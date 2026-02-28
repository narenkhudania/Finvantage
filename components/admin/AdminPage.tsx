import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Eye,
  EyeOff,
  Flag,
  Layers,
  ListChecks,
  LogOut,
  Megaphone,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  SlidersHorizontal,
  Ticket,
  UserCog,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts';
import { supabase } from '../../services/supabase';
import { applySeoMeta } from '../../services/seoMeta';
import {
  getBehaviorIntelligenceReport,
  getCrmOperationsReport,
  getAdminPermissions,
  getAdminSecuritySessions,
  getAdminTwoFactorStatus,
  getAdminWorkspaceId,
  exportCustomersCsv,
  createCrmComplaintTicket,
  forceCustomerLogout,
  confirmAdminTwoFactorSetup,
  disableAdminTwoFactor,
  getAdminAccess,
  getAdminAuditLogs,
  getAdminCustomers,
  getAdminCustomerTimeline,
  getAdminOverviewReport,
  getAdminRoles,
  getAdminUsersWithRoles,
  getAnalyticsSnapshot,
  getCustomerFinancialDetail,
  getFeatureFlags,
  getFraudQueue,
  getKycQueue,
  getMarketingGrowthReport,
  getPayments,
  getPortfolioRows,
  getSubscriptions,
  getSupportTickets,
  getUsageReport,
  getWebhookEvents,
  regenerateAdminRecoveryCodes,
  registerAdminSecuritySession,
  replayWebhook,
  revokeAdminSecuritySession,
  resolveFraudFlag,
  reviewKyc,
  sendCustomerNotification,
  setAdminWorkspaceId,
  setCustomerBlocked,
  startAdminTwoFactorSetup,
  touchAdminSecuritySession,
  updateSupportTicket,
  upsertAdminUserAccount,
  upsertCrmCustomObject,
  upsertCrmDeal,
  upsertCrmEmailTemplate,
  upsertCrmLead,
  upsertCrmTask,
  upsertCrmWorkflow,
  upsertFeatureFlag,
  updateCrmDealStage,
  updateCrmTaskStatus,
  verifyAdminSecondFactor,
} from '../../services/admin/adminService';
import type {
  AdminAccess,
  AdminAnalyticsSnapshot,
  AdminAuditLog,
  AdminBehaviorReport,
  AdminCrmReport,
  AdminCustomer,
  AdminCustomerTimeline,
  AdminFraudFlag,
  AdminGrowthJourney,
  AdminKycCase,
  AdminMarketingGrowthReport,
  AdminModule,
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
} from '../../services/admin/types';
import {
  deleteAdminBlogPost,
  evaluateBlogSeo,
  listAdminBlogPosts,
  saveAdminBlogPost,
  setAdminBlogPostStatus,
  slugify,
  type BlogPost,
  type BlogStatus,
} from '../../services/blogService';
import SafeResponsiveContainer from '../common/SafeResponsiveContainer';
import AdminAccessModule from './modules/AdminAccessModule';
import AdminAnalyticsModule from './modules/AdminAnalyticsModule';
import AdminAuditModule from './modules/AdminAuditModule';
import AdminComplianceModule from './modules/AdminComplianceModule';
import AdminCustomersModule from './modules/AdminCustomersModule';
import AdminFraudModule from './modules/AdminFraudModule';
import AdminPaymentsModule from './modules/AdminPaymentsModule';
import AdminOverviewModule from './modules/AdminOverviewModule';
import AdminPortfolioModule from './modules/AdminPortfolioModule';
import AdminSupportModule from './modules/AdminSupportModule';
import AdminUsageModule from './modules/AdminUsageModule';

type LoginState = {
  email: string;
  password: string;
};

type GrowthTriggerType = 'event' | 'behavior' | 'time';

type GrowthJourneyStepDraft = {
  id: string;
  title: string;
  channel: string;
  delayHours: number;
};

type GrowthJourneyBuilderDraft = {
  journey: string;
  triggerType: GrowthTriggerType;
  triggerValue: string;
  steps: GrowthJourneyStepDraft[];
};

const inferGrowthTriggerType = (trigger: string): GrowthTriggerType => {
  const value = trigger.toLowerCase();
  if (value.includes('inactive') || value.includes('behavior')) return 'behavior';
  if (value.includes('weekly') || value.includes('daily') || value.includes('time') || value.includes('every_')) return 'time';
  return 'event';
};

const normalizeGrowthBuilderSteps = (
  journey: string,
  trigger: string,
  rawSteps?: AdminGrowthJourney['steps']
): GrowthJourneyStepDraft[] => {
  const base = journey.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'journey';
  const normalized = Array.isArray(rawSteps)
    ? rawSteps
        .filter(Boolean)
        .map((step, index) => {
          const rawDelay = Number(step?.delayHours ?? 0);
          return {
            id: String(step?.id || `${base}_step_${index + 1}`),
            title: String(step?.title || `Step ${index + 1}`),
            channel: String(step?.channel || 'in_app'),
            delayHours: Number.isFinite(rawDelay) ? Math.max(0, rawDelay) : 0,
          };
        })
    : [];

  if (normalized.length) return normalized;

  const isDrip = journey.toLowerCase().includes('drip') || trigger.toLowerCase().includes('payment_failed');
  return [
    { id: `${base}_step_1`, title: 'Primary Message', channel: 'in_app', delayHours: 0 },
    { id: `${base}_step_2`, title: isDrip ? 'Follow-up Reminder' : 'Conversion Nudge', channel: 'email', delayHours: isDrip ? 24 : 12 },
    { id: `${base}_step_3`, title: 'Final Follow-up', channel: isDrip ? 'sms' : 'mobile_push', delayHours: 48 },
  ];
};

const createGrowthBuilderDraft = (journey: AdminGrowthJourney): GrowthJourneyBuilderDraft => {
  const triggerType = journey.triggerType || inferGrowthTriggerType(journey.trigger);
  const triggerValue = journey.triggerValue || journey.trigger;
  return {
    journey: journey.journey,
    triggerType,
    triggerValue,
    steps: normalizeGrowthBuilderSteps(journey.journey, triggerValue, journey.steps),
  };
};

const MODULES: Array<{
  id: AdminModule;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  permission?: string;
}> = [
  { id: 'overview', label: 'Overview', icon: BarChart3, permission: 'analytics.read' },
  { id: 'customers', label: 'Customers', icon: Users, permission: 'customers.read' },
  { id: 'portfolio', label: 'Portfolio', icon: Wallet, permission: 'customers.read' },
  { id: 'payments', label: 'Payments', icon: CreditCard, permission: 'payments.read' },
  { id: 'compliance', label: 'KYC', icon: Shield, permission: 'kyc.read' },
  { id: 'fraud', label: 'Fraud', icon: ShieldAlert, permission: 'fraud.read' },
  { id: 'support', label: 'Support', icon: Ticket, permission: 'ops.manage' },
  { id: 'access', label: 'Access', icon: UserCog, permission: 'admin.manage' },
  { id: 'audit', label: 'Audit', icon: ListChecks, permission: 'audit.read' },
  { id: 'analytics', label: 'Analytics', icon: Activity, permission: 'analytics.read' },
  { id: 'usage', label: 'Usage', icon: Layers, permission: 'analytics.read' },
  { id: 'behavior', label: 'Behavior', icon: Flag, permission: 'analytics.read' },
  { id: 'growth', label: 'Growth', icon: Megaphone, permission: 'analytics.read' },
  { id: 'crm', label: 'CRM', icon: CircleDollarSign, permission: 'ops.manage' },
  { id: 'blogs', label: 'Blogs', icon: SlidersHorizontal, permission: 'analytics.read' },
  { id: 'operations', label: 'Operations', icon: Wrench, permission: 'ops.manage' },
];

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const NUM = new Intl.NumberFormat('en-IN');

const formatCurrency = (value: number) => INR.format(Number.isFinite(value) ? value : 0);
const formatNumber = (value: number) => NUM.format(Number.isFinite(value) ? value : 0);
const formatSignedNumber = (value: number) => `${value > 0 ? '+' : ''}${formatNumber(value)}`;

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const round = (value: number, precision = 1) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const calculateDeltaPct = (current: number, previous: number): number | null => {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous <= 0) return current <= 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
};

const formatDeltaPct = (value: number | null) => {
  if (value == null) return 'N/A';
  const rounded = round(value, 1);
  const prefix = rounded > 0 ? '+' : '';
  return `${prefix}${rounded.toFixed(1)}%`;
};

const formatPct = (value: number) => `${round(value, 1).toFixed(1)}%`;

const toRate = (numerator: number, denominator: number): number | null => {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return (numerator / denominator) * 100;
};

const toneFromDelta = (value: number | null): 'up' | 'down' | 'flat' => {
  if (value == null) return 'flat';
  if (value > 2) return 'up';
  if (value < -2) return 'down';
  return 'flat';
};

const toneClass = (tone: 'up' | 'down' | 'flat') => {
  if (tone === 'up') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (tone === 'down') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
};

const statusBadgeClass = (value: string) => {
  const key = value.toLowerCase();
  if (['critical', 'high', 'failed', 'blocked', 'rejected', 'open', 'escalated'].includes(key)) {
    return 'bg-rose-100 text-rose-700 border-rose-200';
  }
  if (['pending', 'under_review', 'in_review', 'investigating', 'past_due'].includes(key)) {
    return 'bg-amber-100 text-amber-700 border-amber-200';
  }
  if (['active', 'approved', 'resolved', 'closed', 'captured', 'settled'].includes(key)) {
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  }
  return 'bg-slate-100 text-slate-600 border-slate-200';
};

const cardClass =
  'rounded-3xl border border-teal-100 bg-white/90 shadow-[0_25px_50px_-35px_rgba(15,118,110,0.55)]';

const buttonBase =
  'rounded-xl border px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.14em] transition disabled:opacity-45 disabled:cursor-not-allowed';

const BLOG_PROMOTION_STEPS: Array<{ key: string; label: string }> = [
  { key: 'newsletter', label: 'Shared in newsletter' },
  { key: 'linkedin', label: 'Posted on LinkedIn' },
  { key: 'twitter', label: 'Posted as thread on X/Twitter' },
  { key: 'community', label: 'Shared in niche communities' },
  { key: 'internal_links', label: 'Added internal links from old posts' },
  { key: 'lead_magnet', label: 'Linked to a lead magnet / calculator' },
  { key: 'refresh_date', label: 'Added refresh date in content' },
  { key: 'repurpose_video', label: 'Repurposed to short video' },
];

type ModuleErrorBoundaryProps = React.PropsWithChildren<{
  moduleName: AdminModule;
  onRetry: () => Promise<void> | void;
}>;

type ModuleErrorBoundaryState = {
  hasError: boolean;
  message: string | null;
};

class ModuleErrorBoundary extends React.Component<ModuleErrorBoundaryProps, ModuleErrorBoundaryState> {
  state: ModuleErrorBoundaryState = {
    hasError: false,
    message: null,
  };

  static getDerivedStateFromError(error: Error): ModuleErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Unexpected module rendering error.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep visibility in devtools and preserve the app shell.
    console.error('[AdminPage] Module render failed', {
      module: this.props.moduleName,
      error,
      componentStack: info.componentStack,
    });
  }

  componentDidUpdate(prevProps: ModuleErrorBoundaryProps) {
    if (prevProps.moduleName !== this.props.moduleName && this.state.hasError) {
      this.setState({ hasError: false, message: null });
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, message: null });
    void this.props.onRetry();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-rose-600">Module Error</p>
        <h3 className="mt-2 text-lg font-black tracking-tight text-rose-900">{this.props.moduleName} failed to render</h3>
        <p className="mt-2 text-sm font-semibold text-rose-700">{this.state.message || 'Unexpected module rendering error.'}</p>
        <button
          onClick={this.handleRetry}
          className="mt-4 rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-teal-700"
        >
          Reload Module
        </button>
      </div>
    );
  }
}

const createBlogDraft = (): BlogPost => ({
  id: '',
  title: '',
  slug: '',
  excerpt: '',
  contentMarkdown: '',
  status: 'draft',
  publishedAt: null,
  scheduledFor: null,
  targetKeyword: '',
  secondaryKeywords: [],
  tags: [],
  metaTitle: '',
  metaDescription: '',
  canonicalUrl: '',
  ogImageUrl: '',
  ctaText: '',
  ctaUrl: '',
  internalLinkTargets: [],
  externalReferences: [],
  schemaType: 'Article',
  faqSchema: [],
  promotionChecklist: {},
  organicScore: 0,
  wordCount: 0,
  estimatedReadMinutes: 1,
  isFeatured: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const AdminPage: React.FC = () => {
  const [booting, setBooting] = useState(true);
  const [activeModule, setActiveModule] = useState<AdminModule>('overview');
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [loginState, setLoginState] = useState<LoginState>({ email: '', password: '' });
  const [revealLoginPassword, setRevealLoginPassword] = useState(false);
  const [loginFocusField, setLoginFocusField] = useState<'email' | 'password' | null>(null);
  const [loginCapsLockOn, setLoginCapsLockOn] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [overview, setOverview] = useState<AdminOverviewReport | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalyticsSnapshot | null>(null);
  const [usageReport, setUsageReport] = useState<AdminUsageReport | null>(null);
  const [behaviorReport, setBehaviorReport] = useState<AdminBehaviorReport | null>(null);
  const [growthReport, setGrowthReport] = useState<AdminMarketingGrowthReport | null>(null);
  const [crmReport, setCrmReport] = useState<AdminCrmReport | null>(null);
  const [analyticsDays, setAnalyticsDays] = useState(365);
  const [usageDays, setUsageDays] = useState(30);
  const [behaviorDays, setBehaviorDays] = useState(30);
  const [growthDays, setGrowthDays] = useState(30);
  const [crmDays, setCrmDays] = useState(30);
  const [selectedGrowthJourney, setSelectedGrowthJourney] = useState<string | null>(null);
  const [journeyBuilder, setJourneyBuilder] = useState<GrowthJourneyBuilderDraft | null>(null);
  const [draggingBuilderStepId, setDraggingBuilderStepId] = useState<string | null>(null);

  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Record<string, boolean>>({});
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerKycFilter, setCustomerKycFilter] = useState('');
  const [timelineTarget, setTimelineTarget] = useState<AdminCustomer | null>(null);
  const [timeline, setTimeline] = useState<AdminCustomerTimeline | null>(null);

  const [portfolioRows, setPortfolioRows] = useState<AdminPortfolioRow[]>([]);
  const [portfolioSearch, setPortfolioSearch] = useState('');
  const [portfolioTarget, setPortfolioTarget] = useState<AdminPortfolioRow | null>(null);
  const [portfolioDetail, setPortfolioDetail] = useState<any>(null);

  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [subscriptions, setSubscriptions] = useState<AdminSubscription[]>([]);

  const [kycQueue, setKycQueue] = useState<AdminKycCase[]>([]);
  const [fraudQueue, setFraudQueue] = useState<AdminFraudFlag[]>([]);

  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [supportStatusFilter, setSupportStatusFilter] = useState('all');

  const [adminUsers, setAdminUsers] = useState<AdminUserAccount[]>([]);
  const [adminRoles, setAdminRoles] = useState<AdminRole[]>([]);
  const [adminPermissions, setAdminPermissions] = useState<AdminPermissionDefinition[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(getAdminWorkspaceId());
  const [adminForm, setAdminForm] = useState({
    userId: '',
    roleId: '',
    isActive: true,
    twoFactorEnabled: false,
    twoFactorRequired: false,
  });
  const [securitySessions, setSecuritySessions] = useState<AdminSecuritySession[]>([]);
  const [sessionTargetUserId, setSessionTargetUserId] = useState('');
  const [twoFactorStatus, setTwoFactorStatus] = useState<AdminTwoFactorStatus | null>(null);
  const [twoFactorSetup, setTwoFactorSetup] = useState<AdminTwoFactorSetup | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [secondFactorCode, setSecondFactorCode] = useState('');
  const [recoveryCodesDraft, setRecoveryCodesDraft] = useState('');

  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [auditActionFilter, setAuditActionFilter] = useState('');

  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);

  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [blogStatusFilter, setBlogStatusFilter] = useState<BlogStatus | 'all'>('all');
  const [blogSearch, setBlogSearch] = useState('');
  const [blogForm, setBlogForm] = useState<BlogPost>(() => createBlogDraft());

  const [communicationForm, setCommunicationForm] = useState({
    userId: '',
    title: '',
    message: '',
    channel: 'in_app',
  });

  const [flagForm, setFlagForm] = useState({
    flagKey: '',
    description: '',
    enabled: false,
    rolloutPercent: 100,
  });

  const [crmLeadForm, setCrmLeadForm] = useState({
    title: '',
    source: 'internal',
    stage: 'new',
    score: 35,
    value: 5000,
    tags: '',
  });

  const [crmDealForm, setCrmDealForm] = useState({
    name: '',
    stage: 'discovery',
    amount: 10000,
    probabilityPct: 45,
    expectedCloseAt: '',
  });

  const [crmTaskForm, setCrmTaskForm] = useState({
    title: '',
    entityType: 'lead',
    priority: 'medium',
    dueAt: '',
  });

  const [crmTemplateForm, setCrmTemplateForm] = useState({
    name: '',
    subject: '',
    previewText: '',
    bodyMarkdown: '',
  });

  const [crmWorkflowForm, setCrmWorkflowForm] = useState({
    name: '',
    trigger: '',
    conditionLogic: 'true',
    channels: 'in_app,email',
    stepCount: 3,
    status: 'draft',
  });

  const [crmCustomObjectForm, setCrmCustomObjectForm] = useState({
    objectType: 'account_health',
    title: '',
    status: 'active',
    score: 50,
    propertiesJson: '{}',
  });

  const [crmComplaintForm, setCrmComplaintForm] = useState({
    userId: '',
    subject: '',
    description: '',
    priority: 'medium',
    assignedTo: '',
    tags: '',
  });
  const [crmComplaintStatusFilter, setCrmComplaintStatusFilter] = useState('all');
  const [crmComplaintPriorityFilter, setCrmComplaintPriorityFilter] = useState('all');

  const selectedCustomerList = useMemo(
    () => customers.filter((customer) => selectedCustomerIds[customer.user_id]),
    [customers, selectedCustomerIds]
  );

  const clearBanners = () => {
    setError(null);
    setSuccess(null);
  };

  const safeErrorText = useMemo(() => {
    if (!error) return null;
    return error
      .replace(/supabase/gi, 'platform')
      .replace(/gotrue/gi, 'identity service');
  }, [error]);

  const can = useCallback(
    (permission?: string) => {
      if (!permission) return true;
      if (!access?.isAdmin) return false;
      if (access.roleKey === 'super_admin' || access.roleKey === 'admin') return true;
      return access.permissions.includes(permission) || access.permissions.includes('*');
    },
    [access]
  );

  const bootAccess = useCallback(async () => {
    setBooting(true);
    setError(null);
    setSuccess(null);

    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setAccess(null);
        return;
      }

      const accessData = await getAdminAccess();
      setAccess(accessData);
      const workspaceId = accessData.workspaceId || accessData.workspaces?.[0]?.workspaceId || null;
      if (workspaceId) {
        setAdminWorkspaceId(workspaceId);
        setSelectedWorkspaceId(workspaceId);
        await registerAdminSecuritySession({
          deviceName: typeof navigator !== 'undefined' ? navigator.platform || 'browser' : 'browser',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'browser',
          metadata: { source: 'admin_panel' },
        }).catch(() => null);
      }

      // reset to first available module if current one is not allowed
      const hasPermission = (permission?: string) => {
        if (!permission) return true;
        if (!accessData?.isAdmin) return false;
        if (accessData.roleKey === 'super_admin' || accessData.roleKey === 'admin') return true;
        return accessData.permissions.includes(permission) || accessData.permissions.includes('*');
      };

      setActiveModule((currentModule) => {
        const current = MODULES.find((item) => item.id === currentModule);
        if (!current?.permission || hasPermission(current.permission)) return currentModule;
        const fallback = MODULES.find((item) => hasPermission(item.permission));
        return fallback?.id || currentModule;
      });
    } catch (err) {
      setError((err as Error).message || 'Unable to initialize admin access.');
      setAccess(null);
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    applySeoMeta({
      title: 'FinVantage Admin Control Plane',
      description: 'Internal admin operations dashboard for FinVantage.',
      canonicalUrl: `${window.location.origin}/admin`,
      type: 'website',
      robots: 'noindex,nofollow',
    });
  }, []);

  useEffect(() => {
    void bootAccess();
    const { data: authSub } = supabase.auth.onAuthStateChange(() => {
      void bootAccess();
    });
    return () => authSub.subscription.unsubscribe();
  }, [bootAccess]);

  useEffect(() => {
    if (!access?.isAdmin || !selectedWorkspaceId) return;
    const interval = window.setInterval(() => {
      void touchAdminSecuritySession().catch(() => null);
    }, 45_000);
    return () => window.clearInterval(interval);
  }, [access?.isAdmin, selectedWorkspaceId]);

  useEffect(() => {
    if (!access?.workspaceId) return;
    if (access.workspaceId !== selectedWorkspaceId) {
      setSelectedWorkspaceId(access.workspaceId);
    }
  }, [access?.workspaceId, selectedWorkspaceId]);

  const loadOverview = useCallback(async () => {
    const overviewData = await getAdminOverviewReport(180);
    setOverview(overviewData);
  }, []);

  const loadCustomers = useCallback(async () => {
    const rows = await getAdminCustomers({
      search: customerSearch || undefined,
      kycStatus: customerKycFilter || undefined,
      limit: 120,
      offset: 0,
    });
    setCustomers(rows);
  }, [customerSearch, customerKycFilter]);

  const loadPortfolio = useCallback(async () => {
    const rows = await getPortfolioRows({ search: portfolioSearch || undefined, limit: 140, offset: 0 });
    setPortfolioRows(rows);
  }, [portfolioSearch]);

  const loadPayments = useCallback(async () => {
    const [paymentRows, subscriptionRows] = await Promise.all([getPayments(220), getSubscriptions(220)]);
    setPayments(paymentRows);
    setSubscriptions(subscriptionRows);
  }, []);

  const loadCompliance = useCallback(async () => {
    const rows = await getKycQueue();
    setKycQueue(rows);
  }, []);

  const loadFraud = useCallback(async () => {
    const rows = await getFraudQueue();
    setFraudQueue(rows);
  }, []);

  const loadSupport = useCallback(async () => {
    const rows = await getSupportTickets({ status: supportStatusFilter, limit: 200 });
    setSupportTickets(rows);
  }, [supportStatusFilter]);

  const loadAccessModule = useCallback(async () => {
    const [users, roles, permissions, sessions, tfStatus] = await Promise.all([
      getAdminUsersWithRoles(),
      getAdminRoles(),
      getAdminPermissions(),
      getAdminSecuritySessions(sessionTargetUserId || undefined),
      getAdminTwoFactorStatus(),
    ]);
    setAdminUsers(users);
    setAdminRoles(roles);
    setAdminPermissions(permissions);
    setSecuritySessions(sessions);
    setTwoFactorStatus(tfStatus);
    if (!adminForm.roleId && roles[0]) {
      setAdminForm((prev) => ({ ...prev, roleId: roles[0].id }));
    }
  }, [adminForm.roleId, sessionTargetUserId]);

  const loadAudit = useCallback(async () => {
    const rows = await getAdminAuditLogs({ action: auditActionFilter || undefined, limit: 250 });
    setAuditLogs(rows);
  }, [auditActionFilter]);

  const loadAnalytics = useCallback(async () => {
    const data = await getAnalyticsSnapshot(analyticsDays);
    setAnalytics(data);
  }, [analyticsDays]);

  const loadUsage = useCallback(async () => {
    const data = await getUsageReport(usageDays, 30);
    setUsageReport(data);
  }, [usageDays]);

  const loadBehavior = useCallback(async () => {
    const data = await getBehaviorIntelligenceReport(behaviorDays);
    setBehaviorReport(data);
  }, [behaviorDays]);

  const loadGrowth = useCallback(async () => {
    const data = await getMarketingGrowthReport(growthDays);
    setGrowthReport(data);
    const journeys = data.journeys || [];
    if (!journeys.length) {
      setSelectedGrowthJourney(null);
      setJourneyBuilder(null);
      setDraggingBuilderStepId(null);
      return;
    }

    const selected = selectedGrowthJourney && journeys.some((row) => row.journey === selectedGrowthJourney)
      ? selectedGrowthJourney
      : journeys[0].journey;
    const journey = journeys.find((row) => row.journey === selected) || journeys[0];
    setSelectedGrowthJourney(selected);
    setJourneyBuilder(createGrowthBuilderDraft(journey));
    setDraggingBuilderStepId(null);
  }, [growthDays, selectedGrowthJourney]);

  const loadCrm = useCallback(async () => {
    const data = await getCrmOperationsReport(crmDays);
    setCrmReport(data);
  }, [crmDays]);

  const loadBlogs = useCallback(async () => {
    const rows = await listAdminBlogPosts({
      status: blogStatusFilter,
      search: blogSearch || undefined,
      limit: 200,
    });
    setBlogPosts(rows);
  }, [blogSearch, blogStatusFilter]);

  const loadOperations = useCallback(async () => {
    const [flags, events] = await Promise.all([getFeatureFlags(), getWebhookEvents(160)]);
    setFeatureFlags(flags);
    setWebhookEvents(events);
  }, []);

  const refreshModule = useCallback(async () => {
    if (!access?.isAdmin) return;

    setBusy(true);
    clearBanners();

    try {
      switch (activeModule) {
        case 'overview':
          await loadOverview();
          break;
        case 'customers':
          await loadCustomers();
          break;
        case 'portfolio':
          await loadPortfolio();
          break;
        case 'payments':
          await loadPayments();
          break;
        case 'compliance':
          await loadCompliance();
          break;
        case 'fraud':
          await loadFraud();
          break;
        case 'support':
          await loadSupport();
          break;
        case 'access':
          await loadAccessModule();
          break;
        case 'audit':
          await loadAudit();
          break;
        case 'analytics':
          await loadAnalytics();
          break;
        case 'usage':
          await loadUsage();
          break;
        case 'behavior':
          await loadBehavior();
          break;
        case 'growth':
          await loadGrowth();
          break;
        case 'crm':
          await loadCrm();
          break;
        case 'blogs':
          await loadBlogs();
          break;
        case 'operations':
          await loadOperations();
          break;
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to load module data.');
    } finally {
      setBusy(false);
    }
  }, [
    access?.isAdmin,
    activeModule,
    loadOverview,
    loadCustomers,
    loadPortfolio,
    loadPayments,
    loadCompliance,
    loadFraud,
    loadSupport,
    loadAccessModule,
    loadAudit,
    loadAnalytics,
    loadUsage,
    loadBehavior,
    loadGrowth,
    loadCrm,
    loadBlogs,
    loadOperations,
  ]);

  const handleWorkspaceSwitch = useCallback(async (workspaceId: string) => {
    if (!workspaceId || workspaceId === selectedWorkspaceId) return;
    setBusy(true);
    clearBanners();
    try {
      setAdminWorkspaceId(workspaceId);
      setSelectedWorkspaceId(workspaceId);
      const nextAccess = await getAdminAccess();
      setAccess(nextAccess);
      await registerAdminSecuritySession({
        deviceName: typeof navigator !== 'undefined' ? navigator.platform || 'browser' : 'browser',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'browser',
        metadata: { source: 'admin_panel', switchedWorkspace: true },
      }).catch(() => null);
      setSuccess(`Workspace switched to ${nextAccess.workspaceName || 'selected workspace'}.`);
    } catch (err) {
      setError((err as Error).message || 'Could not switch workspace.');
    } finally {
      setBusy(false);
    }
  }, [selectedWorkspaceId]);

  useEffect(() => {
    if (!access?.isAdmin) return;
    void refreshModule();
  }, [activeModule, access?.isAdmin]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    clearBanners();

    if (!loginState.email.trim() || !loginState.password) {
      setError('Email and password are required.');
      return;
    }

    setBusy(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: loginState.email.trim(),
        password: loginState.password,
      });

      if (authError) throw authError;
      setSuccess('Authentication successful.');
      await bootAccess();
    } catch (err) {
      const message = String((err as Error)?.message || '').toLowerCase();
      if (message.includes('invalid') || message.includes('credentials')) {
        setError('Invalid email or password.');
      } else if (message.includes('email') && message.includes('confirm')) {
        setError('Email verification is pending. Confirm your inbox link and retry.');
      } else {
        setError('Authentication failed. Verify credentials and workspace access mapping.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    clearBanners();

    try {
      await supabase.auth.signOut();
      setAccess(null);
      setAdminWorkspaceId(null);
      setSelectedWorkspaceId(null);
      setSuccess('Signed out.');
    } catch (err) {
      setError((err as Error).message || 'Could not sign out.');
    } finally {
      setBusy(false);
    }
  };

  const handleCustomerAction = async (
    action: 'block' | 'unblock' | 'force_logout',
    userIds: string[],
    reason?: string
  ) => {
    if (!userIds.length) return;

    clearBanners();
    setBusy(true);

    try {
      if (action === 'block') {
        await Promise.all(userIds.map((userId) => setCustomerBlocked(userId, true, reason || 'Risk intervention')));
        setSuccess(`Blocked ${userIds.length} customer(s).`);
      }
      if (action === 'unblock') {
        await Promise.all(userIds.map((userId) => setCustomerBlocked(userId, false)));
        setSuccess(`Unblocked ${userIds.length} customer(s).`);
      }
      if (action === 'force_logout') {
        await Promise.all(userIds.map((userId) => forceCustomerLogout(userId, reason || 'Session reset by admin')));
        setSuccess(`Force logout queued for ${userIds.length} customer(s).`);
      }

      setSelectedCustomerIds({});
      await loadCustomers();
      if (activeModule === 'overview') await loadOverview();
    } catch (err) {
      setError((err as Error).message || 'Customer action failed.');
    } finally {
      setBusy(false);
    }
  };

  const openTimeline = async (customer: AdminCustomer) => {
    clearBanners();
    setTimelineTarget(customer);
    setTimeline(null);

    try {
      const data = await getAdminCustomerTimeline(customer.user_id);
      setTimeline(data);
    } catch (err) {
      setError((err as Error).message || 'Could not load customer timeline.');
    }
  };

  const openPortfolioDetail = async (row: AdminPortfolioRow) => {
    clearBanners();
    setPortfolioTarget(row);
    setPortfolioDetail(null);

    try {
      const data = await getCustomerFinancialDetail(row.userId);
      setPortfolioDetail(data);
    } catch (err) {
      setError((err as Error).message || 'Could not load portfolio details.');
    }
  };

  const renderPill = (value: string) => (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${statusBadgeClass(value)}`}>
      {value}
    </span>
  );

  const selectJourneyForBuilder = useCallback((journeyName: string) => {
    const row = growthReport?.journeys.find((item) => item.journey === journeyName);
    if (!row) return;
    setSelectedGrowthJourney(row.journey);
    setJourneyBuilder(createGrowthBuilderDraft(row));
    setDraggingBuilderStepId(null);
  }, [growthReport]);

  const patchJourneyBuilder = (patch: Partial<GrowthJourneyBuilderDraft>) => {
    setJourneyBuilder((current) => {
      if (!current) return current;
      return { ...current, ...patch };
    });
  };

  const patchJourneyBuilderStep = (stepId: string, patch: Partial<GrowthJourneyStepDraft>) => {
    setJourneyBuilder((current) => {
      if (!current) return current;
      return {
        ...current,
        steps: current.steps.map((step) => (step.id === stepId ? { ...step, ...patch } : step)),
      };
    });
  };

  const addJourneyBuilderStep = () => {
    setJourneyBuilder((current) => {
      if (!current) return current;
      const nextIndex = current.steps.length;
      const previousDelay = current.steps[nextIndex - 1]?.delayHours || 0;
      return {
        ...current,
        steps: [
          ...current.steps,
          {
            id: `${current.journey.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'journey'}_step_${nextIndex + 1}`,
            title: `Step ${nextIndex + 1}`,
            channel: 'email',
            delayHours: previousDelay + 24,
          },
        ],
      };
    });
  };

  const removeJourneyBuilderStep = (stepId: string) => {
    setJourneyBuilder((current) => {
      if (!current) return current;
      const remaining = current.steps.filter((step) => step.id !== stepId);
      if (!remaining.length) {
        return {
          ...current,
          steps: [{ id: `${current.journey.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_step_1`, title: 'Primary Message', channel: 'in_app', delayHours: 0 }],
        };
      }
      return { ...current, steps: remaining };
    });
  };

  const reorderJourneyBuilderStep = (dragId: string, dropId: string) => {
    setJourneyBuilder((current) => {
      if (!current || dragId === dropId) return current;
      const from = current.steps.findIndex((step) => step.id === dragId);
      const to = current.steps.findIndex((step) => step.id === dropId);
      if (from < 0 || to < 0) return current;
      const nextSteps = [...current.steps];
      const [moved] = nextSteps.splice(from, 1);
      nextSteps.splice(to, 0, moved);
      return { ...current, steps: nextSteps };
    });
  };

  const saveJourneyBuilder = async () => {
    if (!journeyBuilder) {
      setError('Select a journey to save automation flow.');
      return;
    }

    const safeKey = journeyBuilder.journey.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'journey';
    clearBanners();
    setBusy(true);
    try {
      await upsertFeatureFlag({
        flagKey: `campaign.workflow.${safeKey}`,
        enabled: true,
        description: `Campaign automation workflow for ${journeyBuilder.journey}`,
        rolloutPercent: 100,
        config: {
          journey: journeyBuilder.journey,
          triggerType: journeyBuilder.triggerType,
          triggerValue: journeyBuilder.triggerValue,
          steps: journeyBuilder.steps,
          updatedBy: access?.userId || 'admin',
          updatedAt: new Date().toISOString(),
        },
      });
      setSuccess(`Saved ${journeyBuilder.journey} flow.`);
      await loadGrowth();
    } catch (err) {
      setError((err as Error).message || 'Could not save campaign flow.');
    } finally {
      setBusy(false);
    }
  };

  const overviewKpis = useMemo(() => {
    if (!overview) return [];

    return [
      {
        label: 'Total Users',
        value: formatNumber(overview.summary.totalUsers),
        helper: `${formatNumber(overview.summary.newUsers30d)} new in 30d`,
        icon: Users,
      },
      {
        label: 'Onboarding Rate',
        value: `${overview.summary.onboardingRatePct.toFixed(1)}%`,
        helper: `${formatNumber(overview.summary.onboardedUsers)} fully onboarded`,
        icon: CheckCircle2,
      },
      {
        label: 'DAU / MAU',
        value: `${formatNumber(overview.summary.dau)} / ${formatNumber(overview.summary.mau)}`,
        helper: `${overview.summary.engagementPct.toFixed(1)}% engagement`,
        icon: Activity,
      },
      {
        label: 'AUM',
        value: formatCurrency(overview.summary.totalAum),
        helper: 'Assets tagged in customer node',
        icon: Wallet,
      },
      {
        label: 'MTD Revenue',
        value: formatCurrency(overview.summary.mtdRevenue),
        helper: `${overview.summary.paymentSuccessRatePct.toFixed(1)}% payment success`,
        icon: CircleDollarSign,
      },
      {
        label: 'Risk Backlog',
        value: `${formatNumber(overview.summary.pendingKyc)} KYC / ${formatNumber(overview.summary.openFraudFlags)} Fraud`,
        helper: `${formatNumber(overview.summary.blockedUsers)} blocked users`,
        icon: ShieldAlert,
      },
      {
        label: 'Support Backlog',
        value: formatNumber(overview.summary.openTickets),
        helper: 'Open or in-progress tickets',
        icon: Ticket,
      },
      {
        label: 'Active Subscriptions',
        value: formatNumber(overview.summary.activeSubscriptions),
        helper: `${formatNumber(subscriptions.length)} tracked subscriptions`,
        icon: CreditCard,
      },
    ];
  }, [overview, subscriptions.length]);

  const analyticsSeries = useMemo(() => {
    const moduleSeries = analytics?.series || [];
    const overviewSeries = overview?.trends || [];

    if (!moduleSeries.length) return overviewSeries;
    if (!overviewSeries.length) return moduleSeries;
    return moduleSeries.length >= 60 ? moduleSeries : overviewSeries;
  }, [analytics, overview]);

  const analyticsGrowth = useMemo(() => {
    if (!analyticsSeries.length) return null;

    const sumMetric = (
      rows: AdminAnalyticsSnapshot['series'],
      key: 'newUsers' | 'txnCount' | 'revenue' | 'dau'
    ) => rows.reduce((total, row) => total + Number(row[key] || 0), 0);

    const avgMetric = (
      rows: AdminAnalyticsSnapshot['series'],
      key: 'newUsers' | 'txnCount' | 'revenue' | 'dau'
    ) => (rows.length ? sumMetric(rows, key) / rows.length : 0);

    const last30 = analyticsSeries.slice(-30);
    const previous30 = analyticsSeries.slice(-60, -30);

    const current = {
      newUsers: sumMetric(last30, 'newUsers'),
      txnCount: sumMetric(last30, 'txnCount'),
      revenue: sumMetric(last30, 'revenue'),
      avgDau: avgMetric(last30, 'dau'),
    };

    const previous = {
      newUsers: sumMetric(previous30, 'newUsers'),
      txnCount: sumMetric(previous30, 'txnCount'),
      revenue: sumMetric(previous30, 'revenue'),
      avgDau: avgMetric(previous30, 'dau'),
    };

    return {
      current,
      previous,
      deltas: {
        newUsersPct: calculateDeltaPct(current.newUsers, previous.newUsers),
        txnCountPct: calculateDeltaPct(current.txnCount, previous.txnCount),
        revenuePct: calculateDeltaPct(current.revenue, previous.revenue),
        dauPct: calculateDeltaPct(current.avgDau, previous.avgDau),
      },
      efficiency: {
        revenuePerTxn: current.txnCount ? current.revenue / current.txnCount : 0,
        revenuePerDailyActive: current.avgDau ? current.revenue / current.avgDau : 0,
      },
    };
  }, [analyticsSeries]);

  const usageGrowth = useMemo(() => {
    if (!usageReport) return null;

    const funnelMap = new Map((usageReport.funnel || []).map((item) => [item.step, item.users]));
    const onboardingUsers = funnelMap.get('Onboarding Complete') || 0;
    const goalUsers = funnelMap.get('Goal Created') || 0;
    const assetUsers = funnelMap.get('Asset Added') || 0;
    const liabilityUsers = funnelMap.get('Liability Added') || 0;
    const riskUsers = funnelMap.get('Risk Profile Completed') || 0;

    const recent7 = usageReport.trends.slice(-7);
    const previous7 = usageReport.trends.slice(-14, -7);

    const currentEvents7d = recent7.reduce((sum, row) => sum + row.events, 0);
    const previousEvents7d = previous7.reduce((sum, row) => sum + row.events, 0);
    const currentAvgUsers7d = recent7.length
      ? recent7.reduce((sum, row) => sum + row.users, 0) / recent7.length
      : 0;
    const previousAvgUsers7d = previous7.length
      ? previous7.reduce((sum, row) => sum + row.users, 0) / previous7.length
      : 0;

    const keyActions =
      usageReport.totals.goalCreates +
      usageReport.totals.assetAdds +
      usageReport.totals.liabilityAdds +
      usageReport.totals.riskProfilesCompleted;

    const topFiveEventVolume = usageReport.powerUsers
      .slice(0, 5)
      .reduce((sum, row) => sum + row.events, 0);

    return {
      onboardingUsers,
      goalUsers,
      assetUsers,
      liabilityUsers,
      riskUsers,
      activationRatePct: toRate(goalUsers, onboardingUsers),
      assetAdoptionRatePct: toRate(assetUsers, onboardingUsers),
      liabilityAdoptionRatePct: toRate(liabilityUsers, onboardingUsers),
      riskCompletionRatePct: toRate(riskUsers, onboardingUsers),
      eventsMomentumPct: calculateDeltaPct(currentEvents7d, previousEvents7d),
      activeUsersMomentumPct: calculateDeltaPct(currentAvgUsers7d, previousAvgUsers7d),
      actionsPerUser: usageReport.totals.uniqueUsers
        ? keyActions / usageReport.totals.uniqueUsers
        : 0,
      powerUserConcentrationPct: usageReport.totals.totalEvents
        ? (topFiveEventVolume / usageReport.totals.totalEvents) * 100
        : 0,
      currentEvents7d,
      previousEvents7d,
      currentAvgUsers7d,
      previousAvgUsers7d,
    };
  }, [usageReport]);

  const growthTrackingCards = useMemo(() => {
    const cards: Array<{
      label: string;
      value: string;
      helper: string;
      tone: 'up' | 'down' | 'flat';
    }> = [];

    if (analyticsGrowth) {
      cards.push(
        {
          label: 'Acquisition Momentum',
          value: formatDeltaPct(analyticsGrowth.deltas.newUsersPct),
          helper: `${formatNumber(analyticsGrowth.current.newUsers)} users in latest 30d`,
          tone: toneFromDelta(analyticsGrowth.deltas.newUsersPct),
        },
        {
          label: 'Revenue Momentum',
          value: formatDeltaPct(analyticsGrowth.deltas.revenuePct),
          helper: `${formatCurrency(analyticsGrowth.current.revenue)} in latest 30d`,
          tone: toneFromDelta(analyticsGrowth.deltas.revenuePct),
        },
        {
          label: 'Engagement Momentum',
          value: formatDeltaPct(analyticsGrowth.deltas.dauPct),
          helper: `Avg DAU ${formatNumber(round(analyticsGrowth.current.avgDau, 0))}`,
          tone: toneFromDelta(analyticsGrowth.deltas.dauPct),
        }
      );
    }

    if (usageGrowth) {
      const activationTone =
        usageGrowth.activationRatePct == null
          ? 'flat'
          : usageGrowth.activationRatePct >= 35
          ? 'up'
          : usageGrowth.activationRatePct < 20
          ? 'down'
          : 'flat';
      const concentrationTone =
        usageGrowth.powerUserConcentrationPct <= 35
          ? 'up'
          : usageGrowth.powerUserConcentrationPct >= 60
          ? 'down'
          : 'flat';

      cards.push(
        {
          label: 'Activation (Onboarded -> Goal)',
          value: usageGrowth.activationRatePct == null ? 'N/A' : `${round(usageGrowth.activationRatePct, 1).toFixed(1)}%`,
          helper: `${formatNumber(usageGrowth.goalUsers)} of ${formatNumber(usageGrowth.onboardingUsers)} users`,
          tone: activationTone,
        },
        {
          label: 'Weekly Event Velocity',
          value: formatDeltaPct(usageGrowth.eventsMomentumPct),
          helper: `${formatSignedNumber(usageGrowth.currentEvents7d - usageGrowth.previousEvents7d)} vs previous 7d`,
          tone: toneFromDelta(usageGrowth.eventsMomentumPct),
        },
        {
          label: 'Power User Concentration',
          value: `${round(usageGrowth.powerUserConcentrationPct, 1).toFixed(1)}%`,
          helper: 'Top 5 users contribution to total events',
          tone: concentrationTone,
        }
      );
    }

    return cards;
  }, [analyticsGrowth, usageGrowth]);

  const visibleModules = useMemo(
    () => MODULES.filter((module) => can(module.permission)),
    [can]
  );

  const renderOverview = () => {
    return (
      <AdminOverviewModule
        overview={overview}
        overviewKpis={overviewKpis}
        growthTrackingCards={growthTrackingCards}
        toneClass={toneClass}
        formatCurrency={formatCurrency}
        formatNumber={formatNumber}
        formatDate={formatDate}
        renderPill={renderPill}
      />
    );
  };

  const renderCustomers = () => (
    <AdminCustomersModule
      customers={customers}
      customerSearch={customerSearch}
      customerKycFilter={customerKycFilter}
      selectedCustomerIds={selectedCustomerIds}
      selectedCustomerList={selectedCustomerList}
      busy={busy}
      setCustomerSearch={setCustomerSearch}
      setCustomerKycFilter={setCustomerKycFilter}
      setSelectedCustomerIds={setSelectedCustomerIds}
      onLoadCustomers={loadCustomers}
      onExportCustomersCsv={() => exportCustomersCsv(customers)}
      onOpenTimeline={openTimeline}
      onCustomerAction={handleCustomerAction}
      renderPill={renderPill}
      formatDate={formatDate}
    />
  );

  const renderPortfolio = () => (
    <AdminPortfolioModule
      portfolioRows={portfolioRows}
      portfolioSearch={portfolioSearch}
      setPortfolioSearch={setPortfolioSearch}
      onLoadPortfolio={loadPortfolio}
      onOpenPortfolioDetail={openPortfolioDetail}
      renderPill={renderPill}
      formatCurrency={formatCurrency}
      formatNumber={formatNumber}
      formatDate={formatDate}
    />
  );

  const renderPayments = () => (
    <AdminPaymentsModule
      payments={payments}
      subscriptions={subscriptions}
      renderPill={renderPill}
      formatCurrency={formatCurrency}
      formatNumber={formatNumber}
      formatDate={formatDate}
    />
  );

  const renderCompliance = () => (
    <AdminComplianceModule
      kycQueue={kycQueue}
      renderPill={renderPill}
      formatDate={formatDate}
      onApprove={async (item) => {
        setBusy(true);
        try {
          await reviewKyc({ userId: item.user_id, status: 'approved', riskScore: item.risk_score, notes: 'Approved by admin' });
          setSuccess('KYC approved.');
          await loadCompliance();
        } catch (err) {
          setError((err as Error).message || 'KYC approve failed.');
        } finally {
          setBusy(false);
        }
      }}
      onReject={async (item) => {
        setBusy(true);
        try {
          await reviewKyc({ userId: item.user_id, status: 'rejected', riskScore: item.risk_score, notes: 'Rejected by admin' });
          setSuccess('KYC rejected.');
          await loadCompliance();
        } catch (err) {
          setError((err as Error).message || 'KYC rejection failed.');
        } finally {
          setBusy(false);
        }
      }}
    />
  );

  const renderFraud = () => (
    <AdminFraudModule
      fraudQueue={fraudQueue}
      renderPill={renderPill}
      formatCurrency={formatCurrency}
      onResolve={async (flag) => {
        setBusy(true);
        try {
          await resolveFraudFlag(flag.id, 'resolved', 'Resolved via admin queue');
          setSuccess('Fraud flag resolved.');
          await loadFraud();
        } catch (err) {
          setError((err as Error).message || 'Could not resolve fraud flag.');
        } finally {
          setBusy(false);
        }
      }}
    />
  );

  const renderSupport = () => (
    <AdminSupportModule
      supportStatusFilter={supportStatusFilter}
      supportTickets={supportTickets}
      setSupportStatusFilter={setSupportStatusFilter}
      onRefreshSupport={loadSupport}
      onMoveInProgress={async (ticket) => {
        setBusy(true);
        try {
          await updateSupportTicket(ticket.id, { status: 'in_progress' });
          setSuccess('Ticket moved to in_progress.');
          await loadSupport();
        } catch (err) {
          setError((err as Error).message || 'Could not update ticket.');
        } finally {
          setBusy(false);
        }
      }}
      onResolveTicket={async (ticket) => {
        setBusy(true);
        try {
          await updateSupportTicket(ticket.id, { status: 'resolved', resolutionNote: 'Resolved in admin panel' });
          setSuccess('Ticket resolved.');
          await loadSupport();
        } catch (err) {
          setError((err as Error).message || 'Could not resolve ticket.');
        } finally {
          setBusy(false);
        }
      }}
      renderPill={renderPill}
      formatDate={formatDate}
    />
  );

  const renderAccess = () => (
    <AdminAccessModule
      busy={busy}
      adminUsers={adminUsers}
      adminRoles={adminRoles}
      adminPermissions={adminPermissions}
      adminForm={adminForm}
      setAdminForm={setAdminForm}
      twoFactorStatus={twoFactorStatus}
      twoFactorSetup={twoFactorSetup}
      totpCode={totpCode}
      setTotpCode={setTotpCode}
      secondFactorCode={secondFactorCode}
      setSecondFactorCode={setSecondFactorCode}
      recoveryCodesDraft={recoveryCodesDraft}
      setRecoveryCodesDraft={setRecoveryCodesDraft}
      sessionTargetUserId={sessionTargetUserId}
      setSessionTargetUserId={setSessionTargetUserId}
      securitySessions={securitySessions}
      renderPill={renderPill}
      formatDate={formatDate}
      formatNumber={formatNumber}
      onToggleActive={async (admin) => {
        setBusy(true);
        try {
          await upsertAdminUserAccount({
            userId: admin.userId,
            roleId: admin.roleId,
            isActive: !admin.isActive,
            twoFactorRequired: admin.twoFactorRequired,
            reason: admin.isActive ? 'manual_deactivate' : 'manual_activate',
          });
          setSuccess(`User ${admin.isActive ? 'deactivated' : 'activated'}.`);
          await loadAccessModule();
        } catch (err) {
          setError((err as Error).message || 'Could not update user.');
        } finally {
          setBusy(false);
        }
      }}
      onToggleTwoFactorRequirement={async (admin) => {
        setBusy(true);
        try {
          await upsertAdminUserAccount({
            userId: admin.userId,
            roleId: admin.roleId,
            isActive: admin.isActive,
            twoFactorRequired: !admin.twoFactorRequired,
            reason: 'toggle_2fa_requirement',
          });
          setSuccess(`2FA requirement ${admin.twoFactorRequired ? 'removed' : 'enabled'} for user.`);
          await loadAccessModule();
        } catch (err) {
          setError((err as Error).message || 'Could not update 2FA requirement.');
        } finally {
          setBusy(false);
        }
      }}
      onSaveMembership={async () => {
        if (!adminForm.userId.trim() || !adminForm.roleId) {
          setError('User UUID and role are required.');
          return;
        }

        setBusy(true);
        try {
          await upsertAdminUserAccount({
            userId: adminForm.userId.trim(),
            roleId: adminForm.roleId,
            isActive: adminForm.isActive,
            twoFactorRequired: adminForm.twoFactorRequired,
          });
          setSuccess('Workspace user saved.');
          setAdminForm((prev) => ({ ...prev, userId: '' }));
          await loadAccessModule();
        } catch (err) {
          setError((err as Error).message || 'Could not save workspace user.');
        } finally {
          setBusy(false);
        }
      }}
      onGenerateTotpSetup={async () => {
        setBusy(true);
        try {
          const setup = await startAdminTwoFactorSetup();
          setTwoFactorSetup(setup);
          setRecoveryCodesDraft(setup.recoveryCodes.join('\n'));
          setTotpCode('');
          setSuccess('TOTP setup generated. Save recovery codes before verifying.');
          const status = await getAdminTwoFactorStatus();
          setTwoFactorStatus(status);
        } catch (err) {
          setError((err as Error).message || 'Could not start 2FA setup.');
        } finally {
          setBusy(false);
        }
      }}
      onDisableTwoFactor={async () => {
        setBusy(true);
        try {
          await disableAdminTwoFactor('manual_disable_from_admin_panel');
          setTwoFactorSetup(null);
          setRecoveryCodesDraft('');
          setTotpCode('');
          setSecondFactorCode('');
          setTwoFactorStatus(await getAdminTwoFactorStatus());
          setSuccess('2FA disabled for current admin.');
        } catch (err) {
          setError((err as Error).message || 'Could not disable 2FA.');
        } finally {
          setBusy(false);
        }
      }}
      onVerifyEnableTwoFactor={async () => {
        if (!totpCode.trim()) {
          setError('Enter the TOTP code to enable 2FA.');
          return;
        }
        setBusy(true);
        try {
          const status = await confirmAdminTwoFactorSetup(totpCode.trim());
          setTwoFactorStatus(status);
          setTotpCode('');
          setSuccess('2FA enabled successfully.');
          await loadAccessModule();
        } catch (err) {
          setError((err as Error).message || 'Could not confirm 2FA setup.');
        } finally {
          setBusy(false);
        }
      }}
      onVerifyCurrentSession={async () => {
        if (!secondFactorCode.trim()) {
          setError('Enter a TOTP or recovery code.');
          return;
        }
        setBusy(true);
        try {
          const status = await verifyAdminSecondFactor(secondFactorCode.trim());
          setTwoFactorStatus(status);
          setSecondFactorCode('');
          setSuccess('Session verified with second factor.');
        } catch (err) {
          setError((err as Error).message || 'Could not verify second factor.');
        } finally {
          setBusy(false);
        }
      }}
      onSaveRecoveryCodes={async () => {
        const codes = recoveryCodesDraft
          .split('\n')
          .map((row) => row.trim())
          .filter(Boolean);
        if (codes.length < 4) {
          setError('Enter at least 4 recovery codes.');
          return;
        }
        setBusy(true);
        try {
          await regenerateAdminRecoveryCodes(codes);
          setTwoFactorStatus(await getAdminTwoFactorStatus());
          setSuccess('Recovery codes rotated.');
        } catch (err) {
          setError((err as Error).message || 'Could not rotate recovery codes.');
        } finally {
          setBusy(false);
        }
      }}
      onRefreshSessions={loadAccessModule}
      onRevokeSession={async (session) => {
        setBusy(true);
        try {
          await revokeAdminSecuritySession(session.id, 'manual_revoke_from_access_panel');
          setSuccess('Session revoked.');
          await loadAccessModule();
        } catch (err) {
          setError((err as Error).message || 'Could not revoke session.');
        } finally {
          setBusy(false);
        }
      }}
    />
  );

  const renderAudit = () => (
    <AdminAuditModule
      auditActionFilter={auditActionFilter}
      setAuditActionFilter={setAuditActionFilter}
      auditLogs={auditLogs}
      loadAudit={loadAudit}
      renderPill={renderPill}
      formatDate={formatDate}
    />
  );

  const renderAnalytics = () => (
    <AdminAnalyticsModule
      analyticsDays={analyticsDays}
      setAnalyticsDays={setAnalyticsDays}
      analytics={analytics}
      analyticsGrowth={analyticsGrowth}
      loadAnalytics={loadAnalytics}
      toneClass={toneClass}
      toneFromDelta={toneFromDelta}
      formatDeltaPct={formatDeltaPct}
      formatNumber={formatNumber}
      formatCurrency={formatCurrency}
    />
  );

  const blogSeo = useMemo(
    () =>
      evaluateBlogSeo({
        title: blogForm.title,
        excerpt: blogForm.excerpt,
        contentMarkdown: blogForm.contentMarkdown,
        targetKeyword: blogForm.targetKeyword,
        metaTitle: blogForm.metaTitle,
        metaDescription: blogForm.metaDescription,
        ctaText: blogForm.ctaText,
        ctaUrl: blogForm.ctaUrl,
        ogImageUrl: blogForm.ogImageUrl,
      }),
    [
      blogForm.title,
      blogForm.excerpt,
      blogForm.contentMarkdown,
      blogForm.targetKeyword,
      blogForm.metaTitle,
      blogForm.metaDescription,
      blogForm.ctaText,
      blogForm.ctaUrl,
      blogForm.ogImageUrl,
    ]
  );

  const renderUsage = () => (
    <AdminUsageModule
      usageDays={usageDays}
      setUsageDays={setUsageDays}
      usageReport={usageReport}
      usageGrowth={usageGrowth}
      loadUsage={loadUsage}
      toneClass={toneClass}
      toneFromDelta={toneFromDelta}
      formatDeltaPct={formatDeltaPct}
      formatNumber={formatNumber}
      formatDate={formatDate}
      round={round}
    />
  );

  const renderBehavior = () => {
    if (!behaviorReport) {
      return (
        <div className={`${cardClass} p-6`}>
          <h3 className="text-xl font-black tracking-tight text-slate-900">Behavior Intelligence</h3>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Event-level analytics, cohorts, funnels, retention/churn, path analysis, real-time telemetry, rage/dead-click tracking and issue triggers.
          </p>
          <button onClick={loadBehavior} className={`${buttonBase} mt-4 border-teal-200 bg-teal-50 text-teal-700`}>
            Load Behavior Report
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div className={`${cardClass} p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3`}>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Window</label>
            <select
              value={behaviorDays}
              onChange={(event) => setBehaviorDays(Number(event.target.value || 30))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-600"
            >
              <option value={7}>7 Days</option>
              <option value={30}>30 Days</option>
              <option value={60}>60 Days</option>
              <option value={90}>90 Days</option>
              <option value={180}>180 Days</option>
              <option value={365}>365 Days</option>
            </select>
            <button onClick={loadBehavior} className={`${buttonBase} border-teal-200 bg-teal-50 text-teal-700`}>
              Refresh Behavior
            </button>
          </div>
          <p className="text-xs font-semibold text-slate-500">Generated: {formatDate(behaviorReport.generatedAt)}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-5 gap-4">
          <div className={`${cardClass} p-4`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Events</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{formatNumber(behaviorReport.kpis.totalEvents)}</p>
          </div>
          <div className={`${cardClass} p-4`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Active Users</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{formatNumber(behaviorReport.kpis.activeUsers)}</p>
          </div>
          <div className={`${cardClass} p-4`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Retention (W4)</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{formatPct(behaviorReport.kpis.retentionWeek4Pct)}</p>
            <p className="mt-1 text-xs text-slate-500">Churn {formatPct(behaviorReport.kpis.churnPct)}</p>
          </div>
          <div className={`${cardClass} p-4`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Conversion</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{formatPct(behaviorReport.kpis.conversionPct)}</p>
          </div>
          <div className={`${cardClass} p-4`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Rage / Dead</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{formatPct(behaviorReport.kpis.rageClickRatePct)}</p>
            <p className="mt-1 text-xs text-slate-500">Dead {formatPct(behaviorReport.kpis.deadClickRatePct)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 2xl:grid-cols-[1fr_1fr] gap-5">
          <div className={`${cardClass} p-5`}>
            <h3 className="text-lg font-black tracking-tight text-slate-900">Behavioral Cohorts</h3>
            <div className="overflow-auto mt-3">
              <table className="min-w-[620px] lg:min-w-[700px] w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Cohort', 'Users', 'W1', 'W4', 'Churn'].map((header) => (
                      <th key={header} className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {behaviorReport.cohorts.map((row) => (
                    <tr key={row.cohort} className="border-t border-slate-100">
                      <td className="px-3 py-2.5 font-black text-slate-800">{row.cohort}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{formatNumber(row.users)}</td>
                      <td className="px-3 py-2.5 text-xs font-black text-slate-700">{formatPct(row.week1RetentionPct)}</td>
                      <td className="px-3 py-2.5 text-xs font-black text-slate-700">{formatPct(row.week4RetentionPct)}</td>
                      <td className="px-3 py-2.5 text-xs font-black text-rose-600">{formatPct(row.churnPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`${cardClass} p-5`}>
            <h3 className="text-lg font-black tracking-tight text-slate-900">Funnel Drop-Offs</h3>
            <div className="mt-3 space-y-2.5">
              {behaviorReport.funnel.map((row) => (
                <div key={row.step} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-black text-slate-800">{row.step}</p>
                    <p className="text-xs font-black text-slate-700">{formatNumber(row.users)} users</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">Conversion {formatPct(row.conversionPct)} • Drop-off {formatPct(row.dropOffPct)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 2xl:grid-cols-[1fr_1fr] gap-5">
          <div className={`${cardClass} p-5`}>
            <h3 className="text-lg font-black tracking-tight text-slate-900">Path Analysis</h3>
            <div className="overflow-auto mt-3">
              <table className="min-w-[620px] lg:min-w-[700px] w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Path', 'Users', 'Share', 'Gap (min)'].map((header) => (
                      <th key={header} className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {behaviorReport.paths.map((row) => (
                    <tr key={row.path} className="border-t border-slate-100">
                      <td className="px-3 py-2.5 text-xs font-black text-slate-700">{row.path}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{formatNumber(row.users)}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{formatPct(row.sharePct)}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{row.avgStepGapMinutes.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`${cardClass} p-5`}>
            <h3 className="text-lg font-black tracking-tight text-slate-900">Real-Time Event Feed</h3>
            <div className="max-h-72 overflow-auto mt-3 space-y-2 pr-1">
              {behaviorReport.realTime.map((row, idx) => (
                <div key={`${row.eventTime}-${idx}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-black text-slate-800">{row.eventName}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{row.platform}</p>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{row.email || row.userId || 'Unknown user'}</p>
                  <p className="text-xs text-slate-500 mt-1">{row.source} • {row.latencySeconds.toFixed(1)}s • {formatDate(row.eventTime)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 2xl:grid-cols-[1fr_1fr] gap-5">
          <div className={`${cardClass} p-5`}>
            <h3 className="text-lg font-black tracking-tight text-slate-900">Audience & Traffic</h3>
            <div className="overflow-auto mt-3">
              <table className="min-w-[620px] lg:min-w-[700px] w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Source', 'Sessions', 'Users', 'Conversion', 'Bounce Risk'].map((header) => (
                      <th key={header} className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {behaviorReport.traffic.map((row) => (
                    <tr key={row.source} className="border-t border-slate-100">
                      <td className="px-3 py-2.5 text-xs font-black text-slate-700">{row.source}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{formatNumber(row.sessions)}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{formatNumber(row.users)}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{formatPct(row.conversionPct)}</td>
                      <td className="px-3 py-2.5 text-xs text-rose-600 font-black">{formatPct(row.bounceRiskPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`${cardClass} p-5`}>
            <h3 className="text-lg font-black tracking-tight text-slate-900">Cross-Platform + A/B Impact</h3>
            <div className="overflow-auto mt-3">
              <table className="min-w-[620px] lg:min-w-[760px] w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Metric', 'Users', 'Events/Sample', 'Conversion', 'Extra'].map((header) => (
                      <th key={header} className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {behaviorReport.crossPlatform.map((row) => (
                    <tr key={`platform-${row.platform}`} className="border-t border-slate-100">
                      <td className="px-3 py-2.5 text-xs font-black text-slate-700">{row.platform}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{formatNumber(row.users)}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{formatNumber(row.events)}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{formatPct(row.conversionPct)}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">platform split</td>
                    </tr>
                  ))}
                  {behaviorReport.abImpact.slice(0, 4).map((row) => (
                    <tr key={`ab-${row.experiment}`} className="border-t border-slate-100">
                      <td className="px-3 py-2.5 text-xs font-black text-slate-700">{row.experiment}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{formatNumber(row.sampleSize)}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{formatPct(row.variantConversionPct)}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{row.upliftPct == null ? 'N/A' : formatPct(row.upliftPct)}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">{row.confidencePct == null ? 'N/A' : `${row.confidencePct.toFixed(1)}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 2xl:grid-cols-[1fr_0.9fr] gap-5">
          <div className={`${cardClass} p-5`}>
            <h3 className="text-lg font-black tracking-tight text-slate-900">Heatmaps, Session Replay, Issues</h3>
            <div className="overflow-auto mt-3">
              <table className="min-w-[620px] xl:min-w-[820px] 2xl:min-w-[880px] w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Type', 'Label', 'Metric 1', 'Metric 2', 'Metric 3'].map((header) => (
                      <th key={header} className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {behaviorReport.heatmaps.slice(0, 5).map((row) => (
                    <tr key={`heat-${row.screen}-${row.zone}`} className="border-t border-slate-100">
                      <td className="px-3 py-2.5 text-xs font-black text-slate-700">Heatmap</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{row.screen} / {row.zone}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{formatNumber(row.interactions)}</td>
                      <td className="px-3 py-2.5 text-xs text-rose-600">{formatNumber(row.rageClicks)}</td>
                      <td className="px-3 py-2.5 text-xs text-amber-600">{formatNumber(row.deadClicks)}</td>
                    </tr>
                  ))}
                  {behaviorReport.sessionReplays.slice(0, 5).map((row) => (
                    <tr key={`session-${row.sessionId}`} className="border-t border-slate-100">
                      <td className="px-3 py-2.5 text-xs font-black text-slate-700">Session</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{row.sessionId}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{row.durationSec.toFixed(1)}s</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{formatNumber(row.interactions)} interactions</td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">{formatDate(row.lastEventAt)}</td>
                    </tr>
                  ))}
                  {behaviorReport.issues.slice(0, 8).map((row) => (
                    <tr key={`issue-${row.issue}`} className="border-t border-slate-100">
                      <td className="px-3 py-2.5 text-xs font-black text-slate-700">Issue</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{row.issue}</td>
                      <td className="px-3 py-2.5">{renderPill(row.severity)}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{formatNumber(row.users)} users</td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-5">
            <div className={`${cardClass} p-5`}>
              <h3 className="text-lg font-black tracking-tight text-slate-900">Alert Triggers</h3>
              <div className="mt-3 space-y-2.5">
                {behaviorReport.alerts.map((row) => (
                  <div key={row.trigger} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-black text-slate-800">{row.trigger}</p>
                      {renderPill(row.status)}
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{row.metric} • {row.currentValue}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className={`${cardClass} p-5`}>
              <h3 className="text-lg font-black tracking-tight text-slate-900">AI Insights</h3>
              <div className="mt-3 space-y-2.5">
                {behaviorReport.insights.map((row, idx) => (
                  <div key={`${row.title}-${idx}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-black text-slate-800">{row.title}</p>
                      {renderPill(row.severity)}
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{row.detail}</p>
                    <p className="mt-1 text-xs font-black text-slate-700">{row.metric}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCrm = () => {
    if (!crmReport) {
      return (
        <div className={`${cardClass} p-6`}>
          <h3 className="text-xl font-black tracking-tight text-slate-900">Internal CRM & Automation</h3>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Contacts, leads, deal pipeline, automation workflows, templates, scoring, segmentation, and unified timeline.
          </p>
          <button onClick={loadCrm} className={`${buttonBase} mt-4 border-teal-200 bg-teal-50 text-teal-700`}>
            Load CRM Report
          </button>
        </div>
      );
    }

    const pipelineStages = ['new', 'qualified', 'discovery', 'proposal', 'negotiation', 'won', 'lost'];
    const complaintStatusOptions = ['open', 'in_progress', 'waiting_user', 'resolved', 'closed'];
    const complaintPriorityOptions = ['low', 'medium', 'high', 'urgent'];
    const filteredComplaints = crmReport.complaints.filter((ticket) => {
      if (crmComplaintStatusFilter !== 'all' && ticket.status !== crmComplaintStatusFilter) return false;
      if (crmComplaintPriorityFilter !== 'all' && ticket.priority !== crmComplaintPriorityFilter) return false;
      return true;
    });

    return (
      <div className="space-y-5">
        <div className={`${cardClass} p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3`}>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Window</label>
            <select
              value={crmDays}
              onChange={(event) => setCrmDays(Number(event.target.value || 30))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-600"
            >
              <option value={30}>30 Days</option>
              <option value={60}>60 Days</option>
              <option value={90}>90 Days</option>
              <option value={180}>180 Days</option>
              <option value={365}>365 Days</option>
            </select>
            <button onClick={loadCrm} className={`${buttonBase} border-teal-200 bg-teal-50 text-teal-700`}>
              Refresh CRM
            </button>
          </div>
          <p className="text-xs font-semibold text-slate-500">Generated: {formatDate(crmReport.generatedAt)}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-8 gap-4">
          <div className={`${cardClass} p-4`}><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Contacts</p><p className="mt-2 text-2xl font-black text-slate-900">{formatNumber(crmReport.kpis.contacts)}</p></div>
          <div className={`${cardClass} p-4`}><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Leads</p><p className="mt-2 text-2xl font-black text-slate-900">{formatNumber(crmReport.kpis.leads)}</p></div>
          <div className={`${cardClass} p-4`}><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Deals</p><p className="mt-2 text-2xl font-black text-slate-900">{formatNumber(crmReport.kpis.deals)}</p></div>
          <div className={`${cardClass} p-4`}><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pipeline</p><p className="mt-2 text-2xl font-black text-slate-900">{formatCurrency(crmReport.kpis.openPipelineValue)}</p></div>
          <div className={`${cardClass} p-4`}><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Email Open</p><p className="mt-2 text-2xl font-black text-slate-900">{formatPct(crmReport.kpis.emailOpenRatePct)}</p></div>
          <div className={`${cardClass} p-4`}><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Automations</p><p className="mt-2 text-2xl font-black text-slate-900">{formatNumber(crmReport.kpis.workflowsActive)}</p></div>
          <div className={`${cardClass} p-4`}><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Open Complaints</p><p className="mt-2 text-2xl font-black text-slate-900">{formatNumber(crmReport.kpis.openComplaints)}</p><p className="mt-1 text-xs text-slate-500">{formatNumber(crmReport.kpis.complaintTickets)} total</p></div>
          <div className={`${cardClass} p-4`}><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">High Priority</p><p className="mt-2 text-2xl font-black text-slate-900">{formatNumber(crmReport.kpis.highPriorityComplaints)}</p><p className="mt-1 text-xs text-slate-500">{formatNumber(crmReport.kpis.resolvedComplaints)} resolved</p></div>
        </div>

        <div className={`${cardClass} p-5`}>
          <h3 className="text-lg font-black tracking-tight text-slate-900">Deal Pipeline Board</h3>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 2xl:grid-cols-7 gap-3">
            {pipelineStages.map((stage) => {
              const deals = crmReport.deals.filter((deal) => deal.stage.toLowerCase() === stage).slice(0, 4);
              return (
                <div key={stage} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{stage}</p>
                  <div className="mt-2 space-y-2">
                    {deals.map((deal) => (
                      <div key={deal.id} className="rounded-xl border border-slate-200 bg-white p-2">
                        <p className="text-xs font-black text-slate-700">{deal.name}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{formatCurrency(deal.amount)}</p>
                        <select
                          value={deal.stage}
                          onChange={async (event) => {
                            setBusy(true);
                            try {
                              await updateCrmDealStage(deal.id, event.target.value);
                              setSuccess('Deal stage updated.');
                              await loadCrm();
                            } catch (err) {
                              setError((err as Error).message || 'Could not update deal stage.');
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600"
                        >
                          {pipelineStages.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                    {!deals.length && <div className="text-xs text-slate-400">No deals</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 2xl:grid-cols-[1fr_1fr] gap-5">
          <div className={`${cardClass} p-5`}>
            <h3 className="text-lg font-black tracking-tight text-slate-900">Quick Actions</h3>
            <div className="mt-3 space-y-3">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Create Customer Complaint Ticket</p>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input
                    value={crmComplaintForm.userId}
                    onChange={(event) => setCrmComplaintForm((prev) => ({ ...prev, userId: event.target.value }))}
                    placeholder="Customer user UUID"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                  />
                  <input
                    value={crmComplaintForm.subject}
                    onChange={(event) => setCrmComplaintForm((prev) => ({ ...prev, subject: event.target.value }))}
                    placeholder="Complaint subject"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                  />
                  <select
                    value={crmComplaintForm.priority}
                    onChange={(event) => setCrmComplaintForm((prev) => ({ ...prev, priority: event.target.value }))}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    {complaintPriorityOptions.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                  <input
                    value={crmComplaintForm.assignedTo}
                    onChange={(event) => setCrmComplaintForm((prev) => ({ ...prev, assignedTo: event.target.value }))}
                    placeholder="Assign to (admin UUID, optional)"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                  />
                </div>
                <textarea
                  value={crmComplaintForm.description}
                  onChange={(event) => setCrmComplaintForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Complaint details / customer statement"
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                />
                <input
                  value={crmComplaintForm.tags}
                  onChange={(event) => setCrmComplaintForm((prev) => ({ ...prev, tags: event.target.value }))}
                  placeholder="Tags (comma separated): billing, delay, service"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                />
                <button
                  onClick={async () => {
                    if (!crmComplaintForm.userId.trim()) {
                      setError('Customer user UUID is required.');
                      return;
                    }
                    if (!crmComplaintForm.subject.trim()) {
                      setError('Complaint subject is required.');
                      return;
                    }
                    setBusy(true);
                    try {
                      await createCrmComplaintTicket({
                        userId: crmComplaintForm.userId.trim(),
                        subject: crmComplaintForm.subject.trim(),
                        description: crmComplaintForm.description.trim(),
                        priority: crmComplaintForm.priority,
                        assignedTo: crmComplaintForm.assignedTo.trim() || null,
                        tags: crmComplaintForm.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
                      });
                      setSuccess('Complaint ticket created.');
                      setCrmComplaintForm({
                        userId: '',
                        subject: '',
                        description: '',
                        priority: 'medium',
                        assignedTo: '',
                        tags: '',
                      });
                      await loadCrm();
                    } catch (err) {
                      setError((err as Error).message || 'Could not create complaint ticket.');
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className={`${buttonBase} mt-2 border-teal-200 bg-teal-50 text-teal-700`}
                >
                  Create Complaint Ticket
                </button>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Create Lead</p>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input value={crmLeadForm.title} onChange={(event) => setCrmLeadForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Lead title" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" />
                  <input value={crmLeadForm.source} onChange={(event) => setCrmLeadForm((prev) => ({ ...prev, source: event.target.value }))} placeholder="Source" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" />
                </div>
                <button
                  onClick={async () => {
                    if (!crmLeadForm.title.trim()) {
                      setError('Lead title is required.');
                      return;
                    }
                    setBusy(true);
                    try {
                      await upsertCrmLead({
                        title: crmLeadForm.title.trim(),
                        source: crmLeadForm.source.trim(),
                        stage: crmLeadForm.stage,
                        score: crmLeadForm.score,
                        value: crmLeadForm.value,
                        tags: crmLeadForm.tags.split(',').map((item) => item.trim()).filter(Boolean),
                      });
                      setSuccess('Lead saved.');
                      setCrmLeadForm({ title: '', source: 'internal', stage: 'new', score: 35, value: 5000, tags: '' });
                      await loadCrm();
                    } catch (err) {
                      setError((err as Error).message || 'Could not save lead.');
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className={`${buttonBase} mt-2 border-teal-200 bg-teal-50 text-teal-700`}
                >
                  Save Lead
                </button>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Create Deal</p>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input value={crmDealForm.name} onChange={(event) => setCrmDealForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Deal name" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" />
                  <input type="number" value={crmDealForm.amount} onChange={(event) => setCrmDealForm((prev) => ({ ...prev, amount: Number(event.target.value || 0) }))} placeholder="Amount" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" />
                </div>
                <button
                  onClick={async () => {
                    if (!crmDealForm.name.trim()) {
                      setError('Deal name is required.');
                      return;
                    }
                    setBusy(true);
                    try {
                      await upsertCrmDeal({
                        name: crmDealForm.name.trim(),
                        stage: crmDealForm.stage,
                        amount: crmDealForm.amount,
                        probabilityPct: crmDealForm.probabilityPct,
                      });
                      setSuccess('Deal saved.');
                      setCrmDealForm({ name: '', stage: 'discovery', amount: 10000, probabilityPct: 45, expectedCloseAt: '' });
                      await loadCrm();
                    } catch (err) {
                      setError((err as Error).message || 'Could not save deal.');
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className={`${buttonBase} mt-2 border-teal-200 bg-teal-50 text-teal-700`}
                >
                  Save Deal
                </button>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Create Task</p>
                <input value={crmTaskForm.title} onChange={(event) => setCrmTaskForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Task title" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" />
                <button
                  onClick={async () => {
                    if (!crmTaskForm.title.trim()) {
                      setError('Task title is required.');
                      return;
                    }
                    setBusy(true);
                    try {
                      await upsertCrmTask({
                        entityType: crmTaskForm.entityType,
                        title: crmTaskForm.title.trim(),
                        priority: crmTaskForm.priority,
                      });
                      setSuccess('Task saved.');
                      setCrmTaskForm({ title: '', entityType: 'lead', priority: 'medium', dueAt: '' });
                      await loadCrm();
                    } catch (err) {
                      setError((err as Error).message || 'Could not save task.');
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className={`${buttonBase} mt-2 border-teal-200 bg-teal-50 text-teal-700`}
                >
                  Save Task
                </button>
              </div>
            </div>
          </div>

          <div className={`${cardClass} p-5`}>
            <h3 className="text-lg font-black tracking-tight text-slate-900">Workflow, Template & Custom Object</h3>
            <div className="mt-3 space-y-3">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <input value={crmTemplateForm.name} onChange={(event) => setCrmTemplateForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Template name" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" />
                <input value={crmTemplateForm.subject} onChange={(event) => setCrmTemplateForm((prev) => ({ ...prev, subject: event.target.value }))} placeholder="Template subject" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" />
                <button
                  onClick={async () => {
                    if (!crmTemplateForm.name.trim() || !crmTemplateForm.subject.trim()) {
                      setError('Template name and subject are required.');
                      return;
                    }
                    setBusy(true);
                    try {
                      await upsertCrmEmailTemplate({ name: crmTemplateForm.name.trim(), subject: crmTemplateForm.subject.trim(), previewText: crmTemplateForm.previewText });
                      setSuccess('Template saved.');
                      setCrmTemplateForm({ name: '', subject: '', previewText: '', bodyMarkdown: '' });
                      await loadCrm();
                    } catch (err) {
                      setError((err as Error).message || 'Could not save template.');
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className={`${buttonBase} mt-2 border-teal-200 bg-teal-50 text-teal-700`}
                >
                  Save Template
                </button>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <input value={crmWorkflowForm.name} onChange={(event) => setCrmWorkflowForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Workflow name" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" />
                <input value={crmWorkflowForm.trigger} onChange={(event) => setCrmWorkflowForm((prev) => ({ ...prev, trigger: event.target.value }))} placeholder="Trigger event" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" />
                <input value={crmWorkflowForm.conditionLogic} onChange={(event) => setCrmWorkflowForm((prev) => ({ ...prev, conditionLogic: event.target.value }))} placeholder="Condition logic" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" />
                <button
                  onClick={async () => {
                    if (!crmWorkflowForm.name.trim() || !crmWorkflowForm.trigger.trim()) {
                      setError('Workflow name and trigger are required.');
                      return;
                    }
                    setBusy(true);
                    try {
                      await upsertCrmWorkflow({
                        name: crmWorkflowForm.name.trim(),
                        trigger: crmWorkflowForm.trigger.trim(),
                        conditionLogic: crmWorkflowForm.conditionLogic.trim(),
                        channels: crmWorkflowForm.channels.split(',').map((item) => item.trim()).filter(Boolean),
                        stepCount: crmWorkflowForm.stepCount,
                      });
                      setSuccess('Workflow saved.');
                      setCrmWorkflowForm({ name: '', trigger: '', conditionLogic: 'true', channels: 'in_app,email', stepCount: 3, status: 'draft' });
                      await loadCrm();
                    } catch (err) {
                      setError((err as Error).message || 'Could not save workflow.');
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className={`${buttonBase} mt-2 border-teal-200 bg-teal-50 text-teal-700`}
                >
                  Save Workflow
                </button>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <input value={crmCustomObjectForm.objectType} onChange={(event) => setCrmCustomObjectForm((prev) => ({ ...prev, objectType: event.target.value }))} placeholder="Object type" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" />
                <input value={crmCustomObjectForm.title} onChange={(event) => setCrmCustomObjectForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Object title" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" />
                <button
                  onClick={async () => {
                    if (!crmCustomObjectForm.title.trim()) {
                      setError('Custom object title is required.');
                      return;
                    }
                    setBusy(true);
                    try {
                      await upsertCrmCustomObject({
                        objectType: crmCustomObjectForm.objectType.trim(),
                        title: crmCustomObjectForm.title.trim(),
                        status: crmCustomObjectForm.status,
                        score: crmCustomObjectForm.score,
                        properties: JSON.parse(crmCustomObjectForm.propertiesJson || '{}'),
                      });
                      setSuccess('Custom object saved.');
                      setCrmCustomObjectForm({ objectType: 'account_health', title: '', status: 'active', score: 50, propertiesJson: '{}' });
                      await loadCrm();
                    } catch (err) {
                      setError((err as Error).message || 'Could not save custom object.');
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className={`${buttonBase} mt-2 border-teal-200 bg-teal-50 text-teal-700`}
                >
                  Save Object
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className={`${cardClass} p-5`}>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-900">Customer Complaint Tracker</h3>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                Track complaint lifecycle from registration to closure in CRM.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={crmComplaintStatusFilter}
                onChange={(event) => setCrmComplaintStatusFilter(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-600"
              >
                <option value="all">All Status</option>
                {complaintStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <select
                value={crmComplaintPriorityFilter}
                onChange={(event) => setCrmComplaintPriorityFilter(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-600"
              >
                <option value="all">All Priority</option>
                {complaintPriorityOptions.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-auto mt-3">
            <table className="min-w-[700px] xl:min-w-[960px] 2xl:min-w-[1260px] w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['Ticket', 'Customer', 'Subject', 'Priority', 'Status', 'Assigned', 'Updated', 'Actions'].map((header) => (
                    <th key={header} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredComplaints.map((ticket) => (
                  <tr key={ticket.id} className="border-t border-slate-100">
                    <td className="px-3 py-3">
                      <p className="text-sm font-black text-slate-800">#{ticket.ticketNumber}</p>
                      <p className="text-xs text-slate-500">{ticket.userId || '-'}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-sm font-black text-slate-800">{ticket.customerName || 'Unknown User'}</p>
                      <p className="text-xs text-slate-500">{ticket.customerEmail || '-'}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-sm font-semibold text-slate-700">{ticket.subject}</p>
                      <p className="text-xs text-slate-500 line-clamp-2">{ticket.description || '-'}</p>
                    </td>
                    <td className="px-3 py-3">{renderPill(ticket.priority)}</td>
                    <td className="px-3 py-3">{renderPill(ticket.status)}</td>
                    <td className="px-3 py-3 text-xs text-slate-600">{ticket.assignedTo || '-'}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{formatDate(ticket.updatedAt)}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <select
                          value={ticket.status}
                          onChange={async (event) => {
                            setBusy(true);
                            try {
                              await updateSupportTicket(ticket.id, { status: event.target.value });
                              setSuccess('Complaint status updated.');
                              await loadCrm();
                            } catch (err) {
                              setError((err as Error).message || 'Could not update complaint status.');
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600"
                        >
                          {complaintStatusOptions.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        <select
                          value={ticket.priority}
                          onChange={async (event) => {
                            setBusy(true);
                            try {
                              await updateSupportTicket(ticket.id, { priority: event.target.value });
                              setSuccess('Complaint priority updated.');
                              await loadCrm();
                            } catch (err) {
                              setError((err as Error).message || 'Could not update complaint priority.');
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600"
                        >
                          {complaintPriorityOptions.map((priority) => (
                            <option key={priority} value={priority}>
                              {priority}
                            </option>
                          ))}
                        </select>
                        {!['resolved', 'closed'].includes(ticket.status) && (
                          <button
                            onClick={async () => {
                              setBusy(true);
                              try {
                                await updateSupportTicket(ticket.id, {
                                  status: 'resolved',
                                  resolutionNote: 'Resolved from CRM complaint tracker.',
                                });
                                setSuccess('Complaint marked resolved.');
                                await loadCrm();
                              } catch (err) {
                                setError((err as Error).message || 'Could not resolve complaint.');
                              } finally {
                                setBusy(false);
                              }
                            }}
                            className={`${buttonBase} !px-2.5 !py-1.5 border-emerald-200 bg-emerald-50 text-emerald-700`}
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredComplaints.length && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-sm font-semibold text-slate-500">
                      No complaint tickets for selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 2xl:grid-cols-[1fr_1fr] gap-5">
          <div className={`${cardClass} p-5`}>
            <h3 className="text-lg font-black tracking-tight text-slate-900">Contacts & Lead Scoring</h3>
            <div className="overflow-auto mt-3">
              <table className="min-w-[620px] xl:min-w-[780px] 2xl:min-w-[840px] w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Contact', 'Stage', 'Lead Score', 'Tags', 'Last Activity'].map((header) => (
                      <th key={header} className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {crmReport.contacts.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-3 py-2.5">
                        <p className="text-sm font-black text-slate-800">{row.name}</p>
                        <p className="text-xs text-slate-500">{row.email}</p>
                      </td>
                      <td className="px-3 py-2.5">{renderPill(row.stage)}</td>
                      <td className="px-3 py-2.5 text-xs font-black text-slate-700">{formatNumber(row.leadScore)}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">{row.tags.join(', ') || '-'}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">{formatDate(row.lastActivityAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`${cardClass} p-5`}>
            <h3 className="text-lg font-black tracking-tight text-slate-900">Timeline, Tasks, Templates</h3>
            <div className="max-h-80 overflow-auto mt-3 space-y-2 pr-1">
              {crmReport.timeline.slice(0, 20).map((row, idx) => (
                <div key={`${row.time}-${idx}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-black text-slate-800">{row.entity} • {row.action}</p>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{formatDate(row.time)}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{row.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderGrowth = () => {
    if (!growthReport) {
      return (
        <div className={`${cardClass} p-6`}>
          <h3 className="text-xl font-black tracking-tight text-slate-900">Marketing Growth Command Center</h3>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Load the growth report to review customer analytics, cross-channel performance, automation readiness, AI/personalization, testing, integrations, security and ROI.
          </p>
          <button
            onClick={loadGrowth}
            className={`${buttonBase} mt-4 border-teal-200 bg-teal-50 text-teal-700 inline-flex items-center gap-1.5`}
          >
            <RefreshCw size={13} /> Load Growth Report
          </button>
        </div>
      );
    }

    const readinessClass = (value: string) => {
      if (value === 'ready') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      if (value === 'partial') return 'bg-amber-100 text-amber-700 border-amber-200';
      return 'bg-slate-100 text-slate-600 border-slate-200';
    };

    return (
      <div className="space-y-5">
        <div className={`${cardClass} p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3`}>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Window</label>
            <select
              value={growthDays}
              onChange={(event) => setGrowthDays(Number(event.target.value || 30))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-600"
            >
              <option value={30}>30 Days</option>
              <option value={60}>60 Days</option>
              <option value={90}>90 Days</option>
              <option value={180}>180 Days</option>
              <option value={365}>365 Days</option>
            </select>
            <button onClick={loadGrowth} className={`${buttonBase} border-teal-200 bg-teal-50 text-teal-700`}>
              Refresh Growth Report
            </button>
          </div>
          <p className="text-xs font-semibold text-slate-500">Generated: {formatDate(growthReport.generatedAt)}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-5 gap-4">
          <div className={`${cardClass} p-4`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Campaign Reach</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{formatNumber(growthReport.kpis.campaignReachUsers)}</p>
            <p className="mt-1 text-xs text-slate-500">{formatPct(growthReport.kpis.multiChannelReachPct)} multi-channel</p>
          </div>
          <div className={`${cardClass} p-4`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Segmentation Library</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{formatNumber(growthReport.kpis.segmentationCriteriaCount)}</p>
            <p className="mt-1 text-xs text-slate-500">{formatNumber(growthReport.kpis.configuredChannels)} channels configured</p>
          </div>
          <div className={`${cardClass} p-4`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Activation</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{formatPct(growthReport.kpis.goalConversionPct)}</p>
            <p className="mt-1 text-xs text-slate-500">{formatNumber(growthReport.kpis.activeUsers)} active users</p>
          </div>
          <div className={`${cardClass} p-4`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Revenue / ROI</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{formatCurrency(growthReport.kpis.revenueAttributed)}</p>
            <p className={`mt-1 text-xs font-black ${growthReport.kpis.roiPct >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              ROI {formatPct(growthReport.kpis.roiPct)}
            </p>
          </div>
          <div className={`${cardClass} p-4`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Predictive Audiences</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{formatNumber(growthReport.kpis.purchaseLikelyUsers)}</p>
            <p className="mt-1 text-xs text-slate-500">{formatNumber(growthReport.kpis.churnRiskUsers)} churn-risk users</p>
          </div>
        </div>

        <div className={`${cardClass} p-5`}>
          <h3 className="text-lg font-black tracking-tight text-slate-900">Capability Readiness (Marketing Executive View)</h3>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
            {growthReport.capabilities.map((capability) => (
              <div key={capability.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-black text-slate-800">{capability.title}</p>
                  <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${readinessClass(capability.readiness)}`}>
                    {capability.readiness}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-slate-600">{capability.summary}</p>
                <p className="mt-2 text-xs font-black text-slate-700">Coverage: {capability.completionPct}%</p>
                <p className="mt-2 text-[11px] font-black uppercase tracking-widest text-slate-500">Requirements</p>
                <ul className="mt-1 text-xs text-slate-600 space-y-1">
                  {capability.requirements.slice(0, 3).map((item) => (
                    <li key={`${capability.id}-req-${item}`}>• {item}</li>
                  ))}
                </ul>
                {!!capability.gaps.length && (
                  <>
                    <p className="mt-2 text-[11px] font-black uppercase tracking-widest text-rose-500">Gaps</p>
                    <ul className="mt-1 text-xs text-rose-600 space-y-1">
                      {capability.gaps.slice(0, 2).map((item) => (
                        <li key={`${capability.id}-gap-${item}`}>• {item}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 2xl:grid-cols-[1.2fr_0.8fr] gap-5">
          <div className={`${cardClass} p-5`}>
            <h3 className="text-lg font-black tracking-tight text-slate-900">Cross-Channel Engagement Performance</h3>
            <div className="overflow-auto mt-4">
              <table className="min-w-[620px] xl:min-w-[800px] 2xl:min-w-[860px] w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Channel', 'Sent', 'Delivered', 'Opened', 'Clicked', 'Conversions', 'Revenue', 'Fail Rate'].map((header) => (
                      <th key={header} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {growthReport.channels.map((row) => (
                    <tr key={row.channel} className="border-t border-slate-100">
                      <td className="px-3 py-3 font-black text-slate-800">{row.channel}</td>
                      <td className="px-3 py-3 text-xs text-slate-600">{formatNumber(row.sent)}</td>
                      <td className="px-3 py-3 text-xs text-slate-600">{formatNumber(row.delivered)}</td>
                      <td className="px-3 py-3 text-xs text-slate-600">{formatNumber(row.opened)}</td>
                      <td className="px-3 py-3 text-xs text-slate-600">{formatNumber(row.clicked)}</td>
                      <td className="px-3 py-3 text-xs text-slate-600">{formatNumber(row.conversions)}</td>
                      <td className="px-3 py-3 text-xs font-black text-slate-700">{formatCurrency(row.revenue)}</td>
                      <td className="px-3 py-3 text-xs font-black text-slate-700">{formatPct(row.failRatePct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`${cardClass} p-5`}>
            <h3 className="text-lg font-black tracking-tight text-slate-900">Real-Time Transactional Reliability</h3>
            <div className="mt-4 grid grid-cols-1 gap-3">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sent</p>
                <p className="mt-1 text-xl font-black text-slate-900">{formatNumber(growthReport.transactional.sent)}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Failed</p>
                <p className="mt-1 text-xl font-black text-rose-600">{formatNumber(growthReport.transactional.failed)}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Fail Rate</p>
                <p className="mt-1 text-xl font-black text-slate-900">{formatPct(growthReport.transactional.failRatePct)}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Fallback Activations</p>
                <p className="mt-1 text-xl font-black text-slate-900">{formatNumber(growthReport.transactional.fallbackActivations)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 2xl:grid-cols-[1fr_1fr] gap-5">
          <div className={`${cardClass} p-5`}>
            <h3 className="text-lg font-black tracking-tight text-slate-900">Audience Segmentation & Predictive Signals</h3>
            <div className="overflow-auto mt-4">
              <table className="min-w-[620px] lg:min-w-[760px] w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Segment', 'Users', 'Criteria', 'Conversion Rate', 'Churn Risk'].map((header) => (
                      <th key={header} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {growthReport.segments.map((row) => (
                    <tr key={row.segment} className="border-t border-slate-100">
                      <td className="px-3 py-3 font-black text-slate-800">{row.segment}</td>
                      <td className="px-3 py-3 text-xs text-slate-600">{formatNumber(row.users)}</td>
                      <td className="px-3 py-3 text-xs text-slate-500">{row.criteria}</td>
                      <td className="px-3 py-3 text-xs font-black text-slate-700">{formatPct(row.conversionRatePct)}</td>
                      <td className="px-3 py-3 text-xs font-black text-slate-700">{formatPct(row.churnRiskPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`${cardClass} p-5`}>
            <h3 className="text-lg font-black tracking-tight text-slate-900">AI-Driven Insights & Recommendations</h3>
            <div className="mt-4 space-y-2.5">
              {growthReport.insights.map((insight, index) => (
                <div key={`${insight.title}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-black text-slate-800">{insight.title}</p>
                    {renderPill(insight.impact)}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-600">{insight.detail}</p>
                  <p className="mt-2 text-xs font-black text-slate-700">{insight.metric}</p>
                  <p className="mt-1 text-xs font-semibold text-teal-700">Action: {insight.recommendation}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 2xl:grid-cols-[1fr_1fr] gap-5">
          <div className={`${cardClass} p-5 space-y-4`}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-lg font-black tracking-tight text-slate-900">Campaign Automation Studio</h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Visual journey builder with drag-and-drop step orchestration for lifecycle and drip campaigns.
                </p>
              </div>
              <button onClick={saveJourneyBuilder} disabled={busy || !journeyBuilder} className={`${buttonBase} border-teal-200 bg-teal-50 text-teal-700`}>
                Save Flow
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {growthReport.journeys.map((journey) => {
                const active = selectedGrowthJourney === journey.journey;
                return (
                  <button
                    key={`builder-${journey.journey}`}
                    onClick={() => selectJourneyForBuilder(journey.journey)}
                    className={`${buttonBase} !px-2.5 !py-1.5 ${
                      active ? 'border-teal-200 bg-teal-50 text-teal-700' : 'border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    {journey.journey}
                  </button>
                );
              })}
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 space-y-3">
              {!journeyBuilder && (
                <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-600">
                  Select a journey to configure trigger logic and drip sequence.
                </div>
              )}

              {journeyBuilder && (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                    <select
                      value={journeyBuilder.triggerType}
                      onChange={(event) => patchJourneyBuilder({ triggerType: event.target.value as GrowthTriggerType })}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-600"
                    >
                      <option value="event">Event Trigger</option>
                      <option value="behavior">Behavior Trigger</option>
                      <option value="time">Time Trigger</option>
                    </select>
                    <input
                      value={journeyBuilder.triggerValue}
                      onChange={(event) => patchJourneyBuilder({ triggerValue: event.target.value })}
                      placeholder="Trigger expression"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Flow Steps (Drag & Drop)</p>
                      <button onClick={addJourneyBuilderStep} className={`${buttonBase} !px-2.5 !py-1.5 border-slate-200 bg-white text-slate-700`}>
                        Add Step
                      </button>
                    </div>
                    <div className="mt-2 space-y-2">
                      {journeyBuilder.steps.map((step, index) => (
                        <div
                          key={step.id}
                          draggable
                          onDragStart={() => setDraggingBuilderStepId(step.id)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => {
                            if (!draggingBuilderStepId) return;
                            reorderJourneyBuilderStep(draggingBuilderStepId, step.id);
                            setDraggingBuilderStepId(null);
                          }}
                          onDragEnd={() => setDraggingBuilderStepId(null)}
                          className={`rounded-xl border border-slate-200 bg-white p-2.5 ${draggingBuilderStepId === step.id ? 'opacity-60' : ''}`}
                        >
                          <div className="grid grid-cols-1 lg:grid-cols-[1fr_130px_120px_auto] gap-2">
                            <input
                              value={step.title}
                              onChange={(event) => patchJourneyBuilderStep(step.id, { title: event.target.value })}
                              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-semibold text-slate-700"
                              placeholder={`Step ${index + 1} title`}
                            />
                            <select
                              value={step.channel}
                              onChange={(event) => patchJourneyBuilderStep(step.id, { channel: event.target.value })}
                              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-black uppercase tracking-wider text-slate-600"
                            >
                              {['in_app', 'email', 'sms', 'mobile_push', 'web_push', 'whatsapp', 'rcs', 'other'].map((channel) => (
                                <option key={`${step.id}-${channel}`} value={channel}>{channel}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min={0}
                              value={step.delayHours}
                              onChange={(event) => patchJourneyBuilderStep(step.id, { delayHours: Number(event.target.value || 0) })}
                              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-semibold text-slate-700"
                            />
                            <button
                              onClick={() => removeJourneyBuilderStep(step.id)}
                              className={`${buttonBase} !px-2.5 !py-1.5 border-rose-200 bg-rose-50 text-rose-700`}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="overflow-auto">
              <table className="min-w-[560px] lg:min-w-[680px] w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Journey', 'Status', 'Trigger', 'Audience', 'Conversion'].map((header) => (
                      <th key={header} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {growthReport.journeys.map((journey) => (
                    <tr key={journey.journey} className="border-t border-slate-100">
                      <td className="px-3 py-3 font-black text-slate-800">{journey.journey}</td>
                      <td className="px-3 py-3">{renderPill(journey.status)}</td>
                      <td className="px-3 py-3 text-xs text-slate-500">{journey.trigger}</td>
                      <td className="px-3 py-3 text-xs text-slate-600">{formatNumber(journey.activeUsers)}</td>
                      <td className="px-3 py-3 text-xs font-black text-slate-700">{formatPct(journey.conversionPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`${cardClass} p-5`}>
            <h3 className="text-lg font-black tracking-tight text-slate-900">A/B & Optimization Experiments</h3>
            <div className="overflow-auto mt-4">
              <table className="min-w-[560px] lg:min-w-[680px] w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Experiment', 'Status', 'Coverage', 'Conversion', 'Uplift'].map((header) => (
                      <th key={header} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {growthReport.experiments.map((experiment) => (
                    <tr key={experiment.experiment} className="border-t border-slate-100">
                      <td className="px-3 py-3 font-black text-slate-800">{experiment.experiment}</td>
                      <td className="px-3 py-3">{renderPill(experiment.status)}</td>
                      <td className="px-3 py-3 text-xs text-slate-600">{formatPct(experiment.variantCoveragePct)}</td>
                      <td className="px-3 py-3 text-xs text-slate-600">{formatPct(experiment.conversionRatePct)}</td>
                      <td className="px-3 py-3 text-xs font-black text-slate-700">{experiment.upliftPct == null ? 'N/A' : formatPct(experiment.upliftPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 2xl:grid-cols-[1fr_0.9fr] gap-5">
          <div className={`${cardClass} p-5`}>
            <h3 className="text-lg font-black tracking-tight text-slate-900">Integrations & Connectivity</h3>
            <div className="overflow-auto mt-4">
              <table className="min-w-[620px] lg:min-w-[760px] w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Integration', 'Type', 'Status', 'Throughput (24h)', 'Error Rate', 'Last Sync'].map((header) => (
                      <th key={header} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {growthReport.integrations.map((row) => (
                    <tr key={row.integration} className="border-t border-slate-100">
                      <td className="px-3 py-3 font-black text-slate-800">{row.integration}</td>
                      <td className="px-3 py-3 text-xs text-slate-500">{row.type}</td>
                      <td className="px-3 py-3">{renderPill(row.status)}</td>
                      <td className="px-3 py-3 text-xs text-slate-600">{formatNumber(row.throughput24h)}</td>
                      <td className="px-3 py-3 text-xs font-black text-slate-700">{formatPct(row.errorRatePct)}</td>
                      <td className="px-3 py-3 text-xs text-slate-500">{formatDate(row.lastSyncAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`${cardClass} p-5`}>
            <h3 className="text-lg font-black tracking-tight text-slate-900">Security & Governance</h3>
            <div className="mt-4 grid grid-cols-1 gap-3">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Admin Users</p>
                <p className="mt-1 text-xl font-black text-slate-900">{formatNumber(growthReport.governance.adminUsers)}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">2FA Enabled</p>
                <p className="mt-1 text-xl font-black text-slate-900">{formatNumber(growthReport.governance.twoFactorEnabled)}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Workflow Approvals</p>
                <p className="mt-1 text-xl font-black text-slate-900">{formatNumber(growthReport.governance.workflowApprovalEvents)}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">SSO</p>
                <p className="mt-1 text-sm font-black text-slate-900">{growthReport.governance.ssoEnabled ? 'Enabled' : 'Not Enabled'}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">GDPR / CCPA</p>
                <p className="mt-1 text-sm font-black text-slate-900">{growthReport.governance.gdprCcpaControls ? 'Controls Active' : 'Controls Pending'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderBlogs = () => (
    <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-5">
        <div className={`${cardClass} p-4`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
              <Search size={16} className="text-slate-400" />
              <input
                value={blogSearch}
                onChange={(event) => setBlogSearch(event.target.value)}
                placeholder="Search title / keyword / slug"
                className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none"
              />
            </div>
            <select
              value={blogStatusFilter}
              onChange={(event) => setBlogStatusFilter(event.target.value as BlogStatus | 'all')}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-600"
            >
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
            <button onClick={loadBlogs} className={`${buttonBase} border-teal-200 bg-teal-50 text-teal-700`}>Refresh</button>
          </div>
        </div>

        <div className={`${cardClass} p-5`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-black tracking-tight text-slate-900">Blog Library</h3>
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">{blogPosts.length} posts</span>
          </div>

          <div className="max-h-[720px] overflow-auto space-y-2 pr-1">
            {blogPosts.map((post) => (
              <div key={post.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-black text-slate-800">{post.title}</p>
                    <p className="text-xs text-slate-500 mt-1">/{post.slug}</p>
                  </div>
                  {renderPill(post.status)}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <span>SEO {post.organicScore}%</span>
                  <span>•</span>
                  <span>{post.estimatedReadMinutes} min</span>
                  <span>•</span>
                  <span>{post.wordCount} words</span>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  30d: {post.performance30d?.impressions || 0} impressions • {post.performance30d?.clicks || 0} clicks • {post.performance30d?.leads || 0} leads
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setBlogForm(post)}
                    className={`${buttonBase} border-slate-200 bg-white text-slate-700 !px-2.5 !py-1.5`}
                  >
                    Edit
                  </button>
                  {post.status !== 'published' && (
                    <button
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await setAdminBlogPostStatus(post.id, 'published');
                          setSuccess('Post published.');
                          await loadBlogs();
                        } catch (err) {
                          setError((err as Error).message || 'Could not publish post.');
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className={`${buttonBase} border-emerald-200 bg-emerald-50 text-emerald-700 !px-2.5 !py-1.5`}
                    >
                      Publish
                    </button>
                  )}
                  {post.status === 'published' && (
                    <button
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await setAdminBlogPostStatus(post.id, 'draft');
                          setSuccess('Post moved back to draft.');
                          await loadBlogs();
                        } catch (err) {
                          setError((err as Error).message || 'Could not unpublish post.');
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className={`${buttonBase} border-amber-200 bg-amber-50 text-amber-700 !px-2.5 !py-1.5`}
                    >
                      Unpublish
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      const confirmed = window.confirm('Delete this post? This cannot be undone.');
                      if (!confirmed) return;
                      setBusy(true);
                      try {
                        await deleteAdminBlogPost(post.id);
                        setSuccess('Post deleted.');
                        if (blogForm.id === post.id) setBlogForm(createBlogDraft());
                        await loadBlogs();
                      } catch (err) {
                        setError((err as Error).message || 'Could not delete post.');
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className={`${buttonBase} border-rose-200 bg-rose-50 text-rose-700 !px-2.5 !py-1.5`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {!blogPosts.length && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm font-semibold text-slate-500">
                No posts found for this filter.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <div className={`${cardClass} p-5`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-900">{blogForm.id ? 'Edit Blog Post' : 'New SEO Blog Post'}</h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                SEO score: {blogSeo.score}% • {blogSeo.wordCount} words • {blogSeo.readMinutes} min read
              </p>
            </div>
            <button
              onClick={() => setBlogForm(createBlogDraft())}
              className={`${buttonBase} border-slate-200 bg-white text-slate-700 !px-2.5 !py-1.5`}
            >
              New Draft
            </button>
          </div>

          <div className="mt-4 space-y-3">
            <input
              value={blogForm.title}
              onChange={(event) => {
                const title = event.target.value;
                setBlogForm((prev) => ({
                  ...prev,
                  title,
                  slug: prev.id ? prev.slug : (prev.slug || slugify(title)),
                }));
              }}
              placeholder="Blog title (problem + intent keyword)"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            />

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input
                value={blogForm.slug}
                onChange={(event) => setBlogForm((prev) => ({ ...prev, slug: slugify(event.target.value) }))}
                placeholder="slug"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              />
              <select
                value={blogForm.status}
                onChange={(event) => setBlogForm((prev) => ({ ...prev, status: event.target.value as BlogStatus }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              >
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <input
              value={blogForm.targetKeyword}
              onChange={(event) => setBlogForm((prev) => ({ ...prev, targetKeyword: event.target.value }))}
              placeholder="Primary keyword (example: retirement planning india)"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            />
            <input
              value={blogForm.secondaryKeywords.join(', ')}
              onChange={(event) =>
                setBlogForm((prev) => ({
                  ...prev,
                  secondaryKeywords: event.target.value.split(',').map((item) => item.trim()).filter(Boolean),
                }))
              }
              placeholder="Secondary keywords (comma separated)"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            />
            <input
              value={blogForm.tags.join(', ')}
              onChange={(event) =>
                setBlogForm((prev) => ({
                  ...prev,
                  tags: event.target.value.split(',').map((item) => item.trim()).filter(Boolean),
                }))
              }
              placeholder="Tags (goal-planning, insurance, investing)"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            />
            <textarea
              value={blogForm.excerpt}
              onChange={(event) => setBlogForm((prev) => ({ ...prev, excerpt: event.target.value }))}
              rows={3}
              placeholder="Excerpt for search/social preview (120-220 chars)"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            />
            <textarea
              value={blogForm.contentMarkdown}
              onChange={(event) => setBlogForm((prev) => ({ ...prev, contentMarkdown: event.target.value }))}
              rows={12}
              placeholder="Write markdown article content..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            />

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input
                value={blogForm.metaTitle}
                onChange={(event) => setBlogForm((prev) => ({ ...prev, metaTitle: event.target.value }))}
                placeholder="Meta title"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              />
              <input
                value={blogForm.metaDescription}
                onChange={(event) => setBlogForm((prev) => ({ ...prev, metaDescription: event.target.value }))}
                placeholder="Meta description"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              />
              <input
                value={blogForm.canonicalUrl}
                onChange={(event) => setBlogForm((prev) => ({ ...prev, canonicalUrl: event.target.value }))}
                placeholder="Canonical URL"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              />
              <input
                value={blogForm.ogImageUrl}
                onChange={(event) => setBlogForm((prev) => ({ ...prev, ogImageUrl: event.target.value }))}
                placeholder="Open Graph image URL"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              />
              <input
                value={blogForm.ctaText}
                onChange={(event) => setBlogForm((prev) => ({ ...prev, ctaText: event.target.value }))}
                placeholder="CTA text"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              />
              <input
                value={blogForm.ctaUrl}
                onChange={(event) => setBlogForm((prev) => ({ ...prev, ctaUrl: event.target.value }))}
                placeholder="CTA URL"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              />
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Organic Distribution Checklist</p>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              {BLOG_PROMOTION_STEPS.map((step) => (
                <label key={step.key} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(blogForm.promotionChecklist[step.key])}
                    onChange={(event) =>
                      setBlogForm((prev) => ({
                        ...prev,
                        promotionChecklist: {
                          ...prev.promotionChecklist,
                          [step.key]: event.target.checked,
                        },
                      }))
                    }
                  />
                  {step.label}
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={async () => {
              if (!blogForm.title.trim()) {
                setError('Blog title is required.');
                return;
              }

              setBusy(true);
              try {
                const saved = await saveAdminBlogPost({
                  id: blogForm.id || undefined,
                  title: blogForm.title,
                  slug: blogForm.slug,
                  excerpt: blogForm.excerpt,
                  contentMarkdown: blogForm.contentMarkdown,
                  status: blogForm.status,
                  publishedAt: blogForm.publishedAt,
                  scheduledFor: blogForm.scheduledFor,
                  targetKeyword: blogForm.targetKeyword,
                  secondaryKeywords: blogForm.secondaryKeywords,
                  tags: blogForm.tags,
                  metaTitle: blogForm.metaTitle,
                  metaDescription: blogForm.metaDescription,
                  canonicalUrl: blogForm.canonicalUrl,
                  ogImageUrl: blogForm.ogImageUrl,
                  ctaText: blogForm.ctaText,
                  ctaUrl: blogForm.ctaUrl,
                  internalLinkTargets: blogForm.internalLinkTargets,
                  externalReferences: blogForm.externalReferences,
                  schemaType: blogForm.schemaType,
                  faqSchema: blogForm.faqSchema,
                  promotionChecklist: blogForm.promotionChecklist,
                  isFeatured: blogForm.isFeatured,
                });
                setBlogForm(saved);
                setSuccess('Blog post saved.');
                await loadBlogs();
              } catch (err) {
                setError((err as Error).message || 'Could not save blog post.');
              } finally {
                setBusy(false);
              }
            }}
            className={`${buttonBase} mt-4 border-teal-200 bg-teal-50 text-teal-700`}
          >
            Save Blog Post
          </button>
        </div>

        <div className={`${cardClass} p-5`}>
          <h3 className="text-lg font-black tracking-tight text-slate-900">SEO Quality Audit</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">Score is recalculated as you edit. Aim for 80%+ before publishing.</p>
          <div className="mt-3 grid grid-cols-1 gap-2">
            {blogSeo.checks.map((item) => (
              <div key={item.id} className={`rounded-2xl border p-3 ${item.passed ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                <p className="text-xs font-black text-slate-800">{item.label}</p>
                {!item.passed && <p className="mt-1 text-xs text-slate-600">{item.tip}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderOperations = () => (
    <div className="grid grid-cols-1 2xl:grid-cols-[1fr_1fr] gap-5">
      <div className="space-y-5">
        <div className={`${cardClass} p-5`}>
          <h3 className="text-lg font-black tracking-tight text-slate-900">Feature Flags</h3>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              value={flagForm.flagKey}
              onChange={(event) => setFlagForm((prev) => ({ ...prev, flagKey: event.target.value }))}
              placeholder="flag key"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            />
            <input
              value={flagForm.description}
              onChange={(event) => setFlagForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="description"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            />
            <input
              type="number"
              min={0}
              max={100}
              value={flagForm.rolloutPercent}
              onChange={(event) => setFlagForm((prev) => ({ ...prev, rolloutPercent: Number(event.target.value || 0) }))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            />
            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-600">
              <input
                type="checkbox"
                checked={flagForm.enabled}
                onChange={(event) => setFlagForm((prev) => ({ ...prev, enabled: event.target.checked }))}
              />
              Enabled
            </label>
          </div>

          <button
            onClick={async () => {
              if (!flagForm.flagKey.trim()) {
                setError('Flag key is required.');
                return;
              }

              setBusy(true);
              try {
                await upsertFeatureFlag({
                  flagKey: flagForm.flagKey.trim(),
                  enabled: flagForm.enabled,
                  description: flagForm.description.trim() || undefined,
                  rolloutPercent: flagForm.rolloutPercent,
                });
                setSuccess('Feature flag saved.');
                setFlagForm({ flagKey: '', description: '', enabled: false, rolloutPercent: 100 });
                await loadOperations();
              } catch (err) {
                setError((err as Error).message || 'Could not save feature flag.');
              } finally {
                setBusy(false);
              }
            }}
            className={`${buttonBase} mt-3 border-teal-200 bg-teal-50 text-teal-700`}
          >
            Save Flag
          </button>

          <div className="mt-4 max-h-64 overflow-auto space-y-2 pr-1">
            {featureFlags.map((flag) => (
              <div key={flag.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-black text-slate-800">{flag.flag_key}</p>
                    <p className="text-xs text-slate-500">{flag.description || 'No description'}</p>
                  </div>
                  <button
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await upsertFeatureFlag({
                          flagKey: flag.flag_key,
                          enabled: !flag.is_enabled,
                          description: flag.description || undefined,
                          rolloutPercent: flag.rollout_percent,
                          config: flag.config,
                        });
                        setSuccess(`Feature flag ${flag.flag_key} updated.`);
                        await loadOperations();
                      } catch (err) {
                        setError((err as Error).message || 'Could not toggle feature flag.');
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className={`${buttonBase} ${flag.is_enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white text-slate-700'} !px-2.5 !py-1.5`}
                  >
                    {flag.is_enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={`${cardClass} p-5`}>
          <h3 className="text-lg font-black tracking-tight text-slate-900">Webhook Replay Tool</h3>
          <div className="mt-4 max-h-72 overflow-auto space-y-2 pr-1">
            {webhookEvents.map((event) => (
              <div key={event.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-black text-slate-800">{event.provider} / {event.event_type}</p>
                    <p className="text-xs text-slate-500">{event.event_id || event.id}</p>
                  </div>
                  <button
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await replayWebhook(event.id, 'manual replay from admin');
                        setSuccess('Webhook replay queued.');
                        await loadOperations();
                      } catch (err) {
                        setError((err as Error).message || 'Could not replay webhook event.');
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className={`${buttonBase} border-amber-200 bg-amber-50 text-amber-700 !px-2.5 !py-1.5`}
                  >
                    Replay
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-2">Status: {event.status} • Replays: {event.replay_count} • Received: {formatDate(event.received_at)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`${cardClass} p-5 h-fit`}>
        <h3 className="text-lg font-black tracking-tight text-slate-900">Customer Communication</h3>
        <p className="mt-2 text-xs font-semibold text-slate-500">Send in-app operational notice directly from admin console.</p>

        <div className="mt-4 space-y-3">
          <input
            value={communicationForm.userId}
            onChange={(event) => setCommunicationForm((prev) => ({ ...prev, userId: event.target.value }))}
            placeholder="Customer UUID"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          />
          <input
            value={communicationForm.title}
            onChange={(event) => setCommunicationForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Title"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          />
          <textarea
            value={communicationForm.message}
            onChange={(event) => setCommunicationForm((prev) => ({ ...prev, message: event.target.value }))}
            placeholder="Message"
            rows={6}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          />
          <select
            value={communicationForm.channel}
            onChange={(event) => setCommunicationForm((prev) => ({ ...prev, channel: event.target.value }))}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          >
            <option value="in_app">In-App</option>
            <option value="email">Email (future)</option>
            <option value="sms">SMS (future)</option>
          </select>
        </div>

        <button
          onClick={async () => {
            if (!communicationForm.userId.trim() || !communicationForm.title.trim() || !communicationForm.message.trim()) {
              setError('Customer UUID, title and message are required.');
              return;
            }

            setBusy(true);
            try {
              await sendCustomerNotification({
                userId: communicationForm.userId.trim(),
                title: communicationForm.title.trim(),
                message: communicationForm.message.trim(),
                channel: communicationForm.channel,
              });
              setSuccess('Notification queued.');
              setCommunicationForm({ userId: '', title: '', message: '', channel: 'in_app' });
            } catch (err) {
              setError((err as Error).message || 'Could not send notification.');
            } finally {
              setBusy(false);
            }
          }}
          className={`${buttonBase} mt-4 border-teal-200 bg-teal-50 text-teal-700 inline-flex items-center gap-1.5`}
        >
          <Send size={13} /> Send Notice
        </button>
      </div>
    </div>
  );

  const renderModuleBody = () => {
    switch (activeModule) {
      case 'overview':
        return renderOverview();
      case 'customers':
        return renderCustomers();
      case 'portfolio':
        return renderPortfolio();
      case 'payments':
        return renderPayments();
      case 'compliance':
        return renderCompliance();
      case 'fraud':
        return renderFraud();
      case 'support':
        return renderSupport();
      case 'access':
        return renderAccess();
      case 'audit':
        return renderAudit();
      case 'analytics':
        return renderAnalytics();
      case 'usage':
        return renderUsage();
      case 'behavior':
        return renderBehavior();
      case 'growth':
        return renderGrowth();
      case 'crm':
        return renderCrm();
      case 'blogs':
        return renderBlogs();
      case 'operations':
        return renderOperations();
      default:
        return renderOverview();
    }
  };

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="animate-spin text-teal-600 mx-auto" size={30} />
          <p className="mt-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Loading Admin Control Plane</p>
        </div>
      </div>
    );
  }

  if (!access?.isAdmin) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_8%_10%,rgba(20,184,166,0.22),transparent_32%),radial-gradient(circle_at_88%_14%,rgba(59,130,246,0.2),transparent_36%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-6 py-10 md:px-10">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-20 -top-24 h-80 w-80 rounded-full bg-teal-300/30 blur-3xl animate-pulse" />
          <div className="absolute -right-24 top-8 h-96 w-96 rounded-full bg-sky-300/20 blur-3xl animate-pulse" />
          <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-emerald-200/25 blur-3xl animate-pulse" />
        </div>

        <div className="relative max-w-6xl mx-auto grid grid-cols-1 gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-7 shadow-[0_30px_70px_-40px_rgba(15,23,42,0.45)] backdrop-blur md:p-9">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-teal-600">FinVantage / Admin</p>
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                Authorized Access
              </span>
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">Admin Command Login</h1>
            <p className="mt-3 max-w-xl text-sm font-semibold text-slate-600 md:text-base">
              Financial operations, growth analytics, and governance controls in one secure workspace.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Risk & Compliance</p>
                <p className="mt-2 text-sm font-black text-slate-900">KYC, fraud, and governance workflows</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Growth Intelligence</p>
                <p className="mt-2 text-sm font-black text-slate-900">Lifecycle automation and campaign visibility</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Audit Integrity</p>
                <p className="mt-2 text-sm font-black text-slate-900">Immutable action logs and approvals</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Workspace Control</p>
                <p className="mt-2 text-sm font-black text-slate-900">Role-scoped modules and security sessions</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-teal-100 bg-teal-50/75 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-teal-700">What You Can Do</p>
              <ul className="mt-2 space-y-2 text-sm font-semibold text-teal-900">
                <li className="flex items-center gap-2"><ChevronRight size={14} /> Monitor customer risk and compliance queues</li>
                <li className="flex items-center gap-2"><ChevronRight size={14} /> Manage growth automation and engagement performance</li>
                <li className="flex items-center gap-2"><ChevronRight size={14} /> Review operational events and execution reliability</li>
              </ul>
            </div>
          </section>

          <section className="rounded-[2rem] border border-teal-100 bg-white p-7 shadow-[0_30px_70px_-40px_rgba(13,148,136,0.5)] md:p-9">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
                <Shield size={16} />
              </span>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-teal-700">Admin Authentication</p>
            </div>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Sign In</h2>
            <p className="mt-2 text-sm font-semibold text-slate-600">Use your authorized workspace email and password.</p>

            <form className="mt-6 space-y-4" onSubmit={handleLogin}>
              <div className={`rounded-2xl border bg-white px-3 py-2 transition ${loginFocusField === 'email' ? 'border-teal-300 shadow-[0_0_0_3px_rgba(45,212,191,0.15)]' : 'border-slate-200'}`}>
                <label className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Work Email</label>
                <input
                  type="email"
                  autoComplete="username"
                  placeholder="admin@company.com"
                  className="mt-1 w-full bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                  value={loginState.email}
                  onFocus={() => setLoginFocusField('email')}
                  onBlur={() => setLoginFocusField(null)}
                  onChange={(event) => setLoginState((prev) => ({ ...prev, email: event.target.value }))}
                />
              </div>

              <div className={`rounded-2xl border bg-white px-3 py-2 transition ${loginFocusField === 'password' ? 'border-teal-300 shadow-[0_0_0_3px_rgba(45,212,191,0.15)]' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Password</label>
                  <button
                    type="button"
                    onClick={() => setRevealLoginPassword((current) => !current)}
                    className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700"
                  >
                    {revealLoginPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                    {revealLoginPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  type={revealLoginPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Password"
                  className="mt-1 w-full bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                  value={loginState.password}
                  onFocus={() => setLoginFocusField('password')}
                  onBlur={() => {
                    setLoginFocusField(null);
                    setLoginCapsLockOn(false);
                  }}
                  onKeyDown={(event) => setLoginCapsLockOn(event.getModifierState('CapsLock'))}
                  onKeyUp={(event) => setLoginCapsLockOn(event.getModifierState('CapsLock'))}
                  onChange={(event) => setLoginState((prev) => ({ ...prev, password: event.target.value }))}
                />
                {loginCapsLockOn && (
                  <p className="mt-1.5 text-[11px] font-black uppercase tracking-widest text-amber-700">Caps Lock is on</p>
                )}
              </div>

              <button
                disabled={busy}
                type="submit"
                className={`${buttonBase} w-full border-teal-200 bg-teal-50 text-teal-700 !py-3 inline-flex items-center justify-center gap-2 hover:bg-teal-100`}
              >
                {busy ? <RefreshCw size={14} className="animate-spin" /> : <Shield size={14} />}
                {busy ? 'Verifying Access...' : 'Enter Control Plane'}
              </button>
            </form>
            <p className="mt-3 text-xs font-semibold text-slate-500">Authorized admin users only.</p>
          </section>
        </div>

        {safeErrorText && (
          <div className="max-w-6xl mx-auto mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {safeErrorText}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen px-3 sm:px-4 lg:px-5 xl:px-6 2xl:px-8 py-4 sm:py-5 lg:py-6 2xl:py-8">
      <div className="max-w-[1700px] mx-auto grid grid-cols-1 xl:grid-cols-[250px_1fr] 2xl:grid-cols-[290px_1fr] gap-4 lg:gap-5">
        <aside className={`${cardClass} p-4 xl:p-5 h-fit 2xl:sticky 2xl:top-6 2xl:max-h-[calc(100vh-3rem)] 2xl:overflow-auto`}>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-teal-600">FinVantage</p>
          <h2 className="mt-2 text-xl font-black tracking-tight text-slate-900">Admin Control Plane</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">Role: {access.roleName || access.roleKey || 'Unknown'}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Workspace: {access.workspaceName || selectedWorkspaceId || 'Unscoped'}
          </p>

          {Boolean(access.workspaces?.length) && (
            <div className="mt-3">
              <label className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Workspace</label>
              <select
                value={selectedWorkspaceId || ''}
                onChange={(event) => void handleWorkspaceSwitch(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-700"
              >
                {(access.workspaces || []).map((workspace: AdminWorkspaceMembership) => (
                  <option key={workspace.workspaceId} value={workspace.workspaceId}>
                    {workspace.organizationName} / {workspace.workspaceName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-1 gap-1.5">
            {visibleModules.map((module) => {
              const Icon = module.icon;
              const active = module.id === activeModule;
              return (
                <button
                  key={module.id}
                  onClick={() => setActiveModule(module.id)}
                  className={`w-full rounded-2xl px-2.5 xl:px-3 py-2 text-left flex items-center justify-between transition ${
                    active ? 'bg-teal-600 text-white shadow-lg' : 'bg-transparent text-slate-600 hover:bg-teal-50'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5 text-[10px] xl:text-[11px] font-black uppercase tracking-[0.12em] xl:tracking-[0.14em]">
                    <Icon size={14} /> {module.label}
                  </span>
                  <ChevronRight size={14} className={active ? 'opacity-80' : 'opacity-40'} />
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <a href="/" className={`${buttonBase} border-slate-200 bg-white text-slate-700 inline-flex items-center justify-center gap-1.5`}>
              <ArrowLeftRight size={13} /> Client
            </a>
            <button onClick={handleLogout} className={`${buttonBase} border-rose-200 bg-rose-50 text-rose-700 inline-flex items-center justify-center gap-1.5`}>
              <LogOut size={13} /> Logout
            </button>
          </div>
        </aside>

        <section className="min-w-0 space-y-5">
          <div className={`${cardClass} px-4 lg:px-5 py-3 lg:py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3`}>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">{MODULES.find((item) => item.id === activeModule)?.label}</h1>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                Detailed admin telemetry, compliance workflows and operational controls for financial scale.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={refreshModule} disabled={busy} className={`${buttonBase} border-teal-200 bg-teal-50 text-teal-700 inline-flex items-center gap-1.5`}>
                <RefreshCw size={13} className={busy ? 'animate-spin' : ''} /> Refresh
              </button>
              {activeModule === 'customers' && selectedCustomerList.length > 0 && (
                <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-600">
                  <Users size={13} /> {selectedCustomerList.length} selected
                </span>
              )}
            </div>
          </div>

          {safeErrorText && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 inline-flex items-center gap-2">
              <AlertTriangle size={15} /> {safeErrorText}
            </div>
          )}

          {success && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 inline-flex items-center gap-2">
              <CheckCircle2 size={15} /> {success}
            </div>
          )}

          <ModuleErrorBoundary moduleName={activeModule} onRetry={refreshModule}>
            {renderModuleBody()}
          </ModuleErrorBoundary>
        </section>
      </div>

      {timelineTarget && (
        <div className="fixed inset-0 z-[120] bg-slate-950/45 backdrop-blur-sm px-4 py-6 flex justify-end" onClick={() => setTimelineTarget(null)}>
          <div className="w-full max-w-2xl h-full rounded-[2rem] border border-teal-100 bg-white shadow-2xl p-5 overflow-auto" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-teal-600">Customer Timeline</p>
                <h3 className="text-xl font-black tracking-tight text-slate-900 mt-2">{timelineTarget.first_name} {timelineTarget.last_name || ''}</h3>
                <p className="text-xs text-slate-500 mt-1">{timelineTarget.email}</p>
              </div>
              <button onClick={() => setTimelineTarget(null)} className={`${buttonBase} border-slate-200 bg-white text-slate-700 !px-2.5 !py-1.5`}>
                Close
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {(timeline?.timeline || []).map((item, idx) => (
                <div key={`${item.time || 't'}-${idx}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-800">{item.title || item.type || 'Activity'}</p>
                      <p className="text-xs text-slate-500 mt-1">{item.detail || '-'}</p>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{formatDate(item.time)}</span>
                  </div>
                  {typeof item.amount === 'number' && <p className="mt-2 text-xs font-black text-teal-700">Amount: {formatCurrency(item.amount)}</p>}
                </div>
              ))}

              {!timeline?.timeline?.length && (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm font-semibold text-slate-500">
                  No timeline events available for this customer.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {portfolioTarget && (
        <div className="fixed inset-0 z-[120] bg-slate-950/45 backdrop-blur-sm px-4 py-6 flex justify-end" onClick={() => setPortfolioTarget(null)}>
          <div className="w-full max-w-3xl h-full rounded-[2rem] border border-teal-100 bg-white shadow-2xl p-5 overflow-auto" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-teal-600">Portfolio Drilldown</p>
                <h3 className="text-xl font-black tracking-tight text-slate-900 mt-2">{portfolioTarget.name}</h3>
                <p className="text-xs text-slate-500 mt-1">{portfolioTarget.email}</p>
              </div>
              <button onClick={() => setPortfolioTarget(null)} className={`${buttonBase} border-slate-200 bg-white text-slate-700 !px-2.5 !py-1.5`}>
                Close
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Assets</p>
                <p className="mt-2 text-xl font-black text-slate-900">{formatCurrency(portfolioTarget.totalAssets)}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Liabilities</p>
                <p className="mt-2 text-xl font-black text-slate-900">{formatCurrency(portfolioTarget.totalLiabilities)}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Net Worth</p>
                <p className="mt-2 text-xl font-black text-teal-700">{formatCurrency(portfolioTarget.netWorth)}</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <h4 className="text-sm font-black text-slate-800">Assets ({portfolioDetail?.assets?.length || 0})</h4>
                <div className="mt-2 text-xs text-slate-600 space-y-1 max-h-40 overflow-auto">
                  {(portfolioDetail?.assets || []).map((item: any) => (
                    <div key={item.id} className="flex justify-between gap-3">
                      <span>{item.name || item.sub_category || item.category}</span>
                      <span className="font-black text-slate-800">{formatCurrency(Number(item.current_value || 0))}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <h4 className="text-sm font-black text-slate-800">Liabilities ({portfolioDetail?.loans?.length || 0})</h4>
                <div className="mt-2 text-xs text-slate-600 space-y-1 max-h-40 overflow-auto">
                  {(portfolioDetail?.loans || []).map((item: any) => (
                    <div key={item.id} className="flex justify-between gap-3">
                      <span>{item.type || item.source}</span>
                      <span className="font-black text-slate-800">{formatCurrency(Number(item.outstanding_amount || 0))}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <h4 className="text-sm font-black text-slate-800">Recent Transactions ({portfolioDetail?.transactions?.length || 0})</h4>
                <div className="mt-2 text-xs text-slate-600 space-y-1 max-h-40 overflow-auto">
                  {(portfolioDetail?.transactions || []).map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between gap-3">
                      <span>{item.description || item.category}</span>
                      <span className="font-black text-slate-800">{formatCurrency(Number(item.amount || 0))}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-4 right-4 rounded-full border border-white/70 bg-white/90 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 shadow-xl inline-flex items-center gap-2">
        <Flag size={12} className="text-teal-600" />
        Admin Audit Trail Active
        <Bell size={12} className="text-teal-600" />
      </div>
    </div>
  );
};

export default AdminPage;
