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
  Download,
  Flag,
  Layers,
  ListChecks,
  LogOut,
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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts';
import { supabase } from '../../services/supabase';
import { applySeoMeta } from '../../services/seoMeta';
import {
  exportCustomersCsv,
  forceCustomerLogout,
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
  getPayments,
  getPortfolioRows,
  getSubscriptions,
  getSupportTickets,
  getUsageReport,
  getWebhookEvents,
  replayWebhook,
  resolveFraudFlag,
  reviewKyc,
  sendCustomerNotification,
  setCustomerBlocked,
  updateSupportTicket,
  upsertAdminUserAccount,
  upsertFeatureFlag,
} from '../../services/admin/adminService';
import type {
  AdminAccess,
  AdminAnalyticsSnapshot,
  AdminAuditLog,
  AdminCustomer,
  AdminCustomerTimeline,
  AdminFraudFlag,
  AdminKycCase,
  AdminModule,
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

type LoginState = {
  email: string;
  password: string;
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

const CHART_COLORS = ['#0d9488', '#14b8a6', '#f43f5e', '#eab308', '#6366f1', '#8b5cf6', '#84cc16', '#0ea5e9'];

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

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [overview, setOverview] = useState<AdminOverviewReport | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalyticsSnapshot | null>(null);
  const [usageReport, setUsageReport] = useState<AdminUsageReport | null>(null);
  const [usageDays, setUsageDays] = useState(30);

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
  const [adminForm, setAdminForm] = useState({ userId: '', roleId: '', isActive: true, twoFactorEnabled: false });

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

  const selectedCustomerList = useMemo(
    () => customers.filter((customer) => selectedCustomerIds[customer.user_id]),
    [customers, selectedCustomerIds]
  );

  const clearBanners = () => {
    setError(null);
    setSuccess(null);
  };

  const can = useCallback(
    (permission?: string) => {
      if (!permission) return true;
      if (!access?.isAdmin) return false;
      if (access.roleKey === 'super_admin') return true;
      return access.permissions.includes(permission) || access.permissions.includes('*');
    },
    [access]
  );

  const bootAccess = useCallback(async () => {
    setBooting(true);
    clearBanners();

    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setAccess(null);
        return;
      }

      const accessData = await getAdminAccess();
      setAccess(accessData);

      // reset to first available module if current one is not allowed
      const current = MODULES.find((item) => item.id === activeModule);
      const hasPermission = (permission?: string) => {
        if (!permission) return true;
        if (!accessData?.isAdmin) return false;
        if (accessData.roleKey === 'super_admin') return true;
        return accessData.permissions.includes(permission) || accessData.permissions.includes('*');
      };

      if (current?.permission && !hasPermission(current.permission)) {
        const fallback = MODULES.find((item) => hasPermission(item.permission));
        if (fallback) setActiveModule(fallback.id);
      }
    } catch (err) {
      setError((err as Error).message || 'Unable to initialize admin access.');
      setAccess(null);
    } finally {
      setBooting(false);
    }
  }, [activeModule, can]);

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
    bootAccess();
    const { data: authSub } = supabase.auth.onAuthStateChange(() => bootAccess());
    return () => authSub.subscription.unsubscribe();
  }, [bootAccess]);

  const loadOverview = useCallback(async () => {
    const [overviewData, analyticsData] = await Promise.all([
      getAdminOverviewReport(60),
      getAnalyticsSnapshot(180),
    ]);
    setOverview(overviewData);
    setAnalytics(analyticsData);
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
    const [users, roles] = await Promise.all([getAdminUsersWithRoles(), getAdminRoles()]);
    setAdminUsers(users);
    setAdminRoles(roles);
    if (!adminForm.roleId && roles[0]) {
      setAdminForm((prev) => ({ ...prev, roleId: roles[0].id }));
    }
  }, [adminForm.roleId]);

  const loadAudit = useCallback(async () => {
    const rows = await getAdminAuditLogs({ action: auditActionFilter || undefined, limit: 250 });
    setAuditLogs(rows);
  }, [auditActionFilter]);

  const loadAnalytics = useCallback(async () => {
    const data = await getAnalyticsSnapshot(365);
    setAnalytics(data);
  }, []);

  const loadUsage = useCallback(async () => {
    const data = await getUsageReport(usageDays, 30);
    setUsageReport(data);
  }, [usageDays]);

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
    loadBlogs,
    loadOperations,
  ]);

  useEffect(() => {
    refreshModule();
  }, [refreshModule]);

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
      setError((err as Error).message || 'Login failed.');
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

  const visibleModules = useMemo(
    () => MODULES.filter((module) => can(module.permission)),
    [can]
  );

  const renderOverview = () => {
    if (!overview) return null;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {overviewKpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className={`${cardClass} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{kpi.label}</p>
                    <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{kpi.value}</p>
                    <p className="mt-2 text-xs font-semibold text-slate-500">{kpi.helper}</p>
                  </div>
                  <div className="rounded-2xl bg-teal-50 p-2.5 border border-teal-100">
                    <Icon size={18} className="text-teal-700" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.9fr] gap-5">
          <div className={`${cardClass} p-5`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black tracking-tight text-slate-900">Growth & Activity (180 days)</h3>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Revenue, DAU, New Users</span>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics?.series || overview.trends} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#0d9488" strokeWidth={2.3} dot={false} name="Revenue" />
                  <Line yAxisId="right" type="monotone" dataKey="dau" stroke="#f43f5e" strokeWidth={2.3} dot={false} name="DAU" />
                  <Line yAxisId="right" type="monotone" dataKey="newUsers" stroke="#6366f1" strokeWidth={2.2} dot={false} name="New Users" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-5">
            <div className={`${cardClass} p-5`}>
              <h3 className="text-lg font-black tracking-tight text-slate-900">Payments Status Mix</h3>
              <div className="h-56 mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overview.distributions.paymentStatus} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="key" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#0d9488" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={`${cardClass} p-5`}>
              <h3 className="text-lg font-black tracking-tight text-slate-900">KYC + Fraud Distribution</h3>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={overview.distributions.kycStatus} dataKey="count" nameKey="key" outerRadius={60} innerRadius={34}>
                        {overview.distributions.kycStatus.map((entry, idx) => (
                          <Cell key={`kyc-${entry.key}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">KYC</p>
                </div>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={overview.distributions.fraudSeverity} dataKey="count" nameKey="key" outerRadius={60} innerRadius={34}>
                        {overview.distributions.fraudSeverity.map((entry, idx) => (
                          <Cell key={`fraud-${entry.key}`} fill={CHART_COLORS[(idx + 3) % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Fraud</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.9fr] gap-5">
          <div className={`${cardClass} p-5`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black tracking-tight text-slate-900">Top Households by Net Worth</h3>
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">{overview.topCustomers.length} customers</span>
            </div>
            <div className="overflow-auto">
              <table className="min-w-[760px] w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Customer</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Assets</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Liabilities</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Net Worth</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Goals</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.topCustomers.map((row) => (
                    <tr key={row.userId} className="border-t border-slate-100">
                      <td className="px-3 py-3">
                        <p className="font-black text-slate-800 text-sm">{row.name}</p>
                        <p className="text-xs text-slate-500">{row.email}</p>
                      </td>
                      <td className="px-3 py-3 text-xs font-semibold text-slate-600">{formatCurrency(row.totalAssets)}</td>
                      <td className="px-3 py-3 text-xs font-semibold text-slate-600">{formatCurrency(row.totalLiabilities)}</td>
                      <td className="px-3 py-3 text-sm font-black text-teal-700">{formatCurrency(row.netWorth)}</td>
                      <td className="px-3 py-3 text-xs font-semibold text-slate-600">{formatNumber(row.goalCount)}</td>
                      <td className="px-3 py-3 text-xs text-slate-500">{formatDate(row.lastActivityAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`${cardClass} p-5`}>
            <h3 className="text-lg font-black tracking-tight text-slate-900">Operational Alerts</h3>
            <div className="mt-4 space-y-2.5">
              {overview.alerts.map((alert, idx) => (
                <div key={`${alert.title}-${idx}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-black text-slate-800">{alert.title}</p>
                    {renderPill(alert.severity)}
                  </div>
                  <p className="text-xs text-slate-600 mt-1.5">{alert.detail}</p>
                  <p className="text-xs font-black text-slate-700 mt-2">{alert.metric}</p>
                </div>
              ))}

              {!overview.alerts.length && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
                  No critical alerts right now.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCustomers = () => (
    <div className="space-y-5">
      <div className={`${cardClass} p-4`}>
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
            <Search size={16} className="text-slate-400" />
            <input
              className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none"
              placeholder="Search by email, name, or UUID"
              value={customerSearch}
              onChange={(event) => setCustomerSearch(event.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <select
              value={customerKycFilter}
              onChange={(event) => setCustomerKycFilter(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-600"
            >
              <option value="">All KYC</option>
              <option value="not_started">Not Started</option>
              <option value="pending">Pending</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>

            <button onClick={loadCustomers} className={`${buttonBase} border-teal-200 bg-teal-50 text-teal-700`}>
              Apply
            </button>

            <button onClick={() => exportCustomersCsv(customers)} className={`${buttonBase} border-slate-200 bg-white text-slate-700 inline-flex items-center gap-1.5`}>
              <Download size={13} /> CSV
            </button>
          </div>
        </div>
      </div>

      <div className={`${cardClass} overflow-hidden`}>
        <div className="overflow-auto">
          <table className="min-w-[1050px] w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2.5 text-left">
                  <input
                    type="checkbox"
                    checked={customers.length > 0 && selectedCustomerList.length === customers.length}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      const map: Record<string, boolean> = {};
                      if (checked) customers.forEach((item) => (map[item.user_id] = true));
                      setSelectedCustomerIds(map);
                    }}
                  />
                </th>
                {['Customer', 'Country', 'Risk', 'KYC', 'Plan', 'Blocked', 'Updated', 'Actions'].map((header) => (
                  <th key={header} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.user_id} className="border-t border-slate-100 hover:bg-teal-50/35">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedCustomerIds[customer.user_id])}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setSelectedCustomerIds((prev) => {
                          const next = { ...prev };
                          if (checked) next[customer.user_id] = true;
                          else delete next[customer.user_id];
                          return next;
                        });
                      }}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-black text-slate-800 text-sm">{customer.first_name} {customer.last_name || ''}</p>
                    <p className="text-xs text-slate-500">{customer.email}</p>
                  </td>
                  <td className="px-3 py-3 text-xs font-semibold text-slate-600">{customer.country || '-'}</td>
                  <td className="px-3 py-3">{renderPill(customer.risk_level || 'unknown')}</td>
                  <td className="px-3 py-3">{renderPill(customer.kyc_status || 'not_started')}</td>
                  <td className="px-3 py-3 text-xs font-semibold text-slate-600">{customer.plan_code || '-'}</td>
                  <td className="px-3 py-3">{renderPill(customer.blocked ? 'blocked' : 'active')}</td>
                  <td className="px-3 py-3 text-xs text-slate-500">{formatDate(customer.updated_at)}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => openTimeline(customer)}
                        className={`${buttonBase} border-slate-200 bg-white text-slate-700 !px-2.5 !py-1.5`}
                      >
                        Timeline
                      </button>
                      <button
                        onClick={() =>
                          handleCustomerAction(
                            customer.blocked ? 'unblock' : 'block',
                            [customer.user_id],
                            customer.blocked ? undefined : 'Manual risk action'
                          )
                        }
                        className={`${buttonBase} !px-2.5 !py-1.5 ${customer.blocked ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}
                      >
                        {customer.blocked ? 'Unblock' : 'Block'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={`${cardClass} p-4`}> 
        <div className="flex flex-wrap items-center gap-2">
          <button
            disabled={!selectedCustomerList.length || busy}
            onClick={() => handleCustomerAction('block', selectedCustomerList.map((item) => item.user_id), 'Bulk risk action')}
            className={`${buttonBase} border-rose-200 bg-rose-50 text-rose-700`}
          >
            Block ({selectedCustomerList.length})
          </button>
          <button
            disabled={!selectedCustomerList.length || busy}
            onClick={() => handleCustomerAction('unblock', selectedCustomerList.map((item) => item.user_id))}
            className={`${buttonBase} border-emerald-200 bg-emerald-50 text-emerald-700`}
          >
            Unblock
          </button>
          <button
            disabled={!selectedCustomerList.length || busy}
            onClick={() => handleCustomerAction('force_logout', selectedCustomerList.map((item) => item.user_id), 'Bulk admin reset')}
            className={`${buttonBase} border-amber-200 bg-amber-50 text-amber-700`}
          >
            Force Logout
          </button>
        </div>
      </div>
    </div>
  );

  const renderPortfolio = () => (
    <div className="space-y-5">
      <div className={`${cardClass} p-4`}>
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
          <Search size={16} className="text-slate-400" />
          <input
            className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none"
            placeholder="Search household by email/name"
            value={portfolioSearch}
            onChange={(event) => setPortfolioSearch(event.target.value)}
          />
          <button onClick={loadPortfolio} className={`${buttonBase} border-teal-200 bg-teal-50 text-teal-700 !py-1.5`}>
            Search
          </button>
        </div>
      </div>

      <div className={`${cardClass} overflow-hidden`}>
        <div className="overflow-auto">
          <table className="min-w-[1100px] w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['Customer', 'Assets', 'Liabilities', 'Net Worth', 'Goals', 'Txns', 'Risk', 'KYC', 'Last Txn', 'Actions'].map((header) => (
                  <th key={header} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {portfolioRows.map((row) => (
                <tr key={row.userId} className="border-t border-slate-100 hover:bg-teal-50/35">
                  <td className="px-3 py-3">
                    <p className="font-black text-slate-800 text-sm">{row.name}</p>
                    <p className="text-xs text-slate-500">{row.email}</p>
                  </td>
                  <td className="px-3 py-3 text-xs font-semibold text-slate-700">{formatCurrency(row.totalAssets)}</td>
                  <td className="px-3 py-3 text-xs font-semibold text-slate-700">{formatCurrency(row.totalLiabilities)}</td>
                  <td className="px-3 py-3 text-sm font-black text-teal-700">{formatCurrency(row.netWorth)}</td>
                  <td className="px-3 py-3 text-xs font-semibold text-slate-600">{formatNumber(row.goalsCount)}</td>
                  <td className="px-3 py-3 text-xs font-semibold text-slate-600">{formatNumber(row.transactionsCount)}</td>
                  <td className="px-3 py-3">{renderPill(row.riskLevel || 'unknown')}</td>
                  <td className="px-3 py-3">{renderPill(row.kycStatus || 'not_started')}</td>
                  <td className="px-3 py-3 text-xs text-slate-500">{formatDate(row.lastTransactionAt)}</td>
                  <td className="px-3 py-3">
                    <button
                      onClick={() => openPortfolioDetail(row)}
                      className={`${buttonBase} border-slate-200 bg-white text-slate-700 !px-2.5 !py-1.5`}
                    >
                      Drilldown
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderPayments = () => {
    const failedPayments = payments.filter((payment) => ['failed', 'declined'].includes(payment.status.toLowerCase()));

    return (
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-5">
        <div className={`${cardClass} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-black tracking-tight text-slate-900">Payments Ledger</h3>
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">{payments.length} records</span>
          </div>
          <div className="max-h-[560px] overflow-auto space-y-2 pr-1">
            {payments.map((payment) => (
              <div key={payment.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-800">{formatCurrency(payment.amount)} {payment.currency}</p>
                    <p className="text-xs text-slate-500 mt-1">User: {payment.user_id}</p>
                  </div>
                  {renderPill(payment.status)}
                </div>
                <p className="text-xs text-slate-500 mt-2">Provider: {payment.provider} • Attempted: {formatDate(payment.attempted_at)}</p>
                {payment.failure_reason && <p className="text-xs font-semibold text-rose-600 mt-2">Failure: {payment.failure_reason}</p>}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className={`${cardClass} p-5`}>
            <h3 className="text-lg font-black tracking-tight text-slate-900">Payments Risk Snapshot</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Failures</p>
                <p className="text-xl font-black text-rose-600 mt-2">{formatNumber(failedPayments.length)}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Subscriptions</p>
                <p className="text-xl font-black text-slate-900 mt-2">{formatNumber(subscriptions.length)}</p>
              </div>
            </div>
          </div>

          <div className={`${cardClass} p-5`}>
            <h3 className="text-lg font-black tracking-tight text-slate-900">Subscription Monitoring</h3>
            <div className="max-h-[420px] overflow-auto mt-4 space-y-2 pr-1">
              {subscriptions.map((subscription) => (
                <div key={subscription.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black text-slate-800">{subscription.plan_code}</p>
                    {renderPill(subscription.status)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{subscription.user_id}</p>
                  <p className="text-xs font-semibold text-slate-600 mt-2">
                    {formatCurrency(subscription.amount)} {subscription.currency} / {subscription.billing_cycle}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCompliance = () => (
    <div className={`${cardClass} p-5`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-black tracking-tight text-slate-900">KYC Review Queue</h3>
        <span className="text-xs font-black uppercase tracking-wider text-slate-500">{kycQueue.length} records</span>
      </div>

      <div className="overflow-auto">
        <table className="min-w-[920px] w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {['Customer', 'Status', 'Risk Score', 'Risk Band', 'Updated', 'Actions'].map((header) => (
                <th key={header} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {kycQueue.map((item) => (
              <tr key={item.user_id} className="border-t border-slate-100">
                <td className="px-3 py-3">
                  <p className="font-black text-slate-800">{item.email || item.user_id}</p>
                  <p className="text-xs text-slate-500">{item.user_id}</p>
                </td>
                <td className="px-3 py-3">{renderPill(item.status)}</td>
                <td className="px-3 py-3 text-xs font-semibold text-slate-700">{item.risk_score}</td>
                <td className="px-3 py-3 text-xs font-semibold text-slate-700">{item.risk_band || '-'}</td>
                <td className="px-3 py-3 text-xs text-slate-500">{formatDate(item.updated_at)}</td>
                <td className="px-3 py-3">
                  <div className="flex gap-1.5">
                    <button
                      onClick={async () => {
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
                      className={`${buttonBase} border-emerald-200 bg-emerald-50 text-emerald-700 !px-2.5 !py-1.5`}
                    >
                      Approve
                    </button>
                    <button
                      onClick={async () => {
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
                      className={`${buttonBase} border-rose-200 bg-rose-50 text-rose-700 !px-2.5 !py-1.5`}
                    >
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderFraud = () => (
    <div className={`${cardClass} p-5`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-black tracking-tight text-slate-900">Fraud Monitoring Queue</h3>
        <span className="text-xs font-black uppercase tracking-wider text-slate-500">{fraudQueue.length} flags</span>
      </div>

      <div className="overflow-auto">
        <table className="min-w-[980px] w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {['Severity', 'Customer', 'Rule', 'Amount', 'Status', 'Actions'].map((header) => (
                <th key={header} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fraudQueue.map((flag) => (
              <tr key={flag.id} className="border-t border-slate-100">
                <td className="px-3 py-3">{renderPill(flag.severity)}</td>
                <td className="px-3 py-3">
                  <p className="font-black text-slate-800">{flag.email || flag.user_id}</p>
                  <p className="text-xs text-slate-500">{flag.user_id}</p>
                </td>
                <td className="px-3 py-3 text-xs font-semibold text-slate-700">{flag.rule_key}</td>
                <td className="px-3 py-3 text-xs font-semibold text-slate-700">{flag.amount ? formatCurrency(flag.amount) : '-'}</td>
                <td className="px-3 py-3">{renderPill(flag.status)}</td>
                <td className="px-3 py-3">
                  <button
                    onClick={async () => {
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
                    className={`${buttonBase} border-emerald-200 bg-emerald-50 text-emerald-700 !px-2.5 !py-1.5`}
                  >
                    Resolve
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderSupport = () => (
    <div className="space-y-5">
      <div className={`${cardClass} p-4 flex flex-wrap items-center gap-2`}> 
        <select
          value={supportStatusFilter}
          onChange={(event) => setSupportStatusFilter(event.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-600"
        >
          <option value="all">All Tickets</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="waiting_user">Waiting User</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <button onClick={loadSupport} className={`${buttonBase} border-teal-200 bg-teal-50 text-teal-700`}>Refresh Tickets</button>
      </div>

      <div className={`${cardClass} overflow-hidden`}>
        <div className="overflow-auto">
          <table className="min-w-[1080px] w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['Ticket', 'Customer', 'Category', 'Priority', 'Status', 'Updated', 'Actions'].map((header) => (
                  <th key={header} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {supportTickets.map((ticket) => (
                <tr key={ticket.id} className="border-t border-slate-100">
                  <td className="px-3 py-3">
                    <p className="font-black text-slate-800">#{ticket.ticketNumber}</p>
                    <p className="text-xs text-slate-500">{ticket.subject}</p>
                  </td>
                  <td className="px-3 py-3 text-xs font-semibold text-slate-600">{ticket.userId || '-'}</td>
                  <td className="px-3 py-3">{renderPill(ticket.category)}</td>
                  <td className="px-3 py-3">{renderPill(ticket.priority)}</td>
                  <td className="px-3 py-3">{renderPill(ticket.status)}</td>
                  <td className="px-3 py-3 text-xs text-slate-500">{formatDate(ticket.updatedAt)}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1.5">
                      <button
                        onClick={async () => {
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
                        className={`${buttonBase} border-amber-200 bg-amber-50 text-amber-700 !px-2.5 !py-1.5`}
                      >
                        In Progress
                      </button>
                      <button
                        onClick={async () => {
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
                        className={`${buttonBase} border-emerald-200 bg-emerald-50 text-emerald-700 !px-2.5 !py-1.5`}
                      >
                        Resolve
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderAccess = () => (
    <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-5">
      <div className={`${cardClass} p-5`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black tracking-tight text-slate-900">Admin Users & Roles</h3>
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">{adminUsers.length} admins</span>
        </div>

        <div className="overflow-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['Admin', 'Role', '2FA', 'Active', 'Last Login', 'Actions'].map((header) => (
                  <th key={header} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {adminUsers.map((admin) => (
                <tr key={admin.userId} className="border-t border-slate-100">
                  <td className="px-3 py-3">
                    <p className="font-black text-slate-800">{admin.name || admin.email}</p>
                    <p className="text-xs text-slate-500">{admin.email}</p>
                  </td>
                  <td className="px-3 py-3">{renderPill(admin.roleName)}</td>
                  <td className="px-3 py-3">{renderPill(admin.twoFactorEnabled ? 'enabled' : 'disabled')}</td>
                  <td className="px-3 py-3">{renderPill(admin.isActive ? 'active' : 'inactive')}</td>
                  <td className="px-3 py-3 text-xs text-slate-500">{formatDate(admin.lastLoginAt)}</td>
                  <td className="px-3 py-3">
                    <button
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await upsertAdminUserAccount({
                            userId: admin.userId,
                            roleId: admin.roleId,
                            isActive: !admin.isActive,
                            twoFactorEnabled: admin.twoFactorEnabled,
                          });
                          setSuccess(`Admin ${admin.isActive ? 'deactivated' : 'activated'}.`);
                          await loadAccessModule();
                        } catch (err) {
                          setError((err as Error).message || 'Could not update admin user.');
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className={`${buttonBase} ${admin.isActive ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'} !px-2.5 !py-1.5`}
                    >
                      {admin.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={`${cardClass} p-5 h-fit`}>
        <h3 className="text-lg font-black tracking-tight text-slate-900">Add / Update Admin</h3>
        <p className="mt-2 text-xs text-slate-500 font-semibold">Assign role and activation status to a Supabase user UUID.</p>

        <div className="mt-4 space-y-3">
          <input
            value={adminForm.userId}
            onChange={(event) => setAdminForm((prev) => ({ ...prev, userId: event.target.value }))}
            placeholder="User UUID"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          />
          <select
            value={adminForm.roleId}
            onChange={(event) => setAdminForm((prev) => ({ ...prev, roleId: event.target.value }))}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          >
            {adminRoles.map((role) => (
              <option key={role.id} value={role.id}>{role.displayName}</option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-600">
            <input
              type="checkbox"
              checked={adminForm.isActive}
              onChange={(event) => setAdminForm((prev) => ({ ...prev, isActive: event.target.checked }))}
            />
            Active
          </label>
          <label className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-600">
            <input
              type="checkbox"
              checked={adminForm.twoFactorEnabled}
              onChange={(event) => setAdminForm((prev) => ({ ...prev, twoFactorEnabled: event.target.checked }))}
            />
            2FA Enabled (flag)
          </label>
        </div>

        <button
          onClick={async () => {
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
                twoFactorEnabled: adminForm.twoFactorEnabled,
              });
              setSuccess('Admin account saved.');
              setAdminForm((prev) => ({ ...prev, userId: '' }));
              await loadAccessModule();
            } catch (err) {
              setError((err as Error).message || 'Could not save admin account.');
            } finally {
              setBusy(false);
            }
          }}
          className={`${buttonBase} mt-4 border-teal-200 bg-teal-50 text-teal-700`}
        >
          Save Admin Access
        </button>
      </div>
    </div>
  );

  const renderAudit = () => (
    <div className="space-y-5">
      <div className={`${cardClass} p-4 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between`}>
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 w-full sm:max-w-md">
          <Search size={16} className="text-slate-400" />
          <input
            className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none"
            placeholder="Filter by action"
            value={auditActionFilter}
            onChange={(event) => setAuditActionFilter(event.target.value)}
          />
        </div>
        <button onClick={loadAudit} className={`${buttonBase} border-teal-200 bg-teal-50 text-teal-700`}>
          Apply Filter
        </button>
      </div>

      <div className={`${cardClass} overflow-hidden`}>
        <div className="overflow-auto">
          <table className="min-w-[1080px] w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['Timestamp', 'Action', 'Entity', 'Entity Id', 'Admin User', 'Reason'].map((header) => (
                  <th key={header} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id} className="border-t border-slate-100">
                  <td className="px-3 py-3 text-xs text-slate-500">{formatDate(log.createdAt)}</td>
                  <td className="px-3 py-3">{renderPill(log.action)}</td>
                  <td className="px-3 py-3 text-xs font-semibold text-slate-600">{log.entityType}</td>
                  <td className="px-3 py-3 text-xs text-slate-500">{log.entityId || '-'}</td>
                  <td className="px-3 py-3 text-xs text-slate-500">{log.adminUserId}</td>
                  <td className="px-3 py-3 text-xs text-slate-500">{log.reason || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className={`${cardClass} p-4`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">New Users</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{formatNumber(analytics?.totals.newUsers || 0)}</p>
        </div>
        <div className={`${cardClass} p-4`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Transactions</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{formatNumber(analytics?.totals.txnCount || 0)}</p>
        </div>
        <div className={`${cardClass} p-4`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Volume</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{formatCurrency(analytics?.totals.txnAmount || 0)}</p>
        </div>
        <div className={`${cardClass} p-4`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Revenue</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{formatCurrency(analytics?.totals.revenue || 0)}</p>
        </div>
      </div>

      <div className={`${cardClass} p-5`}>
        <h3 className="text-lg font-black tracking-tight text-slate-900 mb-4">Annual Growth Curves</h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={analytics?.series || []} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="newUsers" stroke="#0d9488" strokeWidth={2.3} dot={false} name="New Users" />
              <Line type="monotone" dataKey="txnCount" stroke="#f43f5e" strokeWidth={2.3} dot={false} name="Transactions" />
              <Line type="monotone" dataKey="dau" stroke="#6366f1" strokeWidth={2.2} dot={false} name="DAU" />
              <Line type="monotone" dataKey="revenue" stroke="#eab308" strokeWidth={2.2} dot={false} name="Revenue" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
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
    <div className="space-y-5">
      <div className={`${cardClass} p-4 flex flex-wrap items-center gap-2`}>
        <label className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Window</label>
        <select
          value={usageDays}
          onChange={(event) => setUsageDays(Number(event.target.value || 30))}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-600"
        >
          <option value={7}>7 Days</option>
          <option value={30}>30 Days</option>
          <option value={60}>60 Days</option>
          <option value={90}>90 Days</option>
          <option value={180}>180 Days</option>
          <option value={365}>365 Days</option>
        </select>
        <button onClick={loadUsage} className={`${buttonBase} border-teal-200 bg-teal-50 text-teal-700`}>
          Refresh Usage
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className={`${cardClass} p-4`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Events</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{formatNumber(usageReport?.totals.totalEvents || 0)}</p>
        </div>
        <div className={`${cardClass} p-4`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Unique Users</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{formatNumber(usageReport?.totals.uniqueUsers || 0)}</p>
        </div>
        <div className={`${cardClass} p-4`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Avg Events / User</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{(usageReport?.totals.avgEventsPerUser || 0).toFixed(2)}</p>
        </div>
        <div className={`${cardClass} p-4`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Goal + Asset Actions</p>
          <p className="mt-2 text-2xl font-black text-slate-900">
            {formatNumber((usageReport?.totals.goalCreates || 0) + (usageReport?.totals.assetAdds || 0))}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-5">
        <div className={`${cardClass} p-5`}>
          <h3 className="text-lg font-black tracking-tight text-slate-900 mb-4">Daily Feature Activity</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={usageReport?.trends || []} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="events" stroke="#0d9488" strokeWidth={2.4} dot={false} name="Events" />
                <Line yAxisId="right" type="monotone" dataKey="users" stroke="#6366f1" strokeWidth={2.2} dot={false} name="Active Users" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`${cardClass} p-5`}>
          <h3 className="text-lg font-black tracking-tight text-slate-900">Goal Funnel Signals</h3>
          <div className="mt-4 space-y-2.5">
            {(usageReport?.funnel || []).map((row) => (
              <div key={row.step} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs font-black uppercase tracking-widest text-slate-600">{row.step}</p>
                <p className="mt-1 text-xl font-black text-slate-900">{formatNumber(row.users)}</p>
              </div>
            ))}
            {!(usageReport?.funnel || []).length && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm font-semibold text-slate-500">
                No funnel events captured yet.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-5">
        <div className={`${cardClass} p-5`}>
          <h3 className="text-lg font-black tracking-tight text-slate-900 mb-3">Top Features Used</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(usageReport?.topEvents || []).slice(0, 10)} margin={{ top: 10, right: 12, left: -8, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="eventName" tick={{ fontSize: 9, fill: '#64748b' }} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip />
                <Bar dataKey="events" fill="#0d9488" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`${cardClass} p-5`}>
          <h3 className="text-lg font-black tracking-tight text-slate-900 mb-3">Module Opens (View-level)</h3>
          <div className="max-h-72 overflow-auto space-y-2 pr-1">
            {(usageReport?.moduleUsage || []).map((row) => (
              <div key={row.module} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-slate-800">{row.module}</p>
                  <p className="text-xs font-semibold text-slate-500">{row.avgPerUser.toFixed(2)} / user</p>
                </div>
                <p className="mt-1 text-xs font-semibold text-slate-600">
                  {formatNumber(row.opens)} opens • {formatNumber(row.users)} users
                </p>
              </div>
            ))}
            {!(usageReport?.moduleUsage || []).length && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm font-semibold text-slate-500">
                Module activity will appear once events are captured.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-5">
        <div className={`${cardClass} p-5`}>
          <h3 className="text-lg font-black tracking-tight text-slate-900 mb-3">Power Users</h3>
          <div className="overflow-auto">
            <table className="min-w-[640px] w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['User', 'Events', 'Top Action', 'Last Seen'].map((header) => (
                    <th key={header} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(usageReport?.powerUsers || []).map((row) => (
                  <tr key={row.userId} className="border-t border-slate-100">
                    <td className="px-3 py-3">
                      <p className="font-black text-slate-800 text-sm">{row.name || row.email}</p>
                      <p className="text-xs text-slate-500">{row.email}</p>
                    </td>
                    <td className="px-3 py-3 text-xs font-semibold text-slate-700">{formatNumber(row.events)}</td>
                    <td className="px-3 py-3 text-xs font-semibold text-slate-700">{row.topEvent || '-'}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{formatDate(row.lastEventAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={`${cardClass} p-5`}>
          <h3 className="text-lg font-black tracking-tight text-slate-900 mb-3">Recent Customer Events</h3>
          <div className="max-h-80 overflow-auto space-y-2 pr-1">
            {(usageReport?.recentActivity || []).map((row, idx) => (
              <div key={`${row.eventTime}-${idx}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-black text-slate-800">{row.eventName}</p>
                    <p className="text-xs text-slate-500">{row.email || row.userId || 'Unknown user'}</p>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{formatDate(row.eventTime)}</span>
                </div>
              </div>
            ))}
            {!(usageReport?.recentActivity || []).length && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm font-semibold text-slate-500">
                No events yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderBlogs = () => (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.95fr_1.05fr]">
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
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-5">
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
      <div className="min-h-screen px-6 py-10 md:px-10">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-5">
          <div className={`${cardClass} p-7`}>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-teal-600">FinVantage / Admin</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Secure Operations Control Plane</h1>
            <p className="mt-3 text-sm font-semibold text-slate-600">
              Sign in with your Supabase credentials. Access is allowed only for users mapped in <code>admin_users</code>.
            </p>

            <form className="mt-6 space-y-3" onSubmit={handleLogin}>
              <input
                type="email"
                autoComplete="username"
                placeholder="admin@company.com"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700"
                value={loginState.email}
                onChange={(event) => setLoginState((prev) => ({ ...prev, email: event.target.value }))}
              />
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700"
                value={loginState.password}
                onChange={(event) => setLoginState((prev) => ({ ...prev, password: event.target.value }))}
              />
              <button disabled={busy} type="submit" className={`${buttonBase} w-full border-teal-200 bg-teal-50 text-teal-700 !py-3`}>
                {busy ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>
          </div>

          <div className={`${cardClass} p-6`}>
            <h2 className="text-xl font-black tracking-tight text-slate-900">Admin capabilities</h2>
            <ul className="mt-4 space-y-2 text-sm font-semibold text-slate-600">
              <li className="flex items-center gap-2"><ChevronRight size={14} /> Comprehensive executive overview with risk + growth telemetry</li>
              <li className="flex items-center gap-2"><ChevronRight size={14} /> Customer lifecycle controls: block, unblock, forced session reset</li>
              <li className="flex items-center gap-2"><ChevronRight size={14} /> KYC review, fraud queue and operational support workflows</li>
              <li className="flex items-center gap-2"><ChevronRight size={14} /> Portfolio drilldowns and transaction-level visibility</li>
              <li className="flex items-center gap-2"><ChevronRight size={14} /> Access control and immutable audit visibility</li>
            </ul>
          </div>
        </div>

        {error && (
          <div className="max-w-5xl mx-auto mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 md:px-8 py-6 md:py-8">
      <div className="max-w-[1700px] mx-auto grid grid-cols-1 xl:grid-cols-[290px_1fr] gap-5">
        <aside className={`${cardClass} p-5 h-fit xl:sticky xl:top-6`}>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-teal-600">FinVantage</p>
          <h2 className="mt-2 text-xl font-black tracking-tight text-slate-900">Admin Control Plane</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">Role: {access.roleName || access.roleKey || 'Unknown'}</p>

          <div className="mt-5 space-y-1.5">
            {visibleModules.map((module) => {
              const Icon = module.icon;
              const active = module.id === activeModule;
              return (
                <button
                  key={module.id}
                  onClick={() => setActiveModule(module.id)}
                  className={`w-full rounded-2xl px-3 py-2.5 text-left flex items-center justify-between transition ${
                    active ? 'bg-teal-600 text-white shadow-lg' : 'bg-transparent text-slate-600 hover:bg-teal-50'
                  }`}
                >
                  <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em]">
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

        <section className="space-y-5">
          <div className={`${cardClass} px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3`}>
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

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 inline-flex items-center gap-2">
              <AlertTriangle size={15} /> {error}
            </div>
          )}

          {success && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 inline-flex items-center gap-2">
              <CheckCircle2 size={15} /> {success}
            </div>
          )}

          {renderModuleBody()}
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
