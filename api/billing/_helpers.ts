import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BILLING_POLICY, PLAN_MONTHS } from './_config';
import {
  calculateCouponDiscountRule,
  computeAccessStateRule,
  computeBonusDaysFromPointsRule,
  computePastDueDaysRule,
  computeRetryTimelineRule,
  isUpgradeAllowedRule,
} from '../../lib/billingRules.mjs';

type BillingPlanRow = {
  plan_code: string;
  display_name: string;
  billing_months: number;
  amount_inr: number;
  tax_inclusive: boolean;
  auto_renew: boolean;
  is_active: boolean;
  sort_order: number;
  metadata: Record<string, unknown>;
};

type HeaderCarrier = {
  headers?: Record<string, string | string[] | undefined>;
};

export const safeNum = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const nowIso = () => new Date().toISOString();

const REFERRAL_SIGNAL_SALT =
  process.env.BILLING_REFERRAL_SIGNAL_SALT ||
  '';

const readHeader = (req: HeaderCarrier | null | undefined, key: string): string => {
  const raw = req?.headers?.[key] ?? req?.headers?.[key.toLowerCase()];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' ? value.trim() : '';
};

const normalizeEmailIdentity = (email: string) => {
  const lower = String(email || '').trim().toLowerCase();
  if (!lower || !lower.includes('@')) return '';
  const [localRaw, domainRaw] = lower.split('@');
  let local = localRaw || '';
  let domain = domainRaw || '';

  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') {
    local = local.replace(/\./g, '');
    const plusIndex = local.indexOf('+');
    if (plusIndex >= 0) local = local.slice(0, plusIndex);
  }
  return `${local}@${domain}`;
};

const normalizeDeviceFingerprint = (value: unknown) =>
  String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-:.]/g, '')
    .slice(0, 180);

const hashReferralSignal = (value: string) => {
  if (!REFERRAL_SIGNAL_SALT) return null;
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  return crypto
    .createHash('sha256')
    .update(`${REFERRAL_SIGNAL_SALT}|${normalized}`)
    .digest('hex');
};

export const getRequestClientContext = (req: HeaderCarrier | null | undefined) => {
  const xff = readHeader(req, 'x-forwarded-for');
  const ip = xff ? xff.split(',')[0].trim() : readHeader(req, 'x-real-ip');
  const userAgent = readHeader(req, 'user-agent');
  return {
    ip: ip || null,
    userAgent: userAgent || null,
  };
};

export const recordReferralIdentitySignal = async (
  client: SupabaseClient,
  params: {
    userId: string;
    eventType: 'apply_referral' | 'checkout_referral' | 'payment_verify' | 'manual_review';
    referralCode?: string | null;
    email?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    deviceFingerprint?: string | null;
    metadata?: Record<string, unknown>;
  }
) => {
  if (!REFERRAL_SIGNAL_SALT) {
    return false;
  }
  const emailHash = params.email ? hashReferralSignal(normalizeEmailIdentity(params.email)) : null;
  const ipHash = params.ip ? hashReferralSignal(params.ip) : null;
  const uaHash = params.userAgent ? hashReferralSignal(params.userAgent) : null;
  const fingerprint = normalizeDeviceFingerprint(params.deviceFingerprint || '');
  const deviceHash = fingerprint ? hashReferralSignal(fingerprint) : null;

  const { error } = await client.from('referral_identity_signals').insert({
    user_id: params.userId,
    event_type: params.eventType,
    referral_code: params.referralCode ? String(params.referralCode).trim().toUpperCase() : null,
    ip_hash: ipHash,
    user_agent_hash: uaHash,
    device_fingerprint_hash: deviceHash,
    email_hash: emailHash,
    metadata: params.metadata || {},
    created_at: nowIso(),
  });

  if (error) {
    const message = String(error.message || '').toLowerCase();
    if (
      message.includes('relation') ||
      message.includes('does not exist') ||
      message.includes('permission denied') ||
      message.includes('forbidden')
    ) {
      return false;
    }
    throw new Error(error.message || 'Could not store referral identity signal.');
  }
  return true;
};

export const assessReferralAbuseRisk = async (
  client: SupabaseClient,
  params: {
    referrerUserId: string;
    referredUserId: string;
  }
): Promise<{
  is_high_risk: boolean;
  same_ip_hash?: boolean;
  same_device_hash?: boolean;
  same_email_hash?: boolean;
  ip_cluster_user_count?: number;
  device_cluster_user_count?: number;
  email_cluster_user_count?: number;
  reason?: string;
  [key: string]: unknown;
}> => {
  const { data, error } = await client.rpc('billing_referral_risk_assessment', {
    p_referrer_user_id: params.referrerUserId,
    p_referred_user_id: params.referredUserId,
  });

  if (error) {
    const message = String(error.message || '').toLowerCase();
    if (
      message.includes('billing_referral_risk_assessment') ||
      message.includes('function') ||
      message.includes('does not exist')
    ) {
      return { is_high_risk: false, reason: 'risk_assessment_unavailable' };
    }
    throw new Error(error.message || 'Could not evaluate referral risk.');
  }

  if (!data || typeof data !== 'object') {
    return { is_high_risk: false, reason: 'risk_assessment_empty' };
  }

  const row = data as Record<string, unknown>;
  return {
    ...row,
    is_high_risk: Boolean(row.is_high_risk),
  } as {
    is_high_risk: boolean;
    same_ip_hash?: boolean;
    same_device_hash?: boolean;
    same_email_hash?: boolean;
    ip_cluster_user_count?: number;
    device_cluster_user_count?: number;
    email_cluster_user_count?: number;
    reason?: string;
    [key: string]: unknown;
  };
};

export const getReferrerRewardCountForCurrentMonth = async (
  client: SupabaseClient,
  referrerUserId: string
) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  const { count, error } = await client
    .from('referral_events')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_user_id', referrerUserId)
    .in('status', ['rewarded', 'fraud_hold'])
    .gte('created_at', monthStart)
    .lt('created_at', monthEnd);

  if (error) throw new Error(error.message || 'Could not validate referral capacity.');
  return Number(count || 0);
};

export const readPlanMonths = (planCode: string) => {
  return PLAN_MONTHS[planCode] || 1;
};

export const addMonths = (iso: string, months: number) => {
  const date = new Date(iso);
  date.setMonth(date.getMonth() + Math.max(1, months));
  return date.toISOString();
};

export const addDays = (iso: string, days: number) => {
  const date = new Date(iso);
  date.setDate(date.getDate() + Math.max(0, days));
  return date.toISOString();
};

export const daysBetween = (fromIso: string, toIso: string) => {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  return Math.floor((to - from) / (24 * 60 * 60 * 1000));
};

export const computeBonusDaysFromPoints = (points: number, amountInr: number, billingMonths: number) => {
  return computeBonusDaysFromPointsRule(points, amountInr, billingMonths);
};

export const getAvailablePoints = async (client: SupabaseClient, userId: string) => {
  const { data, error } = await client
    .from('reward_points_ledger')
    .select('points, expires_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message || 'Could not load points ledger.');

  const now = Date.now();
  return (data || []).reduce((sum, row: any) => {
    const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : null;
    if (expiresAt && expiresAt < now) return sum;
    return sum + safeNum(row.points, 0);
  }, 0);
};

export const getLatestSubscription = async (client: SupabaseClient, userId: string) => {
  const now = nowIso();
  const { data: current, error: currentError } = await client
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing', 'past_due'])
    .lte('start_at', now)
    .or(`end_at.is.null,end_at.gte.${now}`)
    .order('start_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (currentError) throw new Error(currentError.message || 'Could not load current subscription.');
  if (current) return current as Record<string, any>;

  const { data, error } = await client
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message || 'Could not load subscription.');
  return data as Record<string, any> | null;
};

export const getBillingProfile = async (client: SupabaseClient, userId: string) => {
  const { data, error } = await client
    .from('user_billing_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message || 'Could not load billing profile.');
  return data as Record<string, any> | null;
};

const randomReferralCode = () => `FV${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

export const ensureBillingProfile = async (client: SupabaseClient, userId: string, country = 'India') => {
  const existing = await getBillingProfile(client, userId);
  if (existing) return existing;

  const referralCode = randomReferralCode();

  const { data, error } = await client
    .from('user_billing_profiles')
    .insert({
      user_id: userId,
      country,
      billing_currency: 'INR',
      referral_code: referralCode,
      trial_eligible: false,
      trial_started_at: null,
      trial_end_at: null,
      trial_consumed: true,
      trial_activated_at: null,
    })
    .select('*')
    .maybeSingle();

  if (error) throw new Error(error.message || 'Could not create billing profile.');
  return data as Record<string, any>;
};

export const activateMigrationTrialIfEligible = async (
  client: SupabaseClient,
  profile: Record<string, any>,
  trialDays: number
) => {
  if (!profile?.user_id) return profile;
  const alreadyStarted = Boolean(profile.trial_started_at);
  const eligible = profile.trial_eligible === true;
  const consumed = profile.trial_consumed === true;
  if (!eligible || consumed || alreadyStarted) return profile;

  const startedAt = nowIso();
  const endAt = addDays(startedAt, trialDays);

  const { data, error } = await client
    .from('user_billing_profiles')
    .update({
      trial_started_at: startedAt,
      trial_end_at: endAt,
      trial_consumed: false,
      trial_eligible: false,
      trial_activated_at: startedAt,
      updated_at: startedAt,
    })
    .eq('user_id', String(profile.user_id))
    .select('*')
    .maybeSingle();

  if (error) throw new Error(error.message || 'Could not activate migration trial.');
  return (data || profile) as Record<string, any>;
};

export const getActivePlans = async (client: SupabaseClient) => {
  const { data, error } = await client
    .from('billing_plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message || 'Could not load billing plans.');
  return (data || []) as BillingPlanRow[];
};

export const getPlanByCode = async (client: SupabaseClient, planCode: string) => {
  const { data, error } = await client
    .from('billing_plans')
    .select('*')
    .eq('plan_code', planCode)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw new Error(error.message || 'Could not load selected plan.');
  return data as BillingPlanRow | null;
};

export const getMonthlyEquivalent = (amountInr: number, months: number) => {
  const safeMonths = Math.max(1, months);
  return amountInr / safeMonths;
};

export const calculateCouponDiscount = (amount: number, coupon: Record<string, any>) => {
  return calculateCouponDiscountRule(amount, coupon);
};

export const isUpgradeAllowed = (params: {
  currentAmount: number;
  currentMonths: number;
  targetAmount: number;
  targetMonths: number;
  currentIsPaid: boolean;
}) => {
  return isUpgradeAllowedRule(params);
};

export const verifyRazorpaySignature = (orderId: string, paymentId: string, signature: string, webhookSecret: string) => {
  const payload = `${orderId}|${paymentId}`;
  const digest = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');
  const digestBuf = Buffer.from(digest, 'hex');
  const signatureBuf = Buffer.from(String(signature || ''), 'hex');
  if (!digestBuf.length || digestBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(digestBuf, signatureBuf);
};

export const verifyRazorpaySubscriptionSignature = (paymentId: string, subscriptionId: string, signature: string, webhookSecret: string) => {
  const payload = `${paymentId}|${subscriptionId}`;
  const digest = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');
  const digestBuf = Buffer.from(digest, 'hex');
  const signatureBuf = Buffer.from(String(signature || ''), 'hex');
  if (!digestBuf.length || digestBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(digestBuf, signatureBuf);
};

export const toMinorInr = (amountInr: number) => {
  return Math.max(0, Math.round(amountInr * 100));
};

export const getAuthHeaderForRazorpay = () => {
  const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  if (!keyId || !keySecret) {
    throw new Error('Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET');
  }
  return {
    keyId,
    keySecret,
    authHeader: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
  };
};

export const createRazorpayOrder = async (params: {
  amountInr: number;
  receipt: string;
  notes?: Record<string, string>;
}) => {
  const { authHeader } = getAuthHeaderForRazorpay();
  const amount = toMinorInr(params.amountInr);
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount,
      currency: 'INR',
      receipt: params.receipt,
      notes: params.notes || {},
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.description || payload?.message || 'Could not create Razorpay order.');
  }
  return payload as {
    id: string;
    entity: string;
    amount: number;
    amount_paid: number;
    amount_due: number;
    currency: string;
    receipt: string;
    status: string;
    attempts: number;
    notes: Record<string, string>;
    created_at: number;
  };
};

export const createRazorpaySubscription = async (params: {
  providerPlanId: string;
  customerNotify?: boolean;
  totalCount?: number;
  notes?: Record<string, string>;
}) => {
  const { authHeader } = getAuthHeaderForRazorpay();
  const response = await fetch('https://api.razorpay.com/v1/subscriptions', {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      plan_id: params.providerPlanId,
      customer_notify: params.customerNotify === false ? 0 : 1,
      total_count: Math.max(1, Number(params.totalCount || 120)),
      notes: params.notes || {},
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.description || payload?.message || 'Could not create Razorpay subscription.');
  }
  return payload as {
    id: string;
    status: string;
    short_url?: string;
    plan_id?: string;
    customer_id?: string;
    current_start?: number;
    current_end?: number;
  };
};

export const cancelRazorpaySubscription = async (providerSubscriptionId: string, cancelAtCycleEnd = true) => {
  const { authHeader } = getAuthHeaderForRazorpay();
  const response = await fetch(`https://api.razorpay.com/v1/subscriptions/${providerSubscriptionId}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.description || payload?.message || 'Could not cancel Razorpay subscription.');
  }
  return payload;
};

export const resumeRazorpaySubscription = async (providerSubscriptionId: string) => {
  const { authHeader } = getAuthHeaderForRazorpay();
  const response = await fetch(`https://api.razorpay.com/v1/subscriptions/${providerSubscriptionId}/resume`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      resume_at: 'now',
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.description || payload?.message || 'Could not resume Razorpay subscription.');
  }
  return payload;
};

export const computeAccessState = (subscription: Record<string, any> | null, overrideUntil: string | null) => {
  return computeAccessStateRule(subscription, overrideUntil, BILLING_POLICY);
};

export const computePastDueDays = (subscription: Record<string, any> | null, now = Date.now()) => {
  return computePastDueDaysRule(subscription, now);
};

export const computeRetryTimeline = (subscription: Record<string, any> | null) => {
  return computeRetryTimelineRule(subscription, BILLING_POLICY.retryDays, addDays) as Array<{
    day: number;
    scheduledAt: string;
    elapsed: boolean;
  }>;
};

export const getActiveOverrideUntil = async (client: SupabaseClient, userId: string) => {
  const { data, error } = await client
    .from('billing_admin_overrides')
    .select('ends_at')
    .eq('user_id', userId)
    .eq('is_active', true)
    .gt('ends_at', nowIso())
    .order('ends_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message || 'Could not load billing override.');
  return data?.ends_at ? String(data.ends_at) : null;
};

export const listBillingHistory = async (client: SupabaseClient, userId: string) => {
  const [subscriptionsRes, paymentsRes, couponRes, pointsRes, referralRes, messageRes] = await Promise.all([
    client
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(24),
    client
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(60),
    client
      .from('subscription_coupon_redemptions')
      .select('id,coupon_id,payment_id,subscription_id,amount_discount,redeemed_at,metadata')
      .eq('user_id', userId)
      .order('redeemed_at', { ascending: false })
      .limit(24),
    client
      .from('reward_points_ledger')
      .select('id,event_type,points,source_ref,expires_at,metadata,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(120),
    client
      .from('referral_events')
      .select('id,referrer_user_id,referred_user_id,referral_code,status,metadata,created_at')
      .or(`referrer_user_id.eq.${userId},referred_user_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(120),
    client
      .from('billing_message_events')
      .select('id,template_key,channel,status,payload,reason,created_at,sent_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(60),
  ]);

  if (subscriptionsRes.error) throw new Error(subscriptionsRes.error.message || 'Could not load subscriptions.');
  if (paymentsRes.error) throw new Error(paymentsRes.error.message || 'Could not load payments.');
  if (couponRes.error) throw new Error(couponRes.error.message || 'Could not load coupon history.');
  if (pointsRes.error) throw new Error(pointsRes.error.message || 'Could not load points history.');
  if (referralRes.error) throw new Error(referralRes.error.message || 'Could not load referral history.');
  if (messageRes.error) throw new Error(messageRes.error.message || 'Could not load message history.');

  return {
    subscriptions: (subscriptionsRes.data || []) as Record<string, any>[],
    payments: (paymentsRes.data || []) as Record<string, any>[],
    couponRedemptions: (couponRes.data || []) as Record<string, any>[],
    pointsLedger: (pointsRes.data || []) as Record<string, any>[],
    referralEvents: (referralRes.data || []) as Record<string, any>[],
    messageEvents: (messageRes.data || []) as Record<string, any>[],
  };
};

export const recordBillingActivity = async (
  client: SupabaseClient,
  userId: string,
  eventName: string,
  metadata: Record<string, unknown> = {}
) => {
  await client
    .from('activity_events')
    .insert({
      user_id: userId,
      event_name: eventName,
      source: 'billing',
      metadata,
      event_time: nowIso(),
    });
};

export const isPointsFrozenForUser = async (client: SupabaseClient, userId: string) => {
  const profile = await getBillingProfile(client, userId);
  return Boolean(profile?.points_frozen);
};

export const queueBillingMessageEvent = async (
  client: SupabaseClient,
  params: {
    userId: string;
    templateKey: string;
    channel?: 'email' | 'mobile' | 'in_app';
    payload?: Record<string, unknown>;
    reason?: string | null;
  }
) => {
  const { data: template, error: templateError } = await client
    .from('billing_message_templates')
    .select('template_key, channel, is_active')
    .eq('template_key', params.templateKey)
    .maybeSingle();
  if (templateError || !template || !template.is_active) return false;

  const { error: eventError } = await client
    .from('billing_message_events')
    .insert({
      user_id: params.userId,
      template_key: String(template.template_key),
      channel: params.channel || String(template.channel || 'in_app'),
      status: 'queued',
      payload: params.payload || {},
      reason: params.reason || null,
      created_at: nowIso(),
    });

  return !eventError;
};

export const logBillingErrorEvent = async (
  client: SupabaseClient,
  params: {
    source: string;
    severity?: 'warn' | 'error' | 'critical';
    errorCode?: string | null;
    errorMessage: string;
    metadata?: Record<string, unknown>;
  }
) => {
  const { error } = await client
    .from('billing_error_events')
    .insert({
      source: params.source,
      severity: params.severity || 'error',
      error_code: params.errorCode || null,
      error_message: params.errorMessage,
      metadata: params.metadata || {},
      created_at: nowIso(),
    });
  if (error) {
    console.error('[billing.error.channel]', error.message || error);
    return false;
  }
  return true;
};
