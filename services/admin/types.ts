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
  | 'behavior'
  | 'growth'
  | 'crm'
  | 'blogs'
  | 'operations';

export interface AdminWorkspaceMembership {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  roleKey: string;
  roleName: string;
  twoFactorRequired: boolean;
}

export interface AdminAccess {
  isAdmin: boolean;
  userId: string | null;
  organizationId?: string | null;
  organizationName?: string | null;
  workspaceId?: string | null;
  workspaceName?: string | null;
  roleKey: string | null;
  roleName: string | null;
  permissions: string[];
  workspaces?: AdminWorkspaceMembership[];
  twoFactorRequired?: boolean;
  twoFactorEnabled?: boolean;
  twoFactorStatus?: 'pending' | 'enabled' | 'disabled';
  twoFactorLastVerifiedAt?: string | null;
  recoveryCodesRemaining?: number;
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
  permissionKeys?: string[];
}

export interface AdminUserAccount {
  userId: string;
  email: string;
  name: string;
  roleId: string;
  roleKey: string;
  roleName: string;
  isActive: boolean;
  twoFactorRequired: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminPermissionDefinition {
  permissionKey: string;
  description: string | null;
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

export interface AdminSecuritySession {
  id: string;
  userId: string;
  email: string | null;
  fullName: string | null;
  roleKey: string | null;
  deviceName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  startedAt: string;
  lastSeenAt: string;
  twoFactorVerifiedAt: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
  isCurrentUser: boolean;
}

export interface AdminTwoFactorStatus {
  workspaceId: string;
  userId: string;
  required: boolean;
  status: 'pending' | 'enabled' | 'disabled';
  enabled: boolean;
  enabledAt: string | null;
  lastVerifiedAt: string | null;
  recoveryCodesRemaining: number;
}

export interface AdminTwoFactorSetup {
  secret: string;
  otpAuthUrl: string;
  recoveryCodes: string[];
}

export type AdminGrowthReadiness = 'ready' | 'partial' | 'planned';

export interface AdminGrowthCapability {
  id: string;
  title: string;
  summary: string;
  readiness: AdminGrowthReadiness;
  completionPct: number;
  requirements: string[];
  gaps: string[];
}

export interface AdminGrowthKpis {
  totalProfiles: number;
  activeUsers: number;
  campaignReachUsers: number;
  segmentationCriteriaCount: number;
  configuredChannels: number;
  multiChannelReachPct: number;
  goalConversionPct: number;
  revenueAttributed: number;
  churnRiskUsers: number;
  purchaseLikelyUsers: number;
  roiPct: number;
  experimentationCoveragePct: number;
}

export interface AdminGrowthChannelPerformance {
  channel: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  conversions: number;
  revenue: number;
  failRatePct: number;
}

export interface AdminGrowthSegmentPerformance {
  segment: string;
  users: number;
  criteria: string;
  conversionRatePct: number;
  churnRiskPct: number;
}

export type AdminGrowthJourneyTriggerType = 'event' | 'behavior' | 'time';

export interface AdminGrowthJourneyStep {
  id: string;
  title: string;
  channel: string;
  delayHours: number;
}

export interface AdminGrowthJourney {
  journey: string;
  status: 'active' | 'partial' | 'planned';
  trigger: string;
  triggerType?: AdminGrowthJourneyTriggerType;
  triggerValue?: string;
  steps?: AdminGrowthJourneyStep[];
  activeUsers: number;
  conversionPct: number;
}

export interface AdminGrowthExperiment {
  experiment: string;
  status: 'running' | 'planned' | 'paused';
  variantCoveragePct: number;
  conversionRatePct: number;
  upliftPct: number | null;
}

export interface AdminGrowthIntegration {
  integration: string;
  type: string;
  status: 'connected' | 'degraded' | 'planned';
  throughput24h: number;
  errorRatePct: number;
  lastSyncAt: string | null;
}

export interface AdminGrowthInsight {
  title: string;
  detail: string;
  impact: 'high' | 'medium' | 'low';
  metric: string;
  recommendation: string;
}

export interface AdminGrowthGovernance {
  adminUsers: number;
  twoFactorEnabled: number;
  workflowApprovalEvents: number;
  ssoEnabled: boolean;
  gdprCcpaControls: boolean;
}

export interface AdminGrowthTransactional {
  sent: number;
  failed: number;
  failRatePct: number;
  fallbackActivations: number;
}

export interface AdminMarketingGrowthReport {
  generatedAt: string;
  windowDays: number;
  kpis: AdminGrowthKpis;
  channels: AdminGrowthChannelPerformance[];
  segments: AdminGrowthSegmentPerformance[];
  journeys: AdminGrowthJourney[];
  experiments: AdminGrowthExperiment[];
  integrations: AdminGrowthIntegration[];
  insights: AdminGrowthInsight[];
  governance: AdminGrowthGovernance;
  transactional: AdminGrowthTransactional;
  capabilities: AdminGrowthCapability[];
}

export interface AdminBehaviorKpis {
  totalEvents: number;
  activeUsers: number;
  retentionWeek1Pct: number;
  retentionWeek4Pct: number;
  churnPct: number;
  conversionPct: number;
  realtimeEventsLastHour: number;
  rageClickRatePct: number;
  deadClickRatePct: number;
}

export interface AdminBehaviorCohortRow {
  cohort: string;
  users: number;
  week1RetentionPct: number;
  week4RetentionPct: number;
  churnPct: number;
}

export interface AdminBehaviorFunnelRow {
  step: string;
  users: number;
  conversionPct: number;
  dropOffPct: number;
}

export interface AdminBehaviorPathRow {
  path: string;
  users: number;
  sharePct: number;
  avgStepGapMinutes: number;
}

export interface AdminBehaviorRealtimeEvent {
  eventTime: string;
  userId: string | null;
  email: string | null;
  eventName: string;
  source: string;
  platform: string;
  latencySeconds: number;
}

export interface AdminBehaviorTrafficRow {
  source: string;
  sessions: number;
  users: number;
  conversionPct: number;
  bounceRiskPct: number;
}

export interface AdminBehaviorPlatformRow {
  platform: string;
  users: number;
  events: number;
  conversionPct: number;
}

export interface AdminBehaviorJourneyStage {
  stage: string;
  users: number;
  conversionPct: number;
}

export interface AdminBehaviorAbTestImpact {
  experiment: string;
  status: 'running' | 'planned' | 'paused';
  sampleSize: number;
  controlConversionPct: number;
  variantConversionPct: number;
  upliftPct: number | null;
  confidencePct: number | null;
}

export interface AdminBehaviorHeatmapRow {
  screen: string;
  zone: string;
  interactions: number;
  rageClicks: number;
  deadClicks: number;
  avgScrollDepthPct: number;
}

export interface AdminBehaviorSessionReplayRow {
  sessionId: string;
  userId: string | null;
  email: string | null;
  durationSec: number;
  interactions: number;
  rageClicks: number;
  deadClicks: number;
  lastEventAt: string;
}

export interface AdminBehaviorIssueRow {
  issue: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  users: number;
  events: number;
  lastSeenAt: string | null;
  status: 'open' | 'monitoring' | 'resolved';
}

export interface AdminBehaviorSearchInsightRow {
  keyword: string;
  matches: number;
  latestEventAt: string | null;
}

export interface AdminBehaviorAlertTrigger {
  trigger: string;
  metric: string;
  threshold: string;
  currentValue: string;
  status: 'triggered' | 'healthy';
  lastTriggeredAt: string | null;
}

export interface AdminBehaviorInsight {
  title: string;
  detail: string;
  severity: 'high' | 'medium' | 'low';
  metric: string;
  recommendation: string;
}

export interface AdminBehaviorReport {
  generatedAt: string;
  windowDays: number;
  kpis: AdminBehaviorKpis;
  cohorts: AdminBehaviorCohortRow[];
  funnel: AdminBehaviorFunnelRow[];
  paths: AdminBehaviorPathRow[];
  realTime: AdminBehaviorRealtimeEvent[];
  traffic: AdminBehaviorTrafficRow[];
  crossPlatform: AdminBehaviorPlatformRow[];
  journey: AdminBehaviorJourneyStage[];
  abImpact: AdminBehaviorAbTestImpact[];
  heatmaps: AdminBehaviorHeatmapRow[];
  sessionReplays: AdminBehaviorSessionReplayRow[];
  issues: AdminBehaviorIssueRow[];
  search: AdminBehaviorSearchInsightRow[];
  alerts: AdminBehaviorAlertTrigger[];
  insights: AdminBehaviorInsight[];
}

export interface AdminCrmContact {
  id: string;
  userId: string | null;
  name: string;
  email: string;
  source: string;
  stage: string;
  leadScore: number;
  tags: string[];
  owner: string | null;
  lastActivityAt: string | null;
  createdAt: string;
}

export interface AdminCrmLead {
  id: string;
  contactId: string | null;
  title: string;
  source: string;
  stage: string;
  status: string;
  score: number;
  value: number;
  tags: string[];
  nextActionAt: string | null;
  owner: string | null;
  createdAt: string;
}

export interface AdminCrmDeal {
  id: string;
  contactId: string | null;
  leadId: string | null;
  name: string;
  stage: string;
  status: string;
  amount: number;
  probabilityPct: number;
  expectedCloseAt: string | null;
  owner: string | null;
  updatedAt: string;
}

export interface AdminCrmTask {
  id: string;
  entityType: string;
  entityId: string | null;
  title: string;
  status: string;
  priority: string;
  dueAt: string | null;
  meetingAt: string | null;
  assignee: string | null;
  createdAt: string;
}

export interface AdminCrmEmailTemplate {
  id: string;
  name: string;
  subject: string;
  previewText: string;
  updatedAt: string;
  lastUsedAt: string | null;
  sent: number;
  opens: number;
  clicks: number;
  conversions: number;
}

export interface AdminCrmWorkflow {
  id: string;
  name: string;
  status: string;
  trigger: string;
  conditionLogic: string;
  channels: string[];
  stepCount: number;
  enrolled: number;
  lastRunAt: string | null;
}

export interface AdminCrmPipelineStage {
  stage: string;
  deals: number;
  amount: number;
  weightedAmount: number;
}

export interface AdminCrmCustomObject {
  id: string;
  objectType: string;
  title: string;
  status: string;
  owner: string | null;
  score: number;
  updatedAt: string;
  properties: Record<string, unknown>;
}

export interface AdminCrmTimelineItem {
  time: string;
  entity: string;
  action: string;
  detail: string;
}

export interface AdminCrmKpis {
  contacts: number;
  leads: number;
  qualifiedLeads: number;
  deals: number;
  openPipelineValue: number;
  wonValue: number;
  avgLeadScore: number;
  emailsSent: number;
  emailOpenRatePct: number;
  emailClickRatePct: number;
  workflowsActive: number;
  tasksDue: number;
}

export interface AdminCrmReport {
  generatedAt: string;
  windowDays: number;
  kpis: AdminCrmKpis;
  pipeline: AdminCrmPipelineStage[];
  contacts: AdminCrmContact[];
  leads: AdminCrmLead[];
  deals: AdminCrmDeal[];
  tasks: AdminCrmTask[];
  templates: AdminCrmEmailTemplate[];
  workflows: AdminCrmWorkflow[];
  customObjects: AdminCrmCustomObject[];
  timeline: AdminCrmTimelineItem[];
}
