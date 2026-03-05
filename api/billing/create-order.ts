import { withBillingAuth } from './_auth';
import {
  assessReferralAbuseRisk,
  calculateCouponDiscount,
  computeBonusDaysFromPoints,
  createRazorpayOrder,
  createRazorpaySubscription,
  ensureBillingProfile,
  getAvailablePoints,
  getReferrerRewardCountForCurrentMonth,
  getRequestClientContext,
  getLatestSubscription,
  isPointsFrozenForUser,
  isUpgradeAllowed,
  getPlanByCode,
  nowIso,
  recordReferralIdentitySignal,
  queueBillingMessageEvent,
  recordBillingActivity,
  logBillingErrorEvent,
} from './_helpers';
import { BILLING_POLICY, PLAN_MONTHS } from './_config';
import { resolveCheckoutModeRule } from '../../lib/billingCheckout.mjs';

type RequestLike = {
  method?: string;
  body?: any;
  headers?: Record<string, string | string[] | undefined>;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (payload: unknown) => void;
};

const normalizeCouponCode = (value: unknown) => String(value || '').trim().toUpperCase();
const parseBillingMonthsFromCycle = (value: unknown) => {
  const cycle = String(value || '').toLowerCase();
  const match = cycle.match(/^(\d+)_month/);
  if (match) return Math.max(1, Number(match[1]));
  if (cycle.includes('annual') || cycle.includes('year')) return 12;
  if (cycle.includes('quarter')) return 3;
  if (cycle.includes('half')) return 6;
  return 1;
};

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const ctx = await withBillingAuth(req, res);
  if (!ctx) return;

  const planCode = String(req.body?.planCode || '').trim();
  const couponCode = normalizeCouponCode(req.body?.couponCode);
  const referralCode = normalizeCouponCode(req.body?.referralCode);
  const pointsRequested = Math.max(0, Math.floor(Number(req.body?.pointsToRedeem || 0)));

  if (!planCode) {
    res.status(400).json({ error: 'planCode is required.' });
    return;
  }

  try {
    const clientContext = getRequestClientContext(req);
    const deviceFingerprint = String(req.body?.deviceFingerprint || '').trim();

    const [plan, profile, availablePoints, currentSub, pointsFrozen] = await Promise.all([
      getPlanByCode(ctx.client, planCode),
      ensureBillingProfile(ctx.client, ctx.user.id),
      getAvailablePoints(ctx.client, ctx.user.id),
      getLatestSubscription(ctx.client, ctx.user.id),
      isPointsFrozenForUser(ctx.client, ctx.user.id),
    ]);

    if (!plan) {
      res.status(404).json({ error: 'Selected plan is not available.' });
      return;
    }

    // Upgrade-only policy: prevent moving to lower monthly equivalent if an active paid plan exists.
    if (currentSub && ['active', 'trialing', 'past_due'].includes(String(currentSub.status || '').toLowerCase())) {
      const currentIsPaid = Number(currentSub.amount || 0) > 0;
      const currentMonths =
        parseBillingMonthsFromCycle(currentSub.billing_cycle) ||
        PLAN_MONTHS[String(currentSub.plan_code || '')] ||
        Number(currentSub.metadata?.billing_months || 1) ||
        1;
      const allowed = isUpgradeAllowed({
        currentAmount: Number(currentSub.amount || 0),
        currentMonths,
        targetAmount: Number(plan.amount_inr || 0),
        targetMonths: Number(plan.billing_months || 1),
        currentIsPaid,
      });
      if (!allowed) {
        res.status(400).json({ error: 'Downgrades are disabled. Only upgrades are allowed.' });
        return;
      }
    }

    // Referral code attachment before first successful paid subscription.
    if (referralCode && !profile.referred_by_code) {
      const { data: refProfile, error: refError } = await ctx.client
        .from('user_billing_profiles')
        .select('user_id, referral_code')
        .eq('referral_code', referralCode)
        .maybeSingle();

      if (refError || !refProfile) {
        res.status(400).json({ error: 'Invalid referral code.' });
        return;
      }

      if (String(refProfile.user_id) === ctx.user.id) {
        res.status(400).json({ error: 'Self-referral is not allowed.' });
        return;
      }

      await recordReferralIdentitySignal(ctx.client, {
        userId: ctx.user.id,
        eventType: 'checkout_referral',
        referralCode,
        email: ctx.user.email || null,
        ip: clientContext.ip,
        userAgent: clientContext.userAgent,
        deviceFingerprint: deviceFingerprint || null,
        metadata: {
          stage: 'create_order',
          plan_code: planCode,
        },
      }).catch(() => false);

      const risk = await assessReferralAbuseRisk(ctx.client, {
        referrerUserId: String(refProfile.user_id),
        referredUserId: ctx.user.id,
      });
      if (risk.is_high_risk) {
        await recordBillingActivity(ctx.client, ctx.user.id, 'billing.referral_blocked_risk', {
          referral_code: referralCode,
          referrer_user_id: String(refProfile.user_id),
          stage: 'create_order',
          risk,
        }).catch(() => undefined);
        res.status(400).json({
          error: 'Referral code cannot be applied automatically due to risk checks. Contact support for review.',
        });
        return;
      }

      const referralCount = await getReferrerRewardCountForCurrentMonth(
        ctx.client,
        String(refProfile.user_id)
      );
      if (referralCount >= BILLING_POLICY.referralMonthlyCap) {
        res.status(400).json({ error: 'Referral code has reached monthly reward capacity.' });
        return;
      }

      const { error: referralLinkError } = await ctx.client
        .from('user_billing_profiles')
        .update({
          referred_by_code: referralCode,
          referred_by_user_id: refProfile.user_id,
          updated_at: nowIso(),
        })
        .eq('user_id', ctx.user.id);
      if (referralLinkError) {
        throw new Error(referralLinkError.message || 'Could not apply referral code.');
      }

      await recordBillingActivity(ctx.client, ctx.user.id, 'billing.referral_applied', {
        referral_code: referralCode,
        referrer_user_id: String(refProfile.user_id),
        stage: 'create_order',
        risk,
      }).catch(() => undefined);
    }

    const amountInr = Number(plan.amount_inr || 0);
    const pointsToRedeem = pointsFrozen ? 0 : Math.max(0, Math.min(pointsRequested, availablePoints));
    const pointsBonusDays = computeBonusDaysFromPoints(
      pointsToRedeem,
      Number(plan.amount_inr || 0),
      Number(plan.billing_months || 1),
      BILLING_POLICY.pointsToRupee
    );
    let couponId: string | null = null;
    let couponDiscountPreview = 0;
    let couponContract: Record<string, unknown> | null = null;
    let couponBonusDays = 0;
    let bonusDays = Math.max(0, Math.floor(pointsBonusDays));

    const { data: paymentRow, error: paymentError } = await ctx.client
      .from('payments')
      .insert({
        user_id: ctx.user.id,
        provider: 'razorpay',
        status: amountInr > 0 ? 'created' : 'captured',
        amount: amountInr,
        currency: 'INR',
        coupon_code: couponCode || null,
        points_redeemed: pointsToRedeem,
        metadata: {
          plan_code: planCode,
          billing_months: Number(plan.billing_months || 1),
          provider_plan_id: (plan as any).provider_plan_id || (plan as any).metadata?.provider_plan_id || null,
          coupon_id: couponId,
          coupon_discount: couponDiscountPreview,
          renewal_coupon_contract: couponContract,
          points_redeemed: pointsToRedeem,
          points_bonus_days: pointsBonusDays,
          coupon_bonus_days: couponBonusDays,
          bonus_days: bonusDays,
          points_frozen: pointsFrozen,
          dashboard_paywall: BILLING_POLICY.dashboardPaywall,
        },
      })
      .select('*')
      .maybeSingle();

    if (paymentError || !paymentRow) {
      throw new Error(paymentError?.message || 'Could not create payment ledger row.');
    }

    if (couponCode) {
      const { data: reservedRaw, error: reserveError } = await ctx.client.rpc(
        'billing_reserve_coupon_for_payment',
        {
          p_user_id: ctx.user.id,
          p_coupon_code: couponCode,
          p_plan_code: planCode,
          p_payment_id: paymentRow.id,
          p_amount: amountInr,
        }
      );

      if (reserveError) {
        const message = String(reserveError.message || '').toLowerCase();
        if (!message.includes('does not exist')) {
          throw new Error(reserveError.message || 'Could not reserve coupon.');
        }
        const { data: coupon, error: couponError } = await ctx.client
          .from('subscription_coupons')
          .select('*')
          .eq('code', couponCode)
          .eq('is_active', true)
          .maybeSingle();
        if (couponError || !coupon) {
          throw new Error('Invalid coupon code.');
        }
        couponId = String(coupon.id);
        couponDiscountPreview = calculateCouponDiscount(amountInr, coupon);
        couponContract = {
          coupon_id: String(coupon.id),
          code: String(coupon.code || couponCode),
          discount_type: String(coupon.discount_type || 'percentage'),
          discount_value: Number(coupon.discount_value || 0),
          max_discount_amount: coupon.max_discount_amount != null ? Number(coupon.max_discount_amount) : null,
          recurring_allowed: coupon.recurring_allowed !== false,
          valid_until: coupon.valid_until ? String(coupon.valid_until) : null,
          applies_to_plan_codes: Array.isArray(coupon.applies_to_plan_codes) ? coupon.applies_to_plan_codes : [],
        };
      } else {
        const reserved = reservedRaw && typeof reservedRaw === 'object'
          ? (reservedRaw as Record<string, any>)
          : {};
        if (!reserved.ok) {
          const reason = String(reserved.reason || '').toLowerCase();
          const reasonMap: Record<string, string> = {
            invalid_coupon: 'Invalid coupon code.',
            not_started: 'Coupon is not active yet.',
            expired: 'Coupon expired.',
            plan_not_eligible: 'Coupon is not applicable for this plan.',
            usage_limit_total_reached: 'Coupon usage limit reached.',
            usage_limit_per_user_reached: 'You have exhausted usage for this coupon.',
          };
          throw new Error(reasonMap[reason] || 'Coupon is not applicable.');
        }
        couponId = reserved.coupon_id ? String(reserved.coupon_id) : null;
        couponDiscountPreview = Number(reserved.discount || 0);
        couponContract = {
          coupon_id: couponId,
          code: String(reserved.code || couponCode),
          discount_type: String(reserved.discount_type || 'percentage'),
          discount_value: Number(reserved.discount_value || 0),
          max_discount_amount: reserved.max_discount_amount != null ? Number(reserved.max_discount_amount) : null,
          recurring_allowed: reserved.recurring_allowed !== false,
          valid_until: reserved.valid_until ? String(reserved.valid_until) : null,
          applies_to_plan_codes: Array.isArray(reserved.applies_to_plan_codes) ? reserved.applies_to_plan_codes : [],
        };
      }

      couponBonusDays = couponDiscountPreview > 0
        ? computeBonusDaysFromPoints(
            couponDiscountPreview / Math.max(1, BILLING_POLICY.pointsToRupee),
            Number(plan.amount_inr || 0),
            Number(plan.billing_months || 1),
            BILLING_POLICY.pointsToRupee
          )
        : 0;
      bonusDays = Math.max(0, Math.floor(pointsBonusDays + couponBonusDays));

      await ctx.client
        .from('payments')
        .update({
          metadata: {
            ...(paymentRow.metadata || {}),
            coupon_id: couponId,
            coupon_discount: couponDiscountPreview,
            renewal_coupon_contract: couponContract,
            coupon_bonus_days: couponBonusDays,
            bonus_days: bonusDays,
          },
        })
        .eq('id', paymentRow.id);
    }

    await recordBillingActivity(ctx.client, ctx.user.id, 'billing.create_order', {
      payment_id: paymentRow.id,
      plan_code: planCode,
      amount_inr: amountInr,
      coupon_code: couponCode || null,
      coupon_discount_preview: couponDiscountPreview,
      points_requested: pointsToRedeem,
      bonus_days: bonusDays,
    }).catch(() => {});
    await queueBillingMessageEvent(ctx.client, {
      userId: ctx.user.id,
      templateKey: 'billing_payment_initiated_email',
      channel: 'email',
      payload: {
        plan_code: planCode,
        amount_inr: amountInr,
        payment_id: paymentRow.id,
      },
    }).catch(() => false);

    const providerPlanId = String((plan as any).provider_plan_id || (plan as any).metadata?.provider_plan_id || '').trim();
    const checkoutMode = resolveCheckoutModeRule({ amountInr, providerPlanId });

    // Free plans (if any) bypass gateway.
    if (checkoutMode === 'zero_amount') {
      res.status(200).json({
        data: {
          mode: 'zero_amount',
          paymentId: paymentRow.id,
          planCode,
          amountInr,
          couponDiscount: couponDiscountPreview,
          pointsToRedeem,
          bonusDays,
        },
      });
      return;
    }

    if (checkoutMode === 'razorpay_subscription') {
      const subscription = await createRazorpaySubscription({
        providerPlanId,
        customerNotify: true,
        totalCount: 120,
        notes: {
          payment_id: String(paymentRow.id),
          user_id: ctx.user.id,
          plan_code: planCode,
        },
      });
      await ctx.client
        .from('payments')
        .update({
          metadata: {
            ...(paymentRow.metadata || {}),
            provider_subscription_id: subscription.id,
            provider_plan_id: providerPlanId,
          },
        })
        .eq('id', paymentRow.id);

      const publicKey = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || '';
      if (!publicKey) throw new Error('Missing RAZORPAY_KEY_ID (public key).');
      res.status(200).json({
        data: {
          mode: 'razorpay_subscription',
          paymentId: paymentRow.id,
          subscriptionId: subscription.id,
          keyId: publicKey,
          amountInr,
          currency: 'INR',
          planCode,
          billingMonths: Number(plan.billing_months || 1),
          couponDiscount: couponDiscountPreview,
          pointsToRedeem,
          bonusDays,
        },
      });
      return;
    }

    const order = await createRazorpayOrder({
      amountInr,
      receipt: `finv-${String(paymentRow.id).slice(0, 10)}`,
      notes: {
        payment_id: String(paymentRow.id),
        user_id: ctx.user.id,
        plan_code: planCode,
      },
    });

    await ctx.client
      .from('payments')
      .update({
        provider_order_id: order.id,
        metadata: {
          ...(paymentRow.metadata || {}),
          provider_order_status: order.status,
          provider_order_created_at: order.created_at,
        },
      })
      .eq('id', paymentRow.id);

    const publicKey = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || '';
    if (!publicKey) throw new Error('Missing RAZORPAY_KEY_ID (public key).');

    res.status(200).json({
      data: {
        mode: 'razorpay_order',
        paymentId: paymentRow.id,
        orderId: order.id,
        keyId: publicKey,
        amountInr,
        amountMinor: order.amount,
        currency: order.currency,
        planCode,
        billingMonths: Number(plan.billing_months || 1),
        couponDiscount: couponDiscountPreview,
        pointsToRedeem,
        bonusDays,
      },
    });
  } catch (err) {
    const rawMessage = (err as Error).message || 'Could not create checkout order.';
    const normalized = String(rawMessage).toLowerCase();
    const isConfigError =
      normalized.includes('missing supabase_url') ||
      normalized.includes('supabase_service_role_key') ||
      normalized.includes('missing razorpay_key_id') ||
      normalized.includes('missing razorpay_key_secret') ||
      normalized.includes('server misconfiguration');

    await logBillingErrorEvent(ctx.client, {
      source: 'billing.create_order',
      severity: 'error',
      errorMessage: rawMessage,
      metadata: {
        user_id: ctx.user.id,
        plan_code: planCode,
      },
    }).catch(() => false);

    if (isConfigError) {
      res.status(503).json({
        error: 'Checkout backend configuration is incomplete. Please contact support.',
        code: 'BILLING_BACKEND_CONFIG_MISSING',
      });
      return;
    }

    res.status(500).json({ error: 'Checkout could not be initialized. Please retry.' });
  }
}
