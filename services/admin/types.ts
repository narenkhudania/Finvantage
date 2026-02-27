export type AdminModule =
  | 'overview'
  | 'customers'
  | 'portfolio'
  | 'payments'
  | 'compliance'
  | 'fraud'
  | 'support'
  | 'access'
  | 'audit'
  | 'analytics'
  | 'usage'
  | 'blogs'
  | 'operations';

export interface AdminAccess {
  isAdmin: boolean;
  userId: string | null;
  roleKey: string | null;
  roleName: string | null;
  permissions: string[];
}

export interface AdminDashboardSummary {
  totalUsers: number;
  onboardedUsers: number;
  newUsers30d: number;
  dau: number;
  mau: number;
  totalAum: number;
  mtdRevenue: number;
  failedPayments30d: number;
  pendingKyc: number;
  openFraudFlags: number;
  blockedUsers: number;
}

export interface AdminCustomer {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string | null;
  mobile: string | null;
  country: string | null;
  onboarding_done: boolean;
  risk_level: string | null;
  kyc_status: string | null;
  plan_code: string | null;
  subscription_status: string | null;
  blocked: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminCustomerTimeline {
  profile: Record<string, unknown> | null;
  timeline: Array<{
    time?: string;
    type?: string;
    title?: string;
    detail?: string;
    amount?: number;
    meta?: Record<string, unknown>;
  }>;
}

export interface AdminKycCase {
  user_id: string;
  email: string | null;
  status: string;
  risk_score: number;
  risk_band: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  updated_at: string;
}

export interface AdminFraudFlag {
  id: string;
  user_id: string;
  email: string | null;
  severity: string;
  rule_key: string;
  status: string;
  amount: number | null;
  details: Record<string, unknown> | null;
  assigned_to: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface FeatureFlag {
  id: string;
  flag_key: string;
  description: string | null;
  is_enabled: boolean;
  rollout_percent: number;
  config: Record<string, unknown>;
  updated_at: string;
}

export interface WebhookEvent {
  id: string;
  provider: string;
  event_id: string | null;
  event_type: string;
  status: string;
  replay_count: number;
  received_at: string;
  last_replayed_at: string | null;
  error_message: string | null;
}

export interface AdminPayment {
  id: string;
  user_id: string;
  subscription_id: string | null;
  provider: string;
  provider_payment_id: string | null;
  status: string;
  amount: number;
  currency: string;
  attempted_at: string;
  settled_at: string | null;
  failure_reason: string | null;
}

export interface AdminSubscription {
  id: string;
  user_id: string;
  plan_code: string;
  status: string;
  billing_cycle: string;
  amount: number;
  currency: string;
  start_at: string;
  end_at: string | null;
  cancel_at_period_end: boolean;
}

export interface AdminAnalyticsSeriesPoint {
  day: string;
  newUsers: number;
  txnCount: number;
  txnAmount: number;
  revenue: number;
  dau: number;
}

export interface AdminAnalyticsSnapshot {
  days: number;
  series: AdminAnalyticsSeriesPoint[];
  totals: {
    newUsers: number;
    txnCount: number;
    txnAmount: number;
    revenue: number;
    avgDau: number;
  };
}

export interface AdminDistribution {
  key: string;
  count: number;
}

export interface AdminTopCustomer {
  userId: string;
  email: string;
  name: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  goalCount: number;
  lastActivityAt: string | null;
}

export interface AdminAlertItem {
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  metric: string;
}

export interface AdminOverviewReport {
  generatedAt: string;
  summary: {
    totalUsers: number;
    onboardedUsers: number;
    onboardingRatePct: number;
    newUsers30d: number;
    dau: number;
    mau: number;
    engagementPct: number;
    totalAum: number;
    mtdRevenue: number;
    paymentSuccessRatePct: number;
    failedPayments30d: number;
    pendingKyc: number;
    openFraudFlags: number;
    blockedUsers: number;
    openTickets: number;
    activeSubscriptions: number;
  };
  distributions: {
    paymentStatus: AdminDistribution[];
    subscriptionStatus: AdminDistribution[];
    kycStatus: AdminDistribution[];
    fraudSeverity: AdminDistribution[];
    riskLevel: AdminDistribution[];
  };
  topCustomers: AdminTopCustomer[];
  alerts: AdminAlertItem[];
  trends: AdminAnalyticsSeriesPoint[];
}

export interface AdminPortfolioRow {
  userId: string;
  email: string;
  name: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  goalsCount: number;
  transactionsCount: number;
  lastTransactionAt: string | null;
  riskLevel: string | null;
  kycStatus: string | null;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  userId: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  assignedTo: string | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminRole {
  id: string;
  roleKey: string;
  displayName: string;
  description: string | null;
}

export interface AdminUserAccount {
  userId: string;
  email: string;
  name: string;
  roleId: string;
  roleKey: string;
  roleName: string;
  isActive: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminUsageTrendPoint {
  day: string;
  events: number;
  users: number;
}

export interface AdminUsageTopEvent {
  eventName: string;
  events: number;
  users: number;
  lastSeenAt: string | null;
}

export interface AdminUsageModuleRow {
  module: string;
  opens: number;
  users: number;
  avgPerUser: number;
}

export interface AdminUsagePowerUser {
  userId: string;
  email: string;
  name: string | null;
  events: number;
  lastEventAt: string | null;
  topEvent: string | null;
}

export interface AdminUsageRecentEvent {
  eventTime: string;
  userId: string | null;
  email: string | null;
  eventName: string;
  source: string;
  metadata: Record<string, unknown>;
}

export interface AdminUsageFunnelRow {
  step: string;
  users: number;
}

export interface AdminUsageReport {
  days: number;
  generatedAt: string;
  totals: {
    totalEvents: number;
    uniqueUsers: number;
    avgEventsPerUser: number;
    viewOpens: number;
    goalCreates: number;
    assetAdds: number;
    liabilityAdds: number;
    riskProfilesCompleted: number;
  };
  trends: AdminUsageTrendPoint[];
  topEvents: AdminUsageTopEvent[];
  moduleUsage: AdminUsageModuleRow[];
  powerUsers: AdminUsagePowerUser[];
  funnel: AdminUsageFunnelRow[];
  recentActivity: AdminUsageRecentEvent[];
}

export interface AdminAuditLog {
  id: string;
  adminUserId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  reason: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}
