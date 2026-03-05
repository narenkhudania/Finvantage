import { withBillingAuth } from './_auth';
import {
  assessReferralAbuseRisk,
  getRequestClientContext,
  nowIso,
  queueBillingMessageEvent,
  recordBillingActivity,
  recordReferralIdentitySignal,
  logBillingErrorEvent,
  verifyRazorpaySignature,
  verifyRazorpaySubscriptionSignature,
} from './_helpers';
import { BILLING_POLICY, USAGE_POINT_EVENTS } from './_config';

type RequestLike = {
  method?: string;
  body?: any;
  headers?: Record<string, string | string[] | undefined>;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (payload: unknown) => void;
};

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const ctx = await withBillingAuth(req, res);
  if (!ctx) return;

  const paymentId = String(req.body?.paymentId || '').trim();
  const orderId = String(req.body?.razorpayOrderId || '').trim();
  const razorpayPaymentId = String(req.body?.razorpayPaymentId || '').trim();
  const razorpaySubscriptionId = String(req.body?.razorpaySubscriptionId || '').trim();
  const signature = String(req.body?.razorpaySignature || '').trim();

  if (!paymentId) {
    res.status(400).json({ error: 'paymentId is required.' });
    return;
  }

  try {
    const clientContext = getRequestClientContext(req);
    const deviceFingerprint = String(req.body?.deviceFingerprint || '').trim();

    const { data: payment, error: paymentError } = await ctx.client
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .eq('user_id', ctx.user.id)
      .maybeSingle();

    if (paymentError || !payment) {
      res.status(404).json({ error: 'Payment record not found.' });
      return;
    }

    const existingSubscriptionId = payment?.metadata?.created_subscription_id
      ? String(payment.metadata.created_subscription_id)
      : '';
    if (existingSubscriptionId && String(payment.status || '').toLowerCase() === 'captured') {
      const { data: existingSub } = await ctx.client
        .from('subscriptions')
        .select('*')
        .eq('id', existingSubscriptionId)
        .eq('user_id', ctx.user.id)
        .maybeSingle();
      if (existingSub) {
        res.status(200).json({
          data: {
            verified: true,
            idempotent: true,
            subscription: {
              id: existingSub.id,
              planCode: existingSub.plan_code,
              status: existingSub.status,
              startAt: existingSub.start_at,
              endAt: existingSub.end_at,
              accessState: existingSub.access_state || 'active',
            },
          },
        });
        return;
      }
    }

    const metadata = (payment.metadata || {}) as Record<string, any>;
    const planCode = String(metadata.plan_code || '');

    if (!planCode) {
      res.status(400).json({ error: 'Invalid payment metadata. Missing plan.' });
      return;
    }

    const { data: billingProfile } = await ctx.client
      .from('user_billing_profiles')
      .select('referred_by_user_id,referred_by_code')
      .eq('user_id', ctx.user.id)
      .maybeSingle();

    await recordReferralIdentitySignal(ctx.client, {
      userId: ctx.user.id,
      eventType: 'payment_verify',
      referralCode: billingProfile?.referred_by_code || null,
      email: ctx.user.email || null,
      ip: clientContext.ip,
      userAgent: clientContext.userAgent,
      deviceFingerprint: deviceFingerprint || null,
      metadata: {
        stage: 'verify_payment',
        payment_id: paymentId,
      },
    }).catch(() => false);

    let forceReferralHold = false;
    let referralRisk: Record<string, unknown> | null = null;
    if (billingProfile?.referred_by_user_id && billingProfile?.referred_by_code) {
      referralRisk = await assessReferralAbuseRisk(ctx.client, {
        referrerUserId: String(billingProfile.referred_by_user_id),
        referredUserId: ctx.user.id,
      });
      forceReferralHold = Boolean(referralRisk.is_high_risk);
      if (forceReferralHold) {
        await ctx.client
          .from('fraud_flags')
          .insert({
            user_id: ctx.user.id,
            flag_type: 'referral_abuse_risk',
            severity: 'high',
            description: 'Referral rewards held for manual review due to identity-signal overlap.',
            rule_id: 'billing_referral_risk_assessment',
            metadata: {
              payment_id: paymentId,
              referral_code: String(billingProfile.referred_by_code || ''),
              referrer_user_id: String(billingProfile.referred_by_user_id || ''),
              risk: referralRisk,
            },
          })
          .catch(() => undefined);
      }
    }

    const effectiveReferrerPoints = forceReferralHold ? 0 : BILLING_POLICY.referralPoints.referrer;
    const effectiveReferredPoints = forceReferralHold ? 0 : BILLING_POLICY.referralPoints.referred;

    if (payment.amount > 0) {
      if (!razorpayPaymentId || !signature || (!orderId && !razorpaySubscriptionId)) {
        res.status(400).json({ error: 'Missing Razorpay checkout fields.' });
        return;
      }
      const signingSecret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET || '';
      if (!signingSecret) {
        throw new Error('Missing RAZORPAY_KEY_SECRET.');
      }
      const valid = razorpaySubscriptionId
        ? verifyRazorpaySubscriptionSignature(razorpayPaymentId, razorpaySubscriptionId, signature, signingSecret)
        : verifyRazorpaySignature(orderId, razorpayPaymentId, signature, signingSecret);
      if (!valid) {
        res.status(400).json({ error: 'Payment signature verification failed.' });
        return;
      }
    }

    const { data: finalizeRaw, error: finalizeError } = await ctx.client.rpc('billing_finalize_payment', {
      p_user_id: ctx.user.id,
      p_payment_id: paymentId,
      p_order_id: orderId || null,
      p_provider_payment_id: razorpayPaymentId || null,
      p_provider_subscription_id: razorpaySubscriptionId || null,
      p_points_expiry_months: BILLING_POLICY.pointsExpiryMonths,
      p_referrer_points: effectiveReferrerPoints,
      p_referred_points: effectiveReferredPoints,
      p_referral_monthly_cap: BILLING_POLICY.referralMonthlyCap,
      p_payment_success_points: USAGE_POINT_EVENTS.subscription_payment_success,
      p_retry_days: BILLING_POLICY.retryDays,
    });

    if (finalizeError) {
      const message = String(finalizeError.message || 'Could not finalize payment transaction.');
      if (message.toLowerCase().includes('billing_finalize_payment')) {
        throw new Error('Billing finalization function is missing. Run the latest DB migration and retry.');
      }
      throw new Error(message);
    }

    const finalize =
      finalizeRaw && typeof finalizeRaw === 'object'
        ? (finalizeRaw as Record<string, any>)
        : {};

    const subscriptionId = String(finalize.subscription_id || '').trim();
    if (!finalize.verified || !subscriptionId) {
      throw new Error('Payment finalization returned an invalid payload.');
    }

    const { data: subRow, error: subError } = await ctx.client
      .from('subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .eq('user_id', ctx.user.id)
      .maybeSingle();
    if (subError || !subRow) throw new Error(subError?.message || 'Subscription row could not be loaded after payment finalization.');

    if (metadata?.renewal_coupon_contract) {
      const mergedMetadata = {
        ...((subRow.metadata && typeof subRow.metadata === 'object') ? subRow.metadata : {}),
        renewal_coupon_contract: metadata.renewal_coupon_contract,
        billing_months: Number(metadata?.billing_months || subRow.metadata?.billing_months || 1),
      };
      await ctx.client
        .from('subscriptions')
        .update({
          metadata: mergedMetadata,
          updated_at: nowIso(),
        })
        .eq('id', subRow.id)
        .eq('user_id', ctx.user.id)
        .catch(() => undefined);
    }

    await ctx.client
      .from('subscription_coupon_reservations')
      .update({
        status: 'consumed',
        consumed_at: nowIso(),
      })
      .eq('payment_id', paymentId)
      .eq('user_id', ctx.user.id)
      .eq('status', 'reserved')
      .catch(() => undefined);

    if (forceReferralHold && billingProfile?.referred_by_user_id) {
      const { data: latestReferralEvent } = await ctx.client
        .from('referral_events')
        .select('id,status,metadata')
        .eq('referred_user_id', ctx.user.id)
        .eq('referrer_user_id', String(billingProfile.referred_by_user_id))
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestReferralEvent?.id) {
        try {
          await ctx.client
            .from('referral_events')
            .update({
              status: 'fraud_hold',
              metadata: {
                ...((latestReferralEvent.metadata as Record<string, unknown>) || {}),
                risk_hold: true,
                risk: referralRisk,
                held_at: nowIso(),
                held_by: 'verify_payment',
              },
            })
            .eq('id', latestReferralEvent.id);
        } catch {
          // best effort hold update; payment finalization should not fail on secondary audit updates.
        }
      }
    }

    const now = nowIso();
    const consumedPoints = Number(finalize.consumed_points || 0);
    await queueBillingMessageEvent(ctx.client, {
      userId: ctx.user.id,
      templateKey: 'billing_payment_success_email',
      channel: 'email',
      payload: {
        payment_id: paymentId,
        plan_code: planCode,
      },
    }).catch(() => false);
    await queueBillingMessageEvent(ctx.client, {
      userId: ctx.user.id,
      templateKey: 'billing_payment_success_in_app',
      channel: 'in_app',
      payload: {
        payment_id: paymentId,
        plan_code: planCode,
      },
      reason: 'in_app_confirmation',
    }).catch(() => false);
    if (!finalize.idempotent) {
      await queueBillingMessageEvent(ctx.client, {
        userId: ctx.user.id,
        templateKey: 'billing_subscription_activated_in_app',
        channel: 'in_app',
        payload: {
          payment_id: paymentId,
          subscription_id: subRow.id,
          plan_code: planCode,
        },
      }).catch(() => false);
    }
    await recordBillingActivity(ctx.client, ctx.user.id, 'billing.verify_payment', {
      payment_id: paymentId,
      subscription_id: subRow.id,
      status: 'captured',
      plan_code: planCode,
      amount_inr: Number(payment.amount || 0),
      consumed_points: consumedPoints,
      idempotent: Boolean(finalize.idempotent),
      referral_reward_hold: forceReferralHold,
      referral_risk: referralRisk,
    }).catch(() => {});

    res.status(200).json({
      data: {
        verified: true,
        subscription: {
          id: subRow.id,
          planCode: subRow.plan_code,
          status: subRow.status,
          startAt: subRow.start_at,
          endAt: subRow.end_at,
          accessState: subRow.access_state || 'active',
        },
      },
    });
  } catch (err) {
    await logBillingErrorEvent(ctx.client, {
      source: 'billing.verify_payment',
      severity: 'critical',
      errorMessage: (err as Error).message || 'Could not verify payment.',
      metadata: {
        user_id: ctx.user.id,
        payment_id: paymentId || null,
      },
    }).catch(() => false);
    res.status(500).json({ error: 'Payment verification failed. Please retry.' });
  }
}
