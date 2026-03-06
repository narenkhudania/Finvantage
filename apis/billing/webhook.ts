import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { BILLING_POLICY } from './_config';
import { nowIso, queueBillingMessageEvent } from './_helpers';
import {
  calculateCouponDiscountRule,
  computeBonusDaysFromCreditValueRule,
} from '../../lib/billingRules.mjs';

type RequestLike = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: any;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (payload: unknown) => void;
};

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  '';

const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  '';
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

if (!webhookSecret) {
  throw new Error('Missing required RAZORPAY_WEBHOOK_SECRET for billing webhook handler.');
}

const readHeader = (headers: Record<string, string | string[] | undefined> | undefined, key: string) => {
  const value = headers?.[key] ?? headers?.[key.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
};

const verifyWebhookSignature = (payloadRaw: string, signature: string, secret: string) => {
  const digest = crypto.createHmac('sha256', secret).update(payloadRaw).digest('hex');
  const digestBuf = Buffer.from(digest, 'hex');
  const signatureBuf = Buffer.from(String(signature || ''), 'hex');
  if (!digestBuf.length || digestBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(digestBuf, signatureBuf);
};

const hashPayload = (value: string) => crypto.createHash('sha256').update(value).digest('hex').slice(0, 20);
const toIsoFromUnix = (value: unknown) => {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return null;
  return new Date(num * 1000).toISOString();
};
const addDaysIso = (iso: string, days: number) => {
  const date = new Date(iso);
  date.setDate(date.getDate() + Math.max(0, days));
  return date.toISOString();
};
const parseBillingMonths = (subscription: Record<string, any> | null | undefined) => {
  const cycle = String(subscription?.billing_cycle || '').toLowerCase();
  const direct = Number(subscription?.metadata?.billing_months || 0);
  if (Number.isFinite(direct) && direct > 0) return Math.round(direct);
  const match = cycle.match(/^(\d+)_month/);
  if (match) return Math.max(1, Number(match[1]));
  if (cycle.includes('annual') || cycle.includes('year')) return 12;
  if (cycle.includes('quarter')) return 3;
  if (cycle.includes('half')) return 6;
  return 1;
};
const mapSubscriptionStatus = (eventType: string, providerStatus?: string | null) => {
  if (eventType === 'subscription.activated' || eventType === 'subscription.charged') return 'active';
  if (eventType === 'subscription.completed') return 'completed';
  if (eventType === 'subscription.cancelled') return 'cancelled';
  if (eventType === 'subscription.paused' || eventType === 'subscription.halted') return 'past_due';
  if (providerStatus) return providerStatus;
  return 'active';
};
const readRawBody = (req: any) => {
  if (typeof req?.body === 'string') return req.body;
  const rawCandidate = req?.rawBody || req?.bodyRaw;
  if (typeof rawCandidate === 'string') return rawCandidate;
  if (rawCandidate && typeof rawCandidate?.toString === 'function') return rawCandidate.toString();
  return JSON.stringify(req?.body || {});
};

const isUniqueViolation = (error: any) => {
  const code = String(error?.code || '');
  return code === '23505';
};

const buildErrorId = () => `BILLING-WH-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

const insertDeadLetter = async (
  client: ReturnType<typeof createClient>,
  params: {
    provider: string;
    eventType: string;
    eventId: string;
    reason: string;
    payload: Record<string, any>;
  }
) => {
  const { error } = await client
    .from('billing_dead_letter_events')
    .insert({
      provider: params.provider,
      event_type: params.eventType,
      event_id: params.eventId,
      reason: params.reason,
      payload: params.payload,
      status: 'pending',
      created_at: nowIso(),
      updated_at: nowIso(),
    });
  if (error) {
    console.error('[billing.webhook.dead_letter] insert failed:', error.message || error);
    return false;
  }
  return true;
};

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    res.status(500).json({ error: 'Server not configured for webhook handling.' });
    return;
  }

  const signature = String(readHeader(req.headers, 'x-razorpay-signature') || '');
  const payloadRaw = readRawBody(req);
  if (!signature || !verifyWebhookSignature(payloadRaw, signature, webhookSecret)) {
    res.status(401).json({ error: 'Invalid webhook signature.' });
    return;
  }

  const payload = typeof req.body === 'object' && req.body ? req.body : JSON.parse(payloadRaw);
  const eventType = String(payload?.event || '');
  const paymentEntity = payload?.payload?.payment?.entity || null;
  const subscriptionEntity = payload?.payload?.subscription?.entity || null;
  const paymentId = paymentEntity?.id ? String(paymentEntity.id) : null;
  const orderId = paymentEntity?.order_id ? String(paymentEntity.order_id) : null;
  const paymentSubscriptionId = paymentEntity?.subscription_id
    ? String(paymentEntity.subscription_id)
    : null;
  const emittedMarker =
    paymentEntity?.created_at ||
    subscriptionEntity?.current_start ||
    subscriptionEntity?.charge_at ||
    payload?.created_at ||
    '';
  const subjectId = paymentId || orderId || String(subscriptionEntity?.id || '') || null;
  const uniqueEventId = `${eventType || 'unknown'}:${subjectId || hashPayload(payloadRaw)}:${String(emittedMarker || 'na')}`;

  const client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let webhookEventId: string | null = null;
  let matchedPayment = false;
  let matchedSubscription = false;
  let unresolvedReason = '';
  let resolvedPayment: Record<string, any> | null = null;
  try {
    const { data: existingEvent } = await client
      .from('webhook_events')
      .select('id,status')
      .eq('provider', 'razorpay')
      .eq('event_id', uniqueEventId)
      .maybeSingle();

    if (existingEvent) {
      res.status(200).json({ ok: true, idempotent: true });
      return;
    }

    const { data: createdEvent, error: createEventError } = await client
      .from('webhook_events')
      .insert({
        provider: 'razorpay',
        event_id: uniqueEventId,
        event_type: eventType || 'unknown',
        status: 'received',
        replay_count: 0,
        received_at: nowIso(),
        payload: payload,
      })
      .select('id')
      .maybeSingle();
    if (createEventError) {
      // Concurrent webhook deliveries can race on unique(event_id).
      // Treat unique violation as already processed/idempotent.
      if (isUniqueViolation(createEventError)) {
        res.status(200).json({ ok: true, idempotent: true });
        return;
      }
      throw createEventError;
    }
    webhookEventId = createdEvent?.id ? String(createdEvent.id) : null;

    if (paymentId || orderId || paymentEntity?.notes?.payment_id) {
      const filterColumn = paymentId ? 'provider_payment_id' : 'provider_order_id';
      const filterValue = paymentId || orderId;
      let payment: Record<string, any> | null = null;
      if (filterValue) {
        const result = await client
          .from('payments')
          .select('*')
          .eq(filterColumn, filterValue)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        payment = (result.data as Record<string, any> | null) || null;
      }

      // Reconciliation fallback 1: provider notes.payment_id from Razorpay.
      if (!payment && paymentEntity?.notes?.payment_id) {
        const paymentIdFromNotes = String(paymentEntity.notes.payment_id || '').trim();
        if (paymentIdFromNotes) {
          const result = await client
            .from('payments')
            .select('*')
            .eq('id', paymentIdFromNotes)
            .limit(1)
            .maybeSingle();
          payment = (result.data as Record<string, any> | null) || null;
        }
      }

      // Reconciliation fallback 2: provider subscription id in payment metadata.
      if (!payment && paymentSubscriptionId) {
        const result = await client
          .from('payments')
          .select('*')
          .contains('metadata', { provider_subscription_id: paymentSubscriptionId })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        payment = (result.data as Record<string, any> | null) || null;
      }

      if (payment) {
        resolvedPayment = payment;
        matchedPayment = true;
        if (eventType === 'payment.failed') {
          const failureTime = nowIso();
          await client
            .from('payments')
            .update({
              status: 'failed',
              failure_reason: paymentEntity?.error_description || paymentEntity?.error_reason || 'Gateway failure',
              metadata: {
                ...(payment.metadata || {}),
                webhook_event: eventType,
                webhook_received_at: failureTime,
              },
            })
            .eq('id', payment.id);

          const { data: activeSubscription } = await client
            .from('subscriptions')
            .select('*')
            .eq('user_id', payment.user_id)
            .in('status', ['active', 'past_due', 'trialing'])
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const nextAttemptCount = Number(activeSubscription?.failed_attempt_count || 0) + 1;
          const nextRetryDay = BILLING_POLICY.retryDays[Math.min(nextAttemptCount - 1, BILLING_POLICY.retryDays.length - 1)] || BILLING_POLICY.retryDays[0];
          const nextRetryAt = addDaysIso(failureTime, nextRetryDay);
          await client
            .from('subscriptions')
            .update({
              status: 'past_due',
              past_due_since: activeSubscription?.past_due_since || failureTime,
              failed_attempt_count: nextAttemptCount,
              next_retry_at: nextRetryAt,
              last_payment_status: 'failed',
              access_state: 'active',
              updated_at: failureTime,
            })
            .eq('user_id', payment.user_id)
            .in('status', ['active', 'past_due']);
          matchedSubscription = true;

          await queueBillingMessageEvent(client, {
            userId: String(payment.user_id),
            templateKey: 'billing_payment_failed_email',
            channel: 'email',
            payload: {
              payment_id: payment.id,
              provider_payment_id: paymentId,
              reason: paymentEntity?.error_description || paymentEntity?.error_reason || 'Gateway failure',
            },
          }).catch(() => false);
          await queueBillingMessageEvent(client, {
            userId: String(payment.user_id),
            templateKey: 'billing_payment_failed_mobile',
            channel: 'mobile',
            payload: {
              payment_id: payment.id,
              provider_payment_id: paymentId,
            },
          }).catch(() => false);
          if (nextAttemptCount >= 3) {
            await queueBillingMessageEvent(client, {
              userId: String(payment.user_id),
              templateKey: 'billing_access_limited_in_app',
              channel: 'in_app',
              payload: {
                payment_id: payment.id,
                next_retry_at: nextRetryAt,
                failed_attempt_count: nextAttemptCount,
              },
            }).catch(() => false);
          }
        }

        if (eventType === 'payment.captured' || eventType === 'subscription.charged') {
          const capturedAt = nowIso();
          await client
            .from('payments')
            .update({
              status: 'captured',
              settled_at: capturedAt,
              metadata: {
                ...(payment.metadata || {}),
                webhook_event: eventType,
                webhook_received_at: capturedAt,
              },
            })
            .eq('id', payment.id);

          await client
            .from('subscriptions')
            .update({
              status: 'active',
              access_state: 'active',
              last_payment_status: 'captured',
              failed_attempt_count: 0,
              past_due_since: null,
              next_retry_at: null,
              updated_at: capturedAt,
            })
            .eq('user_id', payment.user_id)
            .in('status', ['active', 'past_due', 'trialing']);
          matchedSubscription = true;

          await client
            .from('subscription_coupon_reservations')
            .update({
              status: 'consumed',
              consumed_at: capturedAt,
            })
            .eq('payment_id', payment.id)
            .eq('status', 'reserved')
            .catch(() => undefined);
        }
      } else if (eventType === 'payment.failed' && paymentSubscriptionId) {
        // If no payment row matched, still transition lifecycle using provider subscription id.
        const failureTime = nowIso();
        const { data: targetSubscription } = await client
          .from('subscriptions')
          .select('*')
          .eq('provider_subscription_id', paymentSubscriptionId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (targetSubscription?.id) {
          const nextAttemptCount = Number(targetSubscription.failed_attempt_count || 0) + 1;
          const nextRetryDay =
            BILLING_POLICY.retryDays[
              Math.min(nextAttemptCount - 1, BILLING_POLICY.retryDays.length - 1)
            ] || BILLING_POLICY.retryDays[0];
          const nextRetryAt = addDaysIso(failureTime, nextRetryDay);
          await client
            .from('subscriptions')
            .update({
              status: 'past_due',
              past_due_since: targetSubscription.past_due_since || failureTime,
              failed_attempt_count: nextAttemptCount,
              next_retry_at: nextRetryAt,
              last_payment_status: 'failed',
              access_state: 'active',
              updated_at: failureTime,
            })
            .eq('id', targetSubscription.id);
          matchedSubscription = true;
        } else {
          unresolvedReason = 'payment_event_unmatched';
        }
      }
    }

    const providerSubscriptionId = subscriptionEntity?.id ? String(subscriptionEntity.id) : null;
    if (providerSubscriptionId && eventType.startsWith('subscription.')) {
      const status = mapSubscriptionStatus(eventType, subscriptionEntity?.status ? String(subscriptionEntity.status) : null);
      const currentStart = toIsoFromUnix(subscriptionEntity?.current_start);
      const currentEnd = toIsoFromUnix(subscriptionEntity?.current_end);
      const endedAt = toIsoFromUnix(subscriptionEntity?.ended_at);
      const now = nowIso();

      const { data: existingSub } = await client
        .from('subscriptions')
        .select('*')
        .eq('provider_subscription_id', providerSubscriptionId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const patch = {
        status,
        provider: 'razorpay',
        provider_subscription_id: providerSubscriptionId,
        provider_customer_id: subscriptionEntity?.customer_id ? String(subscriptionEntity.customer_id) : (existingSub?.provider_customer_id || null),
        provider_plan_id: subscriptionEntity?.plan_id ? String(subscriptionEntity.plan_id) : (existingSub?.provider_plan_id || null),
        current_period_start: currentStart || existingSub?.current_period_start || null,
        current_period_end: currentEnd || existingSub?.current_period_end || null,
        start_at: currentStart || existingSub?.start_at || now,
        end_at: currentEnd || endedAt || existingSub?.end_at || null,
        cancel_at_period_end: ['cancelled', 'completed'].includes(status) ? true : Boolean(existingSub?.cancel_at_period_end),
        auto_renew: !['cancelled', 'completed'].includes(status),
        access_state: ['active', 'trialing', 'past_due'].includes(status) ? 'active' : 'blocked',
        last_payment_status: status === 'active' ? 'captured' : (existingSub?.last_payment_status || null),
        metadata: {
          ...(existingSub?.metadata || {}),
          provider_subscription_status: subscriptionEntity?.status || status,
          webhook_event: eventType,
          webhook_received_at: now,
        },
        updated_at: now,
      };

      if (existingSub?.id) {
        const metadata = (existingSub.metadata && typeof existingSub.metadata === 'object')
          ? (existingSub.metadata as Record<string, any>)
          : {};
        let renewalBonusDays = 0;
        let renewalCouponDiscount = 0;
        const renewalCouponContract =
          metadata.renewal_coupon_contract && typeof metadata.renewal_coupon_contract === 'object'
            ? (metadata.renewal_coupon_contract as Record<string, any>)
            : null;
        if (eventType === 'subscription.charged' && renewalCouponContract) {
          const recurringAllowed = renewalCouponContract.recurring_allowed !== false;
          const validUntil = renewalCouponContract.valid_until
            ? new Date(String(renewalCouponContract.valid_until)).getTime()
            : null;
          const isValid = !validUntil || validUntil >= Date.now();
          if (recurringAllowed && isValid) {
            const baseAmount = Number(existingSub.amount || 0);
            renewalCouponDiscount = calculateCouponDiscountRule(baseAmount, renewalCouponContract);
            const months = parseBillingMonths(existingSub);
            renewalBonusDays = computeBonusDaysFromCreditValueRule(
              renewalCouponDiscount,
              baseAmount,
              months
            );
          }
        }

        const nextEndAt = renewalBonusDays > 0
          ? addDaysIso(currentEnd || existingSub.end_at || now, renewalBonusDays)
          : (currentEnd || existingSub.end_at || null);
        await client
          .from('subscriptions')
          .update({
            ...patch,
            end_at: nextEndAt,
            current_period_end: nextEndAt,
            metadata: {
              ...metadata,
              ...(patch.metadata || {}),
              renewal_coupon_discount: renewalCouponDiscount,
              renewal_bonus_days: renewalBonusDays,
            },
          })
          .eq('id', existingSub.id);
        matchedSubscription = true;

        if (renewalBonusDays > 0 && renewalCouponDiscount > 0 && resolvedPayment?.id) {
          await client
            .from('subscription_coupon_redemptions')
            .insert({
              coupon_id: renewalCouponContract?.coupon_id || null,
              user_id: existingSub.user_id,
              payment_id: resolvedPayment.id,
              subscription_id: existingSub.id,
              amount_discount: renewalCouponDiscount,
              metadata: {
                source: 'renewal',
                provider_event: eventType,
              },
              redeemed_at: now,
              created_at: now,
            })
            .catch(() => undefined);
        }
      } else {
        const userIdFromNotes = subscriptionEntity?.notes?.user_id ? String(subscriptionEntity.notes.user_id) : null;
        if (userIdFromNotes) {
          await client
            .from('subscriptions')
            .insert({
              user_id: userIdFromNotes,
              plan_code: String(subscriptionEntity?.plan_id || 'starter_monthly_99'),
              status,
              billing_cycle: 'monthly',
              amount: 0,
              currency: 'INR',
              provider: 'razorpay',
              provider_subscription_id: providerSubscriptionId,
              provider_customer_id: subscriptionEntity?.customer_id ? String(subscriptionEntity.customer_id) : null,
              provider_plan_id: subscriptionEntity?.plan_id ? String(subscriptionEntity.plan_id) : null,
              current_period_start: currentStart || null,
              current_period_end: currentEnd || null,
              start_at: currentStart || now,
              end_at: currentEnd || endedAt || null,
              cancel_at_period_end: ['cancelled', 'completed'].includes(status),
              auto_renew: !['cancelled', 'completed'].includes(status),
              access_state: ['active', 'trialing', 'past_due'].includes(status) ? 'active' : 'blocked',
              metadata: {
                provider_subscription_status: subscriptionEntity?.status || status,
                webhook_event: eventType,
                webhook_received_at: now,
              },
              created_at: now,
              updated_at: now,
            });
          matchedSubscription = true;
        } else {
          unresolvedReason = unresolvedReason || 'subscription_event_unmatched';
        }
      }
    }

    if (!matchedPayment && !matchedSubscription && unresolvedReason) {
      await insertDeadLetter(client, {
        provider: 'razorpay',
        eventType: eventType || 'unknown',
        eventId: uniqueEventId,
        reason: unresolvedReason,
        payload,
      });
    }

    if (webhookEventId) {
      await client
        .from('webhook_events')
        .update({
          status: 'processed',
          processed_at: nowIso(),
        })
        .eq('id', webhookEventId);
    }
    res.status(200).json({ ok: true });
    return;
  } catch (err) {
    const errorId = buildErrorId();
    if (webhookEventId) {
      await client
        .from('webhook_events')
        .update({
          status: 'failed',
          processed_at: nowIso(),
          error_message: `[${errorId}] ${(err as Error).message || 'Webhook processing failed.'}`,
        })
        .eq('id', webhookEventId);
    }
    await insertDeadLetter(client, {
      provider: 'razorpay',
      eventType: eventType || 'unknown',
      eventId: uniqueEventId,
      reason: 'handler_exception',
      payload: {
        payload,
        errorId,
        errorMessage: (err as Error).message || 'Webhook processing failed.',
      },
    });
    await client
      .from('billing_error_events')
      .insert({
        source: 'billing.webhook',
        severity: 'critical',
        error_code: errorId,
        error_message: (err as Error).message || 'Webhook processing failed.',
        metadata: {
          event_type: eventType || 'unknown',
          event_id: uniqueEventId,
        },
        created_at: nowIso(),
      })
      .catch(() => undefined);
    // Return non-2xx so Razorpay retries transient failures.
    res.status(500).json({
      error: 'Webhook processing failed.',
      errorId,
      retryable: true,
    });
    return;
  }
}
