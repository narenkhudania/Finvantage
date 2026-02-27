import { supabase } from '../supabase';
import type {
  AdminAccess,
  AdminAnalyticsSnapshot,
  AdminAuditLog,
  AdminCustomer,
  AdminCustomerTimeline,
  AdminDashboardSummary,
  AdminFraudFlag,
  AdminKycCase,
  AdminOverviewReport,
  AdminPayment,
  AdminPortfolioRow,
  AdminRole,
  AdminSubscription,
  AdminUsageReport,
  AdminUserAccount,
  FeatureFlag,
  SupportTicket,
  WebhookEvent,
} from './types';

const EMPTY_ACCESS: AdminAccess = {
  isAdmin: false,
  userId: null,
  roleKey: null,
  roleName: null,
  permissions: [],
};

const toError = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String((error as { message?: unknown }).message || '').trim();
    if (msg) return new Error(msg);
  }
  return new Error(fallback);
};

const isMissingRelationError = (error: unknown) => {
  const code = (error as { code?: string } | null)?.code;
  return code === '42P01' || code === 'PGRST205' || code === 'PGRST204';
};

const normalizeAccess = (raw: unknown): AdminAccess => {
  if (!raw || typeof raw !== 'object') return EMPTY_ACCESS;
  const obj = raw as Record<string, unknown>;
  return {
    isAdmin: Boolean(obj.isAdmin),
    userId: typeof obj.userId === 'string' ? obj.userId : null,
    roleKey: typeof obj.roleKey === 'string' ? obj.roleKey : null,
    roleName: typeof obj.roleName === 'string' ? obj.roleName : null,
    permissions: Array.isArray(obj.permissions) ? obj.permissions.map(String) : [],
  };
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

export async function getAdminAccess(): Promise<AdminAccess> {
  const { data, error } = await supabase.rpc('admin_current_access');
  if (!error) return normalizeAccess(data);

  // Fallback for partially migrated environments.
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return EMPTY_ACCESS;

  const { data: adminRow, error: adminError } = await supabase
    .from('admin_users')
    .select('user_id, role_id, is_active')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (adminError || !adminRow || !adminRow.is_active) return EMPTY_ACCESS;

  const { data: roleData } = await supabase
    .from('admin_roles')
    .select('role_key, display_name')
    .eq('id', adminRow.role_id)
    .maybeSingle();

  return {
    isAdmin: true,
    userId: userData.user.id,
    roleKey: roleData?.role_key || 'unknown',
    roleName: roleData?.display_name || roleData?.role_key || 'Unknown Role',
    permissions: roleData?.role_key === 'super_admin' ? ['*'] : [],
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
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  // In dev, Vite serves /api paths as static modules, not JSON functions.
  if (!import.meta.env.DEV && token) {
    try {
      const resp = await fetch(`/api/admin/analytics?days=${encodeURIComponent(String(days))}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (resp.ok) {
        const body = await safeJson(resp);
        if (body && typeof body === 'object' && 'data' in body) {
          return normalizeAnalytics((body as Record<string, unknown>).data);
        }
      }
    } catch {
      // fallback to direct rpc
    }
  }

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
}): Promise<SupportTicket[]> {
  const limit = Math.max(20, Math.min(params?.limit || 150, 300));

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
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || row.created_at || new Date().toISOString()),
  }));
}

export async function updateSupportTicket(
  ticketId: string,
  payload: {
    status?: string;
    priority?: string;
    assignedTo?: string | null;
    resolutionNote?: string | null;
  }
): Promise<void> {
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (payload.status != null) updatePayload.status = payload.status;
  if (payload.priority != null) updatePayload.priority = payload.priority;
  if (payload.assignedTo !== undefined) updatePayload.assigned_to = payload.assignedTo;
  if (payload.resolutionNote !== undefined) updatePayload.resolution_note = payload.resolutionNote;

  if (payload.status === 'resolved' || payload.status === 'closed') {
    updatePayload.resolved_at = new Date().toISOString();
  }

  const { error } = await supabase.from('support_tickets').update(updatePayload).eq('id', ticketId);
  if (error) throw toError(error, 'Could not update support ticket.');
}

export async function getAdminRoles(): Promise<AdminRole[]> {
  const { data, error } = await supabase
    .from('admin_roles')
    .select('id, role_key, display_name, description')
    .order('display_name', { ascending: true });

  if (error) throw toError(error, 'Could not load admin roles.');

  return (data || []).map((row: any) => ({
    id: String(row.id),
    roleKey: String(row.role_key || 'unknown'),
    displayName: String(row.display_name || row.role_key || 'Unknown'),
    description: row.description || null,
  }));
}

export async function getAdminUsersWithRoles(): Promise<AdminUserAccount[]> {
  const [admins, roles] = await Promise.all([
    supabase
      .from('admin_users')
      .select('user_id, role_id, is_active, two_factor_enabled, last_login_at, created_at')
      .order('created_at', { ascending: false }),
    getAdminRoles(),
  ]);

  if (admins.error) throw toError(admins.error, 'Could not load admin users.');

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
  twoFactorEnabled?: boolean;
}): Promise<void> {
  const { error } = await supabase.from('admin_users').upsert(
    {
      user_id: payload.userId,
      role_id: payload.roleId,
      is_active: payload.isActive ?? true,
      two_factor_enabled: payload.twoFactorEnabled ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) throw toError(error, 'Could not save admin user account.');
}

export async function getAdminAuditLogs(params?: {
  action?: string;
  limit?: number;
}): Promise<AdminAuditLog[]> {
  const limit = Math.max(20, Math.min(params?.limit || 200, 500));

  let query = supabase
    .from('admin_audit_logs')
    .select('id, admin_user_id, action, entity_type, entity_id, reason, payload, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (params?.action?.trim()) {
    query = query.ilike('action', `%${params.action.trim()}%`);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw toError(error, 'Could not load audit logs.');
  }

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
