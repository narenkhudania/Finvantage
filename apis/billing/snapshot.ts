import { withBillingAuth } from './_auth';
import crypto from 'node:crypto';
import {
  activateMigrationTrialIfEligible,
  computePastDueDays,
  computeRetryTimeline,
  computeAccessState,
  ensureBillingProfile,
  getActiveOverrideUntil,
  getActivePlans,
  getAvailablePoints,
  getLatestSubscription,
  getUsagePointEvents,
  nowIso,
} from './_helpers';
import { BILLING_POLICY, PUBLIC_APP_BASE_URL, PUBLIC_TEST_WEBHOOK_BASE, USAGE_POINT_EVENTS } from './_config';

type RequestLike = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (payload: unknown) => void;
};

const resolveLifecycleState = (
  trialActive: boolean,
  subscription: Record<string, any> | null,
  accessState: 'active' | 'limited' | 'blocked',
  pastDueDays: number
): 'trial' | 'active' | 'payment_failed' | 'limited_access' | 'cancelled' | 'expired' => {
  if (trialActive) return 'trial';
  const status = String(subscription?.status || '').toLowerCase();
  if (accessState === 'limited') return 'limited_access';
  if (status === 'past_due' && pastDueDays >= 0 && accessState === 'active') return 'payment_failed';
  if (status === 'cancelled' || status === 'completed') return 'cancelled';
  if (status === 'active') return 'active';
  if (accessState === 'blocked') return 'expired';
  return 'active';
};

const POINTS_EVENT_ORDER = [
  'daily_login',
  'profile_completion',
  'risk_profile_completed',
  'goal_added',
  'report_generated',
  'subscription_payment_success',
] as const;

const entitlementSigningKey =
  process.env.BILLING_ENTITLEMENT_SIGNING_KEY ||
  process.env.RAZORPAY_WEBHOOK_SECRET ||
  '';

const signEntitlement = (params: {
  userId: string;
  now: string;
  accessState: string;
  subscriptionId: string | null;
  subscriptionEndAt: string | null;
}) => {
  if (!entitlementSigningKey) return null;
  const base = [
    params.userId,
    params.now,
    params.accessState,
    params.subscriptionId || '',
    params.subscriptionEndAt || '',
  ].join('|');
  return crypto
    .createHmac('sha256', entitlementSigningKey)
    .update(base)
    .digest('hex');
};

const isRecoverableSnapshotError = (error: unknown) => {
  const text = String((error as { message?: string })?.message || '').toLowerCase();
  return (
    text.includes('relation') ||
    text.includes('does not exist') ||
    text.includes('could not find') ||
    text.includes('schema cache') ||
    text.includes('permission denied') ||
    text.includes('forbidden') ||
    text.includes('billing_referral_signal_salt') ||
    text.includes('missing')
  );
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
    const [
      { data: profileRow },
      seededProfile,
      plans,
      subscription,
      pointsBalance,
      overrideUntil,
      pointsEarnedRes,
      usagePointEvents,
      referralEventsRes,
      referralRewardPointsRes,
    ] = await Promise.all([
      ctx.client
        .from('profiles')
        .select('country')
        .eq('id', ctx.user.id)
        .maybeSingle(),
      ensureBillingProfile(ctx.client, ctx.user.id),
      getActivePlans(ctx.client),
      getLatestSubscription(ctx.client, ctx.user.id),
      getAvailablePoints(ctx.client, ctx.user.id),
      getActiveOverrideUntil(ctx.client, ctx.user.id),
      ctx.client
        .from('reward_points_ledger')
        .select('event_type,points')
        .eq('user_id', ctx.user.id)
        .in('event_type', POINTS_EVENT_ORDER as unknown as string[])
        .gt('points', 0),
      getUsagePointEvents(ctx.client),
      ctx.client
        .from('referral_events')
        .select('id,referrer_user_id,referred_user_id,referral_code,status,metadata,created_at')
        .or(`referrer_user_id.eq.${ctx.user.id},referred_user_id.eq.${ctx.user.id}`)
        .order('created_at', { ascending: false })
        .limit(120),
      ctx.client
        .from('reward_points_ledger')
        .select('event_type,points')
        .eq('user_id', ctx.user.id)
        .in('event_type', ['referral_referrer_reward', 'referral_referred_reward'])
        .gt('points', 0),
    ]);

    if (pointsEarnedRes.error) {
      throw new Error(pointsEarnedRes.error.message || 'Could not load points earned summary.');
    }
    if (referralEventsRes.error) {
      throw new Error(referralEventsRes.error.message || 'Could not load referral event summary.');
    }
    if (referralRewardPointsRes.error) {
      throw new Error(referralRewardPointsRes.error.message || 'Could not load referral reward points summary.');
    }

    const earnedPointsByEvent = (pointsEarnedRes.data || []).reduce<Record<string, number>>((acc, row: any) => {
      const key = String(row.event_type || '');
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + Number(row.points || 0);
      return acc;
    }, {});

    const earnedEvents = POINTS_EVENT_ORDER.map((eventType) => {
      const pointsPerEvent = Number(usagePointEvents[eventType] ?? USAGE_POINT_EVENTS[eventType] ?? 0);
      const earnedPoints = Number(earnedPointsByEvent[eventType] || 0);
      const completionCount = pointsPerEvent > 0
        ? Math.floor(earnedPoints / pointsPerEvent)
        : 0;
      return {
        eventType,
        pointsPerEvent,
        earnedPoints,
        completionCount,
        completed: earnedPoints > 0,
      };
    });

    const referralEvents = Array.isArray(referralEventsRes.data)
      ? (referralEventsRes.data as Array<Record<string, any>>)
      : [];
    const referralPointsRows = Array.isArray(referralRewardPointsRes.data)
      ? (referralRewardPointsRes.data as Array<Record<string, any>>)
      : [];
    const referralAsReferrer = referralEvents.filter((row) => String(row.referrer_user_id || '') === ctx.user.id);
    const referralAsReferred = referralEvents.find((row) => String(row.referred_user_id || '') === ctx.user.id) || null;
    const referralStatusCounts = referralAsReferrer.reduce<Record<string, number>>((acc, row) => {
      const status = String(row.status || '').toLowerCase() || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    const referralPointsAsReferrer = referralPointsRows
      .filter((row) => String(row.event_type || '') === 'referral_referrer_reward')
      .reduce((sum, row) => sum + Math.max(0, Number(row.points || 0)), 0);
    const referralPointsAsReferred = referralPointsRows
      .filter((row) => String(row.event_type || '') === 'referral_referred_reward')
      .reduce((sum, row) => sum + Math.max(0, Number(row.points || 0)), 0);

    const counterpartIds = new Set<string>();
    for (const event of referralEvents) {
      const referrerId = String(event.referrer_user_id || '');
      const referredId = String(event.referred_user_id || '');
      if (referrerId && referrerId !== ctx.user.id) counterpartIds.add(referrerId);
      if (referredId && referredId !== ctx.user.id) counterpartIds.add(referredId);
    }
    if (seededProfile?.referred_by_user_id && String(seededProfile.referred_by_user_id) !== ctx.user.id) {
      counterpartIds.add(String(seededProfile.referred_by_user_id));
    }

    const counterpartProfiles = new Map<string, Record<string, any>>();
    if (counterpartIds.size > 0) {
      const ids = Array.from(counterpartIds);
      const { data: profileRows, error: profileRowsError } = await ctx.client
        .from('profiles')
        .select('id,first_name,last_name,identifier')
        .in('id', ids);
      if (!profileRowsError && Array.isArray(profileRows)) {
        for (const row of profileRows) {
          const key = String((row as Record<string, any>).id || '');
          if (!key) continue;
          counterpartProfiles.set(key, row as Record<string, any>);
        }
      }
    }

    const profile = await activateMigrationTrialIfEligible(
      ctx.client,
      seededProfile,
      BILLING_POLICY.trialDays
    );

    const country = String(profileRow?.country || profile?.country || 'India');
    const baseAccess = computeAccessState(subscription, overrideUntil);
    const trialEnd = profile?.trial_end_at ? String(profile.trial_end_at) : null;
    const trialStart = profile?.trial_started_at ? String(profile.trial_started_at) : null;
    const trialActive = Boolean(trialEnd && new Date(trialEnd).getTime() > Date.now() && !profile?.trial_consumed);
    const trialDaysLeft = trialEnd
      ? Math.max(0, Math.ceil((new Date(trialEnd).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : 0;
    const access = trialActive && baseAccess.accessState === 'blocked'
      ? { accessState: 'active' as const, reason: 'trial_profile_active' }
      : baseAccess;
    const pastDueDays = computePastDueDays(subscription);
    const lifecycleState = resolveLifecycleState(
      trialActive,
      subscription,
      access.accessState,
      pastDueDays
    );
    const referredByUserId = profile?.referred_by_user_id ? String(profile.referred_by_user_id) : null;
    const referredByCounterparty = referredByUserId
      ? counterpartProfiles.get(referredByUserId) || null
      : null;
    const referredByLabel = buildProfileLabel(referredByCounterparty);
    const referredByIdentifier = referredByCounterparty?.identifier
      ? String(referredByCounterparty.identifier)
      : null;
    const referredStatus = referralAsReferred
      ? String(referralAsReferred.status || '')
      : (profile?.referred_by_code ? 'applied_pending_first_paid' : null);
    const referredAt = referralAsReferred?.created_at
      ? String(referralAsReferred.created_at)
      : null;
    const recentReferralEvents = referralEvents.slice(0, 20).map((event) => {
      const role: 'referrer' | 'referred' =
        String(event.referrer_user_id || '') === ctx.user.id ? 'referrer' : 'referred';
      const counterpartUserId = role === 'referrer'
        ? String(event.referred_user_id || '')
        : String(event.referrer_user_id || '');
      const counterpartProfile = counterpartUserId
        ? counterpartProfiles.get(counterpartUserId) || null
        : null;
      return {
        id: String(event.id || ''),
        role,
        referralCode: String(event.referral_code || ''),
        status: String(event.status || ''),
        counterpartUserId: counterpartUserId || null,
        counterpartLabel: buildProfileLabel(counterpartProfile),
        counterpartIdentifier: counterpartProfile?.identifier
          ? String(counterpartProfile.identifier)
          : null,
        counterpartIdentifierMasked: null,
        createdAt: String(event.created_at || nowIso()),
        metadata: (event.metadata && typeof event.metadata === 'object')
          ? event.metadata
          : {},
      };
    });
    const uniqueReferredUsers = new Set(
      referralAsReferrer
        .map((event) => String(event.referred_user_id || ''))
        .filter(Boolean)
    ).size;

    const now = nowIso();
    const entitlementSignature = signEntitlement({
      userId: ctx.user.id,
      now,
      accessState: access.accessState,
      subscriptionId: subscription?.id ? String(subscription.id) : null,
      subscriptionEndAt: subscription?.end_at ? String(subscription.end_at) : null,
    });

    res.status(200).json({
      data: {
        now,
        country,
        currency: 'INR',
        lifecycleState,
        accessState: access.accessState,
        accessReason: access.reason,
        policy: {
          retryDays: BILLING_POLICY.retryDays,
          limitedAfterDays: BILLING_POLICY.limitedAfterDays,
          blockedAfterDays: BILLING_POLICY.blockedAfterDays,
        },
        retryTimeline: computeRetryTimeline(subscription),
        pastDueDays,
        trial: {
          active: trialActive,
          startedAt: trialStart,
          endsAt: trialEnd,
          daysLeft: trialDaysLeft,
          consumed: Boolean(profile?.trial_consumed),
        },
        subscription: subscription
          ? {
              id: subscription.id,
              planCode: subscription.plan_code,
              status: subscription.status,
              amount: Number(subscription.amount || 0),
              currency: subscription.currency || 'INR',
              billingCycle: subscription.billing_cycle || 'monthly',
              startAt: subscription.start_at,
              endAt: subscription.end_at,
              cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
              autoRenew: subscription.auto_renew !== false,
              accessState: subscription.access_state || access.accessState,
            }
          : null,
        plans: plans.map((plan) => ({
          planCode: plan.plan_code,
          displayName: plan.display_name,
          billingMonths: Number(plan.billing_months || 1),
          amountInr: Number(plan.amount_inr || 0),
          taxInclusive: Boolean(plan.tax_inclusive),
          autoRenew: Boolean(plan.auto_renew),
          sortOrder: Number(plan.sort_order || 0),
          metadata: plan.metadata || {},
        })),
        points: {
          balance: pointsBalance,
          frozen: Boolean(profile?.points_frozen),
          pointsToInr: BILLING_POLICY.pointsToRupee,
          formula: 'Points convert to extension days using effective daily plan value.',
          earnedEvents,
        },
        referral: {
          myCode: String(profile.referral_code || ''),
          shareLink: `${PUBLIC_APP_BASE_URL}/pricing?ref=${encodeURIComponent(String(profile.referral_code || ''))}`,
          referredByCode: profile.referred_by_code ? String(profile.referred_by_code) : null,
          referredByUserId,
          referredByLabel,
          referredByIdentifier,
          referredByIdentifierMasked: null,
          referredAt,
          referredStatus,
          monthlyInviteCap: BILLING_POLICY.referralMonthlyCap,
          pointsEarned: {
            asReferrer: referralPointsAsReferrer,
            asReferred: referralPointsAsReferred,
            total: referralPointsAsReferrer + referralPointsAsReferred,
          },
          summary: {
            asReferrer: {
              total: referralAsReferrer.length,
              rewarded: Number(referralStatusCounts.rewarded || 0),
              fraudHold: Number(referralStatusCounts.fraud_hold || 0),
              reversed: Number(referralStatusCounts.reversed || 0),
              pending: Number(referralStatusCounts.pending || 0) + Number(referralStatusCounts.investigating || 0),
              uniqueReferredUsers,
            },
            asReferred: {
              status: referredStatus,
              referralCode: profile.referred_by_code ? String(profile.referred_by_code) : null,
              referrerUserId: referredByUserId,
            },
          },
          recentEvents: recentReferralEvents,
          referralReward: BILLING_POLICY.referralPoints,
        },
        webhookBaseUrl: PUBLIC_TEST_WEBHOOK_BASE,
        entitlementSignature,
      },
    });
  } catch (err) {
    if (!isRecoverableSnapshotError(err)) {
      res.status(500).json({ error: (err as Error).message || 'Could not load billing snapshot.' });
      return;
    }

    const now = nowIso();
    const entitlementSignature = signEntitlement({
      userId: ctx.user.id,
      now,
      accessState: 'active',
      subscriptionId: null,
      subscriptionEndAt: null,
    });

    let usagePointEvents = { ...USAGE_POINT_EVENTS };
    try {
      usagePointEvents = await getUsagePointEvents(ctx.client);
    } catch {
      usagePointEvents = { ...USAGE_POINT_EVENTS };
    }

    const earnedEvents = POINTS_EVENT_ORDER.map((eventType) => ({
      eventType,
      pointsPerEvent: Number(usagePointEvents[eventType] ?? USAGE_POINT_EVENTS[eventType] ?? 0),
      earnedPoints: 0,
      completionCount: 0,
      completed: false,
    }));

    res.status(200).json({
      data: {
        now,
        country: 'India',
        currency: 'INR',
        lifecycleState: 'active',
        accessState: 'active',
        accessReason: 'snapshot_recoverable_fallback',
        policy: {
          retryDays: BILLING_POLICY.retryDays,
          limitedAfterDays: BILLING_POLICY.limitedAfterDays,
          blockedAfterDays: BILLING_POLICY.blockedAfterDays,
        },
        retryTimeline: [],
        pastDueDays: 0,
        trial: {
          active: false,
          startedAt: null,
          endsAt: null,
          daysLeft: 0,
          consumed: true,
        },
        subscription: null,
        plans: [],
        points: {
          balance: 0,
          frozen: false,
          pointsToInr: BILLING_POLICY.pointsToRupee,
          formula: 'Points convert to extension days using effective daily plan value.',
          earnedEvents,
        },
        referral: {
          myCode: '',
          shareLink: `${PUBLIC_APP_BASE_URL}/pricing`,
          referredByCode: null,
          referredByUserId: null,
          referredByLabel: null,
          referredByIdentifier: null,
          referredByIdentifierMasked: null,
          referredAt: null,
          referredStatus: null,
          monthlyInviteCap: BILLING_POLICY.referralMonthlyCap,
          pointsEarned: {
            asReferrer: 0,
            asReferred: 0,
            total: 0,
          },
          summary: {
            asReferrer: {
              total: 0,
              rewarded: 0,
              fraudHold: 0,
              reversed: 0,
              pending: 0,
              uniqueReferredUsers: 0,
            },
            asReferred: {
              status: null,
              referralCode: null,
              referrerUserId: null,
            },
          },
          recentEvents: [],
          referralReward: BILLING_POLICY.referralPoints,
        },
        webhookBaseUrl: PUBLIC_TEST_WEBHOOK_BASE,
        entitlementSignature,
        degraded: true,
      },
    });
  }
}
