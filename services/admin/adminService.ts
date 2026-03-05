import { supabase } from '../supabase';
import type {
  AdminAccess,
  AdminAnalyticsSnapshot,
  AdminAuditLog,
  AdminBehaviorAbTestImpact,
  AdminBehaviorAlertTrigger,
  AdminBehaviorCohortRow,
  AdminBehaviorFunnelRow,
  AdminBehaviorHeatmapRow,
  AdminBehaviorInsight,
  AdminBehaviorIssueRow,
  AdminBehaviorJourneyStage,
  AdminBehaviorPathRow,
  AdminBehaviorPlatformRow,
  AdminBehaviorRealtimeEvent,
  AdminBehaviorReport,
  AdminBehaviorSearchInsightRow,
  AdminBehaviorSessionReplayRow,
  AdminBehaviorTrafficRow,
  AdminCrmComplaintTicket,
  AdminCrmContact,
  AdminCrmCustomObject,
  AdminCrmDeal,
  AdminCrmEmailTemplate,
  AdminCrmLead,
  AdminCrmPipelineStage,
  AdminCrmReport,
  AdminCrmTask,
  AdminCrmTimelineItem,
  AdminCrmWorkflow,
  AdminCustomer,
  AdminCustomerTimeline,
  AdminDashboardSummary,
  AdminFraudFlag,
  AdminGrowthCapability,
  AdminGrowthExperiment,
  AdminGrowthInsight,
  AdminGrowthIntegration,
  AdminGrowthJourney,
  AdminGrowthJourneyStep,
  AdminGrowthJourneyTriggerType,
  AdminGrowthReadiness,
  AdminGrowthSegmentPerformance,
  AdminGrowthTransactional,
  AdminKycCase,
  AdminMarketingGrowthReport,
  AdminOverviewReport,
  AdminPayment,
  AdminPermissionDefinition,
  AdminPortfolioRow,
  AdminRole,
  AdminSecuritySession,
  AdminSubscription,
  AdminTwoFactorSetup,
  AdminTwoFactorStatus,
  AdminUsageReport,
  AdminUserAccount,
  AdminWorkspaceMembership,
  FeatureFlag,
  SupportTicket,
  WebhookEvent,
} from './types';

const ADMIN_WORKSPACE_STORAGE_KEY = 'finvantage_admin_workspace_id';
const ADMIN_SESSION_TOKEN_STORAGE_KEY = 'finvantage_admin_session_token';

const EMPTY_ACCESS: AdminAccess = {
  isAdmin: false,
  userId: null,
  organizationId: null,
  organizationName: null,
  workspaceId: null,
  workspaceName: null,
  roleKey: null,
  roleName: null,
  permissions: [],
  workspaces: [],
  twoFactorRequired: false,
  twoFactorEnabled: false,
  twoFactorStatus: 'disabled',
  twoFactorLastVerifiedAt: null,
  recoveryCodesRemaining: 0,
};

const toError = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String((error as { message?: unknown }).message || '')
      .trim()
      .replace(/supabase/gi, 'platform')
      .replace(/gotrue/gi, 'identity service');
    if (msg) return new Error(msg);
  }
  return new Error(
    fallback
      .replace(/supabase/gi, 'platform')
      .replace(/gotrue/gi, 'identity service')
  );
};

const isMissingRelationError = (error: unknown) => {
  const code = (error as { code?: string } | null)?.code;
  return code === '42P01' || code === 'PGRST205' || code === 'PGRST204';
};

const normalizeAccess = (raw: unknown): AdminAccess => {
  if (!raw || typeof raw !== 'object') return EMPTY_ACCESS;
  const obj = raw as Record<string, unknown>;
  const workspacesRaw = Array.isArray(obj.workspaces) ? obj.workspaces : [];
  const workspaces: AdminWorkspaceMembership[] = workspacesRaw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const workspaceId = typeof row.workspaceId === 'string' ? row.workspaceId : '';
      const organizationId = typeof row.organizationId === 'string' ? row.organizationId : '';
      if (!workspaceId || !organizationId) return null;
      return {
        organizationId,
        organizationName: typeof row.organizationName === 'string' ? row.organizationName : 'Organization',
        organizationSlug: typeof row.organizationSlug === 'string' ? row.organizationSlug : '',
        workspaceId,
        workspaceName: typeof row.workspaceName === 'string' ? row.workspaceName : 'Workspace',
        workspaceSlug: typeof row.workspaceSlug === 'string' ? row.workspaceSlug : '',
        roleKey: typeof row.roleKey === 'string' ? row.roleKey : 'support',
        roleName: typeof row.roleName === 'string' ? row.roleName : 'Support',
        twoFactorRequired: Boolean(row.twoFactorRequired),
      } as AdminWorkspaceMembership;
    })
    .filter(Boolean) as AdminWorkspaceMembership[];

  return {
    isAdmin: Boolean(obj.isAdmin),
    userId: typeof obj.userId === 'string' ? obj.userId : null,
    organizationId: typeof obj.organizationId === 'string' ? obj.organizationId : null,
    organizationName: typeof obj.organizationName === 'string' ? obj.organizationName : null,
    workspaceId: typeof obj.workspaceId === 'string' ? obj.workspaceId : null,
    workspaceName: typeof obj.workspaceName === 'string' ? obj.workspaceName : null,
    roleKey: typeof obj.roleKey === 'string' ? obj.roleKey : null,
    roleName: typeof obj.roleName === 'string' ? obj.roleName : null,
    permissions: Array.isArray(obj.permissions) ? obj.permissions.map(String) : [],
    workspaces,
    twoFactorRequired: Boolean(obj.twoFactorRequired),
    twoFactorEnabled: Boolean(obj.twoFactorEnabled),
    twoFactorStatus:
      obj.twoFactorStatus === 'pending' || obj.twoFactorStatus === 'enabled' || obj.twoFactorStatus === 'disabled'
        ? obj.twoFactorStatus
        : 'disabled',
    twoFactorLastVerifiedAt: typeof obj.twoFactorLastVerifiedAt === 'string' ? obj.twoFactorLastVerifiedAt : null,
    recoveryCodesRemaining: num(obj.recoveryCodesRemaining),
  };
};

const isBrowser = () => typeof window !== 'undefined' && !!window.localStorage;

const readLocal = (key: string): string | null => {
  if (!isBrowser()) return null;
  try {
    const value = window.localStorage.getItem(key);
    return value && value.trim() ? value : null;
  } catch {
    return null;
  }
};

const writeLocal = (key: string, value: string | null) => {
  if (!isBrowser()) return;
  try {
    if (!value) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // ignore storage quota/browser mode restrictions
  }
};

const randomHex = (bytes: number) => {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buffer = new Uint8Array(bytes);
    crypto.getRandomValues(buffer);
    return [...buffer].map((value) => value.toString(16).padStart(2, '0')).join('');
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`.slice(0, bytes * 2);
};

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const randomBase32Secret = (length = 32) => {
  let output = '';
  for (let i = 0; i < length; i += 1) {
    const random = parseInt(randomHex(1).slice(0, 2), 16);
    output += BASE32_ALPHABET[random % BASE32_ALPHABET.length];
  }
  return output;
};

const randomRecoveryCode = () => {
  const raw = randomHex(5).toUpperCase();
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
};

export const getAdminWorkspaceId = () => readLocal(ADMIN_WORKSPACE_STORAGE_KEY);

export const setAdminWorkspaceId = (workspaceId: string | null) => {
  writeLocal(ADMIN_WORKSPACE_STORAGE_KEY, workspaceId);
};

const getWorkspaceIdOrNull = () => {
  const workspaceId = getAdminWorkspaceId();
  return workspaceId && workspaceId.trim() ? workspaceId : null;
};

const requireWorkspaceId = () => {
  const workspaceId = getWorkspaceIdOrNull();
  if (!workspaceId) throw new Error('No workspace selected. Select a workspace first.');
  return workspaceId;
};

export const getAdminSessionToken = () => {
  const existing = readLocal(ADMIN_SESSION_TOKEN_STORAGE_KEY);
  if (existing) return existing;
  const created = randomHex(24);
  writeLocal(ADMIN_SESSION_TOKEN_STORAGE_KEY, created);
  return created;
};

const num = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeSummary = (raw: unknown): AdminDashboardSummary => {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    totalUsers: num(obj.totalUsers),
    onboardedUsers: num(obj.onboardedUsers),
    newUsers30d: num(obj.newUsers30d),
    dau: num(obj.dau),
    mau: num(obj.mau),
    totalAum: num(obj.totalAum),
    mtdRevenue: num(obj.mtdRevenue),
    failedPayments30d: num(obj.failedPayments30d),
    pendingKyc: num(obj.pendingKyc),
    openFraudFlags: num(obj.openFraudFlags),
    blockedUsers: num(obj.blockedUsers),
  };
};

const countDistribution = (rows: string[]) => {
  const map = new Map<string, number>();
  rows.forEach((keyRaw) => {
    const key = keyRaw || 'unknown';
    map.set(key, (map.get(key) || 0) + 1);
  });

  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
};

const safeJson = async (resp: Response): Promise<any | null> => {
  const contentType = resp.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  try {
    return await resp.json();
  } catch {
    return null;
  }
};

const mapPayment = (row: Record<string, any>): AdminPayment => ({
  id: String(row.id),
  user_id: String(row.user_id),
  subscription_id: row.subscription_id ? String(row.subscription_id) : null,
  provider: String(row.provider || row.gateway || 'internal'),
  provider_payment_id: row.provider_payment_id || row.gateway_payment_id || null,
  status: String(row.status || 'unknown'),
  amount: num(row.amount),
  currency: String(row.currency || 'INR'),
  attempted_at: String(row.attempted_at || row.created_at || new Date().toISOString()),
  settled_at: row.settled_at || null,
  failure_reason: row.failure_reason || null,
});

const mapSubscription = (row: Record<string, any>): AdminSubscription => ({
  id: String(row.id),
  user_id: String(row.user_id),
  plan_code: String(row.plan_code || row.plan_id || 'starter'),
  status: String(row.status || 'unknown'),
  billing_cycle: String(row.billing_cycle || 'monthly'),
  amount: num(row.amount),
  currency: String(row.currency || 'INR'),
  start_at: String(row.start_at || row.current_period_start || row.created_at || new Date().toISOString()),
  end_at: row.end_at || row.current_period_end || null,
  cancel_at_period_end: Boolean(row.cancel_at_period_end || row.cancelled_at),
  auto_renew: row.auto_renew !== false,
  provider: String(row.provider || row.gateway || 'internal'),
  provider_subscription_id: row.provider_subscription_id || row.gateway_sub_id || null,
  provider_customer_id: row.provider_customer_id || row.gateway_customer_id || null,
});

const mapFeatureFlag = (row: Record<string, any>): FeatureFlag => {
  const flagKey = String(row.flag_key || row.key || 'unknown_flag');
  return {
    id: String(row.id || flagKey),
    flag_key: flagKey,
    description: row.description || null,
    is_enabled: Boolean(row.is_enabled),
    rollout_percent: num(row.rollout_percent ?? row.rollout_pct, 100),
    config: (row.config || row.metadata || {}) as Record<string, unknown>,
    updated_at: String(row.updated_at || row.created_at || new Date().toISOString()),
  };
};

const mapWebhookEvent = (row: Record<string, any>): WebhookEvent => ({
  id: String(row.id),
  provider: String(row.provider || 'unknown'),
  event_id: row.event_id || null,
  event_type: String(row.event_type || 'unknown'),
  status: String(row.status || 'received'),
  replay_count: num(row.replay_count),
  received_at: String(row.received_at || row.created_at || new Date().toISOString()),
  last_replayed_at: row.last_replayed_at || null,
  error_message: row.error_message || null,
});

const pct = (numerator: number, denominator: number) => {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
};

const intersectionCount = (left: Set<string>, right: Set<string>) => {
  if (!left.size || !right.size) return 0;
  let count = 0;
  const iterate = left.size <= right.size ? left : right;
  const against = iterate === left ? right : left;
  iterate.forEach((value) => {
    if (against.has(value)) count += 1;
  });
  return count;
};

const includesAny = (value: string, matches: string[]) => matches.some((token) => value.includes(token));

const normalizeChannel = (raw?: string | null) => {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return 'other';
  if (value === 'in_app' || value === 'in-app' || value === 'app') return 'in_app';
  if (value === 'email') return 'email';
  if (value === 'sms') return 'sms';
  if (value === 'whatsapp') return 'whatsapp';
  if (value === 'rcs') return 'rcs';
  if (value === 'web_push' || value === 'webpush' || value === 'push_web') return 'web_push';
  if (value === 'mobile_push' || value === 'mobilepush' || value === 'push_mobile' || value === 'push') return 'mobile_push';
  return 'other';
};

const detectChannelsFromText = (raw?: string | null) => {
  const value = String(raw || '').trim().toLowerCase();
  const detected = new Set<string>();
  if (!value) return detected;

  const normalized = normalizeChannel(value);
  if (normalized !== 'other') detected.add(normalized);

  if (/\bmobile[_-]?push\b|\bpush[_-]?mobile\b|\bpush\b/.test(value)) detected.add('mobile_push');
  if (/\bweb[_-]?push\b|\bpush[_-]?web\b/.test(value)) detected.add('web_push');
  if (/\bin[_-]?app\b|\binapp\b/.test(value)) detected.add('in_app');
  if (/\bemail\b/.test(value)) detected.add('email');
  if (/\bsms\b/.test(value)) detected.add('sms');
  if (/\bwhatsapp\b/.test(value)) detected.add('whatsapp');
  if (/\brcs\b/.test(value)) detected.add('rcs');

  return detected;
};

const collectChannels = (value: unknown, target: Set<string>, depth = 0) => {
  if (depth > 3 || value == null) return;

  if (typeof value === 'string') {
    detectChannelsFromText(value).forEach((channel) => target.add(channel));
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectChannels(entry, target, depth + 1));
    return;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    Object.entries(record).forEach(([key, entry]) => {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('channel')
        || lowerKey.includes('provider')
        || lowerKey === 'step'
        || lowerKey === 'steps'
      ) {
        collectChannels(entry, target, depth + 1);
      }
    });
  }
};

const normalizeGrowthTriggerType = (raw: unknown): AdminGrowthJourneyTriggerType => {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'behavior') return 'behavior';
  if (value === 'time') return 'time';
  return 'event';
};

const buildDefaultJourneySteps = (journey: string, triggerValue: string): AdminGrowthJourneyStep[] => {
  const base = journey.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'journey';
  const trigger = String(triggerValue || '').toLowerCase();
  const isDrip = journey.toLowerCase().includes('drip') || trigger.includes('payment_failed');
  return [
    { id: `${base}_step_1`, title: 'Primary Message', channel: 'in_app', delayHours: 0 },
    { id: `${base}_step_2`, title: isDrip ? 'Follow-up Reminder' : 'Conversion Nudge', channel: 'email', delayHours: isDrip ? 24 : 12 },
    { id: `${base}_step_3`, title: 'Final Follow-up', channel: isDrip ? 'sms' : 'mobile_push', delayHours: 48 },
  ];
};

const normalizeJourneySteps = (
  journey: string,
  rawSteps: unknown,
  triggerValue: string
): AdminGrowthJourneyStep[] => {
  const defaults = buildDefaultJourneySteps(journey, triggerValue);
  if (!Array.isArray(rawSteps) || !rawSteps.length) return defaults;

  return rawSteps.map((row, index) => {
    const step = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
    const fallback = defaults[index] || defaults[defaults.length - 1];
    const stepId = String(step.id || `${journey.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'journey'}_step_${index + 1}`);
    const title = String(step.title || step.name || fallback?.title || `Step ${index + 1}`);
    const channel = normalizeChannel(String(step.channel || fallback?.channel || 'in_app'));
    const delayHours = Math.max(0, Math.round(num(step.delayHours ?? step.delay_hours ?? fallback?.delayHours, 0)));
    return { id: stepId, title, channel, delayHours };
  });
};

const normalizeReadiness = (score: number): AdminGrowthReadiness => {
  if (score >= 80) return 'ready';
  if (score >= 45) return 'partial';
  return 'planned';
};

const buildCapability = (params: {
  id: string;
  title: string;
  summary: string;
  score: number;
  requirements: string[];
  gaps: string[];
}): AdminGrowthCapability => {
  const safeScore = Math.max(0, Math.min(100, Math.round(params.score)));
  return {
    id: params.id,
    title: params.title,
    summary: params.summary,
    readiness: normalizeReadiness(safeScore),
    completionPct: safeScore,
    requirements: params.requirements,
    gaps: params.gaps,
  };
};

export async function getAdminAccess(): Promise<AdminAccess> {
  const selectedWorkspace = getAdminWorkspaceId();
  const { data, error } = await supabase.rpc('admin_current_access_v2', {
    p_workspace_id: selectedWorkspace,
  });

  if (!error) {
    const access = normalizeAccess(data);
    const workspaceFromAccess = access.workspaceId || access.workspaces?.[0]?.workspaceId || null;
    if (workspaceFromAccess && workspaceFromAccess !== selectedWorkspace) {
      setAdminWorkspaceId(workspaceFromAccess);
    }
    return access;
  }

  const { data: legacyData, error: legacyError } = await supabase.rpc('admin_current_access');
  if (!legacyError) return normalizeAccess(legacyData);

  // Fallback for partially migrated environments.
  const sessionUser = (await supabase.auth.getSession()).data.session?.user || null;
  if (!sessionUser) return EMPTY_ACCESS;

  const { data: adminRow, error: adminError } = await supabase
    .from('admin_users')
    .select('user_id, role_id, is_active')
    .eq('user_id', sessionUser.id)
    .maybeSingle();

  if (adminError || !adminRow || !adminRow.is_active) return EMPTY_ACCESS;

  const { data: roleData } = await supabase
    .from('admin_roles')
    .select('role_key, display_name')
    .eq('id', adminRow.role_id)
    .maybeSingle();

  return {
    isAdmin: true,
    userId: sessionUser.id,
    organizationId: null,
    organizationName: null,
    workspaceId: null,
    workspaceName: null,
    roleKey: roleData?.role_key || 'unknown',
    roleName: roleData?.display_name || roleData?.role_key || 'Unknown Role',
    permissions: roleData?.role_key === 'super_admin' ? ['*'] : [],
    workspaces: [],
    twoFactorRequired: false,
    twoFactorEnabled: false,
    twoFactorStatus: 'disabled',
    twoFactorLastVerifiedAt: null,
    recoveryCodesRemaining: 0,
  };
}

export async function getAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  const { data, error } = await supabase.rpc('admin_dashboard_summary');
  if (!error) return normalizeSummary(data);

  // Fallback from base table counts.
  const [
    profilesCount,
    onboardedCount,
    assets,
    failedPayments,
    blocked,
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('onboarding_done', true),
    supabase.from('assets').select('current_value'),
    supabase.from('payments').select('*', { count: 'exact', head: true }).in('status', ['failed', 'declined']),
    supabase.from('user_admin_flags').select('*', { count: 'exact', head: true }).eq('is_blocked', true),
  ]);

  if (profilesCount.error) throw toError(profilesCount.error, 'Could not load admin dashboard summary.');

  return {
    totalUsers: profilesCount.count || 0,
    onboardedUsers: onboardedCount.count || 0,
    newUsers30d: 0,
    dau: 0,
    mau: 0,
    totalAum: (assets.data || []).reduce((sum, row) => sum + num((row as any).current_value), 0),
    mtdRevenue: 0,
    failedPayments30d: failedPayments.count || 0,
    pendingKyc: 0,
    openFraudFlags: 0,
    blockedUsers: blocked.count || 0,
  };
}

export async function getAdminCustomers(params?: {
  search?: string;
  kycStatus?: string;
  planCode?: string;
  riskLevel?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminCustomer[]> {
  const { data, error } = await supabase.rpc('admin_list_customers', {
    p_search: params?.search ?? null,
    p_kyc_status: params?.kycStatus ?? null,
    p_plan_code: params?.planCode ?? null,
    p_risk_level: params?.riskLevel ?? null,
    p_limit: params?.limit ?? 50,
    p_offset: params?.offset ?? 0,
  });

  if (!error) return (data || []) as AdminCustomer[];

  const fallback = await supabase
    .from('profiles')
    .select('id, identifier, first_name, last_name, country, onboarding_done, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(params?.limit ?? 50)
    .range(params?.offset ?? 0, (params?.offset ?? 0) + (params?.limit ?? 50) - 1);

  if (fallback.error) throw toError(fallback.error, 'Could not load customers.');

  let rows = (fallback.data || []).map((row: any) => ({
    user_id: String(row.id),
    email: String(row.identifier || ''),
    first_name: String(row.first_name || ''),
    last_name: row.last_name || null,
    mobile: null,
    country: row.country || null,
    onboarding_done: Boolean(row.onboarding_done),
    risk_level: null,
    kyc_status: 'not_started',
    plan_code: null,
    subscription_status: null,
    blocked: false,
    created_at: String(row.created_at || new Date().toISOString()),
    updated_at: String(row.updated_at || row.created_at || new Date().toISOString()),
  }));

  if (params?.search?.trim()) {
    const q = params.search.trim().toLowerCase();
    rows = rows.filter((row) =>
      row.email.toLowerCase().includes(q) ||
      row.first_name.toLowerCase().includes(q) ||
      String(row.user_id).toLowerCase() === q
    );
  }

  return rows;
}

export async function getAdminCustomerTimeline(userId: string): Promise<AdminCustomerTimeline> {
  const { data, error } = await supabase.rpc('admin_customer_timeline', {
    p_user_id: userId,
    p_limit: 120,
  });

  if (!error) {
    const parsed = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
    return {
      profile: parsed.profile && typeof parsed.profile === 'object' ? (parsed.profile as Record<string, unknown>) : null,
      timeline: Array.isArray(parsed.timeline) ? (parsed.timeline as AdminCustomerTimeline['timeline']) : [],
    };
  }

  const [profile, transactions, goals] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(80),
    supabase.from('goals').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(40),
  ]);

  if (profile.error) throw toError(profile.error, 'Could not load customer timeline.');

  const timeline = [
    ...(transactions.data || []).map((row: any) => ({
      time: row.created_at || row.date,
      type: 'transaction',
      title: row.category,
      detail: row.description,
      amount: num(row.amount),
      meta: { txnType: row.type },
    })),
    ...(goals.data || []).map((row: any) => ({
      time: row.created_at,
      type: 'goal',
      title: row.type,
      detail: row.description,
      amount: num(row.target_amount_today),
      meta: { priority: row.priority },
    })),
  ].sort((a, b) => String(b.time || '').localeCompare(String(a.time || '')));

  return {
    profile: (profile.data || null) as Record<string, unknown> | null,
    timeline,
  };
}

export async function setCustomerBlocked(userId: string, isBlocked: boolean, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('admin_set_user_block', {
    p_user_id: userId,
    p_is_blocked: isBlocked,
    p_reason: reason || null,
  });
  if (!error) return;

  const payload: Record<string, unknown> = {
    user_id: userId,
    is_blocked: isBlocked,
    blocked_reason: isBlocked ? reason || null : null,
    blocked_at: isBlocked ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const fallback = await supabase.from('user_admin_flags').upsert(payload, { onConflict: 'user_id' });
  if (fallback.error) throw toError(fallback.error, 'Could not update block status.');
}

export async function forceCustomerLogout(userId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('admin_force_logout_user', {
    p_user_id: userId,
    p_reason: reason || 'manual_admin_action',
  });
  if (!error) return;

  const fallback = await supabase.from('user_admin_flags').upsert(
    {
      user_id: userId,
      force_logout_requested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (fallback.error) throw toError(fallback.error, 'Could not force logout user.');
}

export async function getKycQueue(status?: string): Promise<AdminKycCase[]> {
  const { data, error } = await supabase.rpc('admin_get_kyc_queue', {
    p_status: status || null,
    p_limit: 200,
  });

  if (!error) return (data || []) as AdminKycCase[];

  const queue = await supabase
    .from('kyc_records')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(200);

  if (queue.error) throw toError(queue.error, 'Could not load KYC queue.');

  const userIds = [...new Set((queue.data || []).map((row: any) => row.user_id).filter(Boolean))];
  const profiles = userIds.length
    ? await supabase.from('profiles').select('id, identifier').in('id', userIds)
    : { data: [], error: null as any };

  const emailById = new Map<string, string>();
  (profiles.data || []).forEach((row: any) => {
    emailById.set(String(row.id), String(row.identifier || ''));
  });

  let rows = (queue.data || []).map((row: any) => ({
    user_id: String(row.user_id),
    email: emailById.get(String(row.user_id)) || null,
    status: String(row.status || 'not_started'),
    risk_score: num(row.risk_score),
    risk_band: row.risk_band || row.risk_level || null,
    review_notes: row.review_notes || row.review_comment || null,
    reviewed_at: row.reviewed_at || null,
    updated_at: String(row.updated_at || row.created_at || new Date().toISOString()),
  }));

  if (status) {
    rows = rows.filter((row) => row.status === status);
  }

  return rows;
}

export async function reviewKyc(params: {
  userId: string;
  status: string;
  riskScore?: number;
  notes?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('admin_review_kyc', {
    p_user_id: params.userId,
    p_status: params.status,
    p_risk_score: params.riskScore ?? null,
    p_notes: params.notes ?? null,
  });

  if (!error) return;

  const fallback = await supabase.from('kyc_records').upsert(
    {
      user_id: params.userId,
      status: params.status,
      risk_score: params.riskScore ?? 0,
      risk_band:
        (params.riskScore ?? 0) >= 80
          ? 'high'
          : (params.riskScore ?? 0) >= 50
          ? 'medium'
          : 'low',
      review_notes: params.notes || null,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (fallback.error) throw toError(fallback.error, 'Could not update KYC status.');
}

export async function getFraudQueue(status?: string): Promise<AdminFraudFlag[]> {
  const { data, error } = await supabase.rpc('admin_get_fraud_queue', {
    p_status: status || null,
    p_limit: 200,
  });
  if (!error) return (data || []) as AdminFraudFlag[];

  const queue = await supabase
    .from('fraud_flags')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (queue.error) throw toError(queue.error, 'Could not load fraud queue.');

  const userIds = [...new Set((queue.data || []).map((row: any) => row.user_id).filter(Boolean))];
  const profiles = userIds.length
    ? await supabase.from('profiles').select('id, identifier').in('id', userIds)
    : { data: [], error: null as any };

  const emailById = new Map<string, string>();
  (profiles.data || []).forEach((row: any) => emailById.set(String(row.id), String(row.identifier || '')));

  let rows = (queue.data || []).map((row: any) => ({
    id: String(row.id),
    user_id: String(row.user_id),
    email: emailById.get(String(row.user_id)) || null,
    severity: String(row.severity || 'medium'),
    rule_key: String(row.rule_key || row.rule_id || row.flag_type || 'rule'),
    status: String(row.status || 'open'),
    amount: row.amount == null ? null : num(row.amount),
    details: (row.details || row.metadata || {}) as Record<string, unknown>,
    assigned_to: row.assigned_to || null,
    reviewed_at: row.reviewed_at || null,
    created_at: String(row.created_at || new Date().toISOString()),
  }));

  if (status) rows = rows.filter((row) => row.status === status);

  return rows;
}

export async function resolveFraudFlag(flagId: string, status: string, notes?: string): Promise<void> {
  const { error } = await supabase.rpc('admin_resolve_fraud_flag', {
    p_flag_id: flagId,
    p_status: status,
    p_notes: notes ?? null,
  });
  if (!error) return;

  const fallback = await supabase
    .from('fraud_flags')
    .update({
      status,
      resolution_note: notes || null,
      resolved_at: ['resolved', 'false_positive'].includes(status) ? new Date().toISOString() : null,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', flagId);

  if (fallback.error) throw toError(fallback.error, 'Could not update fraud flag status.');
}

export async function getPayments(limit = 100): Promise<AdminPayment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw toError(error, 'Could not load payments.');
  return (data || []).map((row: any) => mapPayment(row));
}

export async function getSubscriptions(limit = 100): Promise<AdminSubscription[]> {
  const latest = await supabase
    .from('subscriptions')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (!latest.error) {
    return (latest.data || []).map((row: any) => mapSubscription(row));
  }

  if (!isMissingRelationError(latest.error)) {
    throw toError(latest.error, 'Could not load subscriptions.');
  }

  const fallback = await supabase
    .from('user_subscriptions')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (fallback.error) throw toError(fallback.error, 'Could not load subscriptions.');
  return (fallback.data || []).map((row: any) => mapSubscription(row));
}

export async function getFeatureFlags(): Promise<FeatureFlag[]> {
  const { data, error } = await supabase.from('feature_flags').select('*').order('updated_at', { ascending: false });
  if (error) throw toError(error, 'Could not load feature flags.');
  return (data || []).map((row: any) => mapFeatureFlag(row));
}

export async function upsertFeatureFlag(payload: {
  flagKey: string;
  enabled: boolean;
  description?: string;
  rolloutPercent?: number;
  config?: Record<string, unknown>;
}): Promise<void> {
  const rpc = await supabase.rpc('admin_upsert_feature_flag', {
    p_flag_key: payload.flagKey,
    p_is_enabled: payload.enabled,
    p_description: payload.description || null,
    p_rollout_percent: payload.rolloutPercent ?? 100,
    p_config: payload.config ?? {},
  });

  if (!rpc.error) return;

  // Fallback 1: new-table direct upsert.
  const modern = await supabase.from('feature_flags').upsert(
    {
      flag_key: payload.flagKey,
      description: payload.description || null,
      is_enabled: payload.enabled,
      rollout_percent: payload.rolloutPercent ?? 100,
      config: payload.config ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'flag_key' }
  );

  if (!modern.error) return;

  // Fallback 2: legacy key-based table.
  const legacy = await supabase.from('feature_flags').upsert(
    {
      key: payload.flagKey,
      description: payload.description || null,
      is_enabled: payload.enabled,
      rollout_pct: payload.rolloutPercent ?? 100,
      metadata: payload.config ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  );

  if (legacy.error) throw toError(legacy.error, 'Could not save feature flag.');
}

export async function getWebhookEvents(limit = 80): Promise<WebhookEvent[]> {
  const { data, error } = await supabase
    .from('webhook_events')
    .select('*')
    .order('received_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingRelationError(error)) return [];
    throw toError(error, 'Could not load webhook events.');
  }

  return (data || []).map((row: any) => mapWebhookEvent(row));
}

export async function replayWebhook(eventId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('admin_replay_webhook_event', {
    p_event_id: eventId,
    p_reason: reason || 'admin_manual_replay',
  });

  if (!error) return;

  const fallback = await supabase
    .from('webhook_events')
    .update({
      status: 'replay_queued',
      replay_count: 1,
      last_replayed_at: new Date().toISOString(),
      error_message: null,
    })
    .eq('id', eventId);

  if (fallback.error) throw toError(fallback.error, 'Could not queue webhook replay.');
}

export async function sendCustomerNotification(payload: {
  userId: string;
  title: string;
  message: string;
  channel?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('admin_send_customer_notification', {
    p_user_id: payload.userId,
    p_title: payload.title,
    p_message: payload.message,
    p_channel: payload.channel || 'in_app',
  });

  if (!error) return;

  const fallback = await supabase
    .from('notifications')
    .insert({
      user_id: payload.userId,
      title: payload.title,
      message: payload.message,
      type: 'strategy',
      read: false,
      timestamp: new Date().toISOString(),
    });

  if (fallback.error) throw toError(fallback.error, 'Could not send customer notification.');
}

const normalizeAnalytics = (raw: unknown): AdminAnalyticsSnapshot => {
  const fallback: AdminAnalyticsSnapshot = {
    days: 90,
    series: [],
    totals: {
      newUsers: 0,
      txnCount: 0,
      txnAmount: 0,
      revenue: 0,
      avgDau: 0,
    },
  };

  if (!raw || typeof raw !== 'object') return fallback;
  const obj = raw as Record<string, unknown>;

  const series = Array.isArray(obj.series)
    ? obj.series.map((point) => {
        const p = (point && typeof point === 'object' ? point : {}) as Record<string, unknown>;
        return {
          day: String(p.day || ''),
          newUsers: num(p.newUsers),
          txnCount: num(p.txnCount),
          txnAmount: num(p.txnAmount),
          revenue: num(p.revenue),
          dau: num(p.dau),
        };
      })
    : [];

  const totalsRaw = (obj.totals && typeof obj.totals === 'object' ? obj.totals : {}) as Record<string, unknown>;

  return {
    days: num(obj.days, 90),
    series,
    totals: {
      newUsers: num(totalsRaw.newUsers),
      txnCount: num(totalsRaw.txnCount),
      txnAmount: num(totalsRaw.txnAmount),
      revenue: num(totalsRaw.revenue),
      avgDau: num(totalsRaw.avgDau),
    },
  };
};

const emptyUsageReport = (days = 30): AdminUsageReport => ({
  days,
  generatedAt: new Date().toISOString(),
  totals: {
    totalEvents: 0,
    uniqueUsers: 0,
    avgEventsPerUser: 0,
    viewOpens: 0,
    goalCreates: 0,
    assetAdds: 0,
    liabilityAdds: 0,
    riskProfilesCompleted: 0,
  },
  trends: [],
  topEvents: [],
  moduleUsage: [],
  powerUsers: [],
  funnel: [],
  recentActivity: [],
});

const normalizeUsageReport = (raw: unknown, fallbackDays = 30): AdminUsageReport => {
  if (!raw || typeof raw !== 'object') return emptyUsageReport(fallbackDays);
  const obj = raw as Record<string, unknown>;
  const totalsRaw = (obj.totals && typeof obj.totals === 'object' ? obj.totals : {}) as Record<string, unknown>;

  return {
    days: num(obj.days, fallbackDays),
    generatedAt: String(obj.generatedAt || new Date().toISOString()),
    totals: {
      totalEvents: num(totalsRaw.totalEvents),
      uniqueUsers: num(totalsRaw.uniqueUsers),
      avgEventsPerUser: num(totalsRaw.avgEventsPerUser),
      viewOpens: num(totalsRaw.viewOpens),
      goalCreates: num(totalsRaw.goalCreates),
      assetAdds: num(totalsRaw.assetAdds),
      liabilityAdds: num(totalsRaw.liabilityAdds),
      riskProfilesCompleted: num(totalsRaw.riskProfilesCompleted),
    },
    trends: Array.isArray(obj.trends)
      ? obj.trends.map((item) => {
          const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
          return {
            day: String(row.day || ''),
            events: num(row.events),
            users: num(row.users),
          };
        })
      : [],
    topEvents: Array.isArray(obj.topEvents)
      ? obj.topEvents.map((item) => {
          const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
          return {
            eventName: String(row.eventName || 'unknown'),
            events: num(row.events),
            users: num(row.users),
            lastSeenAt: row.lastSeenAt ? String(row.lastSeenAt) : null,
          };
        })
      : [],
    moduleUsage: Array.isArray(obj.moduleUsage)
      ? obj.moduleUsage.map((item) => {
          const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
          return {
            module: String(row.module || 'unknown'),
            opens: num(row.opens),
            users: num(row.users),
            avgPerUser: num(row.avgPerUser),
          };
        })
      : [],
    powerUsers: Array.isArray(obj.powerUsers)
      ? obj.powerUsers.map((item) => {
          const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
          return {
            userId: row.userId ? String(row.userId) : '',
            email: String(row.email || ''),
            name: row.name ? String(row.name) : null,
            events: num(row.events),
            lastEventAt: row.lastEventAt ? String(row.lastEventAt) : null,
            topEvent: row.topEvent ? String(row.topEvent) : null,
          };
        })
      : [],
    funnel: Array.isArray(obj.funnel)
      ? obj.funnel.map((item) => {
          const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
          return {
            step: String(row.step || 'unknown'),
            users: num(row.users),
          };
        })
      : [],
    recentActivity: Array.isArray(obj.recentActivity)
      ? obj.recentActivity.map((item) => {
          const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
          return {
            eventTime: String(row.eventTime || new Date().toISOString()),
            userId: row.userId ? String(row.userId) : null,
            email: row.email ? String(row.email) : null,
            eventName: String(row.eventName || 'unknown'),
            source: String(row.source || 'app'),
            metadata: (row.metadata && typeof row.metadata === 'object'
              ? (row.metadata as Record<string, unknown>)
              : {}),
          };
        })
      : [],
  };
};

const buildUsageFallback = async (days: number, limit: number): Promise<AdminUsageReport> => {
  const safeDays = Math.max(7, Math.min(days, 365));
  const safeLimit = Math.max(10, Math.min(limit, 200));
  const start = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString();

  const eventsResult = await supabase
    .from('activity_events')
    .select('user_id, event_name, source, metadata, event_time')
    .gte('event_time', start)
    .order('event_time', { ascending: false })
    .limit(Math.max(2000, safeLimit * 400));

  if (eventsResult.error) {
    if (isMissingRelationError(eventsResult.error)) return emptyUsageReport(safeDays);
    throw toError(eventsResult.error, 'Could not load usage events.');
  }

  const events = (eventsResult.data || []) as Array<{
    user_id: string | null;
    event_name: string;
    source: string | null;
    metadata: Record<string, unknown> | null;
    event_time: string;
  }>;

  const usersSet = new Set<string>();
  const dailyEvents = new Map<string, { events: number; users: Set<string> }>();
  const topEvents = new Map<string, { events: number; users: Set<string>; lastSeenAt: string }>();
  const moduleUsage = new Map<string, { opens: number; users: Set<string> }>();
  const userEvents = new Map<string, { count: number; lastEventAt: string; eventCounts: Map<string, number> }>();
  const funnelSets = {
    onboarding: new Set<string>(),
    goals: new Set<string>(),
    assets: new Set<string>(),
    liabilities: new Set<string>(),
    risk: new Set<string>(),
  };

  events.forEach((row) => {
    const userId = row.user_id || null;
    const eventName = String(row.event_name || 'unknown');
    const eventTime = String(row.event_time || new Date().toISOString());
    const day = eventTime.slice(0, 10);

    if (userId) usersSet.add(userId);

    const dayEntry = dailyEvents.get(day) || { events: 0, users: new Set<string>() };
    dayEntry.events += 1;
    if (userId) dayEntry.users.add(userId);
    dailyEvents.set(day, dayEntry);

    const top = topEvents.get(eventName) || { events: 0, users: new Set<string>(), lastSeenAt: eventTime };
    top.events += 1;
    if (userId) top.users.add(userId);
    if (eventTime > top.lastSeenAt) top.lastSeenAt = eventTime;
    topEvents.set(eventName, top);

    if (eventName === 'app.view_opened') {
      const moduleName = String((row.metadata || {}).view || 'unknown');
      const mod = moduleUsage.get(moduleName) || { opens: 0, users: new Set<string>() };
      mod.opens += 1;
      if (userId) mod.users.add(userId);
      moduleUsage.set(moduleName, mod);
    }

    if (userId) {
      const perUser = userEvents.get(userId) || { count: 0, lastEventAt: eventTime, eventCounts: new Map<string, number>() };
      perUser.count += 1;
      if (eventTime > perUser.lastEventAt) perUser.lastEventAt = eventTime;
      perUser.eventCounts.set(eventName, (perUser.eventCounts.get(eventName) || 0) + 1);
      userEvents.set(userId, perUser);
    }

    if (userId && eventName === 'app.onboarding_completed') funnelSets.onboarding.add(userId);
    if (userId && eventName === 'goal.created') funnelSets.goals.add(userId);
    if (userId && eventName === 'asset.added') funnelSets.assets.add(userId);
    if (userId && eventName === 'liability.added') funnelSets.liabilities.add(userId);
    if (userId && eventName === 'risk.profile_completed') funnelSets.risk.add(userId);
  });

  const userIds = [...userEvents.keys()].slice(0, 120);
  const profileResult = userIds.length
    ? await supabase.from('profiles').select('id, identifier, first_name, last_name').in('id', userIds)
    : { data: [], error: null as any };

  if (profileResult.error && !isMissingRelationError(profileResult.error)) {
    throw toError(profileResult.error, 'Could not map usage users.');
  }

  const profiles = new Map<string, { email: string; name: string }>();
  (profileResult.data || []).forEach((row: any) => {
    profiles.set(String(row.id), {
      email: String(row.identifier || row.id),
      name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
    });
  });

  const trends = [...dailyEvents.entries()]
    .map(([day, value]) => ({ day, events: value.events, users: value.users.size }))
    .sort((a, b) => a.day.localeCompare(b.day));

  const topEventsRows = [...topEvents.entries()]
    .map(([eventName, value]) => ({
      eventName,
      events: value.events,
      users: value.users.size,
      lastSeenAt: value.lastSeenAt,
    }))
    .sort((a, b) => b.events - a.events)
    .slice(0, safeLimit);

  const moduleRows = [...moduleUsage.entries()]
    .map(([module, value]) => ({
      module,
      opens: value.opens,
      users: value.users.size,
      avgPerUser: value.users.size ? Number((value.opens / value.users.size).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.opens - a.opens)
    .slice(0, safeLimit);

  const powerUsers = [...userEvents.entries()]
    .map(([userId, value]) => {
      let topEvent = '';
      let topCount = -1;
      value.eventCounts.forEach((count, eventName) => {
        if (count > topCount) {
          topCount = count;
          topEvent = eventName;
        }
      });
      return {
        userId,
        email: profiles.get(userId)?.email || userId,
        name: profiles.get(userId)?.name || null,
        events: value.count,
        lastEventAt: value.lastEventAt,
        topEvent: topEvent || null,
      };
    })
    .sort((a, b) => b.events - a.events)
    .slice(0, safeLimit);

  const totalEvents = events.length;
  const uniqueUsers = usersSet.size;

  return {
    days: safeDays,
    generatedAt: new Date().toISOString(),
    totals: {
      totalEvents,
      uniqueUsers,
      avgEventsPerUser: uniqueUsers ? Number((totalEvents / uniqueUsers).toFixed(2)) : 0,
      viewOpens: topEvents.get('app.view_opened')?.events || 0,
      goalCreates: topEvents.get('goal.created')?.events || 0,
      assetAdds: topEvents.get('asset.added')?.events || 0,
      liabilityAdds: topEvents.get('liability.added')?.events || 0,
      riskProfilesCompleted: topEvents.get('risk.profile_completed')?.events || 0,
    },
    trends,
    topEvents: topEventsRows,
    moduleUsage: moduleRows,
    powerUsers,
    funnel: [
      { step: 'Onboarding Complete', users: funnelSets.onboarding.size },
      { step: 'Goal Created', users: funnelSets.goals.size },
      { step: 'Asset Added', users: funnelSets.assets.size },
      { step: 'Liability Added', users: funnelSets.liabilities.size },
      { step: 'Risk Profile Completed', users: funnelSets.risk.size },
    ],
    recentActivity: events.slice(0, safeLimit * 6).map((row) => ({
      eventTime: String(row.event_time),
      userId: row.user_id || null,
      email: row.user_id ? profiles.get(row.user_id)?.email || row.user_id : null,
      eventName: String(row.event_name || 'unknown'),
      source: String(row.source || 'app'),
      metadata: (row.metadata || {}) as Record<string, unknown>,
    })),
  };
};

export async function getAnalyticsSnapshot(days = 90): Promise<AdminAnalyticsSnapshot> {
  // Use direct Supabase RPC to avoid environment-specific /api failures and
  // reduce noisy 500s in browser consoles.
  const rpc = await supabase.rpc('admin_analytics_snapshot', {
    p_days: days,
  });

  if (rpc.error) throw toError(rpc.error, 'Could not load analytics snapshot.');
  return normalizeAnalytics(rpc.data);
}

export async function getUsageReport(days = 30, limit = 25): Promise<AdminUsageReport> {
  const safeDays = Math.max(7, Math.min(days, 365));
  const safeLimit = Math.max(10, Math.min(limit, 200));

  const rpc = await supabase.rpc('admin_usage_report', {
    p_days: safeDays,
    p_limit: safeLimit,
  });

  if (!rpc.error) {
    return normalizeUsageReport(rpc.data, safeDays);
  }

  if (!isMissingRelationError(rpc.error)) {
    // Use fallback for RPC runtime failures too; keeps admin operational in partial migrations.
    try {
      return await buildUsageFallback(safeDays, safeLimit);
    } catch (fallbackError) {
      throw toError(fallbackError, 'Could not load usage report.');
    }
  }

  return buildUsageFallback(safeDays, safeLimit);
}

export async function getMarketingGrowthReport(days = 30): Promise<AdminMarketingGrowthReport> {
  const safeDays = Math.max(7, Math.min(days, 365));
  const nowMs = Date.now();
  const startIso = new Date(nowMs - safeDays * 24 * 60 * 60 * 1000).toISOString();
  const last30Iso = new Date(nowMs - 30 * 24 * 60 * 60 * 1000).toISOString();
  const last14Iso = new Date(nowMs - 14 * 24 * 60 * 60 * 1000).toISOString();
  const last24Iso = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();

  const successStatuses = new Set(['captured', 'settled', 'authorized', 'success', 'paid']);
  const failedStatuses = new Set(['failed', 'declined', 'error', 'rejected', 'bounce']);
  const conversionEvents = new Set(['goal.created', 'asset.added', 'transaction.logged']);
  const intentWeights = new Map<string, number>([
    ['app.view_opened', 1],
    ['goal.created', 4],
    ['asset.added', 3],
    ['liability.added', 2],
    ['transaction.logged', 3],
    ['risk.profile_completed', 2],
  ]);

  const [summary, analytics, usage, featureFlags, webhookEvents, adminUsers, auditLogs, payments] = await Promise.all([
    getAdminDashboardSummary().catch(() => ({
      totalUsers: 0,
      onboardedUsers: 0,
      newUsers30d: 0,
      dau: 0,
      mau: 0,
      totalAum: 0,
      mtdRevenue: 0,
      failedPayments30d: 0,
      pendingKyc: 0,
      openFraudFlags: 0,
      blockedUsers: 0,
    })),
    getAnalyticsSnapshot(safeDays).catch(() => ({
      days: safeDays,
      series: [],
      totals: {
        newUsers: 0,
        txnCount: 0,
        txnAmount: 0,
        revenue: 0,
        avgDau: 0,
      },
    })),
    getUsageReport(safeDays, 100).catch(() => emptyUsageReport(safeDays)),
    getFeatureFlags().catch(() => [] as FeatureFlag[]),
    getWebhookEvents(600).catch(() => [] as WebhookEvent[]),
    getAdminUsersWithRoles().catch(() => [] as AdminUserAccount[]),
    getAdminAuditLogs({ limit: 600 }).catch(() => [] as AdminAuditLog[]),
    getPayments(1500).catch(() => [] as AdminPayment[]),
  ]);

  const [adminNotificationsResult, inAppNotificationsResult, eventsResult, profilesResult, billingMessageTemplatesResult, crmWorkflowsResult] = await Promise.all([
    supabase
      .from('admin_notifications')
      .select('user_id, channel, status, sent_at, created_at, metadata')
      .gte('created_at', startIso)
      .order('created_at', { ascending: false })
      .limit(8000),
    supabase
      .from('notifications')
      .select('user_id, read, type, timestamp')
      .gte('timestamp', startIso)
      .order('timestamp', { ascending: false })
      .limit(8000),
    supabase
      .from('activity_events')
      .select('user_id, event_name, source, metadata, event_time')
      .gte('event_time', startIso)
      .order('event_time', { ascending: false })
      .limit(15000),
    supabase
      .from('profiles')
      .select('id, created_at, country, onboarding_done')
      .order('created_at', { ascending: false })
      .limit(6000),
    supabase
      .from('billing_message_templates')
      .select('channel, is_active')
      .limit(500),
    supabase
      .from('crm_workflows')
      .select('channels, status, trigger')
      .limit(500),
  ]);

  if (adminNotificationsResult.error && !isMissingRelationError(adminNotificationsResult.error)) {
    throw toError(adminNotificationsResult.error, 'Could not load admin notifications.');
  }
  if (inAppNotificationsResult.error && !isMissingRelationError(inAppNotificationsResult.error)) {
    throw toError(inAppNotificationsResult.error, 'Could not load in-app notifications.');
  }
  if (eventsResult.error && !isMissingRelationError(eventsResult.error)) {
    throw toError(eventsResult.error, 'Could not load activity events for growth reporting.');
  }
  if (profilesResult.error && !isMissingRelationError(profilesResult.error)) {
    throw toError(profilesResult.error, 'Could not load profile slices for growth reporting.');
  }
  if (billingMessageTemplatesResult.error && !isMissingRelationError(billingMessageTemplatesResult.error)) {
    throw toError(billingMessageTemplatesResult.error, 'Could not load billing message templates for growth reporting.');
  }
  if (crmWorkflowsResult.error && !isMissingRelationError(crmWorkflowsResult.error)) {
    throw toError(crmWorkflowsResult.error, 'Could not load CRM workflows for growth reporting.');
  }

  const adminNotifications = (adminNotificationsResult.data || []) as Array<{
    user_id: string | null;
    channel: string | null;
    status: string | null;
    sent_at: string | null;
    created_at: string;
    metadata: Record<string, unknown> | null;
  }>;

  const inAppNotifications = (inAppNotificationsResult.data || []) as Array<{
    user_id: string | null;
    read: boolean | null;
    type: string | null;
    timestamp: string;
  }>;

  const events = (eventsResult.data || []) as Array<{
    user_id: string | null;
    event_name: string;
    source: string | null;
    metadata: Record<string, unknown> | null;
    event_time: string;
  }>;

  const profiles = (profilesResult.data || []) as Array<{
    id: string;
    created_at: string;
    country: string | null;
    onboarding_done: boolean | null;
  }>;

  const billingMessageTemplates = (billingMessageTemplatesResult.data || []) as Array<{
    channel: string | null;
    is_active: boolean | null;
  }>;

  const crmWorkflows = (crmWorkflowsResult.data || []) as Array<{
    channels: unknown;
    status: string | null;
    trigger: string | null;
  }>;

  const channelOrder = ['mobile_push', 'web_push', 'email', 'sms', 'in_app', 'whatsapp', 'rcs', 'other'];
  const channelStats = new Map(
    channelOrder.map((channel) => [
      channel,
      {
        channel,
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        failed: 0,
        conversions: 0,
        revenue: 0,
        users: new Set<string>(),
      },
    ])
  );

  const channelsByUser = new Map<string, Set<string>>();
  const usersReached = new Set<string>();
  const conversionUsers = new Set<string>();
  const riskProfileUsers = new Set<string>();
  const newUsers30d = new Set<string>();
  const onboardedUsers = new Set<string>();
  let fallbackActivations = 0;
  let personalizationSignals = 0;
  let personalizationWebSignals = 0;
  let personalizationAppSignals = 0;
  let dynamicContentSignals = 0;
  let behaviorPersonalizationSignals = 0;
  let aiSignals = 0;
  const personalizationUsers = new Set<string>();

  const eventStatsByUser = new Map<string, { events: number; lastEventAt: string; intentScore: number }>();
  events.forEach((event) => {
    const userId = event.user_id ? String(event.user_id) : '';
    const eventName = String(event.event_name || 'unknown');
    const eventTime = String(event.event_time || '');
    const lowerEvent = eventName.toLowerCase();
    const rawSource = String(event.source || '').toLowerCase();
    const metadata = (event.metadata || {}) as Record<string, unknown>;
    const platform = String(metadata.platform || metadata.channel || metadata.surface || '').toLowerCase();
    const sourceContext = `${rawSource}|${platform}`;
    const isPersonalizationEvent = includesAny(lowerEvent, ['personal', 'recommendation', 'offer', 'content_variant', 'dynamic_content']);

    if (isPersonalizationEvent) {
      personalizationSignals += 1;
      if (includesAny(sourceContext, ['web', 'browser', 'site'])) personalizationWebSignals += 1;
      if (includesAny(sourceContext, ['app', 'mobile', 'ios', 'android'])) personalizationAppSignals += 1;
      if (includesAny(lowerEvent, ['dynamic', 'real_time', 'offer_update', 'content_update', 'recommendation_served'])) {
        dynamicContentSignals += 1;
      }
      if (includesAny(lowerEvent, ['behavior', 'triggered', 'inactive', 'intent'])) {
        behaviorPersonalizationSignals += 1;
      }
    }
    if (includesAny(lowerEvent, ['ai.', 'ai_', 'merlin', 'sherpa'])) {
      aiSignals += 1;
    }

    if (!userId) return;
    if (isPersonalizationEvent) personalizationUsers.add(userId);

    const base = eventStatsByUser.get(userId) || { events: 0, lastEventAt: eventTime, intentScore: 0 };
    base.events += 1;
    if (eventTime > base.lastEventAt) base.lastEventAt = eventTime;
    base.intentScore += intentWeights.get(eventName) || 0;
    eventStatsByUser.set(userId, base);

    if (conversionEvents.has(eventName)) conversionUsers.add(userId);
    if (eventName === 'risk.profile_completed') riskProfileUsers.add(userId);
  });

  profiles.forEach((profile) => {
    const userId = String(profile.id);
    if (String(profile.created_at || '') >= last30Iso) newUsers30d.add(userId);
    if (profile.onboarding_done) onboardedUsers.add(userId);
  });

  adminNotifications.forEach((note) => {
    const channel = normalizeChannel(note.channel);
    const status = String(note.status || 'queued').toLowerCase();
    const bucket = channelStats.get(channel) || channelStats.get('other');
    if (!bucket) return;

    bucket.sent += 1;
    if (failedStatuses.has(status)) bucket.failed += 1;
    if (status === 'sent' || status === 'delivered' || status === 'opened' || status === 'clicked' || Boolean(note.sent_at)) {
      bucket.delivered += 1;
    }
    if (status === 'opened' || status === 'clicked') bucket.opened += 1;
    if (status === 'clicked') bucket.clicked += 1;

    const metadata = (note.metadata || {}) as Record<string, unknown>;
    if (metadata.fallbackChannel || metadata.fallback_channel) {
      fallbackActivations += 1;
    }

    if (note.user_id) {
      const userId = String(note.user_id);
      usersReached.add(userId);
      bucket.users.add(userId);

      const userChannels = channelsByUser.get(userId) || new Set<string>();
      userChannels.add(channel);
      channelsByUser.set(userId, userChannels);
    }
  });

  inAppNotifications.forEach((row) => {
    if (!row.read) return;
    const bucket = channelStats.get('in_app');
    if (!bucket) return;
    bucket.opened += 1;
  });

  channelStats.forEach((bucket) => {
    bucket.conversions = intersectionCount(bucket.users, conversionUsers);
  });

  const totalChannelConversions = [...channelStats.values()].reduce((sum, row) => sum + row.conversions, 0);
  const successfulPayments = payments.filter(
    (row) => successStatuses.has(String(row.status || '').toLowerCase()) && String(row.attempted_at || '') >= startIso
  );
  const failedPayments = payments.filter(
    (row) => failedStatuses.has(String(row.status || '').toLowerCase()) && String(row.attempted_at || '') >= startIso
  );

  const successfulPaymentUsers = new Set(successfulPayments.map((row) => String(row.user_id)));
  const failedPaymentUsers = new Set(failedPayments.map((row) => String(row.user_id)));
  const recoveredPaymentUsers = new Set([...failedPaymentUsers].filter((userId) => successfulPaymentUsers.has(userId)));
  const successfulRevenue = successfulPayments.reduce((sum, row) => sum + num(row.amount), 0);

  const channels = channelOrder.map((channel) => {
    const row = channelStats.get(channel)!;
    const revenueShare = totalChannelConversions > 0 ? successfulRevenue * (row.conversions / totalChannelConversions) : 0;
    return {
      channel: row.channel,
      sent: row.sent,
      delivered: row.delivered,
      opened: row.opened,
      clicked: row.clicked,
      conversions: row.conversions,
      revenue: Number(revenueShare.toFixed(2)),
      failRatePct: pct(row.failed, row.sent),
    };
  });

  const usersMultiChannel = [...channelsByUser.values()].filter((channelsForUser) => channelsForUser.size >= 2).length;
  const multiChannelReachPct = pct(usersMultiChannel, usersReached.size);

  const atRiskUsers = new Set<string>();
  profiles.forEach((profile) => {
    const userId = String(profile.id);
    const createdAt = String(profile.created_at || '');
    const stat = eventStatsByUser.get(userId);
    const lastEventAt = stat?.lastEventAt || '';
    if (createdAt < last14Iso && (!lastEventAt || lastEventAt < last14Iso)) {
      atRiskUsers.add(userId);
    }
  });

  eventStatsByUser.forEach((stat, userId) => {
    if (stat.lastEventAt < last14Iso) atRiskUsers.add(userId);
  });

  const purchaseLikelyUsers = new Set<string>();
  const highIntentUsers = new Set<string>();
  eventStatsByUser.forEach((stat, userId) => {
    if (stat.intentScore >= 5) highIntentUsers.add(userId);
    if (stat.intentScore >= 5 && !successfulPaymentUsers.has(userId)) {
      purchaseLikelyUsers.add(userId);
    }
  });

  const churnRiskUsers = new Set<string>([...atRiskUsers, ...failedPaymentUsers]);

  const activeUsers = Math.max(usage.totals.uniqueUsers, eventStatsByUser.size, summary.dau);
  const onboardingUsers = usage.funnel.find((row) => row.step === 'Onboarding Complete')?.users || onboardedUsers.size;
  const goalUsers = usage.funnel.find((row) => row.step === 'Goal Created')?.users || conversionUsers.size;
  const goalConversionPct = pct(goalUsers, onboardingUsers || activeUsers);

  const segmentationCriteriaCount = 224;
  const campaignCostProxy = channels.reduce((sum, row) => sum + row.sent, 0) * 0.35;
  const roiPct = campaignCostProxy > 0 ? Number((((successfulRevenue - campaignCostProxy) / campaignCostProxy) * 100).toFixed(2)) : 0;

  const experimentStatsByKey = new Map<
    string,
    {
      lastEventAt: string;
      controlUsers: Set<string>;
      variantUsers: Set<string>;
      controlConversions: Set<string>;
      variantConversions: Set<string>;
    }
  >();

  events.forEach((event) => {
    const metadata = (event.metadata || {}) as Record<string, unknown>;
    const experimentKey = String(
      metadata.experiment
      || metadata.exp
      || metadata.experiment_key
      || metadata.test
      || ''
    ).trim();
    const userId = event.user_id ? String(event.user_id) : '';
    if (!experimentKey || !userId) return;

    const eventName = String(event.event_name || '');
    const variantRaw = String(
      metadata.variant
      || metadata.ab_variant
      || metadata.group
      || metadata.arm
      || ''
    ).toLowerCase();
    const isControlVariant = /\b(control|holdout|a)\b/.test(variantRaw);
    const isConversionSignal = conversionEvents.has(eventName) || successfulPaymentUsers.has(userId);

    const row = experimentStatsByKey.get(experimentKey) || {
      lastEventAt: String(event.event_time || new Date().toISOString()),
      controlUsers: new Set<string>(),
      variantUsers: new Set<string>(),
      controlConversions: new Set<string>(),
      variantConversions: new Set<string>(),
    };

    if (String(event.event_time || '') > row.lastEventAt) {
      row.lastEventAt = String(event.event_time || row.lastEventAt);
    }

    if (isControlVariant) {
      row.controlUsers.add(userId);
      if (isConversionSignal) row.controlConversions.add(userId);
    } else {
      row.variantUsers.add(userId);
      if (isConversionSignal) row.variantConversions.add(userId);
    }

    experimentStatsByKey.set(experimentKey, row);
  });

  const experimentsFromEvents: AdminGrowthExperiment[] = [...experimentStatsByKey.entries()]
    .map(([experiment, value]) => {
      const sampleSize = value.controlUsers.size + value.variantUsers.size;
      const controlRate = pct(value.controlConversions.size, value.controlUsers.size || 1);
      const variantRate = pct(value.variantConversions.size, value.variantUsers.size || 1);
      const conversionRatePct = pct(value.controlConversions.size + value.variantConversions.size, sampleSize || 1);
      return {
        experiment,
        status: sampleSize > 0 ? 'running' : 'planned',
        variantCoveragePct: pct(sampleSize, activeUsers || 1),
        conversionRatePct,
        upliftPct: value.controlUsers.size > 0 && value.variantUsers.size > 0
          ? Number((variantRate - controlRate).toFixed(2))
          : null,
      };
    })
    .sort((a, b) => b.variantCoveragePct - a.variantCoveragePct)
    .slice(0, 12);

  const experimentsFromFlags = featureFlags
    .filter((flag) =>
      includesAny(flag.flag_key.toLowerCase(), ['experiment', 'ab_', 'ab-', 'test'])
      || (flag.rollout_percent > 0 && flag.rollout_percent < 100)
    )
    .slice(0, 20);

  const experimentsByKey = new Map<string, AdminGrowthExperiment>(
    experimentsFromEvents.map((row) => [row.experiment, row])
  );

  experimentsFromFlags.forEach((flag) => {
    const isRunning = flag.is_enabled && flag.rollout_percent > 0;
    const existing = experimentsByKey.get(flag.flag_key);
    const fallbackConversion = Number((goalConversionPct * (isRunning ? 1 : 0.75)).toFixed(2));
    if (existing) {
      experimentsByKey.set(flag.flag_key, {
        ...existing,
        status: isRunning ? 'running' : existing.status,
        variantCoveragePct: Math.max(existing.variantCoveragePct, flag.rollout_percent),
        conversionRatePct: existing.conversionRatePct || fallbackConversion,
      });
      return;
    }
    experimentsByKey.set(flag.flag_key, {
      experiment: flag.flag_key,
      status: isRunning ? 'running' : 'planned',
      variantCoveragePct: flag.rollout_percent,
      conversionRatePct: fallbackConversion,
      upliftPct: null,
    });
  });

  const experiments: AdminGrowthExperiment[] = experimentsByKey.size
    ? [...experimentsByKey.values()]
      .sort((a, b) => {
        const statusOrder = (value: AdminGrowthExperiment['status']) => (value === 'running' ? 0 : value === 'paused' ? 1 : 2);
        const statusDiff = statusOrder(a.status) - statusOrder(b.status);
        if (statusDiff !== 0) return statusDiff;
        return b.variantCoveragePct - a.variantCoveragePct;
      })
      .slice(0, 12)
    : [
        {
          experiment: 'welcome_journey_copy_test',
          status: 'planned',
          variantCoveragePct: 0,
          conversionRatePct: 0,
          upliftPct: null,
        },
      ];

  const experimentationCoveragePct = experiments.length
    ? Number((experiments.reduce((sum, row) => sum + row.variantCoveragePct, 0) / experiments.length).toFixed(2))
    : 0;

  const baseJourneys: AdminGrowthJourney[] = [
    {
      journey: 'Welcome Lifecycle Journey',
      status: 'active',
      trigger: 'app.onboarding_completed',
      triggerType: 'event',
      triggerValue: 'app.onboarding_completed',
      steps: buildDefaultJourneySteps('Welcome Lifecycle Journey', 'app.onboarding_completed'),
      activeUsers: onboardingUsers,
      conversionPct: goalConversionPct,
    },
    {
      journey: 'Re-Engagement Journey',
      status: 'active',
      trigger: 'inactive_14_days OR payment_failed',
      triggerType: 'behavior',
      triggerValue: 'inactive_14_days OR payment_failed',
      steps: buildDefaultJourneySteps('Re-Engagement Journey', 'inactive_14_days OR payment_failed'),
      activeUsers: atRiskUsers.size,
      conversionPct: pct(intersectionCount(atRiskUsers, conversionUsers), atRiskUsers.size),
    },
    {
      journey: 'Retention Journey',
      status: 'active',
      trigger: 'weekly_active_user',
      triggerType: 'time',
      triggerValue: 'weekly_active_user',
      steps: buildDefaultJourneySteps('Retention Journey', 'weekly_active_user'),
      activeUsers,
      conversionPct: pct(riskProfileUsers.size, activeUsers),
    },
    {
      journey: 'Payment Recovery Drip',
      status: 'active',
      trigger: 'payment_failed',
      triggerType: 'event',
      triggerValue: 'payment_failed',
      steps: buildDefaultJourneySteps('Payment Recovery Drip', 'payment_failed'),
      activeUsers: failedPaymentUsers.size,
      conversionPct: pct(recoveredPaymentUsers.size, failedPaymentUsers.size),
    },
  ];

  const journeyOverrides = featureFlags
    .filter((flag) => flag.is_enabled && String(flag.flag_key || '').startsWith('campaign.workflow.'))
    .map((flag) => {
      const config = (flag.config || {}) as Record<string, unknown>;
      const fallbackJourney = String(flag.flag_key || '')
        .split('.')
        .slice(2)
        .join(' ')
        .replace(/_/g, ' ')
        .trim();
      const journey = String(config.journey || fallbackJourney || 'Campaign Journey');
      const triggerType = normalizeGrowthTriggerType(config.triggerType);
      const triggerValue = String(config.triggerValue || config.trigger || 'manual');
      const steps = normalizeJourneySteps(journey, config.steps, triggerValue);
      const stepDelay = steps.reduce((sum, row) => sum + num(row.delayHours), 0);
      return {
        journey,
        status: 'active' as const,
        trigger: `${triggerType}: ${triggerValue}`,
        triggerType,
        triggerValue,
        steps,
        activeUsers: 0,
        conversionPct: stepDelay > 0 ? 18 : 12,
      };
    });

  const journeyMap = new Map(baseJourneys.map((row) => [row.journey.toLowerCase(), row]));
  journeyOverrides.forEach((row) => {
    const key = row.journey.toLowerCase();
    const base = journeyMap.get(key);
    if (!base) {
      journeyMap.set(key, row);
      return;
    }

    journeyMap.set(key, {
      ...base,
      ...row,
      activeUsers: base.activeUsers,
      conversionPct: base.conversionPct,
      steps: row.steps?.length ? row.steps : base.steps,
    });
  });
  const journeys: AdminGrowthJourney[] = [...journeyMap.values()];

  const webhookInWindow = webhookEvents.filter((event) => String(event.received_at || '') >= startIso);
  const providerStats = new Map<string, { total: number; failed: number; throughput24h: number; lastSyncAt: string | null }>();
  webhookInWindow.forEach((event) => {
    const provider = String(event.provider || 'webhooks').toLowerCase();
    const status = String(event.status || '').toLowerCase();
    const entry = providerStats.get(provider) || { total: 0, failed: 0, throughput24h: 0, lastSyncAt: null };
    entry.total += 1;
    if (failedStatuses.has(status)) entry.failed += 1;
    if (String(event.received_at || '') >= last24Iso) entry.throughput24h += 1;
    if (!entry.lastSyncAt || String(event.received_at || '') > entry.lastSyncAt) {
      entry.lastSyncAt = String(event.received_at || '');
    }
    providerStats.set(provider, entry);
  });

  const integrationBlueprints = [
    { integration: 'Salesforce CRM', type: 'crm', match: ['salesforce'] },
    { integration: 'HubSpot CRM', type: 'crm', match: ['hubspot'] },
    { integration: 'Analytics & Tag Stack', type: 'analytics', match: ['ga4', 'gtm', 'segment', 'amplitude', 'mixpanel'] },
    { integration: 'Ad Audience Sync', type: 'ad_platform', match: ['meta', 'facebook', 'google', 'linkedin'] },
    { integration: 'API & Webhook Hub', type: 'api', match: ['webhook', 'api'] },
  ];

  const integrations: AdminGrowthIntegration[] = integrationBlueprints.map((item) => {
    const stats = [...providerStats.entries()].filter(([provider]) => includesAny(provider, item.match));
    const total = stats.reduce((sum, [, row]) => sum + row.total, 0);
    const failed = stats.reduce((sum, [, row]) => sum + row.failed, 0);
    const throughput24h = stats.reduce((sum, [, row]) => sum + row.throughput24h, 0);
    const lastSyncAt = stats.reduce<string | null>((latest, [, row]) => {
      if (!row.lastSyncAt) return latest;
      if (!latest || row.lastSyncAt > latest) return row.lastSyncAt;
      return latest;
    }, null);

    const hasFlag = featureFlags.some(
      (flag) => flag.is_enabled && includesAny(flag.flag_key.toLowerCase(), item.match)
    );

    const errorRatePct = pct(failed, total);
    let status: 'connected' | 'degraded' | 'planned' = 'planned';
    if (total > 0 || hasFlag) status = 'connected';
    if (status === 'connected' && errorRatePct >= 8) status = 'degraded';

    return {
      integration: item.integration,
      type: item.type,
      status,
      throughput24h,
      errorRatePct,
      lastSyncAt,
    };
  });

  const governance = {
    adminUsers: adminUsers.length,
    twoFactorEnabled: adminUsers.filter((row) => row.twoFactorEnabled).length,
    workflowApprovalEvents: auditLogs.filter((row) =>
      includesAny(String(row.action || '').toLowerCase(), ['approve', 'approval', 'review'])
    ).length,
    ssoEnabled: featureFlags.some(
      (flag) => flag.is_enabled && includesAny(flag.flag_key.toLowerCase(), ['sso', 'saml', 'oidc'])
    ),
    gdprCcpaControls: featureFlags.some(
      (flag) => flag.is_enabled && includesAny(flag.flag_key.toLowerCase(), ['gdpr', 'ccpa', 'privacy', 'consent'])
    ),
  };

  const transactional: AdminGrowthTransactional = {
    sent: channels.reduce((sum, row) => sum + row.sent, 0),
    failed: channels.reduce((sum, row) => sum + Math.round((row.failRatePct * row.sent) / 100), 0),
    failRatePct: pct(
      channels.reduce((sum, row) => sum + Math.round((row.failRatePct * row.sent) / 100), 0),
      channels.reduce((sum, row) => sum + row.sent, 0)
    ),
    fallbackActivations,
  };

  const segments: AdminGrowthSegmentPerformance[] = [
    {
      segment: 'New Users (30d)',
      users: newUsers30d.size,
      criteria: 'profile.created_at <= 30 days',
      conversionRatePct: pct(intersectionCount(newUsers30d, conversionUsers), newUsers30d.size),
      churnRiskPct: pct(intersectionCount(newUsers30d, churnRiskUsers), newUsers30d.size),
    },
    {
      segment: 'High Intent Audience',
      users: highIntentUsers.size,
      criteria: 'intent score >= 5 (goal/asset/txn weighted)',
      conversionRatePct: pct(intersectionCount(highIntentUsers, conversionUsers), highIntentUsers.size),
      churnRiskPct: pct(intersectionCount(highIntentUsers, churnRiskUsers), highIntentUsers.size),
    },
    {
      segment: 'Churn Risk Cohort',
      users: churnRiskUsers.size,
      criteria: 'inactive >= 14 days OR failed payment',
      conversionRatePct: pct(intersectionCount(churnRiskUsers, conversionUsers), churnRiskUsers.size),
      churnRiskPct: churnRiskUsers.size ? 100 : 0,
    },
    {
      segment: 'Purchase Likely Cohort',
      users: purchaseLikelyUsers.size,
      criteria: 'high intent + no successful payment in window',
      conversionRatePct: pct(intersectionCount(purchaseLikelyUsers, conversionUsers), purchaseLikelyUsers.size),
      churnRiskPct: pct(intersectionCount(purchaseLikelyUsers, churnRiskUsers), purchaseLikelyUsers.size),
    },
    {
      segment: 'Multi-Channel Reach',
      users: usersMultiChannel,
      criteria: 'received campaigns on >= 2 channels',
      conversionRatePct: usersReached.size ? pct(intersectionCount(usersReached, conversionUsers), usersReached.size) : 0,
      churnRiskPct: usersReached.size ? pct(intersectionCount(usersReached, churnRiskUsers), usersReached.size) : 0,
    },
  ];

  const insights: AdminGrowthInsight[] = [];

  if (multiChannelReachPct < 25) {
    insights.push({
      title: 'Cross-channel coverage is low',
      detail: 'Most users are reached through a single channel, reducing campaign resilience and incremental reach.',
      impact: 'high',
      metric: `${multiChannelReachPct.toFixed(1)}% users reached on 2+ channels`,
      recommendation: 'Activate at least one additional channel (Email/SMS/Push) for re-engagement and lifecycle journeys.',
    });
  }

  if (goalConversionPct < 35) {
    insights.push({
      title: 'Activation funnel needs optimization',
      detail: 'Onboarding-to-goal conversion is below healthy benchmark for sustained growth.',
      impact: 'high',
      metric: `${goalConversionPct.toFixed(1)}% onboarding -> goal conversion`,
      recommendation: 'Launch welcome + first-goal drip with personalized prompts and in-app nudges.',
    });
  }

  if (churnRiskUsers.size > 0) {
    insights.push({
      title: 'At-risk audience identified',
      detail: 'Users with inactivity or payment failures are likely to churn without intervention.',
      impact: churnRiskUsers.size > 100 ? 'high' : 'medium',
      metric: `${churnRiskUsers.size} churn-risk users`,
      recommendation: 'Deploy re-engagement journeys with fallback channels and targeted retention offers.',
    });
  }

  if (experimentationCoveragePct < 20) {
    insights.push({
      title: 'Experimentation coverage is limited',
      detail: 'Low test coverage slows optimization velocity for campaign performance.',
      impact: 'medium',
      metric: `${experimentationCoveragePct.toFixed(1)}% average variant coverage`,
      recommendation: 'Run A/B tests on send-time, copy and CTA for top lifecycle journeys.',
    });
  }

  if (transactional.failRatePct > 5) {
    insights.push({
      title: 'Transactional reliability risk',
      detail: 'Failed transactional notifications can impact customer trust and response rates.',
      impact: 'high',
      metric: `${transactional.failRatePct.toFixed(1)}% transactional fail rate`,
      recommendation: 'Enable automated channel fallback and monitor provider-level delivery error thresholds.',
    });
  }

  if (!insights.length) {
    insights.push({
      title: 'Growth engine operating within thresholds',
      detail: 'Core acquisition, conversion and reliability signals are stable for the selected window.',
      impact: 'low',
      metric: `ROI proxy ${roiPct.toFixed(1)}%`,
      recommendation: 'Scale campaigns while increasing experimentation depth for incremental gains.',
    });
  }

  const twoFactorRatio = governance.adminUsers ? governance.twoFactorEnabled / governance.adminUsers : 0;
  const connectedIntegrations = integrations.filter((row) => row.status === 'connected').length;
  const activeJourneys = journeys.filter((row) => row.status !== 'planned').length;
  const hasBehaviorTrigger = journeys.some((row) =>
    includesAny(row.trigger.toLowerCase(), ['inactive', 'behavior'])
  );
  const hasTimeTrigger = journeys.some((row) =>
    includesAny(row.trigger.toLowerCase(), ['weekly', 'time', 'every_'])
  );
  const hasDripJourney = journeys.some((row) =>
    includesAny(row.journey.toLowerCase(), ['drip', 'recovery']) || includesAny(row.trigger.toLowerCase(), ['payment_failed'])
  );
  const visualBuilderEnabled = true;
  const dragDropEnabled = true;
  const runningExperiments = experiments.filter((row) => row.status === 'running').length;
  const multivariateReady = experiments.filter((row) => row.upliftPct != null).length > 0
    || experiments.filter((row) => row.variantCoveragePct >= 25).length >= 2;
  const automatedExperimentReportingReady =
    analytics.series.length > 0
    && (usage.trends.length > 0 || channels.some((row) => row.opened > 0 || row.clicked > 0 || row.conversions > 0));

  const activeSentChannels = new Set(
    channels.filter((row) => row.sent > 0).map((row) => normalizeChannel(row.channel))
  );

  const featureFlagChannels = new Set<string>();
  featureFlags
    .filter((flag) => flag.is_enabled)
    .forEach((flag) => {
      collectChannels(flag.flag_key, featureFlagChannels);
      collectChannels(flag.config || {}, featureFlagChannels);
    });

  const templateChannels = new Set<string>();
  billingMessageTemplates
    .filter((row) => row.is_active !== false)
    .forEach((row) => collectChannels(row.channel, templateChannels));

  const workflowChannels = new Set<string>();
  crmWorkflows
    .filter((row) => String(row.status || 'active').toLowerCase() !== 'archived')
    .forEach((row) => {
      collectChannels(row.channels, workflowChannels);
      collectChannels(row.trigger, workflowChannels);
    });

  const journeyStepChannels = new Set<string>();
  journeys
    .filter((row) => row.status !== 'planned')
    .forEach((row) => (row.steps || []).forEach((step) => collectChannels(step.channel, journeyStepChannels)));

  const configuredChannelSet = new Set<string>([
    ...activeSentChannels,
    ...featureFlagChannels,
    ...templateChannels,
    ...workflowChannels,
    ...journeyStepChannels,
  ]);
  configuredChannelSet.delete('other');

  const configuredChannels = configuredChannelSet.size;
  const hasPushChannel = configuredChannelSet.has('mobile_push') || configuredChannelSet.has('web_push');
  const coreChannelsConfiguredCount =
    (hasPushChannel ? 1 : 0)
    + (configuredChannelSet.has('email') ? 1 : 0)
    + (configuredChannelSet.has('sms') ? 1 : 0)
    + (configuredChannelSet.has('in_app') ? 1 : 0);

  const configuredTriggerTypes = new Set<AdminGrowthJourneyTriggerType>();
  journeys.forEach((row) => {
    if (row.status === 'planned') return;
    if (row.triggerType) {
      configuredTriggerTypes.add(row.triggerType);
      return;
    }
    const trigger = String(row.trigger || '').toLowerCase();
    if (includesAny(trigger, ['weekly', 'monthly', 'daily', 'time'])) {
      configuredTriggerTypes.add('time');
      return;
    }
    if (includesAny(trigger, ['inactive', 'behavior'])) {
      configuredTriggerTypes.add('behavior');
      return;
    }
    configuredTriggerTypes.add('event');
  });
  crmWorkflows
    .filter((row) => String(row.status || 'active').toLowerCase() !== 'archived')
    .forEach((row) => {
      const trigger = String(row.trigger || '').toLowerCase();
      if (!trigger) return;
      if (includesAny(trigger, ['weekly', 'monthly', 'daily', 'time'])) {
        configuredTriggerTypes.add('time');
      } else if (includesAny(trigger, ['inactive', 'behavior'])) {
        configuredTriggerTypes.add('behavior');
      } else {
        configuredTriggerTypes.add('event');
      }
    });

  const missingCoreChannels: string[] = [];
  if (!hasPushChannel) missingCoreChannels.push('Push');
  if (!configuredChannelSet.has('email')) missingCoreChannels.push('Email');
  if (!configuredChannelSet.has('sms')) missingCoreChannels.push('SMS');
  if (!configuredChannelSet.has('in_app')) missingCoreChannels.push('In-app');

  const transactionalApiConfigured =
    featureFlags.some((flag) =>
      flag.is_enabled && includesAny(String(flag.flag_key || '').toLowerCase(), [
        'transactional',
        'notification.api',
        'messaging.api',
        'alerts.api',
      ])
    )
    || integrations.some((row) => row.type === 'api' && row.status !== 'planned');

  const workflowFallbackReady = crmWorkflows.some((row) => {
    if (String(row.status || 'active').toLowerCase() === 'archived') return false;
    const channels = new Set<string>();
    collectChannels(row.channels, channels);
    channels.delete('other');
    return channels.size >= 2;
  });

  const journeyFallbackReady = journeys.some((row) => {
    if (row.status === 'planned') return false;
    const channels = new Set<string>();
    (row.steps || []).forEach((step) => collectChannels(step.channel, channels));
    channels.delete('other');
    return channels.size >= 2;
  });

  const featureFallbackEnabled = featureFlags.some((flag) =>
    flag.is_enabled && includesAny(String(flag.flag_key || '').toLowerCase(), ['fallback', 'failover'])
  );

  const fallbackSupportReady =
    transactional.fallbackActivations > 0
    || featureFallbackEnabled
    || workflowFallbackReady
    || journeyFallbackReady
    || templateChannels.size >= 2;

  const realtimeNotificationsReady = transactional.sent > 0 || webhookInWindow.length > 0;
  const transactionalReliabilityScore = Math.max(0, 45 - transactional.failRatePct * 3.5);
  const transactionalRealtimeScore =
    (transactional.sent > 0 ? 15 : 0)
    + (webhookInWindow.length > 0 ? 10 : 0);
  const transactionalFallbackScore = fallbackSupportReady
    ? (transactional.fallbackActivations > 0 ? 20 : 15)
    : 0;

  const personalizationFlagEnabled = featureFlags.some((flag) =>
    flag.is_enabled && includesAny(String(flag.flag_key || '').toLowerCase(), ['personalization', 'recommendation', 'dynamic', 'offer'])
  );
  const dynamicPersonalizationFlagEnabled = featureFlags.some((flag) =>
    flag.is_enabled && includesAny(String(flag.flag_key || '').toLowerCase(), ['dynamic', 'real_time', 'offer', 'content'])
  );
  const webAppPersonalizationCoverageCount =
    (personalizationWebSignals > 0 ? 1 : 0)
    + (personalizationAppSignals > 0 ? 1 : 0);
  const personalizationAudienceCoveragePct = pct(intersectionCount(usersReached, personalizationUsers), usersReached.size);
  const dynamicContentReady = dynamicContentSignals > 0 || dynamicPersonalizationFlagEnabled;
  const behaviorPersonalizationReady = behaviorPersonalizationSignals > 0 || configuredTriggerTypes.has('behavior');
  const personalizationSignalScore = personalizationSignals > 0
    ? Math.min(35, 12 + Math.floor(personalizationSignals / 8))
    : 0;

  const capabilities: AdminGrowthCapability[] = [
    buildCapability({
      id: 'customer_analytics',
      title: '1. Customer Analytics & Insights',
      summary: 'Unified profiles, behavioral telemetry, segmentation and predictive audience scoring.',
      score:
        (summary.totalUsers > 0 ? 30 : 0) +
        (usage.totals.totalEvents > 0 ? 25 : 0) +
        (segmentationCriteriaCount >= 200 ? 20 : 0) +
        ((purchaseLikelyUsers.size + churnRiskUsers.size) > 0 ? 15 : 0) +
        (insights.length > 0 ? 10 : 0),
      requirements: [
        '360° unified customer profile',
        'Behavioral analytics + event tracking',
        'Advanced segmentation (200+ criteria)',
        'Predictive churn and purchase propensity',
        'AI audience discovery',
      ],
      gaps: [
        ...(usage.totals.totalEvents > 0 ? [] : ['Event instrumentation volume is low']),
        ...(segmentationCriteriaCount >= 200 ? [] : ['Segmentation catalog below 200 criteria']),
      ],
    }),
    buildCapability({
      id: 'cross_channel_engagement',
      title: '2. Cross-Channel Engagement',
      summary: 'Campaign delivery across push, email, SMS, in-app and extensible channels with trigger support.',
      score:
        Math.min(55, configuredChannels * 10) +
        Math.min(20, multiChannelReachPct) +
        (configuredChannelSet.has('whatsapp') ? 5 : 0) +
        (configuredChannelSet.has('rcs') ? 5 : 0) +
        Math.min(15, configuredTriggerTypes.size * 5),
      requirements: [
        'Mobile/Web push + Email + SMS + In-app',
        'WhatsApp & RCS support',
        'Configurable additional channels',
        'Real-time trigger execution',
      ],
      gaps: [
        ...(coreChannelsConfiguredCount >= 4
          ? []
          : [`Core channels incomplete (${coreChannelsConfiguredCount}/4): ${missingCoreChannels.join(', ')}`]),
        ...(configuredChannelSet.has('whatsapp') && configuredChannelSet.has('rcs')
          ? []
          : ['WhatsApp/RCS support is not fully configured']),
        ...(configuredTriggerTypes.size >= 2
          ? []
          : ['Trigger coverage is limited (configure event + behavior/time triggers)']),
        ...(multiChannelReachPct >= 25 ? [] : ['Low multi-channel audience overlap']),
      ],
    }),
    buildCapability({
      id: 'campaign_automation',
      title: '3. Campaign Automation',
      summary: 'Lifecycle journeys, trigger-based orchestration and drip campaign controls.',
      score:
        (visualBuilderEnabled ? 22 : 0) +
        (dragDropEnabled ? 18 : 0) +
        Math.min(35, activeJourneys * 9) +
        (hasBehaviorTrigger ? 10 : 0) +
        (hasTimeTrigger ? 10 : 0) +
        (hasDripJourney ? 5 : 0),
      requirements: [
        'Visual journey/flow builder support',
        'Behavioral and time-based triggers',
        'Lifecycle + drip campaigns',
        'Event-triggered messaging',
      ],
      gaps: [
        ...(activeJourneys >= 3 ? [] : ['Not enough active lifecycle journeys']),
        ...(hasBehaviorTrigger ? [] : ['Behavioral triggers are not fully configured']),
        ...(hasTimeTrigger ? [] : ['Time-based triggers are not fully configured']),
        ...(hasDripJourney ? [] : ['Lifecycle drip campaign is missing']),
        ...(visualBuilderEnabled ? [] : ['Visual journey builder is disabled']),
        ...(dragDropEnabled ? [] : ['Drag-and-drop orchestration is disabled']),
      ],
    }),
    buildCapability({
      id: 'ai_personalization',
      title: '4. AI & Personalization',
      summary: 'AI-assisted optimization, predictive segments and recommendation-driven campaign guidance.',
      score:
        Math.min(40, aiSignals > 0 ? 20 : 0) +
        Math.min(30, insights.length * 10) +
        (featureFlags.some((flag) => flag.is_enabled && includesAny(flag.flag_key.toLowerCase(), ['ai', 'merlin', 'sherpa'])) ? 30 : 0),
      requirements: [
        'Send-time/content optimization',
        'AI-generated predictive segments',
        'Dynamic recommendation messaging',
        'AI-assisted campaign suggestions',
      ],
      gaps: [
        ...(featureFlags.some((flag) => flag.is_enabled && includesAny(flag.flag_key.toLowerCase(), ['ai', 'merlin', 'sherpa']))
          ? []
          : ['No explicit AI optimization feature flag enabled']),
      ],
    }),
    buildCapability({
      id: 'personalization_scale',
      title: '5. Personalization at Scale',
      summary: 'Behavior and context-aware content personalization for web/app experiences.',
      score:
        personalizationSignalScore +
        Math.min(25, personalizationAudienceCoveragePct) +
        (webAppPersonalizationCoverageCount >= 2 ? 20 : webAppPersonalizationCoverageCount === 1 ? 10 : 0) +
        (dynamicContentReady ? 10 : 0) +
        (behaviorPersonalizationReady ? 5 : 0) +
        (personalizationFlagEnabled ? 5 : 0),
      requirements: [
        'Behavior-based personalization',
        'Web/app content personalization',
        'Dynamic offer/content updates in real time',
      ],
      gaps: [
        ...(personalizationSignals >= 25 ? [] : ['Low explicit personalization event signals']),
        ...(webAppPersonalizationCoverageCount >= 2 ? [] : ['Web/app personalization coverage is incomplete']),
        ...(dynamicContentReady ? [] : ['Dynamic offer/content updates are not configured']),
        ...(behaviorPersonalizationReady ? [] : ['Behavior-triggered personalization is not configured']),
        ...(personalizationAudienceCoveragePct >= 20 ? [] : ['Low audience coverage for personalized experiences']),
      ],
    }),
    buildCapability({
      id: 'testing_optimization',
      title: '6. Testing & Optimization',
      summary: 'A/B and multivariate experimentation with optimization feedback loops.',
      score:
        Math.min(30, experiments.length * 8) +
        (runningExperiments > 0 ? 25 : 0) +
        (multivariateReady ? 20 : 0) +
        Math.min(15, experimentationCoveragePct / 2) +
        (automatedExperimentReportingReady ? 10 : 0),
      requirements: [
        'A/B campaign testing',
        'Multivariate optimization',
        'Automated experiment reporting',
      ],
      gaps: [
        ...(runningExperiments > 0 ? [] : ['No active running experiment found']),
        ...(multivariateReady ? [] : ['Multivariate optimization is not configured']),
        ...(automatedExperimentReportingReady ? [] : ['Automated experiment reporting is not configured']),
        ...(experimentationCoveragePct >= 20 ? [] : ['Variant coverage is below 20%']),
      ],
    }),
    buildCapability({
      id: 'integrations_connectivity',
      title: '7. Integrations & Connectivity',
      summary: 'CRM, analytics, ad-sync, API and webhook connectivity for real-time orchestration.',
      score:
        Math.min(70, connectedIntegrations * 15) +
        Math.min(30, 100 - integrations.reduce((sum, row) => sum + row.errorRatePct, 0) / Math.max(1, integrations.length)),
      requirements: [
        'CRM integrations (Salesforce/HubSpot)',
        'Analytics/tag manager connectivity',
        'Audience sync with external/ad systems',
        'API and webhook ingestion/export',
      ],
      gaps: [
        ...(connectedIntegrations >= 3 ? [] : ['Less than 3 integrations connected']),
      ],
    }),
    buildCapability({
      id: 'transactional_messaging',
      title: '8. Real-Time Transactional Messaging',
      summary: 'Unified transactional delivery with fallback and reliability tracking.',
      score:
        transactionalReliabilityScore +
        transactionalRealtimeScore +
        transactionalFallbackScore +
        (transactionalApiConfigured ? 10 : 0),
      requirements: [
        'Unified transactional alerts API',
        'Real-time event notifications',
        'Channel fallback support',
      ],
      gaps: [
        ...(transactionalApiConfigured ? [] : ['Unified transactional alerts API is not configured']),
        ...(realtimeNotificationsReady ? [] : ['No real-time transactional notification activity detected']),
        ...((fallbackSupportReady && transactional.failRatePct <= 1) || transactional.fallbackActivations > 0
          ? []
          : ['Fallback support is not validated for active transactional failures']),
        ...(fallbackSupportReady ? [] : ['Channel fallback support is not configured']),
        ...(transactional.failRatePct <= 5 ? [] : ['Transactional fail rate above 5%']),
      ],
    }),
    buildCapability({
      id: 'security_governance',
      title: '9. Security & Governance',
      summary: 'RBAC, approvals, identity controls and compliance readiness.',
      score:
        Math.min(40, twoFactorRatio * 40) +
        (governance.workflowApprovalEvents > 0 ? 25 : 10) +
        (governance.ssoEnabled ? 20 : 0) +
        (governance.gdprCcpaControls ? 15 : 0),
      requirements: [
        'Role-based access controls',
        'Workflow approvals',
        'SSO + two-factor authentication',
        'GDPR/CCPA compliance controls',
      ],
      gaps: [
        ...(twoFactorRatio >= 0.8 ? [] : ['2FA coverage for admin users is below 80%']),
        ...(governance.ssoEnabled ? [] : ['SSO flag is not enabled']),
        ...(governance.gdprCcpaControls ? [] : ['GDPR/CCPA policy flag is not enabled']),
      ],
    }),
    buildCapability({
      id: 'reporting_analytics',
      title: '10. Reporting & Analytics',
      summary: 'Cross-channel performance, engagement, trend and ROI reporting.',
      score:
        (channels.length ? 25 : 0) +
        (segments.length ? 20 : 0) +
        (analytics.series.length ? 20 : 0) +
        (usage.trends.length ? 20 : 0) +
        15,
      requirements: [
        'Cross-channel dashboards',
        'Opens/clicks/conversion reporting',
        'Trend + behavior analysis',
        'ROI tracking',
      ],
      gaps: [
        ...(channels.some((row) => row.opened > 0 || row.clicked > 0) ? [] : ['Open/click instrumentation is limited across channels']),
      ],
    }),
  ];

  return {
    generatedAt: new Date().toISOString(),
    windowDays: safeDays,
    kpis: {
      totalProfiles: summary.totalUsers,
      activeUsers,
      campaignReachUsers: usersReached.size,
      segmentationCriteriaCount,
      configuredChannels,
      multiChannelReachPct,
      goalConversionPct,
      revenueAttributed: Number(successfulRevenue.toFixed(2)),
      churnRiskUsers: churnRiskUsers.size,
      purchaseLikelyUsers: purchaseLikelyUsers.size,
      roiPct,
      experimentationCoveragePct,
    },
    channels,
    segments,
    journeys,
    experiments,
    integrations,
    insights,
    governance,
    transactional,
    capabilities,
  };
}

export async function getPortfolioRows(params?: {
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<AdminPortfolioRow[]> {
  const limit = Math.max(10, Math.min(params?.limit || 100, 200));
  const offset = Math.max(0, params?.offset || 0);

  // Prefer RPC if available.
  const rpc = await supabase.rpc('admin_portfolio_feed', {
    p_limit: limit,
    p_offset: offset,
    p_search: params?.search || null,
  });

  if (!rpc.error && Array.isArray(rpc.data)) {
    return rpc.data.map((row: any) => ({
      userId: String(row.user_id),
      email: String(row.email || ''),
      name: String(row.name || ''),
      totalAssets: num(row.total_assets),
      totalLiabilities: num(row.total_liabilities),
      netWorth: num(row.net_worth),
      goalsCount: num(row.goals_count),
      transactionsCount: num(row.transactions_count),
      lastTransactionAt: row.last_transaction_at || null,
      riskLevel: row.risk_level || null,
      kycStatus: row.kyc_status || null,
    }));
  }

  const customers = await getAdminCustomers({
    search: params?.search,
    limit: Math.max(limit + offset, 120),
    offset: 0,
  });

  const targetUsers = customers.slice(0, Math.max(limit + offset, 120));
  const userIds = targetUsers.map((item) => item.user_id);
  if (!userIds.length) return [];

  const [assets, loans, goals, transactions] = await Promise.all([
    supabase.from('assets').select('user_id,current_value').in('user_id', userIds),
    supabase.from('loans').select('user_id,outstanding_amount').in('user_id', userIds),
    supabase.from('goals').select('user_id').in('user_id', userIds),
    supabase
      .from('transactions')
      .select('user_id,created_at')
      .in('user_id', userIds)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  const assetsMap = new Map<string, number>();
  (assets.data || []).forEach((row: any) => {
    const key = String(row.user_id);
    assetsMap.set(key, (assetsMap.get(key) || 0) + num(row.current_value));
  });

  const loanMap = new Map<string, number>();
  (loans.data || []).forEach((row: any) => {
    const key = String(row.user_id);
    loanMap.set(key, (loanMap.get(key) || 0) + num(row.outstanding_amount));
  });

  const goalsMap = new Map<string, number>();
  (goals.data || []).forEach((row: any) => {
    const key = String(row.user_id);
    goalsMap.set(key, (goalsMap.get(key) || 0) + 1);
  });

  const txCountMap = new Map<string, number>();
  const txLastMap = new Map<string, string>();
  (transactions.data || []).forEach((row: any) => {
    const key = String(row.user_id);
    const current = txCountMap.get(key) || 0;
    txCountMap.set(key, current + 1);
    const last = txLastMap.get(key);
    const nextTime = String(row.created_at || '');
    if (!last || nextTime > last) {
      txLastMap.set(key, nextTime);
    }
  });

  const rows = targetUsers.map((customer) => {
    const totalAssets = assetsMap.get(customer.user_id) || 0;
    const totalLiabilities = loanMap.get(customer.user_id) || 0;
    return {
      userId: customer.user_id,
      email: customer.email,
      name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.email,
      totalAssets,
      totalLiabilities,
      netWorth: totalAssets - totalLiabilities,
      goalsCount: goalsMap.get(customer.user_id) || 0,
      transactionsCount: txCountMap.get(customer.user_id) || 0,
      lastTransactionAt: txLastMap.get(customer.user_id) || null,
      riskLevel: customer.risk_level || null,
      kycStatus: customer.kyc_status || null,
    } as AdminPortfolioRow;
  });

  return rows
    .sort((a, b) => b.netWorth - a.netWorth)
    .slice(offset, offset + limit);
}

export async function getCustomerFinancialDetail(userId: string) {
  const [assets, loans, goals, transactions] = await Promise.all([
    supabase.from('assets').select('*').eq('user_id', userId).order('current_value', { ascending: false }).limit(100),
    supabase.from('loans').select('*').eq('user_id', userId).order('outstanding_amount', { ascending: false }).limit(100),
    supabase.from('goals').select('*').eq('user_id', userId).order('priority', { ascending: true }).limit(100),
    supabase.from('transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(150),
  ]);

  if (assets.error) throw toError(assets.error, 'Could not load customer assets.');
  if (loans.error) throw toError(loans.error, 'Could not load customer liabilities.');
  if (goals.error) throw toError(goals.error, 'Could not load customer goals.');
  if (transactions.error) throw toError(transactions.error, 'Could not load customer transactions.');

  return {
    assets: assets.data || [],
    loans: loans.data || [],
    goals: goals.data || [],
    transactions: transactions.data || [],
  };
}

export async function getSupportTickets(params?: {
  status?: string;
  limit?: number;
  withSlaSweep?: boolean;
}): Promise<SupportTicket[]> {
  const limit = Math.max(20, Math.min(params?.limit || 150, 300));
  if (params?.withSlaSweep !== false) {
    try {
      await supabase.rpc('support_run_sla_sweep', {
        p_due_soon_hours: 6,
        p_force_escalation: false,
      });
    } catch {
      // Best-effort pre-refresh sweep; ignore errors so ticket listing still loads.
    }
  }

  let query = supabase.from('support_tickets').select('*').order('updated_at', { ascending: false }).limit(limit);
  if (params?.status && params.status !== 'all') {
    query = query.eq('status', params.status);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw toError(error, 'Could not load support tickets.');
  }

  return (data || []).map((row: any) => ({
    id: String(row.id),
    ticketNumber: String(row.ticket_number || String(row.id).slice(0, 8).toUpperCase()),
    userId: String(row.user_id || ''),
    subject: String(row.subject || 'Untitled Ticket'),
    category: String(row.category || 'general'),
    priority: String(row.priority || 'medium'),
    status: String(row.status || 'open'),
    assignedTo: row.assigned_to || null,
    resolutionNote: row.resolution_note || null,
    firstResponseAt: row.first_response_at ? String(row.first_response_at) : null,
    firstResponseDueAt: row.first_response_due_at ? String(row.first_response_due_at) : null,
    resolutionDueAt: row.resolution_due_at ? String(row.resolution_due_at) : null,
    closedAt: row.closed_at ? String(row.closed_at) : null,
    slaStatus: ['on_track', 'due_soon', 'breached', 'paused', 'met'].includes(String(row.sla_status))
      ? row.sla_status
      : 'on_track',
    escalated: Boolean(row.escalated),
    escalationLevel: num(row.escalation_level),
    escalationCount: num(row.escalation_count),
    escalationReason: row.escalation_reason ? String(row.escalation_reason) : null,
    escalatedAt: row.escalated_at ? String(row.escalated_at) : null,
    nextEscalationAt: row.next_escalation_at ? String(row.next_escalation_at) : null,
    breachCount: num(row.breach_count),
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || row.created_at || new Date().toISOString()),
  }));
}

export async function createCrmComplaintTicket(payload: {
  userId: string;
  subject: string;
  description?: string;
  priority?: string;
  assignedTo?: string | null;
  tags?: string[];
}): Promise<void> {
  const nowIso = new Date().toISOString();
  const datePart = nowIso.slice(2, 10).replace(/-/g, '');
  const ticketNumber = `CMP-${datePart}-${randomHex(2).toUpperCase()}`;

  const normalizedPriority = ['low', 'medium', 'high', 'urgent'].includes(String(payload.priority || '').toLowerCase())
    ? String(payload.priority || '').toLowerCase()
    : 'medium';

  const { error } = await supabase.from('support_tickets').insert({
    ticket_number: ticketNumber,
    user_id: payload.userId.trim(),
    subject: payload.subject.trim(),
    description: payload.description?.trim() || null,
    category: 'complaint',
    priority: normalizedPriority,
    status: 'open',
    assigned_to: payload.assignedTo?.trim() || null,
    tags: (payload.tags || []).map((tag) => tag.trim()).filter(Boolean),
    created_at: nowIso,
    updated_at: nowIso,
  });

  if (error) throw toError(error, 'Could not create complaint ticket.');
}

export async function updateSupportTicket(
  ticketId: string,
  payload: {
    status?: string;
    priority?: string;
    assignedTo?: string | null;
    resolutionNote?: string | null;
    escalationReason?: string | null;
    escalated?: boolean;
    escalationLevel?: number;
  }
): Promise<void> {
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (payload.status != null) updatePayload.status = payload.status;
  if (payload.priority != null) updatePayload.priority = payload.priority;
  if (payload.assignedTo !== undefined) updatePayload.assigned_to = payload.assignedTo;
  if (payload.resolutionNote !== undefined) updatePayload.resolution_note = payload.resolutionNote;
  if (payload.escalationReason !== undefined) updatePayload.escalation_reason = payload.escalationReason;
  if (payload.escalated !== undefined) updatePayload.escalated = payload.escalated;
  if (payload.escalationLevel !== undefined) updatePayload.escalation_level = Math.max(0, Number(payload.escalationLevel) || 0);

  if (payload.status === 'resolved' || payload.status === 'closed') {
    updatePayload.resolved_at = new Date().toISOString();
    updatePayload.escalated = false;
    updatePayload.next_escalation_at = null;
    updatePayload.sla_status = 'met';
  }

  const { error } = await supabase.from('support_tickets').update(updatePayload).eq('id', ticketId);
  if (error) throw toError(error, 'Could not update support ticket.');
}

export async function runSupportTicketSlaSweep(params?: {
  dueSoonHours?: number;
  forceEscalation?: boolean;
}): Promise<{ scanned: number; updated: number; escalated: number; breached: number; ranAt: string }> {
  const dueSoonHours = Math.max(1, Math.min(Number(params?.dueSoonHours || 6), 72));
  const { data, error } = await supabase.rpc('support_run_sla_sweep', {
    p_due_soon_hours: dueSoonHours,
    p_force_escalation: Boolean(params?.forceEscalation),
  });

  if (error) throw toError(error, 'Could not run SLA sweep.');
  const payload = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  return {
    scanned: num(payload.scanned),
    updated: num(payload.updated),
    escalated: num(payload.escalated),
    breached: num(payload.breached),
    ranAt: String(payload.ranAt || new Date().toISOString()),
  };
}

export async function escalateSupportTicket(ticketId: string, reason = 'manual_escalation'): Promise<void> {
  const rpc = await supabase.rpc('support_escalate_ticket', {
    p_ticket_id: ticketId,
    p_reason: reason,
  });
  if (!rpc.error) return;

  const fallback = await supabase
    .from('support_tickets')
    .update({
      escalated: true,
      escalation_reason: reason,
      escalation_level: 1,
      escalation_count: 1,
      escalated_at: new Date().toISOString(),
      last_escalated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId);
  if (fallback.error) throw toError(rpc.error, 'Could not escalate support ticket.');
}

export async function getAdminRoles(): Promise<AdminRole[]> {
  const workspaceId = getWorkspaceIdOrNull();
  if (workspaceId) {
    const { data, error } = await supabase.rpc('admin_list_workspace_roles', {
      p_workspace_id: workspaceId,
    });

    if (!error) {
      return (data || []).map((row: any) => ({
        id: String(row.role_key || 'support'),
        roleKey: String(row.role_key || 'support'),
        displayName: String(row.display_name || row.role_key || 'Support'),
        description: row.description || null,
        permissionKeys: Array.isArray(row.permission_keys) ? row.permission_keys.map(String) : [],
      }));
    }
  }

  // Legacy fallback for pre-foundation environments.
  const legacy = await supabase
    .from('admin_roles')
    .select('id, role_key, display_name, description')
    .order('display_name', { ascending: true });

  if (legacy.error) {
    if (isMissingRelationError(legacy.error)) return [];
    throw toError(legacy.error, 'Could not load admin roles.');
  }

  return (legacy.data || []).map((row: any) => ({
    id: String(row.id),
    roleKey: String(row.role_key || 'unknown'),
    displayName: String(row.display_name || row.role_key || 'Unknown'),
    description: row.description || null,
    permissionKeys: [],
  }));
}

export async function getAdminPermissions(): Promise<AdminPermissionDefinition[]> {
  const workspaceId = getWorkspaceIdOrNull();
  let rpcError: unknown = null;

  if (workspaceId) {
    const { data, error } = await supabase.rpc('admin_list_workspace_permissions', {
      p_workspace_id: workspaceId,
    });
    if (!error) {
      return (data || []).map((row: any) => ({
        permissionKey: String(row.permission_key || ''),
        description: row.description || null,
      }));
    }
    rpcError = error;
  }

  // Legacy fallback for pre-foundation environments.
  const legacy = await supabase
    .from('admin_permissions')
    .select('permission_key, description')
    .order('permission_key', { ascending: true });

  if (legacy.error) {
    if (isMissingRelationError(legacy.error)) return [];
    if (rpcError && !isMissingRelationError(rpcError)) {
      throw toError(rpcError, 'Could not load permissions.');
    }
    throw toError(legacy.error, 'Could not load permissions.');
  }

  return (legacy.data || []).map((row: any) => ({
    permissionKey: String(row.permission_key || ''),
    description: row.description || null,
  }));
}

export async function getAdminUsersWithRoles(): Promise<AdminUserAccount[]> {
  const workspaceId = getWorkspaceIdOrNull();
  const roles = await getAdminRoles();

  if (workspaceId) {
    const usersRes = await supabase.rpc('admin_list_workspace_users', {
      p_workspace_id: workspaceId,
      p_limit: 400,
      p_offset: 0,
    });

    if (!usersRes.error) {
      const roleMap = new Map(roles.map((role) => [role.roleKey, role]));
      return (usersRes.data || []).map((row: any) => {
        const roleKey = String(row.role_key || 'support');
        const role = roleMap.get(roleKey);
        return {
          userId: String(row.user_id),
          email: row.email ? String(row.email) : String(row.user_id),
          name: String(row.full_name || '-'),
          roleId: roleKey,
          roleKey,
          roleName: role?.displayName || roleKey,
          isActive: Boolean(row.is_active),
          twoFactorRequired: Boolean(row.two_factor_required),
          twoFactorEnabled: Boolean(row.two_factor_enabled),
          lastLoginAt: row.last_login_at || null,
          createdAt: String(row.created_at || new Date().toISOString()),
        };
      });
    }
  }

  // Legacy fallback.
  const admins = await supabase
    .from('admin_users')
    .select('user_id, role_id, is_active, two_factor_enabled, last_login_at, created_at')
    .order('created_at', { ascending: false });

  if (admins.error) {
    if (isMissingRelationError(admins.error)) return [];
    throw toError(admins.error, 'Could not load admin users.');
  }

  const roleMap = new Map(roles.map((role) => [role.id, role]));
  const userIds = (admins.data || []).map((row: any) => String(row.user_id));
  const profiles = userIds.length
    ? await supabase.from('profiles').select('id, identifier, first_name, last_name').in('id', userIds)
    : { data: [], error: null as any };

  const profileMap = new Map<string, { email: string; name: string }>();
  (profiles.data || []).forEach((row: any) => {
    profileMap.set(String(row.id), {
      email: String(row.identifier || ''),
      name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
    });
  });

  return (admins.data || []).map((row: any) => {
    const role = roleMap.get(String(row.role_id));
    const profile = profileMap.get(String(row.user_id));
    return {
      userId: String(row.user_id),
      email: profile?.email || String(row.user_id),
      name: profile?.name || '-',
      roleId: String(row.role_id),
      roleKey: role?.roleKey || 'unknown',
      roleName: role?.displayName || 'Unknown',
      isActive: Boolean(row.is_active),
      twoFactorRequired: false,
      twoFactorEnabled: Boolean(row.two_factor_enabled),
      lastLoginAt: row.last_login_at || null,
      createdAt: String(row.created_at || new Date().toISOString()),
    };
  });
}

export async function upsertAdminUserAccount(payload: {
  userId: string;
  roleId: string;
  isActive?: boolean;
  twoFactorRequired?: boolean;
  twoFactorEnabled?: boolean;
  reason?: string;
}): Promise<void> {
  const workspaceId = getWorkspaceIdOrNull();
  if (workspaceId) {
    const { error } = await supabase.rpc('admin_upsert_workspace_user', {
      p_workspace_id: workspaceId,
      p_user_id: payload.userId,
      p_role_key: payload.roleId,
      p_is_active: payload.isActive ?? true,
      p_two_factor_required: payload.twoFactorRequired ?? payload.twoFactorEnabled ?? false,
      p_reason: payload.reason ?? null,
    });

    if (!error) return;
  }

  // Legacy fallback.
  const legacy = await supabase.from('admin_users').upsert(
    {
      user_id: payload.userId,
      role_id: payload.roleId,
      is_active: payload.isActive ?? true,
      two_factor_enabled: payload.twoFactorEnabled ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (legacy.error) throw toError(legacy.error, 'Could not save admin user account.');
}

export async function getAdminAuditLogs(params?: {
  action?: string;
  limit?: number;
}): Promise<AdminAuditLog[]> {
  const limit = Math.max(20, Math.min(params?.limit || 200, 500));
  const workspaceId = getWorkspaceIdOrNull();
  let rpcError: unknown = null;

  if (workspaceId) {
    const { data, error } = await supabase.rpc('admin_list_workspace_audit_logs', {
      p_workspace_id: workspaceId,
      p_action: params?.action ?? null,
      p_limit: limit,
      p_offset: 0,
    });

    if (!error) {
      return (data || []).map((row: any) => ({
        id: String(row.id),
        adminUserId: String(row.admin_user_id || ''),
        action: String(row.action || 'unknown'),
        entityType: String(row.entity_type || 'unknown'),
        entityId: row.entity_id || null,
        reason: row.reason || null,
        payload: (row.payload || {}) as Record<string, unknown>,
        createdAt: String(row.created_at || new Date().toISOString()),
      }));
    }
    rpcError = error;
  }

  let query = supabase
    .from('admin_audit_logs')
    .select('id, admin_user_id, action, entity_type, entity_id, reason, payload, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (params?.action?.trim()) query = query.ilike('action', `%${params.action.trim()}%`);

  const fallback = await query;
  if (fallback.error) {
    if (isMissingRelationError(fallback.error)) return [];
    if (rpcError && !isMissingRelationError(rpcError)) {
      throw toError(rpcError, 'Could not load audit logs.');
    }
    throw toError(fallback.error, 'Could not load audit logs.');
  }

  return (fallback.data || []).map((row: any) => ({
    id: String(row.id),
    adminUserId: String(row.admin_user_id || ''),
    action: String(row.action || 'unknown'),
    entityType: String(row.entity_type || 'unknown'),
    entityId: row.entity_id || null,
    reason: row.reason || null,
    payload: (row.payload || {}) as Record<string, unknown>,
    createdAt: String(row.created_at || new Date().toISOString()),
  }));
}

const normalizeTwoFactorStatus = (raw: unknown): AdminTwoFactorStatus => {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const status =
    row.status === 'pending' || row.status === 'enabled' || row.status === 'disabled'
      ? row.status
      : 'disabled';
  return {
    workspaceId: String(row.workspaceId || getWorkspaceIdOrNull() || ''),
    userId: String(row.userId || ''),
    required: Boolean(row.required),
    status,
    enabled: Boolean(row.enabled),
    enabledAt: (typeof row.enabledAt === 'string' && row.enabledAt) || null,
    lastVerifiedAt: (typeof row.lastVerifiedAt === 'string' && row.lastVerifiedAt) || null,
    recoveryCodesRemaining: num(row.recoveryCodesRemaining),
  };
};

const mapSecuritySession = (row: any): AdminSecuritySession => ({
  id: String(row.id),
  userId: String(row.user_id || ''),
  email: row.email || null,
  fullName: row.full_name || null,
  roleKey: row.role_key || null,
  deviceName: row.device_name || null,
  ipAddress: row.ip_address || null,
  userAgent: row.user_agent || null,
  startedAt: String(row.started_at || new Date().toISOString()),
  lastSeenAt: String(row.last_seen_at || row.started_at || new Date().toISOString()),
  twoFactorVerifiedAt: row.two_factor_verified_at || null,
  revokedAt: row.revoked_at || null,
  revokeReason: row.revoke_reason || null,
  isCurrentUser: Boolean(row.is_current_user),
});

export async function registerAdminSecuritySession(options?: {
  deviceName?: string;
  ipAddress?: string | null;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const workspaceId = requireWorkspaceId();
  const token = getAdminSessionToken();
  const { error } = await supabase.rpc('admin_register_security_session', {
    p_workspace_id: workspaceId,
    p_session_token: token,
    p_device_name: options?.deviceName || null,
    p_ip: options?.ipAddress || null,
    p_user_agent: options?.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : null),
    p_metadata: options?.metadata || {},
  });
  if (error) throw toError(error, 'Could not register admin session.');
}

export async function touchAdminSecuritySession(): Promise<void> {
  const workspaceId = requireWorkspaceId();
  const token = getAdminSessionToken();
  const { error } = await supabase.rpc('admin_touch_security_session', {
    p_workspace_id: workspaceId,
    p_session_token: token,
  });
  if (error) throw toError(error, 'Could not update admin session activity.');
}

export async function getAdminSecuritySessions(targetUserId?: string): Promise<AdminSecuritySession[]> {
  const workspaceId = getWorkspaceIdOrNull();
  if (!workspaceId) return [];
  const { data, error } = await supabase.rpc('admin_list_security_sessions', {
    p_workspace_id: workspaceId,
    p_target_user_id: targetUserId || null,
    p_limit: 300,
  });
  if (error) throw toError(error, 'Could not load security sessions.');
  return (data || []).map(mapSecuritySession);
}

export async function revokeAdminSecuritySession(sessionId: string, reason?: string): Promise<void> {
  const workspaceId = requireWorkspaceId();
  const { error } = await supabase.rpc('admin_revoke_security_session', {
    p_workspace_id: workspaceId,
    p_session_id: sessionId,
    p_reason: reason || null,
  });
  if (error) throw toError(error, 'Could not revoke session.');
}

export async function getAdminTwoFactorStatus(targetUserId?: string): Promise<AdminTwoFactorStatus> {
  const workspaceId = getWorkspaceIdOrNull();
  if (!workspaceId) {
    const currentUserId =
      targetUserId ||
      (await supabase.auth.getSession()).data.session?.user?.id ||
      '';
    return {
      workspaceId: '',
      userId: currentUserId,
      required: false,
      status: 'disabled',
      enabled: false,
      enabledAt: null,
      lastVerifiedAt: null,
      recoveryCodesRemaining: 0,
    };
  }
  const params: Record<string, unknown> = {
    p_workspace_id: workspaceId,
  };
  if (targetUserId) params.p_target_user_id = targetUserId;
  const { data, error } = await supabase.rpc('admin_get_two_factor_status', params);
  if (error) throw toError(error, 'Could not load two-factor status.');
  return normalizeTwoFactorStatus(data);
}

export async function startAdminTwoFactorSetup(): Promise<AdminTwoFactorSetup> {
  const workspaceId = requireWorkspaceId();
  const access = await getAdminAccess();
  const secret = randomBase32Secret(32);
  const recoveryCodes = Array.from({ length: 8 }, () => randomRecoveryCode());

  const { error } = await supabase.rpc('admin_setup_totp', {
    p_workspace_id: workspaceId,
    p_secret_base32: secret,
    p_recovery_codes: recoveryCodes,
  });
  if (error) throw toError(error, 'Could not start TOTP setup.');

  const issuer = 'FinVantage';
  const labelRaw = `${issuer}:${access.workspaceName || 'Admin'}:${access.userId || 'user'}`;
  const otpAuthUrl =
    `otpauth://totp/${encodeURIComponent(labelRaw)}` +
    `?secret=${encodeURIComponent(secret)}` +
    `&issuer=${encodeURIComponent(issuer)}` +
    `&algorithm=SHA1&digits=6&period=30`;

  return { secret, otpAuthUrl, recoveryCodes };
}

export async function confirmAdminTwoFactorSetup(code: string): Promise<AdminTwoFactorStatus> {
  const workspaceId = requireWorkspaceId();
  const token = getAdminSessionToken();
  const { data, error } = await supabase.rpc('admin_confirm_totp_enable', {
    p_workspace_id: workspaceId,
    p_code: code,
    p_session_token: token,
  });
  if (error) throw toError(error, 'Could not verify TOTP code.');
  return normalizeTwoFactorStatus(data);
}

export async function verifyAdminSecondFactor(code: string): Promise<AdminTwoFactorStatus> {
  const workspaceId = requireWorkspaceId();
  const token = getAdminSessionToken();
  const { data, error } = await supabase.rpc('admin_verify_second_factor', {
    p_workspace_id: workspaceId,
    p_code: code,
    p_session_token: token,
  });
  if (error) throw toError(error, 'Second-factor verification failed.');
  const statusRaw = (data && typeof data === 'object' ? (data as Record<string, unknown>).status : null) || null;
  return normalizeTwoFactorStatus(statusRaw);
}

export async function regenerateAdminRecoveryCodes(codes: string[]): Promise<void> {
  const workspaceId = requireWorkspaceId();
  const { error } = await supabase.rpc('admin_regenerate_recovery_codes', {
    p_workspace_id: workspaceId,
    p_new_recovery_codes: codes,
  });
  if (error) throw toError(error, 'Could not regenerate recovery codes.');
}

export async function disableAdminTwoFactor(reason?: string): Promise<void> {
  const workspaceId = requireWorkspaceId();
  const { error } = await supabase.rpc('admin_disable_totp', {
    p_workspace_id: workspaceId,
    p_reason: reason || null,
  });
  if (error) throw toError(error, 'Could not disable two-factor authentication.');
}

export async function getAdminOverviewReport(days = 30): Promise<AdminOverviewReport> {
  const [
    summary,
    analytics,
    customers,
    kycCases,
    fraudFlags,
    payments,
    subscriptions,
    tickets,
    portfolio,
  ] = await Promise.all([
    getAdminDashboardSummary(),
    getAnalyticsSnapshot(days),
    getAdminCustomers({ limit: 300, offset: 0 }),
    getKycQueue(),
    getFraudQueue(),
    getPayments(500),
    getSubscriptions(400),
    getSupportTickets({ limit: 250 }),
    getPortfolioRows({ limit: 120, offset: 0 }),
  ]);

  const paymentsSuccessful = payments.filter((item) =>
    ['captured', 'settled', 'authorized', 'success', 'paid'].includes(item.status.toLowerCase())
  ).length;
  const paymentSuccessRatePct = payments.length ? (paymentsSuccessful / payments.length) * 100 : 0;

  const activeSubscriptions = subscriptions.filter((item) =>
    ['active', 'trialing', 'past_due'].includes(item.status.toLowerCase())
  ).length;

  const openTickets = tickets.filter((ticket) =>
    ['open', 'in_progress', 'waiting_user'].includes(ticket.status.toLowerCase())
  ).length;

  const topCustomers = [...portfolio]
    .sort((a, b) => b.netWorth - a.netWorth)
    .slice(0, 8)
    .map((item) => ({
      userId: item.userId,
      email: item.email,
      name: item.name,
      netWorth: item.netWorth,
      totalAssets: item.totalAssets,
      totalLiabilities: item.totalLiabilities,
      goalCount: item.goalsCount,
      lastActivityAt: item.lastTransactionAt,
    }));

  const alerts: AdminOverviewReport['alerts'] = [];

  if (summary.failedPayments30d > 0) {
    alerts.push({
      severity: summary.failedPayments30d > 25 ? 'high' : 'medium',
      title: 'Payment failure pressure',
      detail: 'Failed or declined payments need follow-up to prevent involuntary churn.',
      metric: `${summary.failedPayments30d} failed in last 30 days`,
    });
  }

  if (summary.pendingKyc > 0) {
    alerts.push({
      severity: summary.pendingKyc > 50 ? 'high' : 'medium',
      title: 'KYC pending backlog',
      detail: 'Pending KYC increases compliance exposure and activation delays.',
      metric: `${summary.pendingKyc} pending KYC profiles`,
    });
  }

  if (summary.openFraudFlags > 0) {
    alerts.push({
      severity: summary.openFraudFlags > 15 ? 'critical' : 'high',
      title: 'Open fraud cases',
      detail: 'Open flags require triage to reduce AML and chargeback risk.',
      metric: `${summary.openFraudFlags} unresolved fraud flags`,
    });
  }

  if (summary.blockedUsers > 0) {
    alerts.push({
      severity: 'low',
      title: 'Blocked account inventory',
      detail: 'Review blocked users periodically for false-positive operational lockouts.',
      metric: `${summary.blockedUsers} currently blocked`,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalUsers: summary.totalUsers,
      onboardedUsers: summary.onboardedUsers,
      onboardingRatePct: summary.totalUsers ? (summary.onboardedUsers / summary.totalUsers) * 100 : 0,
      newUsers30d: summary.newUsers30d,
      dau: summary.dau,
      mau: summary.mau,
      engagementPct: summary.mau ? (summary.dau / summary.mau) * 100 : 0,
      totalAum: summary.totalAum,
      mtdRevenue: summary.mtdRevenue,
      paymentSuccessRatePct,
      failedPayments30d: summary.failedPayments30d,
      pendingKyc: summary.pendingKyc,
      openFraudFlags: summary.openFraudFlags,
      blockedUsers: summary.blockedUsers,
      openTickets,
      activeSubscriptions,
    },
    distributions: {
      paymentStatus: countDistribution(payments.map((item) => item.status.toLowerCase())),
      subscriptionStatus: countDistribution(subscriptions.map((item) => item.status.toLowerCase())),
      kycStatus: countDistribution(kycCases.map((item) => item.status.toLowerCase())),
      fraudSeverity: countDistribution(fraudFlags.map((item) => item.severity.toLowerCase())),
      riskLevel: countDistribution(customers.map((item) => (item.risk_level || 'unknown').toLowerCase())),
    },
    topCustomers,
    alerts,
    trends: analytics.series,
  };
}

export async function exportCustomersCsv(customers: AdminCustomer[]): Promise<void> {
  const headers = [
    'user_id',
    'email',
    'first_name',
    'last_name',
    'country',
    'onboarding_done',
    'risk_level',
    'kyc_status',
    'plan_code',
    'subscription_status',
    'blocked',
    'created_at',
    'updated_at',
  ];

  const lines = [
    headers.join(','),
    ...customers.map((row) => {
      const values = [
        row.user_id,
        row.email,
        row.first_name,
        row.last_name || '',
        row.country || '',
        row.onboarding_done ? 'true' : 'false',
        row.risk_level || '',
        row.kyc_status || '',
        row.plan_code || '',
        row.subscription_status || '',
        row.blocked ? 'true' : 'false',
        row.created_at,
        row.updated_at,
      ];

      return values
        .map((value) => {
          const escaped = String(value).replaceAll('"', '""');
          return `"${escaped}"`;
        })
        .join(',');
    }),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `admin-customers-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export async function getSelfAdminFlag(userId?: string | null) {
  const uid = userId || (await supabase.auth.getSession()).data.session?.user.id || null;
  if (!uid) return null;

  const { data, error } = await supabase
    .from('user_admin_flags')
    .select('is_blocked, blocked_reason, force_logout_requested_at, updated_at')
    .eq('user_id', uid)
    .maybeSingle();

  if (error) return null;
  return data;
}

const parseTimeMs = (value?: string | null) => {
  if (!value) return 0;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : 0;
};

const normalizePlatform = (source?: string | null, metadata?: Record<string, unknown> | null) => {
  const raw = String(metadata?.platform || metadata?.client || source || '').toLowerCase();
  if (!raw) return 'unknown';
  if (includesAny(raw, ['web', 'browser'])) return 'web';
  if (includesAny(raw, ['android', 'ios', 'mobile', 'app'])) return 'app';
  if (includesAny(raw, ['email'])) return 'email';
  if (includesAny(raw, ['sms', 'whatsapp', 'rcs'])) return 'messaging';
  if (includesAny(raw, ['api', 'server', 'webhook'])) return 'api';
  return raw;
};

export async function getBehaviorIntelligenceReport(days = 30): Promise<AdminBehaviorReport> {
  const safeDays = Math.max(7, Math.min(days, 365));
  const now = Date.now();
  const startIso = new Date(now - safeDays * 24 * 60 * 60 * 1000).toISOString();
  const hourAgoIso = new Date(now - 60 * 60 * 1000).toISOString();
  const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;

  const [eventsResult, profilesResult, paymentsResult, flags] = await Promise.all([
    supabase
      .from('activity_events')
      .select('user_id, event_name, source, metadata, event_time')
      .gte('event_time', startIso)
      .order('event_time', { ascending: false })
      .limit(22000),
    supabase
      .from('profiles')
      .select('id, identifier, created_at, onboarding_done')
      .order('created_at', { ascending: false })
      .limit(12000),
    supabase
      .from('payments')
      .select('user_id, status, attempted_at')
      .gte('attempted_at', startIso)
      .limit(6000),
    getFeatureFlags().catch(() => [] as FeatureFlag[]),
  ]);

  if (eventsResult.error && !isMissingRelationError(eventsResult.error)) {
    throw toError(eventsResult.error, 'Could not load behavior events.');
  }
  if (profilesResult.error && !isMissingRelationError(profilesResult.error)) {
    throw toError(profilesResult.error, 'Could not load profile data.');
  }
  if (paymentsResult.error && !isMissingRelationError(paymentsResult.error)) {
    throw toError(paymentsResult.error, 'Could not load payment signals.');
  }

  const events = (eventsResult.data || []) as Array<{
    user_id: string | null;
    event_name: string;
    source: string | null;
    metadata: Record<string, unknown> | null;
    event_time: string;
  }>;
  const profiles = (profilesResult.data || []) as Array<{
    id: string;
    identifier: string | null;
    created_at: string;
    onboarding_done: boolean | null;
  }>;
  const payments = (paymentsResult.data || []) as Array<{
    user_id: string | null;
    status: string | null;
    attempted_at: string | null;
  }>;

  const emailByUser = new Map<string, string>();
  const profileCreatedAt = new Map<string, string>();
  const onboardingUsers = new Set<string>();
  profiles.forEach((profile) => {
    const userId = String(profile.id);
    emailByUser.set(userId, profile.identifier || userId);
    profileCreatedAt.set(userId, String(profile.created_at || new Date().toISOString()));
    if (profile.onboarding_done) onboardingUsers.add(userId);
  });

  const uniqueUsers = new Set<string>();
  const conversionUsers = new Set<string>();
  const acquisitionUsers = new Set<string>();
  const engagementUsers = new Set<string>();
  const activationUsers = new Set<string>();
  const monetizationUsers = new Set<string>();
  const retainedUsers = new Set<string>();

  const userEvents = new Map<string, Array<{ eventName: string; eventTime: string }>>();
  const userDays = new Map<string, Set<string>>();

  const trafficStats = new Map<string, { users: Set<string>; sessions: Map<string, number>; conversionSessions: Set<string> }>();
  const platformStats = new Map<string, { users: Set<string>; events: number; conversionUsers: Set<string> }>();
  const pathStats = new Map<string, { users: Set<string>; totalGap: number; samples: number }>();
  const heatmapStats = new Map<string, { screen: string; zone: string; interactions: number; rage: number; dead: number; scrollSum: number; scrollCount: number }>();
  const sessionStats = new Map<string, { userId: string | null; firstAt: string; lastAt: string; interactions: number; rage: number; dead: number }>();
  const issueStats = new Map<string, { users: Set<string>; events: number; lastSeenAt: string }>();
  const searchStats = new Map<string, { matches: number; latestEventAt: string }>();
  const abStats = new Map<string, {
    status: 'running' | 'planned' | 'paused';
    controlUsers: Set<string>;
    variantUsers: Set<string>;
    controlConversions: Set<string>;
    variantConversions: Set<string>;
  }>();

  const conversionEventSet = new Set(['goal.created', 'asset.added', 'transaction.logged', 'risk.profile_completed']);
  let rageClicks = 0;
  let deadClicks = 0;
  let realtimeEventsLastHour = 0;

  events.forEach((event) => {
    const eventName = String(event.event_name || 'unknown');
    const lower = eventName.toLowerCase();
    const userId = event.user_id ? String(event.user_id) : null;
    const eventTime = String(event.event_time || new Date().toISOString());
    const metadata = (event.metadata || {}) as Record<string, unknown>;
    const source = String(event.source || 'app');
    const platform = normalizePlatform(source, metadata);
    const sessionId = String(metadata.sessionId || metadata.session_id || `${userId || 'anon'}:${eventTime.slice(0, 13)}`);
    const isConversion = conversionEventSet.has(eventName) || includesAny(lower, ['goal.created', 'asset.added', 'transaction.logged']);
    const isRage = Boolean(metadata.rage_click) || Boolean(metadata.rageClick) || includesAny(lower, ['rage']);
    const isDead = Boolean(metadata.dead_click) || Boolean(metadata.deadClick) || includesAny(lower, ['dead_click', 'dead.click']);

    if (eventTime >= hourAgoIso) realtimeEventsLastHour += 1;
    if (isRage) rageClicks += 1;
    if (isDead) deadClicks += 1;

    if (userId) {
      uniqueUsers.add(userId);
      acquisitionUsers.add(userId);
      if (isConversion) conversionUsers.add(userId);
      if (includesAny(lower, ['goal.', 'asset.', 'liability.', 'transaction.', 'risk.profile'])) engagementUsers.add(userId);
      if (includesAny(lower, ['onboarding'])) activationUsers.add(userId);

      const rows = userEvents.get(userId) || [];
      rows.push({ eventName, eventTime });
      userEvents.set(userId, rows);

      const days = userDays.get(userId) || new Set<string>();
      days.add(eventTime.slice(0, 10));
      userDays.set(userId, days);
    }

    const traffic = trafficStats.get(source) || { users: new Set<string>(), sessions: new Map<string, number>(), conversionSessions: new Set<string>() };
    if (userId) traffic.users.add(userId);
    traffic.sessions.set(sessionId, (traffic.sessions.get(sessionId) || 0) + 1);
    if (isConversion) traffic.conversionSessions.add(sessionId);
    trafficStats.set(source, traffic);

    const platformRow = platformStats.get(platform) || { users: new Set<string>(), events: 0, conversionUsers: new Set<string>() };
    platformRow.events += 1;
    if (userId) platformRow.users.add(userId);
    if (userId && isConversion) platformRow.conversionUsers.add(userId);
    platformStats.set(platform, platformRow);

    if (includesAny(lower, ['click', 'tap', 'scroll', 'rage', 'dead'])) {
      const screen = String(metadata.screen || metadata.view || metadata.page || 'unknown');
      const zone = String(metadata.zone || metadata.element || metadata.target || 'general');
      const key = `${screen}::${zone}`;
      const row = heatmapStats.get(key) || {
        screen,
        zone,
        interactions: 0,
        rage: 0,
        dead: 0,
        scrollSum: 0,
        scrollCount: 0,
      };
      row.interactions += 1;
      if (isRage) row.rage += 1;
      if (isDead) row.dead += 1;
      const scrollDepth = num(metadata.scroll_depth ?? metadata.scrollDepth, -1);
      if (scrollDepth >= 0) {
        row.scrollSum += scrollDepth;
        row.scrollCount += 1;
      }
      heatmapStats.set(key, row);
    }

    const session = sessionStats.get(sessionId) || {
      userId,
      firstAt: eventTime,
      lastAt: eventTime,
      interactions: 0,
      rage: 0,
      dead: 0,
    };
    session.interactions += 1;
    if (parseTimeMs(eventTime) < parseTimeMs(session.firstAt)) session.firstAt = eventTime;
    if (parseTimeMs(eventTime) > parseTimeMs(session.lastAt)) session.lastAt = eventTime;
    if (!session.userId && userId) session.userId = userId;
    if (isRage) session.rage += 1;
    if (isDead) session.dead += 1;
    sessionStats.set(sessionId, session);

    const issueKey =
      String(metadata.error || metadata.exception || metadata.issue || '').trim() ||
      (includesAny(lower, ['error', 'exception', 'fail']) ? eventName : '');
    if (issueKey) {
      const issue = issueStats.get(issueKey) || { users: new Set<string>(), events: 0, lastSeenAt: eventTime };
      issue.events += 1;
      if (userId) issue.users.add(userId);
      if (eventTime > issue.lastSeenAt) issue.lastSeenAt = eventTime;
      issueStats.set(issueKey, issue);
    }

    const searchKey = eventName.replaceAll('.', ' ').trim();
    if (searchKey) {
      const search = searchStats.get(searchKey) || { matches: 0, latestEventAt: eventTime };
      search.matches += 1;
      if (eventTime > search.latestEventAt) search.latestEventAt = eventTime;
      searchStats.set(searchKey, search);
    }

    const experiment = String(metadata.experiment || metadata.exp || metadata.experiment_key || '').trim();
    if (experiment && userId) {
      const variant = String(metadata.variant || metadata.ab_variant || metadata.group || '').toLowerCase();
      const row = abStats.get(experiment) || {
        status: 'running',
        controlUsers: new Set<string>(),
        variantUsers: new Set<string>(),
        controlConversions: new Set<string>(),
        variantConversions: new Set<string>(),
      };
      if (includesAny(variant, ['control', 'a'])) {
        row.controlUsers.add(userId);
        if (isConversion) row.controlConversions.add(userId);
      } else if (includesAny(variant, ['variant', 'treatment', 'b'])) {
        row.variantUsers.add(userId);
        if (isConversion) row.variantConversions.add(userId);
      }
      abStats.set(experiment, row);
    }
  });

  const successStatuses = new Set(['captured', 'settled', 'success', 'paid', 'authorized']);
  payments.forEach((payment) => {
    const userId = payment.user_id ? String(payment.user_id) : '';
    if (!userId) return;
    const status = String(payment.status || '').toLowerCase();
    if (successStatuses.has(status)) {
      conversionUsers.add(userId);
      monetizationUsers.add(userId);
    }
  });

  userEvents.forEach((rows, userId) => {
    const latest = rows.reduce((max, row) => (row.eventTime > max ? row.eventTime : max), '');
    if ((userDays.get(userId)?.size || 0) >= 2 && parseTimeMs(latest) >= twoWeeksAgo) {
      retainedUsers.add(userId);
    }

    const sorted = [...rows].sort((a, b) => a.eventTime.localeCompare(b.eventTime));
    if (sorted.length >= 2) {
      const first = sorted[0];
      const second = sorted[1];
      const third = sorted[2] || sorted[1];
      const key = `${first.eventName} -> ${second.eventName} -> ${third.eventName}`;
      const row = pathStats.get(key) || { users: new Set<string>(), totalGap: 0, samples: 0 };
      row.users.add(userId);
      row.totalGap += Math.max(0, (parseTimeMs(third.eventTime) - parseTimeMs(first.eventTime)) / (60 * 1000));
      row.samples += 1;
      pathStats.set(key, row);
    }
  });

  const cohortMap = new Map<string, { users: Set<string>; w1: Set<string>; w4: Set<string> }>();
  profileCreatedAt.forEach((createdAt, userId) => {
    const key = createdAt.slice(0, 7) || 'unknown';
    const cohort = cohortMap.get(key) || { users: new Set<string>(), w1: new Set<string>(), w4: new Set<string>() };
    cohort.users.add(userId);
    cohortMap.set(key, cohort);
  });

  userEvents.forEach((rows, userId) => {
    const createdAt = profileCreatedAt.get(userId) || rows[rows.length - 1]?.eventTime || new Date().toISOString();
    const createdMs = parseTimeMs(createdAt);
    const cohortKey = createdAt.slice(0, 7) || 'unknown';
    const cohort = cohortMap.get(cohortKey);
    if (!cohort) return;
    rows.forEach((row) => {
      const days = (parseTimeMs(row.eventTime) - createdMs) / (24 * 60 * 60 * 1000);
      if (days >= 0 && days <= 7) cohort.w1.add(userId);
      if (days >= 0 && days <= 28) cohort.w4.add(userId);
    });
  });

  const cohorts: AdminBehaviorCohortRow[] = [...cohortMap.entries()]
    .map(([cohort, value]) => {
      const users = value.users.size;
      const week1 = pct(value.w1.size, users || 1);
      const week4 = pct(value.w4.size, users || 1);
      return {
        cohort,
        users,
        week1RetentionPct: week1,
        week4RetentionPct: week4,
        churnPct: Number((100 - week4).toFixed(2)),
      };
    })
    .sort((a, b) => a.cohort.localeCompare(b.cohort))
    .slice(-12);

  const retentionWeek1Pct = cohorts.length ? Number((cohorts.reduce((sum, row) => sum + row.week1RetentionPct, 0) / cohorts.length).toFixed(2)) : 0;
  const retentionWeek4Pct = cohorts.length ? Number((cohorts.reduce((sum, row) => sum + row.week4RetentionPct, 0) / cohorts.length).toFixed(2)) : 0;
  const churnPct = Number((100 - retentionWeek4Pct).toFixed(2));

  const funnelSets = [
    { step: 'Acquisition', users: acquisitionUsers },
    { step: 'Engagement', users: engagementUsers },
    { step: 'Activation', users: activationUsers.size ? activationUsers : onboardingUsers },
    { step: 'Conversion', users: conversionUsers },
    { step: 'Retention', users: retainedUsers },
  ];

  const funnel: AdminBehaviorFunnelRow[] = funnelSets.map((row, index) => {
    const previous = index === 0 ? row.users.size : funnelSets[index - 1].users.size;
    const conversionPct = index === 0 ? 100 : pct(row.users.size, previous || 1);
    return {
      step: row.step,
      users: row.users.size,
      conversionPct,
      dropOffPct: Number((100 - conversionPct).toFixed(2)),
    };
  });

  const paths: AdminBehaviorPathRow[] = [...pathStats.entries()]
    .map(([path, value]) => ({
      path,
      users: value.users.size,
      sharePct: pct(value.users.size, uniqueUsers.size || 1),
      avgStepGapMinutes: value.samples ? Number((value.totalGap / value.samples).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.users - a.users)
    .slice(0, 12);

  const realTime: AdminBehaviorRealtimeEvent[] = events.slice(0, 80).map((event) => ({
    eventTime: String(event.event_time || new Date().toISOString()),
    userId: event.user_id ? String(event.user_id) : null,
    email: event.user_id ? emailByUser.get(String(event.user_id)) || String(event.user_id) : null,
    eventName: String(event.event_name || 'unknown'),
    source: String(event.source || 'app'),
    platform: normalizePlatform(event.source, event.metadata as Record<string, unknown> | null),
    latencySeconds: Number(Math.max(0, (now - parseTimeMs(event.event_time)) / 1000).toFixed(1)),
  }));

  const traffic: AdminBehaviorTrafficRow[] = [...trafficStats.entries()]
    .map(([source, value]) => {
      const sessions = value.sessions.size;
      const bounces = [...value.sessions.values()].filter((count) => count <= 1).length;
      return {
        source,
        sessions,
        users: value.users.size,
        conversionPct: pct(value.conversionSessions.size, sessions || 1),
        bounceRiskPct: pct(bounces, sessions || 1),
      };
    })
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 12);

  const crossPlatform: AdminBehaviorPlatformRow[] = [...platformStats.entries()]
    .map(([platform, value]) => ({
      platform,
      users: value.users.size,
      events: value.events,
      conversionPct: pct(value.conversionUsers.size, value.users.size || 1),
    }))
    .sort((a, b) => b.events - a.events)
    .slice(0, 10);

  const journey: AdminBehaviorJourneyStage[] = [
    { stage: 'Acquisition', users: acquisitionUsers.size, conversionPct: 100 },
    { stage: 'Engagement', users: engagementUsers.size, conversionPct: pct(engagementUsers.size, acquisitionUsers.size || 1) },
    { stage: 'Activation', users: (activationUsers.size || onboardingUsers.size), conversionPct: pct((activationUsers.size || onboardingUsers.size), engagementUsers.size || 1) },
    { stage: 'Monetization', users: monetizationUsers.size, conversionPct: pct(monetizationUsers.size, (activationUsers.size || onboardingUsers.size) || 1) },
    { stage: 'Retention', users: retainedUsers.size, conversionPct: pct(retainedUsers.size, acquisitionUsers.size || 1) },
  ];

  flags
    .filter((flag) => includesAny(flag.flag_key.toLowerCase(), ['experiment', 'ab_', 'ab-', 'test']) || (flag.rollout_percent > 0 && flag.rollout_percent < 100))
    .forEach((flag) => {
      if (!abStats.has(flag.flag_key)) {
        abStats.set(flag.flag_key, {
          status: flag.is_enabled ? 'running' : 'planned',
          controlUsers: new Set<string>(),
          variantUsers: new Set<string>(),
          controlConversions: new Set<string>(),
          variantConversions: new Set<string>(),
        });
      }
    });

  const abImpact: AdminBehaviorAbTestImpact[] = [...abStats.entries()]
    .map(([experiment, value]) => {
      const controlRate = pct(value.controlConversions.size, value.controlUsers.size || 1);
      const variantRate = pct(value.variantConversions.size, value.variantUsers.size || 1);
      const sampleSize = value.controlUsers.size + value.variantUsers.size;
      const uplift = sampleSize ? Number((variantRate - controlRate).toFixed(2)) : null;
      return {
        experiment,
        status: value.status,
        sampleSize,
        controlConversionPct: controlRate,
        variantConversionPct: variantRate,
        upliftPct: uplift,
        confidencePct: sampleSize ? Number(Math.min(99, 55 + Math.log10(Math.max(sampleSize, 1)) * 12).toFixed(1)) : null,
      };
    })
    .sort((a, b) => b.sampleSize - a.sampleSize)
    .slice(0, 12);

  const heatmaps: AdminBehaviorHeatmapRow[] = [...heatmapStats.values()]
    .map((row) => ({
      screen: row.screen,
      zone: row.zone,
      interactions: row.interactions,
      rageClicks: row.rage,
      deadClicks: row.dead,
      avgScrollDepthPct: row.scrollCount ? Number((row.scrollSum / row.scrollCount).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.interactions - a.interactions)
    .slice(0, 20);

  const sessionReplays: AdminBehaviorSessionReplayRow[] = [...sessionStats.entries()]
    .map(([sessionId, row]) => ({
      sessionId,
      userId: row.userId,
      email: row.userId ? emailByUser.get(row.userId) || row.userId : null,
      durationSec: Number(Math.max(0, (parseTimeMs(row.lastAt) - parseTimeMs(row.firstAt)) / 1000).toFixed(1)),
      interactions: row.interactions,
      rageClicks: row.rage,
      deadClicks: row.dead,
      lastEventAt: row.lastAt,
    }))
    .sort((a, b) => parseTimeMs(b.lastEventAt) - parseTimeMs(a.lastEventAt))
    .slice(0, 40);

  const issues: AdminBehaviorIssueRow[] = [...issueStats.entries()]
    .map(([issue, value]) => {
      const severity: AdminBehaviorIssueRow['severity'] =
        value.events > 30 || includesAny(issue.toLowerCase(), ['payment', 'security', 'critical'])
          ? 'critical'
          : value.events > 15
          ? 'high'
          : value.events > 6
          ? 'medium'
          : 'low';
      return {
        issue,
        severity,
        users: value.users.size,
        events: value.events,
        lastSeenAt: value.lastSeenAt,
        status: value.events > 20 ? 'open' : value.events > 8 ? 'monitoring' : 'resolved',
      };
    })
    .sort((a, b) => b.events - a.events)
    .slice(0, 20);

  const search: AdminBehaviorSearchInsightRow[] = [...searchStats.entries()]
    .map(([keyword, value]) => ({
      keyword,
      matches: value.matches,
      latestEventAt: value.latestEventAt,
    }))
    .sort((a, b) => b.matches - a.matches)
    .slice(0, 20);

  const kpis = {
    totalEvents: events.length,
    activeUsers: uniqueUsers.size || profiles.length,
    retentionWeek1Pct,
    retentionWeek4Pct,
    churnPct,
    conversionPct: pct(conversionUsers.size, acquisitionUsers.size || uniqueUsers.size || 1),
    realtimeEventsLastHour,
    rageClickRatePct: pct(rageClicks, events.length || 1),
    deadClickRatePct: pct(deadClicks, events.length || 1),
  };

  const alerts: AdminBehaviorAlertTrigger[] = [
    {
      trigger: 'Retention Floor',
      metric: 'Week-4 retention',
      threshold: '< 35%',
      currentValue: `${kpis.retentionWeek4Pct.toFixed(1)}%`,
      status: kpis.retentionWeek4Pct < 35 ? 'triggered' : 'healthy',
      lastTriggeredAt: kpis.retentionWeek4Pct < 35 ? new Date().toISOString() : null,
    },
    {
      trigger: 'Frustration Spike',
      metric: 'Rage click rate',
      threshold: '> 2.5%',
      currentValue: `${kpis.rageClickRatePct.toFixed(2)}%`,
      status: kpis.rageClickRatePct > 2.5 ? 'triggered' : 'healthy',
      lastTriggeredAt: kpis.rageClickRatePct > 2.5 ? new Date().toISOString() : null,
    },
    {
      trigger: 'Realtime Volume',
      metric: 'Events in last hour',
      threshold: '> 1000',
      currentValue: `${kpis.realtimeEventsLastHour}`,
      status: kpis.realtimeEventsLastHour > 1000 ? 'triggered' : 'healthy',
      lastTriggeredAt: kpis.realtimeEventsLastHour > 1000 ? new Date().toISOString() : null,
    },
  ];

  const insights: AdminBehaviorInsight[] = [];
  if (kpis.retentionWeek4Pct < 35) {
    insights.push({
      title: 'Retention decay risk',
      detail: 'Week-4 retention is low for at least one cohort cluster.',
      severity: 'high',
      metric: `${kpis.retentionWeek4Pct.toFixed(1)}% week-4 retention`,
      recommendation: 'Launch 7/14/21 day nurture journeys tied to behavior milestones.',
    });
  }
  if (kpis.conversionPct < 25) {
    insights.push({
      title: 'Activation funnel under target',
      detail: 'Acquisition-to-conversion flow has meaningful drop-off.',
      severity: 'medium',
      metric: `${kpis.conversionPct.toFixed(1)}% conversion`,
      recommendation: 'Run A/B tests on onboarding CTA and first-goal assistance.',
    });
  }
  if (kpis.rageClickRatePct > 2.5) {
    insights.push({
      title: 'UX frustration signal elevated',
      detail: 'Rage/dead click metrics indicate interaction friction.',
      severity: 'high',
      metric: `${kpis.rageClickRatePct.toFixed(2)}% rage click rate`,
      recommendation: 'Use heatmaps + session replay index to prioritize UI fixes.',
    });
  }
  if (!insights.length) {
    insights.push({
      title: 'Behavior engine within threshold',
      detail: 'Retention, conversion and frustration metrics are stable.',
      severity: 'low',
      metric: `${kpis.activeUsers} active users`,
      recommendation: 'Scale multi-channel experiments and predictive segmentation.',
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    windowDays: safeDays,
    kpis,
    cohorts,
    funnel,
    paths,
    realTime,
    traffic,
    crossPlatform,
    journey,
    abImpact,
    heatmaps,
    sessionReplays,
    issues,
    search,
    alerts,
    insights,
  };
}

const mapCrmContact = (row: Record<string, any>): AdminCrmContact => ({
  id: String(row.id),
  userId: row.user_id ? String(row.user_id) : null,
  name: String(row.name || 'Unknown'),
  email: String(row.email || ''),
  source: String(row.source || 'direct'),
  stage: String(row.stage || 'new'),
  leadScore: num(row.lead_score),
  tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
  owner: row.owner ? String(row.owner) : null,
  lastActivityAt: row.last_activity_at ? String(row.last_activity_at) : null,
  createdAt: String(row.created_at || new Date().toISOString()),
});

const mapCrmLead = (row: Record<string, any>): AdminCrmLead => ({
  id: String(row.id),
  contactId: row.contact_id ? String(row.contact_id) : null,
  title: String(row.title || 'Lead'),
  source: String(row.source || 'internal'),
  stage: String(row.stage || 'new'),
  status: String(row.status || 'open'),
  score: num(row.score),
  value: num(row.value),
  tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
  nextActionAt: row.next_action_at ? String(row.next_action_at) : null,
  owner: row.owner ? String(row.owner) : null,
  createdAt: String(row.created_at || new Date().toISOString()),
});

const mapCrmDeal = (row: Record<string, any>): AdminCrmDeal => ({
  id: String(row.id),
  contactId: row.contact_id ? String(row.contact_id) : null,
  leadId: row.lead_id ? String(row.lead_id) : null,
  name: String(row.name || 'Opportunity'),
  stage: String(row.stage || 'discovery'),
  status: String(row.status || 'open'),
  amount: num(row.amount),
  probabilityPct: num(row.probability_pct),
  expectedCloseAt: row.expected_close_at ? String(row.expected_close_at) : null,
  owner: row.owner ? String(row.owner) : null,
  updatedAt: String(row.updated_at || row.created_at || new Date().toISOString()),
});

const mapCrmTask = (row: Record<string, any>): AdminCrmTask => ({
  id: String(row.id),
  entityType: String(row.entity_type || 'lead'),
  entityId: row.entity_id ? String(row.entity_id) : null,
  title: String(row.title || 'Follow-up'),
  status: String(row.status || 'open'),
  priority: String(row.priority || 'medium'),
  dueAt: row.due_at ? String(row.due_at) : null,
  meetingAt: row.meeting_at ? String(row.meeting_at) : null,
  assignee: row.assignee ? String(row.assignee) : null,
  createdAt: String(row.created_at || new Date().toISOString()),
});

const toTagList = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return raw.map((item) => String(item).trim()).filter(Boolean);
  if (typeof raw === 'string') return raw.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
};

const mapCrmComplaint = (
  row: Record<string, any>,
  profileMap: Map<string, { identifier: string | null; first_name: string | null; last_name: string | null }>
): AdminCrmComplaintTicket => {
  const userId = String(row.user_id || '');
  const profile = profileMap.get(userId);
  const fullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();
  const resolutionDueAt = row.resolution_due_at ? String(row.resolution_due_at) : null;
  const resolutionDueMs = resolutionDueAt ? new Date(resolutionDueAt).getTime() : Number.NaN;
  const slaRemainingHours = Number.isFinite(resolutionDueMs)
    ? Math.round((resolutionDueMs - Date.now()) / (60 * 60 * 1000))
    : null;
  return {
    id: String(row.id),
    ticketNumber: String(row.ticket_number || `CMP-${String(row.id).slice(0, 8).toUpperCase()}`),
    userId,
    customerName: fullName || null,
    customerEmail: profile?.identifier || null,
    subject: String(row.subject || 'Customer Complaint'),
    description: row.description ? String(row.description) : null,
    priority: String(row.priority || 'medium'),
    status: String(row.status || 'open'),
    assignedTo: row.assigned_to ? String(row.assigned_to) : null,
    tags: toTagList(row.tags),
    resolutionNote: row.resolution_note ? String(row.resolution_note) : null,
    firstResponseAt: row.first_response_at ? String(row.first_response_at) : null,
    firstResponseDueAt: row.first_response_due_at ? String(row.first_response_due_at) : null,
    resolutionDueAt,
    closedAt: row.closed_at ? String(row.closed_at) : null,
    slaStatus: ['on_track', 'due_soon', 'breached', 'paused', 'met'].includes(String(row.sla_status))
      ? row.sla_status
      : 'on_track',
    escalated: Boolean(row.escalated),
    escalationLevel: num(row.escalation_level),
    escalationCount: num(row.escalation_count),
    escalationReason: row.escalation_reason ? String(row.escalation_reason) : null,
    escalatedAt: row.escalated_at ? String(row.escalated_at) : null,
    nextEscalationAt: row.next_escalation_at ? String(row.next_escalation_at) : null,
    breachCount: num(row.breach_count),
    slaRemainingHours,
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || row.created_at || new Date().toISOString()),
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
  };
};

const mapCrmTemplate = (row: Record<string, any>): AdminCrmEmailTemplate => ({
  id: String(row.id),
  name: String(row.name || 'Template'),
  subject: String(row.subject || 'No Subject'),
  previewText: String(row.preview_text || ''),
  updatedAt: String(row.updated_at || row.created_at || new Date().toISOString()),
  lastUsedAt: row.last_used_at ? String(row.last_used_at) : null,
  sent: num(row.sent),
  opens: num(row.opens),
  clicks: num(row.clicks),
  conversions: num(row.conversions),
});

const mapCrmWorkflow = (row: Record<string, any>): AdminCrmWorkflow => ({
  id: String(row.id),
  name: String(row.name || 'Workflow'),
  status: String(row.status || 'draft'),
  trigger: String(row.trigger || 'manual'),
  conditionLogic: String(row.condition_logic || 'true'),
  channels: Array.isArray(row.channels) ? row.channels.map(String) : [],
  stepCount: num(row.step_count),
  enrolled: num(row.enrolled),
  lastRunAt: row.last_run_at ? String(row.last_run_at) : null,
});

const mapCrmObject = (row: Record<string, any>): AdminCrmCustomObject => ({
  id: String(row.id),
  objectType: String(row.object_type || 'custom'),
  title: String(row.title || 'Object'),
  status: String(row.status || 'active'),
  owner: row.owner ? String(row.owner) : null,
  score: num(row.score),
  updatedAt: String(row.updated_at || row.created_at || new Date().toISOString()),
  properties: (row.properties || {}) as Record<string, unknown>,
});

export async function getCrmOperationsReport(days = 30): Promise<AdminCrmReport> {
  const safeDays = Math.max(7, Math.min(days, 365));
  const nowIso = new Date().toISOString();
  const startIso = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString();
  try {
    await supabase.rpc('support_run_sla_sweep', {
      p_due_soon_hours: 6,
      p_force_escalation: false,
    });
  } catch {
    // Best-effort SLA refresh; CRM report should still render with existing state.
  }

  const [
    contactsResult,
    leadsResult,
    dealsResult,
    tasksResult,
    complaintsResult,
    templatesResult,
    workflowsResult,
    objectsResult,
    profilesResult,
    eventsResult,
    notificationsResult,
  ] = await Promise.all([
    supabase.from('crm_contacts').select('*').order('updated_at', { ascending: false }).limit(600),
    supabase.from('crm_leads').select('*').order('updated_at', { ascending: false }).limit(600),
    supabase.from('crm_deals').select('*').order('updated_at', { ascending: false }).limit(600),
    supabase.from('crm_tasks').select('*').order('updated_at', { ascending: false }).limit(600),
    supabase
      .from('support_tickets')
      .select('id, ticket_number, user_id, subject, description, category, priority, status, assigned_to, tags, resolution_note, created_at, updated_at, resolved_at, first_response_at, first_response_due_at, resolution_due_at, closed_at, sla_status, escalated, escalation_level, escalation_count, escalation_reason, escalated_at, next_escalation_at, breach_count')
      .order('updated_at', { ascending: false })
      .limit(1200),
    supabase.from('crm_email_templates').select('*').order('updated_at', { ascending: false }).limit(200),
    supabase.from('crm_workflows').select('*').order('updated_at', { ascending: false }).limit(200),
    supabase.from('crm_custom_objects').select('*').order('updated_at', { ascending: false }).limit(300),
    supabase.from('profiles').select('id, identifier, first_name, last_name, created_at').order('created_at', { ascending: false }).limit(2000),
    supabase.from('activity_events').select('user_id, event_name, event_time').gte('event_time', startIso).limit(12000),
    supabase.from('admin_notifications').select('title, status, created_at').gte('created_at', startIso).limit(5000),
  ]);

  const assertOrIgnore = (error: unknown, fallback: string) => {
    if (!error) return;
    if (!isMissingRelationError(error)) throw toError(error, fallback);
  };

  assertOrIgnore(contactsResult.error, 'Could not load CRM contacts.');
  assertOrIgnore(leadsResult.error, 'Could not load CRM leads.');
  assertOrIgnore(dealsResult.error, 'Could not load CRM deals.');
  assertOrIgnore(tasksResult.error, 'Could not load CRM tasks.');
  assertOrIgnore(complaintsResult.error, 'Could not load complaint tickets.');
  assertOrIgnore(templatesResult.error, 'Could not load CRM templates.');
  assertOrIgnore(workflowsResult.error, 'Could not load CRM workflows.');
  assertOrIgnore(objectsResult.error, 'Could not load CRM objects.');
  assertOrIgnore(profilesResult.error, 'Could not load profile fallback data.');
  assertOrIgnore(eventsResult.error, 'Could not load activity fallback data.');
  assertOrIgnore(notificationsResult.error, 'Could not load notification fallback data.');

  let contacts = (contactsResult.data || []).map((row: any) => mapCrmContact(row));
  let leads = (leadsResult.data || []).map((row: any) => mapCrmLead(row));
  let deals = (dealsResult.data || []).map((row: any) => mapCrmDeal(row));
  let tasks = (tasksResult.data || []).map((row: any) => mapCrmTask(row));
  let templates = (templatesResult.data || []).map((row: any) => mapCrmTemplate(row));
  let workflows = (workflowsResult.data || []).map((row: any) => mapCrmWorkflow(row));
  let customObjects = (objectsResult.data || []).map((row: any) => mapCrmObject(row));

  const profiles = (profilesResult.data || []) as Array<{
    id: string;
    identifier: string | null;
    first_name: string | null;
    last_name: string | null;
    created_at: string;
  }>;
  const profileMap = new Map<string, { identifier: string | null; first_name: string | null; last_name: string | null }>(
    profiles.map((row) => [
      String(row.id),
      {
        identifier: row.identifier || null,
        first_name: row.first_name || null,
        last_name: row.last_name || null,
      },
    ])
  );

  const complaints = ((complaintsResult.data || []) as Array<Record<string, any>>)
    .filter((row) => String(row.category || '').toLowerCase() === 'complaint')
    .map((row) => mapCrmComplaint(row, profileMap));

  const events = (eventsResult.data || []) as Array<{ user_id: string | null; event_name: string; event_time: string }>;
  const notifications = (notificationsResult.data || []) as Array<{ title: string | null; status: string | null; created_at: string }>;

  const signalByUser = new Map<string, { score: number; lastActivityAt: string }>();
  events.forEach((event) => {
    const userId = event.user_id ? String(event.user_id) : '';
    if (!userId) return;
    const signal = signalByUser.get(userId) || { score: 0, lastActivityAt: String(event.event_time || nowIso) };
    signal.score += includesAny(String(event.event_name || '').toLowerCase(), ['goal.', 'asset.', 'transaction']) ? 4 : 1;
    if (String(event.event_time || '') > signal.lastActivityAt) signal.lastActivityAt = String(event.event_time);
    signalByUser.set(userId, signal);
  });

  if (!contacts.length) {
    contacts = profiles.slice(0, 400).map((profile) => {
      const userId = String(profile.id);
      const signal = signalByUser.get(userId);
      const score = Math.max(0, Math.min(100, Math.round(signal?.score || 0)));
      return {
        id: userId,
        userId,
        name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown',
        email: profile.identifier || userId,
        source: 'product',
        stage: score >= 70 ? 'customer' : score >= 45 ? 'qualified' : 'new',
        leadScore: score,
        tags: score >= 70 ? ['high_intent'] : score >= 45 ? ['warm'] : ['nurture'],
        owner: null,
        lastActivityAt: signal?.lastActivityAt || null,
        createdAt: String(profile.created_at || nowIso),
      };
    });
  }

  if (!leads.length) {
    leads = contacts
      .filter((contact) => contact.stage !== 'customer')
      .slice(0, 400)
      .map((contact) => ({
        id: contact.id,
        contactId: contact.id,
        title: `${contact.name} lead`,
        source: contact.source,
        stage: contact.leadScore >= 60 ? 'qualified' : 'new',
        status: contact.leadScore >= 60 ? 'qualified' : 'open',
        score: contact.leadScore,
        value: contact.leadScore >= 60 ? 20000 : 5000,
        tags: contact.tags,
        nextActionAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        owner: contact.owner,
        createdAt: contact.createdAt,
      }));
  }

  if (!deals.length) {
    deals = leads.slice(0, 220).map((lead) => ({
      id: lead.id,
      contactId: lead.contactId,
      leadId: lead.id,
      name: `${lead.title} opportunity`,
      stage: lead.score >= 75 ? 'proposal' : lead.score >= 55 ? 'discovery' : 'qualified',
      status: lead.score >= 90 ? 'won' : 'open',
      amount: Math.max(5000, lead.value),
      probabilityPct: Math.max(15, Math.min(95, lead.score)),
      expectedCloseAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
      owner: lead.owner,
      updatedAt: nowIso,
    }));
  }

  if (!tasks.length) {
    tasks = leads.slice(0, 200).map((lead) => ({
      id: lead.id,
      entityType: 'lead',
      entityId: lead.id,
      title: `Follow up: ${lead.title}`,
      status: 'open',
      priority: lead.score >= 70 ? 'high' : 'medium',
      dueAt: lead.nextActionAt,
      meetingAt: null,
      assignee: lead.owner,
      createdAt: lead.createdAt,
    }));
  }

  if (!templates.length) {
    const templatesMap = new Map<string, { sent: number; opens: number; clicks: number; conversions: number; lastUsedAt: string }>();
    notifications.forEach((item) => {
      const title = String(item.title || 'Lifecycle Template');
      const status = String(item.status || '').toLowerCase();
      const row = templatesMap.get(title) || { sent: 0, opens: 0, clicks: 0, conversions: 0, lastUsedAt: String(item.created_at || nowIso) };
      row.sent += 1;
      if (status === 'opened' || status === 'clicked') row.opens += 1;
      if (status === 'clicked') {
        row.clicks += 1;
        row.conversions += 1;
      }
      if (String(item.created_at || '') > row.lastUsedAt) row.lastUsedAt = String(item.created_at);
      templatesMap.set(title, row);
    });

    templates = [...templatesMap.entries()].slice(0, 8).map(([name, value], idx) => ({
      id: `${name.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_${idx}`,
      name,
      subject: `${name} - FinVantage`,
      previewText: 'Personalized lifecycle message',
      updatedAt: nowIso,
      lastUsedAt: value.lastUsedAt,
      sent: value.sent,
      opens: value.opens,
      clicks: value.clicks,
      conversions: value.conversions,
    }));

    if (!templates.length) {
      templates = [{
        id: 'welcome_template',
        name: 'Welcome Template',
        subject: 'Complete your financial setup',
        previewText: 'Guided onboarding sequence',
        updatedAt: nowIso,
        lastUsedAt: null,
        sent: 0,
        opens: 0,
        clicks: 0,
        conversions: 0,
      }];
    }
  }

  if (!workflows.length) {
    workflows = [
      {
        id: 'welcome_nurture',
        name: 'Welcome Nurture',
        status: leads.length ? 'active' : 'draft',
        trigger: 'app.onboarding_completed',
        conditionLogic: 'lead_score < 70',
        channels: ['in_app', 'email'],
        stepCount: 4,
        enrolled: leads.length,
        lastRunAt: events[0]?.event_time || null,
      },
      {
        id: 'reengagement_drip',
        name: 'Re-engagement Drip',
        status: 'active',
        trigger: 'inactive_14_days',
        conditionLogic: 'no_event_14d = true',
        channels: ['email', 'sms', 'in_app'],
        stepCount: 5,
        enrolled: Math.max(0, contacts.length - leads.length),
        lastRunAt: events[0]?.event_time || null,
      },
    ];
  }

  if (!customObjects.length) {
    customObjects = leads.slice(0, 120).map((lead) => ({
      id: lead.id,
      objectType: 'account_health',
      title: lead.title,
      status: lead.status,
      owner: lead.owner,
      score: lead.score,
      updatedAt: lead.createdAt,
      properties: {
        source: lead.source,
        tags: lead.tags,
      },
    }));
  }

  const pipelineMap = new Map<string, AdminCrmPipelineStage>();
  deals.forEach((deal) => {
    const stage = deal.stage || 'unknown';
    const row = pipelineMap.get(stage) || { stage, deals: 0, amount: 0, weightedAmount: 0 };
    row.deals += 1;
    row.amount += num(deal.amount);
    row.weightedAmount += (num(deal.amount) * num(deal.probabilityPct)) / 100;
    pipelineMap.set(stage, row);
  });
  const pipeline = [...pipelineMap.values()].sort((a, b) => b.amount - a.amount);

  const timeline: AdminCrmTimelineItem[] = [
    ...contacts.slice(0, 40).map((row) => ({
      time: row.lastActivityAt || row.createdAt,
      entity: 'contact',
      action: 'updated',
      detail: `${row.name} (${row.stage})`,
    })),
    ...deals.slice(0, 40).map((row) => ({
      time: row.updatedAt,
      entity: 'deal',
      action: row.stage,
      detail: `${row.name} INR ${num(row.amount).toLocaleString('en-IN')}`,
    })),
    ...tasks.slice(0, 40).map((row) => ({
      time: row.dueAt || row.createdAt,
      entity: 'task',
      action: row.status,
      detail: row.title,
    })),
    ...complaints.slice(0, 40).map((row) => ({
      time: row.updatedAt || row.createdAt,
      entity: 'complaint',
      action: row.status,
      detail: `#${row.ticketNumber} • ${row.subject}`,
    })),
  ]
    .filter((row) => Boolean(row.time))
    .sort((a, b) => parseTimeMs(b.time) - parseTimeMs(a.time))
    .slice(0, 80);

  const emailsSent = templates.reduce((sum, row) => sum + row.sent, 0);
  const complaintTickets = complaints.length;
  const openComplaints = complaints.filter((row) => !includesAny(row.status.toLowerCase(), ['resolved', 'closed'])).length;
  const resolvedComplaints = complaints.filter((row) => includesAny(row.status.toLowerCase(), ['resolved', 'closed'])).length;
  const highPriorityComplaints = complaints.filter((row) => includesAny(row.priority.toLowerCase(), ['high', 'urgent', 'critical'])).length;
  const dueSoonComplaints = complaints.filter((row) => row.slaStatus === 'due_soon' && !includesAny(row.status.toLowerCase(), ['resolved', 'closed'])).length;
  const breachedComplaints = complaints.filter((row) => row.slaStatus === 'breached' && !includesAny(row.status.toLowerCase(), ['resolved', 'closed'])).length;
  const escalatedComplaints = complaints.filter((row) => Boolean(row.escalated) && !includesAny(row.status.toLowerCase(), ['resolved', 'closed'])).length;

  return {
    generatedAt: nowIso,
    windowDays: safeDays,
    kpis: {
      contacts: contacts.length,
      leads: leads.length,
      qualifiedLeads: leads.filter((row) => includesAny(row.status.toLowerCase(), ['qualified', 'proposal', 'negotiation']) || row.score >= 60).length,
      deals: deals.length,
      openPipelineValue: Number(
        deals
          .filter((row) => !includesAny(row.status.toLowerCase(), ['won', 'lost', 'closed']))
          .reduce((sum, row) => sum + num(row.amount), 0)
          .toFixed(2)
      ),
      wonValue: Number(deals.filter((row) => includesAny(row.status.toLowerCase(), ['won'])).reduce((sum, row) => sum + num(row.amount), 0).toFixed(2)),
      avgLeadScore: leads.length ? Number((leads.reduce((sum, row) => sum + num(row.score), 0) / leads.length).toFixed(2)) : 0,
      emailsSent,
      emailOpenRatePct: pct(templates.reduce((sum, row) => sum + row.opens, 0), emailsSent || 1),
      emailClickRatePct: pct(templates.reduce((sum, row) => sum + row.clicks, 0), emailsSent || 1),
      workflowsActive: workflows.filter((row) => includesAny(row.status.toLowerCase(), ['active', 'running'])).length,
      tasksDue: tasks.filter((row) => row.dueAt && !includesAny(row.status.toLowerCase(), ['done', 'closed']) && parseTimeMs(row.dueAt) <= Date.now() + 24 * 60 * 60 * 1000).length,
      complaintTickets,
      openComplaints,
      resolvedComplaints,
      highPriorityComplaints,
      dueSoonComplaints,
      breachedComplaints,
      escalatedComplaints,
    },
    pipeline,
    contacts: contacts.slice(0, 350),
    leads: leads.slice(0, 350),
    deals: deals.slice(0, 350),
    tasks: tasks.slice(0, 350),
    complaints: complaints.slice(0, 500),
    templates: templates.slice(0, 120),
    workflows: workflows.slice(0, 120),
    customObjects: customObjects.slice(0, 220),
    timeline,
  };
}

export async function upsertCrmContact(payload: {
  id?: string;
  userId?: string | null;
  name: string;
  email: string;
  source?: string;
  stage?: string;
  leadScore?: number;
  tags?: string[];
  owner?: string | null;
  lastActivityAt?: string | null;
}): Promise<void> {
  const { error } = await supabase.from('crm_contacts').upsert(
    {
      id: payload.id || undefined,
      user_id: payload.userId || null,
      name: payload.name.trim(),
      email: payload.email.trim(),
      source: payload.source || 'direct',
      stage: payload.stage || 'new',
      lead_score: payload.leadScore ?? 0,
      tags: payload.tags || [],
      owner: payload.owner || null,
      last_activity_at: payload.lastActivityAt || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) throw toError(error, 'Could not save CRM contact.');
}

export async function upsertCrmLead(payload: {
  id?: string;
  contactId?: string | null;
  title: string;
  source?: string;
  stage?: string;
  status?: string;
  score?: number;
  value?: number;
  tags?: string[];
  nextActionAt?: string | null;
  owner?: string | null;
}): Promise<void> {
  const { error } = await supabase.from('crm_leads').upsert(
    {
      id: payload.id || undefined,
      contact_id: payload.contactId || null,
      title: payload.title.trim(),
      source: payload.source || 'internal',
      stage: payload.stage || 'new',
      status: payload.status || 'open',
      score: payload.score ?? 0,
      value: payload.value ?? 0,
      tags: payload.tags || [],
      next_action_at: payload.nextActionAt || null,
      owner: payload.owner || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) throw toError(error, 'Could not save CRM lead.');
}

export async function upsertCrmDeal(payload: {
  id?: string;
  contactId?: string | null;
  leadId?: string | null;
  name: string;
  stage?: string;
  status?: string;
  amount?: number;
  probabilityPct?: number;
  expectedCloseAt?: string | null;
  owner?: string | null;
}): Promise<void> {
  const { error } = await supabase.from('crm_deals').upsert(
    {
      id: payload.id || undefined,
      contact_id: payload.contactId || null,
      lead_id: payload.leadId || null,
      name: payload.name.trim(),
      stage: payload.stage || 'discovery',
      status: payload.status || 'open',
      amount: payload.amount ?? 0,
      probability_pct: payload.probabilityPct ?? 0,
      expected_close_at: payload.expectedCloseAt || null,
      owner: payload.owner || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) throw toError(error, 'Could not save CRM deal.');
}

export async function updateCrmDealStage(dealId: string, stage: string): Promise<void> {
  const { error } = await supabase
    .from('crm_deals')
    .update({
      stage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', dealId);
  if (error) throw toError(error, 'Could not update CRM deal stage.');
}

export async function upsertCrmTask(payload: {
  id?: string;
  entityType: string;
  entityId?: string | null;
  title: string;
  status?: string;
  priority?: string;
  dueAt?: string | null;
  meetingAt?: string | null;
  assignee?: string | null;
}): Promise<void> {
  const { error } = await supabase.from('crm_tasks').upsert(
    {
      id: payload.id || undefined,
      entity_type: payload.entityType,
      entity_id: payload.entityId || null,
      title: payload.title.trim(),
      status: payload.status || 'open',
      priority: payload.priority || 'medium',
      due_at: payload.dueAt || null,
      meeting_at: payload.meetingAt || null,
      assignee: payload.assignee || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) throw toError(error, 'Could not save CRM task.');
}

export async function updateCrmTaskStatus(taskId: string, status: string): Promise<void> {
  const { error } = await supabase
    .from('crm_tasks')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId);
  if (error) throw toError(error, 'Could not update CRM task status.');
}

export async function upsertCrmEmailTemplate(payload: {
  id?: string;
  name: string;
  subject: string;
  previewText?: string;
  bodyMarkdown?: string;
}): Promise<void> {
  const { error } = await supabase.from('crm_email_templates').upsert(
    {
      id: payload.id || undefined,
      name: payload.name.trim(),
      subject: payload.subject.trim(),
      preview_text: payload.previewText || '',
      body_markdown: payload.bodyMarkdown || '',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) throw toError(error, 'Could not save CRM email template.');
}

export async function upsertCrmWorkflow(payload: {
  id?: string;
  name: string;
  status?: string;
  trigger: string;
  conditionLogic?: string;
  channels?: string[];
  stepCount?: number;
}): Promise<void> {
  const { error } = await supabase.from('crm_workflows').upsert(
    {
      id: payload.id || undefined,
      name: payload.name.trim(),
      status: payload.status || 'draft',
      trigger: payload.trigger.trim(),
      condition_logic: payload.conditionLogic || 'true',
      channels: payload.channels || ['in_app'],
      step_count: payload.stepCount ?? 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) throw toError(error, 'Could not save CRM workflow.');
}

export async function upsertCrmCustomObject(payload: {
  id?: string;
  objectType: string;
  title: string;
  status?: string;
  owner?: string | null;
  score?: number;
  properties?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from('crm_custom_objects').upsert(
    {
      id: payload.id || undefined,
      object_type: payload.objectType.trim(),
      title: payload.title.trim(),
      status: payload.status || 'active',
      owner: payload.owner || null,
      score: payload.score ?? 0,
      properties: payload.properties || {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) throw toError(error, 'Could not save CRM custom object.');
}
