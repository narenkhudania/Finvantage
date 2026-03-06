import { supabase } from './supabase';
import { getClientDeviceFingerprint } from './deviceFingerprint';

export type BillingAccessState = 'active' | 'limited' | 'blocked';
export type BillingLifecycleState =
  | 'trial'
  | 'active'
  | 'payment_failed'
  | 'limited_access'
  | 'cancelled'
  | 'expired';

export interface BillingPlan {
  planCode: string;
  displayName: string;
  billingMonths: number;
  amountInr: number;
  taxInclusive: boolean;
  autoRenew: boolean;
  sortOrder: number;
  metadata: Record<string, unknown>;
}

export interface PublicBillingPlansResponse {
  plans: BillingPlan[];
  lastUpdatedAt: string | null;
}

export interface BillingSnapshot {
  now: string;
  country: string;
  currency: string;
  lifecycleState: BillingLifecycleState;
  accessState: BillingAccessState;
  accessReason: string;
  policy: {
    retryDays: number[];
    limitedAfterDays: number;
    blockedAfterDays: number;
  };
  retryTimeline: Array<{
    day: number;
    scheduledAt: string;
    elapsed: boolean;
  }>;
  pastDueDays: number;
  trial: {
    active: boolean;
    startedAt: string | null;
    endsAt: string | null;
    daysLeft: number;
    consumed: boolean;
  };
  subscription: {
    id: string;
    planCode: string;
    status: string;
    amount: number;
    currency: string;
    billingCycle: string;
    startAt: string;
    endAt: string | null;
    cancelAtPeriodEnd: boolean;
    autoRenew: boolean;
    accessState: BillingAccessState;
  } | null;
  plans: BillingPlan[];
  points: {
    balance: number;
    frozen?: boolean;
    pointsToInr: number;
    formula: string;
    earnedEvents?: Array<{
      eventType: string;
      pointsPerEvent: number;
      earnedPoints: number;
      completionCount: number;
      completed: boolean;
    }>;
  };
  referral: {
    myCode: string;
    shareLink?: string;
    referredByCode: string | null;
    referredByUserId?: string | null;
    referredByLabel?: string | null;
    referredByIdentifier?: string | null;
    referredByIdentifierMasked?: string | null;
    referredAt?: string | null;
    referredStatus?: string | null;
    monthlyInviteCap?: number;
    pointsEarned?: {
      asReferrer: number;
      asReferred: number;
      total: number;
    };
    summary?: {
      asReferrer: {
        total: number;
        rewarded: number;
        fraudHold: number;
        reversed: number;
        pending: number;
        uniqueReferredUsers: number;
      };
      asReferred: {
        status: string | null;
        referralCode: string | null;
        referrerUserId: string | null;
      };
    };
    recentEvents?: Array<{
      id: string;
      role: 'referrer' | 'referred';
      referralCode: string;
      status: string;
      counterpartUserId: string | null;
      counterpartLabel?: string | null;
      counterpartIdentifier?: string | null;
      counterpartIdentifierMasked?: string | null;
      createdAt: string;
      metadata: Record<string, unknown>;
    }>;
    referralReward: {
      referrer: number;
      referred: number;
    };
  };
  webhookBaseUrl: string;
  entitlementSignature?: string | null;
}

export interface BillingHistoryResponse {
  now: string;
  activeSubscriptionId: string | null;
  retryTimeline: Array<{
    day: number;
    scheduledAt: string;
    elapsed: boolean;
  }>;
  pastDueDays: number;
  subscriptions: Array<{
    id: string;
    planCode: string;
    status: string;
    amount: number;
    currency: string;
    billingCycle: string;
    startAt: string;
    endAt: string | null;
    cancelAtPeriodEnd: boolean;
    autoRenew: boolean;
    createdAt: string;
    metadata: Record<string, unknown>;
  }>;
  payments: Array<{
    id: string;
    status: string;
    amount: number;
    currency: string;
    provider: string;
    providerPaymentId: string | null;
    providerOrderId: string | null;
    attemptedAt: string;
    settledAt: string | null;
    failureReason: string | null;
    couponCode: string | null;
    pointsRedeemed: number;
    metadata: Record<string, unknown>;
  }>;
  invoices: Array<{
    invoiceNumber: string;
    paymentId: string;
    status: string;
    amount: number;
    currency: string;
    issuedAt: string;
    settledAt: string | null;
    description: string;
  }>;
  couponRedemptions: Array<{
    id: string;
    couponId: string;
    paymentId: string | null;
    subscriptionId: string | null;
    amountDiscount: number;
    redeemedAt: string;
    metadata: Record<string, unknown>;
  }>;
  pointsLedger: Array<{
    id: string;
    eventType: string;
    points: number;
    sourceRef: string | null;
    expiresAt: string | null;
    createdAt: string;
    metadata: Record<string, unknown>;
  }>;
  referralEvents: Array<{
    id: string;
    referrerUserId: string;
    referredUserId: string;
    referralCode: string;
    status: string;
    role?: 'referrer' | 'referred';
    counterpartUserId?: string | null;
    counterpartLabel?: string | null;
    counterpartIdentifier?: string | null;
    counterpartIdentifierMasked?: string | null;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>;
  messageEvents: Array<{
    id: string;
    templateKey: string;
    channel: string;
    status: string;
    payload: Record<string, unknown>;
    reason: string | null;
    createdAt: string;
    sentAt: string | null;
  }>;
}

const CLIENT_USAGE_POINT_EVENTS: Record<string, number> = {
  daily_login: 10,
  profile_completion: 20,
  risk_profile_completed: 10,
  goal_added: 20,
  report_generated: 10,
  subscription_payment_success: 30,
};

const POINTS_EVENT_ORDER: Array<keyof typeof CLIENT_USAGE_POINT_EVENTS> = [
  'daily_login',
  'profile_completion',
  'risk_profile_completed',
  'goal_added',
  'report_generated',
  'subscription_payment_success',
];

const BILLING_API_UNAVAILABLE_MESSAGE =
  'Billing service is temporarily unavailable. Please retry in a moment.';

const PRICING_API_UNAVAILABLE_MESSAGE =
  'Pricing service is temporarily unavailable. Please retry in a moment.';

const CLIENT_POLICY = {
  retryDays: [1, 3, 5],
  limitedAfterDays: 5,
  blockedAfterDays: 10,
  pointsMonthlyCap: 1000,
  pointsToInr: 1,
  pointsExpiryMonths: 12,
  referralMonthlyCap: 100,
  referralReward: { referrer: 25, referred: 50 },
};

type ServerBillingPolicy = {
  retryDays: number[];
  limitedAfterDays: number;
  blockedAfterDays: number;
  pointsMonthlyCap: number;
  pointsToRupee: number;
  pointsExpiryMonths: number;
  referralMonthlyCap: number;
  referralReward: { referrer: number; referred: number };
  usagePointEvents: Record<string, number>;
};

type CheckoutOrderRequest = {
  planCode: string;
  couponCode?: string;
  referralCode?: string;
  pointsToRedeem?: number;
  deviceFingerprint?: string;
};

type VerifyPaymentRequest = {
  paymentId: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  razorpaySubscriptionId?: string;
  deviceFingerprint?: string;
};

const AUTH_RETRY_DELAYS_MS = [120, 260, 480];
const BILLING_API_UNAVAILABLE_COOLDOWN_MS = 10_000;
const POINTS_API_UNAVAILABLE_STORAGE_KEY = 'finvantage_points_api_unavailable';
const POINTS_RPC_MISSING_STORAGE_KEY = 'finvantage_points_rpc_missing';
const BILLING_PLANS_CACHE_STORAGE_KEY = 'finvantage_billing_plans_cache_v1';
const BILLING_PLANS_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;
const BILLING_SNAPSHOT_CACHE_STORAGE_KEY = 'finvantage_billing_snapshot_server_cache_v1';
const BILLING_SNAPSHOT_CACHE_MAX_AGE_MS = 1000 * 60 * 15;
const BILLING_LAST_ENTITLEMENT_CACHE_STORAGE_KEY = 'finvantage_billing_last_entitlement_v1';
const BILLING_FAIL_OPEN_GRACE_MS = 1000 * 60 * 30;
let serverPolicyCache: ServerBillingPolicy | null = null;
let billingApiUnavailableUntil = 0;

const isBillingApiCooldownActive = (path: string) =>
  path.startsWith('/api/') && Date.now() < billingApiUnavailableUntil;

const markBillingApiUnavailable = () => {
  billingApiUnavailableUntil = Date.now() + BILLING_API_UNAVAILABLE_COOLDOWN_MS;
};

const clearBillingApiUnavailable = () => {
  billingApiUnavailableUntil = 0;
};

const readPointsApiUnavailableFlag = () => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(POINTS_API_UNAVAILABLE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

const persistPointsApiUnavailableFlag = (unavailable: boolean) => {
  if (typeof window === 'undefined') return;
  try {
    if (unavailable) {
      window.localStorage.setItem(POINTS_API_UNAVAILABLE_STORAGE_KEY, '1');
    } else {
      window.localStorage.removeItem(POINTS_API_UNAVAILABLE_STORAGE_KEY);
    }
  } catch {
    // ignore localStorage write failures
  }
};

const readPointsRpcMissingFlag = () => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(POINTS_RPC_MISSING_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

const persistPointsRpcMissingFlag = (missing: boolean) => {
  if (typeof window === 'undefined') return;
  try {
    if (missing) {
      window.localStorage.setItem(POINTS_RPC_MISSING_STORAGE_KEY, '1');
    } else {
      window.localStorage.removeItem(POINTS_RPC_MISSING_STORAGE_KEY);
    }
  } catch {
    // ignore localStorage write failures
  }
};

let pointsAwardApiState: 'untested' | 'testing' | 'available' | 'unavailable' =
  readPointsApiUnavailableFlag() ? 'unavailable' : 'untested';
let pointsRpcAvailability: 'unknown' | 'available' | 'missing' =
  readPointsRpcMissingFlag() ? 'missing' : 'unknown';

const wait = async (ms: number) =>
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const addDaysIso = (iso: string, days: number) => {
  const date = new Date(iso);
  date.setDate(date.getDate() + Math.max(0, Number(days) || 0));
  return date.toISOString();
};

const isApiUnavailableMessage = (message: string) => {
  const normalized = String(message || '').toLowerCase();
  return (
    normalized.includes('api endpoint is unavailable') ||
    normalized.includes('payload is invalid') ||
    normalized.includes('http 404') ||
    normalized.includes('http 405') ||
    normalized.includes('http 500') ||
    normalized.includes('http 502') ||
    normalized.includes('http 503') ||
    normalized.includes('http 504') ||
    normalized.includes('temporarily unavailable') ||
    normalized.includes('could not load billing snapshot') ||
    normalized.includes('billing_referral_signal_salt')
  );
};

const isIgnorableDbError = (error: unknown) => {
  const text = String((error as { message?: string })?.message || '').toLowerCase();
  return (
    text.includes('relation') ||
    text.includes('does not exist') ||
    text.includes('could not find') ||
    text.includes('permission denied') ||
    text.includes('forbidden') ||
    text.includes('401') ||
    text.includes('403') ||
    text.includes('schema cache') ||
    text.includes('pgrst') ||
    text.includes('jwt')
  );
};

const isMissingRpcFunctionError = (error: unknown, fnName: string) => {
  const text = String((error as { message?: string })?.message || '').toLowerCase();
  const code = String((error as { code?: string })?.code || '').toLowerCase();
  const fn = String(fnName || '').toLowerCase();
  return (
    text.includes('does not exist') ||
    text.includes('could not find') ||
    text.includes('schema cache') ||
    (fn ? text.includes(fn) : false) ||
    code === 'pgrst202' ||
    code === '404'
  );
};

const mapPlanRow = (row: Record<string, unknown>): BillingPlan => ({
  planCode: String(row.plan_code ?? row.planCode ?? ''),
  displayName: String(row.display_name ?? row.displayName ?? ''),
  billingMonths: Number(row.billing_months ?? row.billingMonths ?? 1),
  amountInr: Number(row.amount_inr ?? row.amountInr ?? 0),
  taxInclusive: (row.tax_inclusive ?? row.taxInclusive) !== false,
  autoRenew: (row.auto_renew ?? row.autoRenew) !== false,
  sortOrder: Number(row.sort_order ?? row.sortOrder ?? 0),
  metadata: (row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata))
    ? row.metadata as Record<string, unknown>
    : {},
});

const normalizeBillingPlans = (rows: Array<Record<string, unknown>>): BillingPlan[] => {
  const mapped = rows.map((row) => mapPlanRow(row));
  const filtered = mapped.filter(
    (plan) =>
      Boolean(plan.planCode) &&
      Number.isFinite(plan.billingMonths) &&
      plan.billingMonths > 0 &&
      Number.isFinite(plan.amountInr) &&
      plan.amountInr >= 0
  );
  return filtered.sort((a, b) => {
    const sortDelta = Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
    if (sortDelta !== 0) return sortDelta;
    return Number(a.billingMonths || 1) - Number(b.billingMonths || 1);
  });
};

const persistBillingPlansCache = (plans: BillingPlan[], lastUpdatedAt: string | null) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      BILLING_PLANS_CACHE_STORAGE_KEY,
      JSON.stringify({
        plans,
        lastUpdatedAt,
        cachedAt: new Date().toISOString(),
      })
    );
  } catch {
    // ignore cache writes
  }
};

export const getCachedBillingPlans = (): PublicBillingPlansResponse | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(BILLING_PLANS_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      plans?: unknown;
      lastUpdatedAt?: unknown;
      cachedAt?: unknown;
    };
    if (!Array.isArray(parsed.plans)) return null;

    const cachedAtIso = typeof parsed.cachedAt === 'string' ? parsed.cachedAt : null;
    if (cachedAtIso) {
      const ageMs = Date.now() - new Date(cachedAtIso).getTime();
      if (Number.isFinite(ageMs) && ageMs > BILLING_PLANS_CACHE_MAX_AGE_MS) {
        return null;
      }
    }

    const plans = normalizeBillingPlans(parsed.plans as Array<Record<string, unknown>>);
    if (plans.length === 0) return null;
    return {
      plans,
      lastUpdatedAt: typeof parsed.lastUpdatedAt === 'string' ? parsed.lastUpdatedAt : null,
    };
  } catch {
    return null;
  }
};

const isBillingSnapshotLike = (candidate: unknown): candidate is BillingSnapshot => {
  if (!candidate || typeof candidate !== 'object') return false;
  const row = candidate as Record<string, unknown>;
  return (
    typeof row.now === 'string' &&
    typeof row.accessState === 'string' &&
    typeof row.lifecycleState === 'string' &&
    'policy' in row &&
    'trial' in row &&
    'plans' in row &&
    Array.isArray(row.plans)
  );
};

const persistBillingSnapshotCache = (snapshot: BillingSnapshot) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      BILLING_SNAPSHOT_CACHE_STORAGE_KEY,
      JSON.stringify({
        snapshot,
        cachedAt: new Date().toISOString(),
      })
    );
  } catch {
    // ignore cache writes
  }
};

const getCachedServerBillingSnapshot = (): BillingSnapshot | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(BILLING_SNAPSHOT_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      snapshot?: unknown;
      cachedAt?: unknown;
    };

    const cachedAtIso = typeof parsed.cachedAt === 'string' ? parsed.cachedAt : null;
    if (cachedAtIso) {
      const ageMs = Date.now() - new Date(cachedAtIso).getTime();
      if (Number.isFinite(ageMs) && ageMs > BILLING_SNAPSHOT_CACHE_MAX_AGE_MS) {
        return null;
      }
    }

    if (!isBillingSnapshotLike(parsed.snapshot)) return null;
    const snapshot = parsed.snapshot as BillingSnapshot;
    const normalizedPlans = normalizeBillingPlans(
      (snapshot.plans || []) as unknown as Array<Record<string, unknown>>
    );
    return {
      ...snapshot,
      plans: normalizedPlans,
    };
  } catch {
    return null;
  }
};

const persistLastEntitlementCache = (snapshot: BillingSnapshot) => {
  if (typeof window === 'undefined') return;
  try {
    const payload = {
      now: snapshot.now,
      accessState: snapshot.accessState,
      lifecycleState: snapshot.lifecycleState,
      accessReason: snapshot.accessReason,
      subscription: snapshot.subscription
        ? {
            id: snapshot.subscription.id,
            planCode: snapshot.subscription.planCode,
            status: snapshot.subscription.status,
            startAt: snapshot.subscription.startAt,
            endAt: snapshot.subscription.endAt,
            cancelAtPeriodEnd: snapshot.subscription.cancelAtPeriodEnd,
            autoRenew: snapshot.subscription.autoRenew,
            billingCycle: snapshot.subscription.billingCycle,
            amount: snapshot.subscription.amount,
            currency: snapshot.subscription.currency,
          }
        : null,
      trial: snapshot.trial,
      policy: snapshot.policy,
      entitlementSignature: snapshot.entitlementSignature || null,
      cachedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(BILLING_LAST_ENTITLEMENT_CACHE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore entitlement cache failures
  }
};

const readLastEntitlementCache = (): {
  now: string;
  accessState: BillingAccessState;
  lifecycleState: BillingLifecycleState;
  accessReason: string;
  subscription: BillingSnapshot['subscription'];
  trial: BillingSnapshot['trial'];
  policy: BillingSnapshot['policy'];
  entitlementSignature: string | null;
  cachedAt: string;
} | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(BILLING_LAST_ENTITLEMENT_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const cachedAt = typeof parsed.cachedAt === 'string' ? parsed.cachedAt : '';
    if (!cachedAt) return null;
    const ageMs = Date.now() - new Date(cachedAt).getTime();
    if (!Number.isFinite(ageMs) || ageMs > BILLING_FAIL_OPEN_GRACE_MS) return null;
    return {
      now: typeof parsed.now === 'string' ? parsed.now : new Date().toISOString(),
      accessState: (parsed.accessState as BillingAccessState) || 'active',
      lifecycleState: (parsed.lifecycleState as BillingLifecycleState) || 'active',
      accessReason: typeof parsed.accessReason === 'string' ? parsed.accessReason : 'cache_grace',
      subscription: (parsed.subscription || null) as BillingSnapshot['subscription'],
      trial: (parsed.trial || {
        active: false,
        startedAt: null,
        endsAt: null,
        daysLeft: 0,
        consumed: true,
      }) as BillingSnapshot['trial'],
      policy: (parsed.policy || {
        retryDays: CLIENT_POLICY.retryDays,
        limitedAfterDays: CLIENT_POLICY.limitedAfterDays,
        blockedAfterDays: CLIENT_POLICY.blockedAfterDays,
      }) as BillingSnapshot['policy'],
      entitlementSignature: typeof parsed.entitlementSignature === 'string' ? parsed.entitlementSignature : null,
      cachedAt,
    };
  } catch {
    return null;
  }
};

const readServerPolicyForFallback = async (): Promise<ServerBillingPolicy | null> => {
  if (serverPolicyCache) return serverPolicyCache;
  if (isBillingApiCooldownActive('/api/billing/policy')) return null;
  try {
    const response = await fetch('/api/billing/policy', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) {
      if ([500, 502, 503, 504].includes(response.status)) {
        markBillingApiUnavailable();
      }
      return null;
    }
    const payload = await response.json().catch(() => ({}));
    const data = payload?.data && typeof payload.data === 'object' ? payload.data : null;
    if (!data) return null;
    const retryDays = Array.isArray(data.retryDays) ? data.retryDays.map((value: unknown) => Number(value || 0)).filter((v: number) => v > 0) : [];
    const usagePointEvents = (data.usagePointEvents && typeof data.usagePointEvents === 'object')
      ? Object.entries(data.usagePointEvents as Record<string, unknown>).reduce<Record<string, number>>((acc, [eventType, points]) => {
          acc[eventType] = Math.max(0, Math.trunc(Number(points || 0)));
          return acc;
        }, {})
      : { ...CLIENT_USAGE_POINT_EVENTS };
    const normalized: ServerBillingPolicy = {
      retryDays: retryDays.length ? retryDays : CLIENT_POLICY.retryDays,
      limitedAfterDays: Number(data.limitedAfterDays ?? CLIENT_POLICY.limitedAfterDays),
      blockedAfterDays: Number(data.blockedAfterDays ?? CLIENT_POLICY.blockedAfterDays),
      pointsMonthlyCap: Number(data.pointsMonthlyCap ?? CLIENT_POLICY.pointsMonthlyCap),
      pointsToRupee: Number(data.pointsToRupee ?? CLIENT_POLICY.pointsToInr),
      pointsExpiryMonths: Number(data.pointsExpiryMonths ?? CLIENT_POLICY.pointsExpiryMonths),
      referralMonthlyCap: Number(data.referralMonthlyCap ?? CLIENT_POLICY.referralMonthlyCap),
      referralReward: {
        referrer: Number(data?.referralReward?.referrer ?? CLIENT_POLICY.referralReward.referrer),
        referred: Number(data?.referralReward?.referred ?? CLIENT_POLICY.referralReward.referred),
      },
      usagePointEvents,
    };
    serverPolicyCache = normalized;
    clearBillingApiUnavailable();
    return normalized;
  } catch {
    markBillingApiUnavailable();
    return null;
  }
};

const buildSafeGraceSnapshot = (serverPolicy: ServerBillingPolicy | null): BillingSnapshot => {
  const nowIso = new Date().toISOString();
  const cachedPlans = getCachedBillingPlans()?.plans || [];
  const entitlement = readLastEntitlementCache();
  const usagePointEvents = serverPolicy?.usagePointEvents || CLIENT_USAGE_POINT_EVENTS;
  const fallbackEvents = Object.entries(usagePointEvents).map(([eventType, pointsPerEvent]) => ({
    eventType,
    pointsPerEvent: Number(pointsPerEvent || 0),
    earnedPoints: 0,
    completionCount: 0,
    completed: false,
  }));
  return {
    now: nowIso,
    country: 'India',
    currency: 'INR',
    lifecycleState: entitlement?.lifecycleState || 'active',
    accessState: entitlement?.accessState || 'active',
    accessReason: entitlement?.accessReason || 'billing_server_grace_open',
    policy: {
      retryDays: entitlement?.policy?.retryDays || serverPolicy?.retryDays || CLIENT_POLICY.retryDays,
      limitedAfterDays: entitlement?.policy?.limitedAfterDays ?? serverPolicy?.limitedAfterDays ?? CLIENT_POLICY.limitedAfterDays,
      blockedAfterDays: entitlement?.policy?.blockedAfterDays ?? serverPolicy?.blockedAfterDays ?? CLIENT_POLICY.blockedAfterDays,
    },
    retryTimeline: [],
    pastDueDays: 0,
    trial: entitlement?.trial || {
      active: false,
      startedAt: null,
      endsAt: null,
      daysLeft: 0,
      consumed: true,
    },
    subscription: entitlement?.subscription || null,
    plans: cachedPlans,
    points: {
      balance: 0,
      frozen: false,
      pointsToInr: CLIENT_POLICY.pointsToInr,
      formula: 'Points convert to extension days using effective daily plan value.',
      earnedEvents: fallbackEvents,
    },
    referral: {
      myCode: '',
      shareLink:
        typeof window !== 'undefined'
          ? `${window.location.origin}/pricing`
          : '/pricing',
      referredByCode: null,
      referredByUserId: null,
      referredByLabel: null,
      referredByIdentifier: null,
      referredByIdentifierMasked: null,
      referredAt: null,
      referredStatus: null,
      monthlyInviteCap: CLIENT_POLICY.referralMonthlyCap,
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
      referralReward: CLIENT_POLICY.referralReward,
    },
    webhookBaseUrl: typeof window !== 'undefined' ? window.location.origin : '',
    entitlementSignature: entitlement?.entitlementSignature || null,
  };
};

const inferBillingCycleFromPlan = (
  billingMonths: number,
  fallback: string
) => {
  const months = Math.max(1, Math.floor(Number(billingMonths) || 1));
  if (months === 1) return 'monthly';
  if (months === 3) return 'quarterly';
  if (months === 6) return 'half_yearly';
  if (months === 12) return 'yearly';
  return fallback || `${months}_months`;
};

const resolveAccessStateFromSnapshotFallback = (
  trialActive: boolean,
  subscriptionStatus: string,
  pastDueDays: number,
  policy: {
    limitedAfterDays: number;
    blockedAfterDays: number;
  }
): BillingAccessState => {
  if (trialActive) return 'active';
  const normalizedStatus = String(subscriptionStatus || '').toLowerCase();
  if (normalizedStatus === 'active' || normalizedStatus === 'trialing') return 'active';
  if (normalizedStatus === 'past_due') {
    if (pastDueDays > Number(policy.blockedAfterDays || CLIENT_POLICY.blockedAfterDays)) return 'blocked';
    if (pastDueDays > Number(policy.limitedAfterDays || CLIENT_POLICY.limitedAfterDays)) return 'limited';
    return 'active';
  }
  if (normalizedStatus === 'cancelled' || normalizedStatus === 'completed' || normalizedStatus === 'expired') {
    return 'blocked';
  }
  return 'blocked';
};

const resolveLifecycleStateFromSnapshotFallback = (
  trialActive: boolean,
  subscriptionStatus: string,
  accessState: BillingAccessState,
  hasSubscription: boolean
): BillingLifecycleState => {
  if (trialActive) return 'trial';
  const normalizedStatus = String(subscriptionStatus || '').toLowerCase();
  if (accessState === 'limited') return 'limited_access';
  if (normalizedStatus === 'past_due') return 'payment_failed';
  if (normalizedStatus === 'active' || normalizedStatus === 'trialing') return 'active';
  if (normalizedStatus === 'cancelled' || normalizedStatus === 'completed') return 'cancelled';
  if (!hasSubscription || accessState === 'blocked') return 'expired';
  return 'active';
};

const buildSnapshotViaSupabaseFallback = async (
  serverPolicy: ServerBillingPolicy | null
): Promise<BillingSnapshot | null> => {
  const userId = await getCurrentUserId();
  const now = new Date();
  const nowIsoValue = now.toISOString();
  const nowMs = now.getTime();
  const policy = {
    retryDays: serverPolicy?.retryDays || CLIENT_POLICY.retryDays,
    limitedAfterDays: Number(serverPolicy?.limitedAfterDays ?? CLIENT_POLICY.limitedAfterDays),
    blockedAfterDays: Number(serverPolicy?.blockedAfterDays ?? CLIENT_POLICY.blockedAfterDays),
  };
  const referralReward = serverPolicy?.referralReward || CLIENT_POLICY.referralReward;
  const pointsToInr = Number(serverPolicy?.pointsToRupee ?? CLIENT_POLICY.pointsToInr);

  const [history, billingProfileRes, profileRes, plansRes, usageRulesRes] = await Promise.all([
    getHistoryViaSupabase(),
    supabase
      .from('user_billing_profiles')
      .select('country,billing_currency,referral_code,referred_by_code,referred_by_user_id,points_frozen,trial_started_at,trial_end_at,trial_consumed')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('country')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('billing_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('billing_months', { ascending: true }),
    supabase
      .from('billing_usage_point_rules')
      .select('event_type,points,is_active')
      .in('event_type', POINTS_EVENT_ORDER as unknown as string[]),
  ]);

  if (billingProfileRes.error && !isIgnorableDbError(billingProfileRes.error)) {
    throw billingProfileRes.error;
  }
  if (profileRes.error && !isIgnorableDbError(profileRes.error)) {
    throw profileRes.error;
  }
  if (plansRes.error && !isIgnorableDbError(plansRes.error)) {
    throw plansRes.error;
  }
  if (usageRulesRes.error && !isIgnorableDbError(usageRulesRes.error)) {
    throw usageRulesRes.error;
  }

  const billingProfile = (billingProfileRes.data && typeof billingProfileRes.data === 'object')
    ? billingProfileRes.data as Record<string, unknown>
    : null;
  const profileRow = (profileRes.data && typeof profileRes.data === 'object')
    ? profileRes.data as Record<string, unknown>
    : null;
  const plansRows = Array.isArray(plansRes.data)
    ? plansRes.data as Array<Record<string, unknown>>
    : [];
  const usageRulesRows = Array.isArray(usageRulesRes.data)
    ? usageRulesRes.data as Array<Record<string, unknown>>
    : [];
  const normalizedPlans = normalizeBillingPlans(plansRows);
  const cachedPlans = getCachedBillingPlans()?.plans || [];
  const plans = normalizedPlans.length > 0 ? normalizedPlans : cachedPlans;
  const usagePointEvents = {
    ...(serverPolicy?.usagePointEvents || CLIENT_USAGE_POINT_EVENTS),
  };
  for (const row of usageRulesRows) {
    const eventType = String(row.event_type || '').trim();
    if (!eventType) continue;
    const isActive = row.is_active !== false;
    usagePointEvents[eventType] = isActive
      ? Math.max(0, Math.trunc(Number(row.points || 0)))
      : 0;
  }

  const activeSubscription =
    history.subscriptions.find((row) => row.id && row.id === history.activeSubscriptionId) ||
    history.subscriptions.find((row) => {
      const status = String(row.status || '').toLowerCase();
      return status === 'active' || status === 'trialing' || status === 'past_due';
    }) ||
    null;
  const pastDueDays = Number(history.pastDueDays || 0);
  const trialStart = billingProfile?.trial_started_at ? String(billingProfile.trial_started_at) : null;
  const trialEnd = billingProfile?.trial_end_at ? String(billingProfile.trial_end_at) : null;
  const trialConsumed = Boolean(billingProfile?.trial_consumed);
  const trialActive = Boolean(trialEnd && new Date(trialEnd).getTime() > nowMs && !trialConsumed);
  const trialDaysLeft = trialEnd
    ? Math.max(0, Math.ceil((new Date(trialEnd).getTime() - nowMs) / (24 * 60 * 60 * 1000)))
    : 0;
  const subscriptionStatus = String(activeSubscription?.status || '');
  const accessState = resolveAccessStateFromSnapshotFallback(
    trialActive,
    subscriptionStatus,
    pastDueDays,
    policy
  );
  const lifecycleState = resolveLifecycleStateFromSnapshotFallback(
    trialActive,
    subscriptionStatus,
    accessState,
    Boolean(activeSubscription)
  );

  const pointsBalance = Math.max(
    0,
    history.pointsLedger.reduce((sum, row) => {
      const expiresAtMs = row.expiresAt ? new Date(row.expiresAt).getTime() : null;
      if (expiresAtMs && expiresAtMs < nowMs) return sum;
      return sum + Number(row.points || 0);
    }, 0)
  );
  const referralEvents = Array.isArray(history.referralEvents) ? history.referralEvents : [];
  const referralAsReferrer = referralEvents.filter((event) => String(event.referrerUserId || '') === userId);
  const referralAsReferred = referralEvents.find((event) => String(event.referredUserId || '') === userId) || null;
  const rewardedReferrals = referralAsReferrer.filter((event) => String(event.status || '').toLowerCase() === 'rewarded').length;
  const fraudHoldReferrals = referralAsReferrer.filter((event) => String(event.status || '').toLowerCase() === 'fraud_hold').length;
  const reversedReferrals = referralAsReferrer.filter((event) => String(event.status || '').toLowerCase() === 'reversed').length;
  const pendingReferrals = referralAsReferrer.filter((event) => {
    const normalized = String(event.status || '').toLowerCase();
    return normalized === 'pending' || normalized === 'investigating';
  }).length;
  const referralPointsAsReferrer = Math.max(
    0,
    history.pointsLedger
      .filter((entry) => String(entry.eventType || '') === 'referral_referrer_reward')
      .reduce((sum, entry) => sum + Math.max(0, Number(entry.points || 0)), 0)
  );
  const referralPointsAsReferred = Math.max(
    0,
    history.pointsLedger
      .filter((entry) => String(entry.eventType || '') === 'referral_referred_reward')
      .reduce((sum, entry) => sum + Math.max(0, Number(entry.points || 0)), 0)
  );
  const latestReferralStatus = referralAsReferred
    ? String(referralAsReferred.status || '')
    : (billingProfile?.referred_by_code ? 'applied_pending_first_paid' : null);
  const recentReferralEvents = referralEvents.slice(0, 20).map((event) => {
    const role = String(event.referrerUserId || '') === userId ? 'referrer' : 'referred';
    const counterpartUserId = role === 'referrer'
      ? String(event.referredUserId || '')
      : String(event.referrerUserId || '');
    return {
      id: String(event.id || ''),
      role,
      referralCode: String(event.referralCode || ''),
      status: String(event.status || ''),
      counterpartUserId: counterpartUserId || null,
      counterpartLabel: null,
      counterpartIdentifier: null,
      counterpartIdentifierMasked: null,
      createdAt: String(event.createdAt || nowIsoValue),
      metadata: (event.metadata && typeof event.metadata === 'object')
        ? event.metadata
        : {},
    };
  });

  const earnedPointsByEvent = history.pointsLedger.reduce<Record<string, number>>((acc, row) => {
    const eventType = String(row.eventType || '');
    if (!eventType || Number(row.points || 0) <= 0) return acc;
    acc[eventType] = (acc[eventType] || 0) + Number(row.points || 0);
    return acc;
  }, {});
  const earnedEvents = POINTS_EVENT_ORDER.map((eventType) => {
    const pointsPerEvent = Number(
      usagePointEvents[eventType] ?? CLIENT_USAGE_POINT_EVENTS[eventType] ?? 0
    );
    const earnedPoints = Number(earnedPointsByEvent[eventType] || 0);
    const completionCount = pointsPerEvent > 0 ? Math.floor(earnedPoints / pointsPerEvent) : 0;
    return {
      eventType,
      pointsPerEvent,
      earnedPoints,
      completionCount,
      completed: earnedPoints > 0,
    };
  });

  const activePlan = activeSubscription
    ? plans.find((plan) => plan.planCode === activeSubscription.planCode) || null
    : null;
  const country = String(
    billingProfile?.country ||
    profileRow?.country ||
    'India'
  );
  const currency = String(
    billingProfile?.billing_currency ||
    'INR'
  );
  const referralCode = String(billingProfile?.referral_code || '');

  const snapshot: BillingSnapshot = {
    now: nowIsoValue,
    country,
    currency,
    lifecycleState,
    accessState,
    accessReason: 'supabase_snapshot_fallback',
    policy,
    retryTimeline: Array.isArray(history.retryTimeline) ? history.retryTimeline : [],
    pastDueDays,
    trial: {
      active: trialActive,
      startedAt: trialStart,
      endsAt: trialEnd,
      daysLeft: trialDaysLeft,
      consumed: trialConsumed,
    },
    subscription: activeSubscription
      ? {
          id: String(activeSubscription.id || ''),
          planCode: String(activeSubscription.planCode || ''),
          status: String(activeSubscription.status || ''),
          amount: Number(activeSubscription.amount || 0),
          currency: String(activeSubscription.currency || 'INR'),
          billingCycle: inferBillingCycleFromPlan(
            Number(activePlan?.billingMonths || 0),
            String(activeSubscription.billingCycle || '')
          ),
          startAt: String(activeSubscription.startAt || nowIsoValue),
          endAt: activeSubscription.endAt ? String(activeSubscription.endAt) : null,
          cancelAtPeriodEnd: Boolean(activeSubscription.cancelAtPeriodEnd),
          autoRenew: Boolean(activeSubscription.autoRenew),
          accessState,
        }
      : null,
    plans,
    points: {
      balance: pointsBalance,
      frozen: Boolean(billingProfile?.points_frozen),
      pointsToInr,
      formula: 'Points convert to extension days using effective daily plan value.',
      earnedEvents,
    },
    referral: {
      myCode: referralCode,
      shareLink:
        typeof window !== 'undefined'
          ? `${window.location.origin}/pricing${referralCode ? `?ref=${encodeURIComponent(referralCode)}` : ''}`
          : `/pricing${referralCode ? `?ref=${encodeURIComponent(referralCode)}` : ''}`,
      referredByCode: billingProfile?.referred_by_code
        ? String(billingProfile.referred_by_code)
        : null,
      referredByUserId: billingProfile?.referred_by_user_id
        ? String(billingProfile.referred_by_user_id)
        : null,
      referredByLabel: null,
      referredByIdentifier: null,
      referredByIdentifierMasked: null,
      referredAt: referralAsReferred?.createdAt || null,
      referredStatus: latestReferralStatus,
      monthlyInviteCap: Number(serverPolicy?.referralMonthlyCap ?? CLIENT_POLICY.referralMonthlyCap),
      pointsEarned: {
        asReferrer: referralPointsAsReferrer,
        asReferred: referralPointsAsReferred,
        total: referralPointsAsReferrer + referralPointsAsReferred,
      },
      summary: {
        asReferrer: {
          total: referralAsReferrer.length,
          rewarded: rewardedReferrals,
          fraudHold: fraudHoldReferrals,
          reversed: reversedReferrals,
          pending: pendingReferrals,
          uniqueReferredUsers: new Set(referralAsReferrer.map((event) => String(event.referredUserId || ''))).size,
        },
        asReferred: {
          status: latestReferralStatus,
          referralCode: billingProfile?.referred_by_code
            ? String(billingProfile.referred_by_code)
            : null,
          referrerUserId: billingProfile?.referred_by_user_id
            ? String(billingProfile.referred_by_user_id)
            : null,
        },
      },
      recentEvents: recentReferralEvents,
      referralReward,
    },
    webhookBaseUrl: typeof window !== 'undefined' ? window.location.origin : '',
    entitlementSignature: null,
  };

  return snapshot;
};

const getCurrentUserId = async () => {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id || null;
  if (!userId) throw new Error('Sign in required.');
  return userId;
};

const isAuthErrorMessage = (message: string) => {
  const normalized = String(message || '').toLowerCase();
  return (
    normalized.includes('sign in') ||
    normalized.includes('missing bearer token') ||
    normalized.includes('invalid auth token') ||
    normalized.includes('jwt') ||
    normalized.includes('not authenticated')
  );
};

const getAccessToken = async (attempt = 0): Promise<string> => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token || '';
  if (token) return token;
  if (attempt >= AUTH_RETRY_DELAYS_MS.length - 1) return '';

  await supabase.auth.refreshSession().catch(() => undefined);
  await wait(AUTH_RETRY_DELAYS_MS[attempt]);
  return getAccessToken(attempt + 1);
};

const callBillingApi = async <T>(path: string, init?: RequestInit, attempt = 0): Promise<T> => {
  if (isBillingApiCooldownActive(path)) {
    throw new Error(BILLING_API_UNAVAILABLE_MESSAGE);
  }

  const token = await getAccessToken();
  if (!token) {
    if (attempt < AUTH_RETRY_DELAYS_MS.length - 1) {
      await wait(AUTH_RETRY_DELAYS_MS[attempt]);
      return callBillingApi<T>(path, init, attempt + 1);
    }
    throw new Error('Sign in required.');
  }

  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });
  } catch (err) {
    const message = String((err as Error)?.message || '').toLowerCase();
    const networkUnavailable =
      !message ||
      message.includes('failed to fetch') ||
      message.includes('networkerror') ||
      message.includes('load failed') ||
      message.includes('fetch');
    if (path.startsWith('/api/') && networkUnavailable) {
      markBillingApiUnavailable();
      throw new Error(BILLING_API_UNAVAILABLE_MESSAGE);
    }
    throw err;
  }

  const rawBody = await response.text().catch(() => '');
  let payload: Record<string, unknown> = {};
  const bodySnippet = rawBody.trim().slice(0, 200);
  const looksLikeHtml = /<!doctype html>|<html[\s>]/i.test(bodySnippet);
  const looksLikeJson = /^\s*[\[{]/.test(rawBody.trim());
  if (rawBody) {
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      payload = {};
    }
  }
  if (response.ok) {
    // Local Vite dev often returns index.html with status 200 for unknown /api routes.
    if (path.startsWith('/api/') && (!looksLikeJson || looksLikeHtml) && Object.keys(payload).length === 0) {
      markBillingApiUnavailable();
      throw new Error(BILLING_API_UNAVAILABLE_MESSAGE);
    }
    clearBillingApiUnavailable();
    return payload as T;
  }

  if (!response.ok) {
    const payloadError = typeof payload?.error === 'string' ? payload.error : '';
    const payloadMessage = typeof payload?.message === 'string' ? payload.message : '';
    const normalizedSnippet = bodySnippet.toLowerCase();
    const backendUnavailableViaProxy =
      path.startsWith('/api/') &&
      [500, 502, 503, 504].includes(response.status) &&
      !payloadError &&
      !payloadMessage &&
      (
        !bodySnippet ||
        looksLikeHtml ||
        normalizedSnippet.includes('proxy') ||
        normalizedSnippet.includes('econnrefused') ||
        normalizedSnippet.includes('upstream') ||
        normalizedSnippet.includes('socket hang up')
      );
    const message =
      (backendUnavailableViaProxy ? BILLING_API_UNAVAILABLE_MESSAGE : '') ||
      payloadError ||
      payloadMessage ||
      (!looksLikeHtml && bodySnippet) ||
      ((response.status === 404 || response.status === 405) && path.startsWith('/api/')
        ? BILLING_API_UNAVAILABLE_MESSAGE
        : `Billing request failed (HTTP ${response.status}).`);

    if (backendUnavailableViaProxy || message === BILLING_API_UNAVAILABLE_MESSAGE) {
      markBillingApiUnavailable();
    }

    const shouldRetryAuth =
      attempt < AUTH_RETRY_DELAYS_MS.length - 1 &&
      (response.status === 401 || response.status === 403 || isAuthErrorMessage(message));

    if (shouldRetryAuth) {
      await supabase.auth.refreshSession().catch(() => undefined);
      await wait(AUTH_RETRY_DELAYS_MS[attempt]);
      return callBillingApi<T>(path, init, attempt + 1);
    }
    throw new Error(message);
  }
  return payload as T;
};

const getHistoryViaSupabase = async (): Promise<BillingHistoryResponse> => {
  const userId = await getCurrentUserId();
  const nowIso = new Date().toISOString();

  const [subscriptionRes, paymentsRes, couponRes, pointsRes, referralRes, messageRes] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('subscription_coupon_redemptions')
      .select('*')
      .eq('user_id', userId)
      .order('redeemed_at', { ascending: false }),
    supabase
      .from('reward_points_ledger')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('referral_events')
      .select('*')
      .or(`referrer_user_id.eq.${userId},referred_user_id.eq.${userId}`)
      .order('created_at', { ascending: false }),
    supabase
      .from('billing_message_events')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ]);

  const subscriptions = !subscriptionRes.error && Array.isArray(subscriptionRes.data)
    ? subscriptionRes.data as Array<Record<string, unknown>>
    : [];
  const payments = !paymentsRes.error && Array.isArray(paymentsRes.data)
    ? paymentsRes.data as Array<Record<string, unknown>>
    : [];
  const couponRows = !couponRes.error && Array.isArray(couponRes.data)
    ? couponRes.data as Array<Record<string, unknown>>
    : [];
  const pointsRows = !pointsRes.error && Array.isArray(pointsRes.data)
    ? pointsRes.data as Array<Record<string, unknown>>
    : [];
  const referralRows = !referralRes.error && Array.isArray(referralRes.data)
    ? referralRes.data as Array<Record<string, unknown>>
    : [];
  const messageRows = !messageRes.error && Array.isArray(messageRes.data)
    ? messageRes.data as Array<Record<string, unknown>>
    : [];

  const currentSubscription = subscriptions.find((row) => ['active', 'trialing', 'past_due'].includes(String(row.status || '').toLowerCase())) || subscriptions[0] || null;
  const pastDueSince = currentSubscription?.past_due_since ? String(currentSubscription.past_due_since) : '';
  const pastDueDays = pastDueSince
    ? Math.max(0, Math.floor((Date.now() - new Date(pastDueSince).getTime()) / (24 * 60 * 60 * 1000)))
    : 0;
  const retryTimeline = pastDueSince
    ? CLIENT_POLICY.retryDays.map((day) => {
        const scheduledAt = addDaysIso(pastDueSince, day);
        return { day, scheduledAt, elapsed: new Date(scheduledAt).getTime() <= Date.now() };
      })
    : [];

  return {
    now: nowIso,
    activeSubscriptionId: currentSubscription?.id ? String(currentSubscription.id) : null,
    retryTimeline,
    pastDueDays,
    subscriptions: subscriptions.map((row) => ({
      id: String(row.id || ''),
      planCode: String(row.plan_code || ''),
      status: String(row.status || ''),
      amount: Number(row.amount || 0),
      currency: String(row.currency || 'INR'),
      billingCycle: String(row.billing_cycle || 'monthly'),
      startAt: String(row.start_at || nowIso),
      endAt: row.end_at ? String(row.end_at) : null,
      cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
      autoRenew: row.auto_renew !== false,
      createdAt: String(row.created_at || nowIso),
      metadata: (row.metadata && typeof row.metadata === 'object') ? row.metadata as Record<string, unknown> : {},
    })),
    payments: payments.map((row) => ({
      id: String(row.id || ''),
      status: String(row.status || ''),
      amount: Number(row.amount || 0),
      currency: String(row.currency || 'INR'),
      provider: String(row.provider || row.gateway || 'razorpay'),
      providerPaymentId: row.provider_payment_id ? String(row.provider_payment_id) : (row.gateway_payment_id ? String(row.gateway_payment_id) : null),
      providerOrderId: row.provider_order_id ? String(row.provider_order_id) : (row.gateway_order_id ? String(row.gateway_order_id) : null),
      attemptedAt: String(row.attempted_at || row.created_at || nowIso),
      settledAt: row.settled_at ? String(row.settled_at) : null,
      failureReason: row.failure_reason ? String(row.failure_reason) : null,
      couponCode: row.coupon_code ? String(row.coupon_code) : null,
      pointsRedeemed: Number(row.points_redeemed || 0),
      metadata: (row.metadata && typeof row.metadata === 'object') ? row.metadata as Record<string, unknown> : {},
    })),
    invoices: payments.map((row) => ({
      invoiceNumber: String(row.provider_order_id || row.gateway_order_id || row.id || ''),
      paymentId: String(row.id || ''),
      status: String(row.status || ''),
      amount: Number(row.amount || 0),
      currency: String(row.currency || 'INR'),
      issuedAt: String(row.created_at || nowIso),
      settledAt: row.settled_at ? String(row.settled_at) : null,
      description: `Billing payment ${String(row.status || '').toLowerCase() || 'record'}`,
    })),
    couponRedemptions: couponRows.map((row) => ({
      id: String(row.id || ''),
      couponId: String(row.coupon_id || ''),
      paymentId: row.payment_id ? String(row.payment_id) : null,
      subscriptionId: row.subscription_id ? String(row.subscription_id) : null,
      amountDiscount: Number(row.amount_discount || 0),
      redeemedAt: String(row.redeemed_at || row.created_at || nowIso),
      metadata: (row.metadata && typeof row.metadata === 'object') ? row.metadata as Record<string, unknown> : {},
    })),
    pointsLedger: pointsRows.map((row) => ({
      id: String(row.id || ''),
      eventType: String(row.event_type || ''),
      points: Number(row.points || 0),
      sourceRef: row.source_ref ? String(row.source_ref) : null,
      expiresAt: row.expires_at ? String(row.expires_at) : null,
      createdAt: String(row.created_at || nowIso),
      metadata: (row.metadata && typeof row.metadata === 'object') ? row.metadata as Record<string, unknown> : {},
    })),
    referralEvents: referralRows.map((row) => ({
      id: String(row.id || ''),
      referrerUserId: String(row.referrer_user_id || ''),
      referredUserId: String(row.referred_user_id || ''),
      referralCode: String(row.referral_code || ''),
      status: String(row.status || ''),
      role: String(row.referrer_user_id || '') === userId ? 'referrer' : 'referred',
      counterpartUserId: String(row.referrer_user_id || '') === userId
        ? (row.referred_user_id ? String(row.referred_user_id) : null)
        : (row.referrer_user_id ? String(row.referrer_user_id) : null),
      counterpartLabel: null,
      counterpartIdentifier: null,
      counterpartIdentifierMasked: null,
      metadata: (row.metadata && typeof row.metadata === 'object') ? row.metadata as Record<string, unknown> : {},
      createdAt: String(row.created_at || nowIso),
    })),
    messageEvents: messageRows.map((row) => ({
      id: String(row.id || ''),
      templateKey: String(row.template_key || ''),
      channel: String(row.channel || 'in_app'),
      status: String(row.status || ''),
      payload: (row.payload && typeof row.payload === 'object') ? row.payload as Record<string, unknown> : {},
      reason: row.reason ? String(row.reason) : null,
      createdAt: String(row.created_at || nowIso),
      sentAt: row.sent_at ? String(row.sent_at) : null,
    })),
  };
};

export const getBillingSnapshot = async (): Promise<BillingSnapshot> => {
  try {
    const payload = await callBillingApi<{ data: BillingSnapshot }>('/api/billing/snapshot', { method: 'GET' });
    const candidate = (payload && typeof payload === 'object' && 'data' in payload)
      ? (payload as Record<string, unknown>).data
      : payload;
    if (isBillingSnapshotLike(candidate)) {
      const snapshot = candidate as BillingSnapshot;
      const normalizedPlans = normalizeBillingPlans(
        (snapshot.plans || []) as unknown as Array<Record<string, unknown>>
      );
      const normalizedSnapshot: BillingSnapshot = {
        ...snapshot,
        plans: normalizedPlans,
      };
      if (normalizedPlans.length > 0) {
        persistBillingPlansCache(normalizedPlans, normalizedSnapshot.now || new Date().toISOString());
      }
      persistBillingSnapshotCache(normalizedSnapshot);
      persistLastEntitlementCache(normalizedSnapshot);
      return normalizedSnapshot;
    }
    throw new Error('Billing snapshot payload is invalid.');
  } catch (err) {
    const message = String((err as Error)?.message || '');
    const unavailable = isApiUnavailableMessage(message);
    const ignorable = isIgnorableDbError(err);
    if (!unavailable && !ignorable) throw err;
    const cachedSnapshot = getCachedServerBillingSnapshot();
    if (cachedSnapshot) return cachedSnapshot;
    // If billing API itself is unavailable (local backend down/proxy unavailable),
    // skip extra /api/billing/policy network call and use client policy defaults.
    const serverPolicy = unavailable ? null : await readServerPolicyForFallback();
    try {
      const supabaseFallback = await buildSnapshotViaSupabaseFallback(serverPolicy);
      if (supabaseFallback) {
        persistBillingSnapshotCache(supabaseFallback);
        persistLastEntitlementCache(supabaseFallback);
        if (Array.isArray(supabaseFallback.plans) && supabaseFallback.plans.length > 0) {
          persistBillingPlansCache(supabaseFallback.plans, supabaseFallback.now || new Date().toISOString());
        }
        return supabaseFallback;
      }
    } catch (fallbackErr) {
      if (!isIgnorableDbError(fallbackErr)) {
        throw fallbackErr;
      }
    }
    return buildSafeGraceSnapshot(serverPolicy);
  }
};

export const getPublicBillingPlans = async (): Promise<PublicBillingPlansResponse> => {
  try {
    if (isBillingApiCooldownActive('/api/billing/plans')) {
      throw new Error(PRICING_API_UNAVAILABLE_MESSAGE);
    }
    let response: Response;
    try {
      response = await fetch('/api/billing/plans', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      });
    } catch (err) {
      const message = String((err as Error)?.message || '').toLowerCase();
      const networkUnavailable =
        !message ||
        message.includes('failed to fetch') ||
        message.includes('networkerror') ||
        message.includes('load failed') ||
        message.includes('fetch');
      if (networkUnavailable) {
        markBillingApiUnavailable();
        throw new Error(PRICING_API_UNAVAILABLE_MESSAGE);
      }
      throw err;
    }

    const rawBody = await response.text().catch(() => '');
    const bodySnippet = rawBody.trim().slice(0, 200);
    const looksLikeHtml = /<!doctype html>|<html[\s>]/i.test(bodySnippet);
    const looksLikeJson = /^\s*[\[{]/.test(rawBody.trim());
    let payload: Record<string, unknown> = {};
    if (rawBody) {
      try {
        payload = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        payload = {};
      }
    }

    if (response.ok && (!looksLikeJson || looksLikeHtml) && Object.keys(payload).length === 0) {
      markBillingApiUnavailable();
      throw new Error(PRICING_API_UNAVAILABLE_MESSAGE);
    }

    if (!response.ok) {
      const payloadError = typeof payload?.error === 'string' ? payload.error : '';
      const normalizedSnippet = bodySnippet.toLowerCase();
      const backendUnavailableViaProxy =
        [500, 502, 503, 504].includes(response.status) &&
        !payloadError &&
        (
          !bodySnippet ||
          looksLikeHtml ||
          normalizedSnippet.includes('proxy') ||
          normalizedSnippet.includes('econnrefused') ||
          normalizedSnippet.includes('upstream') ||
          normalizedSnippet.includes('socket hang up')
        );
      const message =
        (backendUnavailableViaProxy ? PRICING_API_UNAVAILABLE_MESSAGE : '') ||
        payloadError ||
        bodySnippet ||
        (response.status === 404
          ? PRICING_API_UNAVAILABLE_MESSAGE
          : `Pricing request failed (HTTP ${response.status}).`);
      if (backendUnavailableViaProxy || message === PRICING_API_UNAVAILABLE_MESSAGE) {
        markBillingApiUnavailable();
      }
      throw new Error(message);
    }

    const data = (payload?.data && typeof payload.data === 'object')
      ? (payload.data as Record<string, unknown>)
      : {};

    if (!Array.isArray(data.plans)) {
      throw new Error('Pricing plans payload is invalid.');
    }

    const plans = normalizeBillingPlans(data.plans as Array<Record<string, unknown>>);
    const lastUpdatedAt = typeof data.lastUpdatedAt === 'string' ? data.lastUpdatedAt : null;
    if (plans.length > 0) {
      persistBillingPlansCache(plans, lastUpdatedAt);
    }
    clearBillingApiUnavailable();

    return {
      plans,
      lastUpdatedAt,
    };
  } catch (err) {
    const cached = getCachedBillingPlans();
    if (cached?.plans?.length) {
      return cached;
    }
    throw err;
  }
};

export const createCheckoutOrder = async (body: CheckoutOrderRequest) => {
  const deviceFingerprint = getClientDeviceFingerprint();
  const payload = await callBillingApi<{
    data: {
      mode: 'razorpay_order' | 'razorpay_subscription' | 'zero_amount';
      paymentId: string;
      orderId?: string;
      subscriptionId?: string;
      keyId?: string;
      amountInr: number;
      amountMinor?: number;
      currency?: string;
      planCode: string;
      billingMonths?: number;
      couponDiscount: number;
      pointsToRedeem: number;
      bonusDays: number;
    };
  }>('/api/billing/create-order', {
    method: 'POST',
    body: JSON.stringify({
      ...body,
      deviceFingerprint: body.deviceFingerprint || deviceFingerprint,
    }),
  });
  return payload.data;
};

export const verifyCheckoutPayment = async (body: VerifyPaymentRequest) => {
  const deviceFingerprint = getClientDeviceFingerprint();
  const payload = await callBillingApi<{
    data: {
      verified: boolean;
      subscription: {
        id: string;
        planCode: string;
        status: string;
        startAt: string;
        endAt: string | null;
        accessState: BillingAccessState;
      };
    };
  }>('/api/billing/verify-payment', {
    method: 'POST',
    body: JSON.stringify({
      ...body,
      deviceFingerprint: body.deviceFingerprint || deviceFingerprint,
    }),
  });
  return payload.data;
};

export const getBillingHistory = async (): Promise<BillingHistoryResponse> => {
  try {
    const payload = await callBillingApi<{ data: BillingHistoryResponse }>('/api/billing/history', { method: 'GET' });
    const candidate = (payload && typeof payload === 'object' && 'data' in payload)
      ? (payload as Record<string, unknown>).data
      : payload;
    if (
      candidate &&
      typeof candidate === 'object' &&
      (
        'subscriptions' in (candidate as Record<string, unknown>) ||
        'payments' in (candidate as Record<string, unknown>) ||
        'invoices' in (candidate as Record<string, unknown>)
      )
    ) {
      return candidate as BillingHistoryResponse;
    }
    throw new Error('Billing history payload is invalid.');
  } catch (err) {
    const message = String((err as Error)?.message || '');
    if (!isApiUnavailableMessage(message)) throw err;
    try {
      return await getHistoryViaSupabase();
    } catch (fallbackErr) {
      if (!isIgnorableDbError(fallbackErr)) throw fallbackErr;
      throw err;
    }
  }
};

export const applySubscriptionAction = async (action: 'cancel_at_period_end' | 'resume_auto_renew', subscriptionId?: string) => {
  const payload = await callBillingApi<{
    data: {
      subscription: {
        id: string;
        planCode: string;
        status: string;
        startAt: string;
        endAt: string | null;
        cancelAtPeriodEnd: boolean;
        autoRenew: boolean;
        updatedAt: string;
      };
    };
  }>('/api/billing/subscription-action', {
    method: 'POST',
    body: JSON.stringify({ action, subscriptionId }),
  });
  return payload.data;
};

export const awardUsagePoints = async (eventType: string, sourceRef?: string, metadata?: Record<string, unknown>) => {
  const awardViaRpcFallback = async () => {
    if (pointsRpcAvailability === 'missing') {
      return { awarded: 0, skipped: true, reason: 'rpc_unavailable' as const, remainingCap: 0 };
    }

    const normalizePayload = (value: unknown) => {
      const payload = value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
      return {
        awarded: Number(payload.awarded || 0),
        skipped: Boolean(payload.skipped),
        reason: typeof payload.reason === 'string' ? payload.reason : undefined,
        remainingCap: Number(payload.remainingCap || payload.remaining_cap || 0),
      };
    };

    const { data: atomicData, error: atomicError } = await supabase.rpc('billing_award_points_client_v2', {
      p_event_type: eventType,
      p_source_ref: sourceRef || null,
      p_metadata: metadata || {},
      p_monthly_cap: CLIENT_POLICY.pointsMonthlyCap,
      p_points_expiry_months: CLIENT_POLICY.pointsExpiryMonths,
    });

    if (!atomicError) {
      pointsRpcAvailability = 'available';
      persistPointsRpcMissingFlag(false);
      return normalizePayload(atomicData);
    }

    if (!isMissingRpcFunctionError(atomicError, 'billing_award_points_client_v2')) {
      const atomicMessage = String(atomicError.message || '').toLowerCase();
      const text = atomicMessage;
      if (
        text.includes('permission denied') ||
        text.includes('forbidden') ||
        text.includes('401') ||
        text.includes('403')
      ) {
        return { awarded: 0, skipped: true, reason: 'rpc_unavailable' as const, remainingCap: 0 };
      }
      throw atomicError;
    }

    const { data, error } = await supabase.rpc('billing_award_points_client', {
      p_event_type: eventType,
      p_source_ref: sourceRef || null,
      p_metadata: metadata || {},
    });
    if (error) {
      const text = String(error.message || '').toLowerCase();
      if (
        isMissingRpcFunctionError(error, 'billing_award_points_client') ||
        text.includes('function') ||
        text.includes('does not exist') ||
        text.includes('permission denied') ||
        text.includes('forbidden') ||
        text.includes('401') ||
        text.includes('403')
      ) {
        if (isMissingRpcFunctionError(error, 'billing_award_points_client')) {
          pointsRpcAvailability = 'missing';
          persistPointsRpcMissingFlag(true);
        }
        return { awarded: 0, skipped: true, reason: 'rpc_unavailable' as const, remainingCap: 0 };
      }
      throw error;
    }

    pointsRpcAvailability = 'available';
    persistPointsRpcMissingFlag(false);
    return {
      ...normalizePayload(data),
    };
  };

  if (pointsAwardApiState === 'unavailable' || pointsAwardApiState === 'testing') {
    return awardViaRpcFallback();
  }

  try {
    if (pointsAwardApiState === 'untested') {
      pointsAwardApiState = 'testing';
    }
    const payload = await callBillingApi<{ data: { awarded: number; skipped: boolean; reason?: string; remainingCap?: number } }>(
      '/api/billing/award-points',
      {
        method: 'POST',
        body: JSON.stringify({ eventType, sourceRef, metadata }),
      }
    );
    pointsAwardApiState = 'available';
    persistPointsApiUnavailableFlag(false);
    pointsRpcAvailability = 'available';
    persistPointsRpcMissingFlag(false);
    return payload.data;
  } catch (err) {
    const message = String((err as Error)?.message || '');
    if (
      /billing api endpoint is unavailable|method not allowed|http 404|http 405/i.test(
        message.toLowerCase()
      )
    ) {
      pointsAwardApiState = 'unavailable';
      persistPointsApiUnavailableFlag(true);
      return awardViaRpcFallback();
    }
    if (pointsAwardApiState === 'testing') {
      pointsAwardApiState = 'available';
    }
    throw err;
  }
};

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export const ensureRazorpayScript = async () => {
  if (window.Razorpay) return true;
  return await new Promise<boolean>((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};
