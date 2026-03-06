import { withBillingAuth } from './_auth';
import {
  computePastDueDays,
  computeRetryTimeline,
  listBillingHistory,
  nowIso,
} from './_helpers';

type RequestLike = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (payload: unknown) => void;
};

const invoiceFromPayment = (payment: Record<string, any>) => {
  const createdAt = String(payment.created_at || payment.attempted_at || nowIso());
  const stamp = createdAt.slice(0, 10).replace(/-/g, '');
  const suffix = String(payment.id || '').replace(/-/g, '').slice(0, 8).toUpperCase();
  return {
    invoiceNumber: `INV-${stamp}-${suffix}`,
    paymentId: String(payment.id || ''),
    status: String(payment.status || 'pending'),
    amount: Number(payment.amount || 0),
    currency: String(payment.currency || 'INR'),
    issuedAt: createdAt,
    settledAt: payment.settled_at ? String(payment.settled_at) : null,
    description: String(payment?.metadata?.plan_code || 'FinVantage Subscription'),
  };
};

const buildProfileLabel = (profile: Record<string, any> | null) => {
  if (!profile || typeof profile !== 'object') return null;
  const first = String(profile.first_name || '').trim();
  const last = String(profile.last_name || '').trim();
  const full = `${first} ${last}`.trim();
  if (full) return full;
  const identifier = String(profile.identifier || '').trim();
  return identifier || null;
};

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const ctx = await withBillingAuth(req, res);
  if (!ctx) return;

  try {
    const { subscriptions, payments, couponRedemptions, pointsLedger, referralEvents, messageEvents } = await listBillingHistory(ctx.client, ctx.user.id);
    const activeSub = subscriptions.find((row) =>
      ['active', 'trialing', 'past_due'].includes(String(row.status || '').toLowerCase())
    ) || null;

    const invoices = payments
      .filter((row) => ['captured', 'paid', 'succeeded', 'authorized', 'refunded', 'failed', 'pending'].includes(String(row.status || '').toLowerCase()))
      .map(invoiceFromPayment);

    const counterpartIds = Array.from(
      new Set(
        referralEvents.flatMap((row) => {
          const ids: string[] = [];
          const referrer = String(row.referrer_user_id || '');
          const referred = String(row.referred_user_id || '');
          if (referrer && referrer !== ctx.user.id) ids.push(referrer);
          if (referred && referred !== ctx.user.id) ids.push(referred);
          return ids;
        })
      )
    );
    const counterpartMap = new Map<string, Record<string, any>>();
    if (counterpartIds.length > 0) {
      const { data: counterpartProfiles, error: counterpartError } = await ctx.client
        .from('profiles')
        .select('id,first_name,last_name,identifier')
        .in('id', counterpartIds);
      if (!counterpartError && Array.isArray(counterpartProfiles)) {
        for (const row of counterpartProfiles) {
          const key = String((row as Record<string, any>).id || '');
          if (!key) continue;
          counterpartMap.set(key, row as Record<string, any>);
        }
      }
    }

    res.status(200).json({
      data: {
        now: nowIso(),
        activeSubscriptionId: activeSub?.id ? String(activeSub.id) : null,
        retryTimeline: computeRetryTimeline(activeSub),
        pastDueDays: computePastDueDays(activeSub),
        subscriptions: subscriptions.map((row) => ({
          id: String(row.id),
          planCode: String(row.plan_code || ''),
          status: String(row.status || ''),
          amount: Number(row.amount || 0),
          currency: String(row.currency || 'INR'),
          billingCycle: String(row.billing_cycle || 'monthly'),
          startAt: String(row.start_at || ''),
          endAt: row.end_at ? String(row.end_at) : null,
          cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
          autoRenew: row.auto_renew !== false,
          createdAt: String(row.created_at || ''),
          metadata: row.metadata || {},
        })),
        payments: payments.map((row) => ({
          id: String(row.id),
          status: String(row.status || ''),
          amount: Number(row.amount || 0),
          currency: String(row.currency || 'INR'),
          provider: String(row.provider || 'razorpay'),
          providerPaymentId: row.provider_payment_id ? String(row.provider_payment_id) : null,
          providerOrderId: row.provider_order_id ? String(row.provider_order_id) : null,
          attemptedAt: String(row.attempted_at || row.created_at || ''),
          settledAt: row.settled_at ? String(row.settled_at) : null,
          failureReason: row.failure_reason ? String(row.failure_reason) : null,
          couponCode: row.coupon_code ? String(row.coupon_code) : null,
          pointsRedeemed: Number(row.points_redeemed || 0),
          metadata: row.metadata || {},
        })),
        invoices,
        couponRedemptions: couponRedemptions.map((row) => ({
          id: String(row.id),
          couponId: String(row.coupon_id),
          paymentId: row.payment_id ? String(row.payment_id) : null,
          subscriptionId: row.subscription_id ? String(row.subscription_id) : null,
          amountDiscount: Number(row.amount_discount || 0),
          redeemedAt: String(row.redeemed_at || ''),
          metadata: row.metadata || {},
        })),
        pointsLedger: pointsLedger.map((row) => ({
          id: String(row.id),
          eventType: String(row.event_type || ''),
          points: Number(row.points || 0),
          sourceRef: row.source_ref ? String(row.source_ref) : null,
          expiresAt: row.expires_at ? String(row.expires_at) : null,
          createdAt: String(row.created_at || ''),
          metadata: row.metadata || {},
        })),
        referralEvents: referralEvents.map((row) => ({
          id: String(row.id),
          referrerUserId: String(row.referrer_user_id || ''),
          referredUserId: String(row.referred_user_id || ''),
          referralCode: String(row.referral_code || ''),
          status: String(row.status || 'rewarded'),
          role: String(row.referrer_user_id || '') === ctx.user.id ? 'referrer' : 'referred',
          counterpartUserId: String(row.referrer_user_id || '') === ctx.user.id
            ? (row.referred_user_id ? String(row.referred_user_id) : null)
            : (row.referrer_user_id ? String(row.referrer_user_id) : null),
          counterpartLabel: (() => {
            const counterpartUserId = String(row.referrer_user_id || '') === ctx.user.id
              ? String(row.referred_user_id || '')
              : String(row.referrer_user_id || '');
            const profile = counterpartUserId ? counterpartMap.get(counterpartUserId) || null : null;
            return buildProfileLabel(profile);
          })(),
          counterpartIdentifier: (() => {
            const counterpartUserId = String(row.referrer_user_id || '') === ctx.user.id
              ? String(row.referred_user_id || '')
              : String(row.referrer_user_id || '');
            const profile = counterpartUserId ? counterpartMap.get(counterpartUserId) || null : null;
            return profile?.identifier ? String(profile.identifier) : null;
          })(),
          counterpartIdentifierMasked: (() => {
            return null;
          })(),
          metadata: row.metadata || {},
          createdAt: String(row.created_at || ''),
        })),
        messageEvents: messageEvents.map((row) => ({
          id: String(row.id),
          templateKey: String(row.template_key || ''),
          channel: String(row.channel || 'in_app'),
          status: String(row.status || 'queued'),
          payload: row.payload || {},
          reason: row.reason ? String(row.reason) : null,
          createdAt: String(row.created_at || ''),
          sentAt: row.sent_at ? String(row.sent_at) : null,
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || 'Could not load billing history.' });
  }
}
