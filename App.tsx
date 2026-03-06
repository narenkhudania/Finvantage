// App.tsx — all original auth/session/routing code preserved.
// Updated: saveFinanceData() now returns DB-assigned UUIDs which
// are merged back into state so subsequent saves use real UUIDs.

import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Onboarding from './components/Onboarding';
import Landing from './components/Landing';
import Settings from './components/Settings';
import RewardCelebration, { type RewardCelebrationPayload } from './components/RewardCelebration';
import { FinanceState, View, DetailedIncome } from './types';
import { LayoutDashboard, Bell, ListChecks, Cloud, CloudOff, Loader2 } from 'lucide-react';
import { supabase } from './services/supabase';
import { signOut } from './services/authService';
import { saveFinanceData, loadFinanceData } from './services/dbService';
import { getSelfAdminFlag } from './services/admin/adminService';
import { flushActivityEvents, setUsageTrackingUserId, trackEvent } from './services/usageTracking';
import { awardUsagePoints, getBillingSnapshot, type BillingSnapshot } from './services/billingService';
import { getJourneyProgress } from './lib/journey';
import { setActiveCountry } from './lib/currency';
import { applySeoMeta } from './services/seoMeta';
import { monthlyIncomeFromDetailed } from './lib/incomeMath';
import {
  buildDataShareReminderNotification,
  recordDataSharePrompt,
  shouldShowDataShareReminder,
} from './lib/dataSharingReminder';

const LOCAL_KEY        = 'finvantage_active_session';
const SAVE_DEBOUNCE_MS = 1500;

const AIAdvisor = lazy(() => import('./components/AIAdvisor'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const Transactions = lazy(() => import('./components/Transactions'));
const Goals = lazy(() => import('./components/Goals'));
const GoalSummary = lazy(() => import('./components/GoalSummary'));
const TaxEstate = lazy(() => import('./components/TaxEstate'));
const RetirementPlan = lazy(() => import('./components/RetirementPlan'));
const Family = lazy(() => import('./components/Family'));
const InflowProfile = lazy(() => import('./components/InflowProfile'));
const OutflowProfile = lazy(() => import('./components/OutflowProfile'));
const Insurances = lazy(() => import('./components/Insurances'));
const Assets = lazy(() => import('./components/Assets'));
const Liabilities = lazy(() => import('./components/Liabilities'));
const RiskProfile = lazy(() => import('./components/RiskProfile'));
const InvestmentPlan = lazy(() => import('./components/InvestmentPlan'));
const ActionPlan = lazy(() => import('./components/ActionPlan'));
const MonthlySavingsPlan = lazy(() => import('./components/MonthlySavingsPlan'));
const Notifications = lazy(() => import('./components/Notifications'));
const Cashflow = lazy(() => import('./components/Cashflow'));
const SupportDeskPage = lazy(async () => ({
  default: (await import('./components/site/PublicInfoPages')).SupportDeskPage,
}));
const StaticInfoPage = lazy(async () => ({
  default: (await import('./components/site/PublicInfoPages')).StaticInfoPage,
}));
const BillingManagePage = lazy(async () => ({
  default: (await import('./components/site/BillingPages')).BillingManagePage,
}));
const BillingLegalPage = lazy(async () => ({
  default: (await import('./components/site/BillingPages')).BillingLegalPage,
}));
const BlogIndexPage = lazy(() => import('./components/blog/BlogIndexPage'));
const BlogPostPage = lazy(() => import('./components/blog/BlogPostPage'));

const INITIAL_INCOME: DetailedIncome = {
  salary: 0, bonus: 0, reimbursements: 0,
  business: 0, rental: 0, investment: 0, pension: 0, expectedIncrease: 6,
};

const INITIAL_STATE: FinanceState = {
  isRegistered: false,
  onboardingStep: 0,
  profile: {
    firstName: '', lastName: '', dob: '', mobile: '', email: '',
    lifeExpectancy: 85, retirementAge: 60, pincode: '', city: '',
    state: '', country: 'India', incomeSource: 'salaried',
    income: { ...INITIAL_INCOME }, monthlyExpenses: 0,
  },
  family: [], detailedExpenses: [], cashflows: [], investmentCommitments: [], assets: [], loans: [],
  insurance: [],
  insuranceAnalysis: {
    inflation: 6,
    termInsuranceAmount: 0,
    healthInsuranceAmount: 0,
    liabilityCovers: {},
    goalCovers: {},
    assetCovers: { financial: 50, personal: 0, inheritance: 100 },
    inheritanceValue: 0,
  },
  discountSettings: {
    useBuckets: false,
    defaultDiscountRate: 10.15,
    useBucketInflation: false,
    defaultInflationRate: 6,
    buckets: [
      { id: 'bucket-short', name: 'Short-Term', startType: 'Offset', startOffset: 0, endType: 'Offset', endOffset: 3, discountRate: 8, inflationRate: 6 },
      { id: 'bucket-medium', name: 'Medium-Term', startType: 'Offset', startOffset: 4, endType: 'Offset', endOffset: 5, discountRate: 9, inflationRate: 6 },
      { id: 'bucket-long', name: 'Long-Term', startType: 'Offset', startOffset: 6, endType: 'Retirement', endOffset: 0, discountRate: 10.15, inflationRate: 6 },
      { id: 'bucket-post', name: 'Post-Retirement', startType: 'Retirement', startOffset: 0, endType: 'Infinity', discountRate: 11.5, inflationRate: 6 },
    ],
  },
  goals: [],
  estate: { hasWill: false, nominationsUpdated: false },
  transactions: [],
  notifications: [{
    id: 'welcome-1', title: 'System Online',
    message: 'Initialize your financial node to begin long-term projections.',
    type: 'success', timestamp: new Date().toISOString(), read: false,
  }],
  riskProfile: undefined,
};

const normalizeState = (raw: Partial<FinanceState> | null | undefined): FinanceState => {
  const base = INITIAL_STATE;
  const profile = {
    ...base.profile,
    ...(raw?.profile || {}),
    income: {
      ...base.profile.income,
      ...((raw?.profile as any)?.income || {}),
    },
  };

  return {
    ...base,
    ...(raw || {}),
    profile,
    family: Array.isArray(raw?.family) ? raw!.family : base.family,
    detailedExpenses: Array.isArray(raw?.detailedExpenses) ? raw!.detailedExpenses : base.detailedExpenses,
    cashflows: Array.isArray(raw?.cashflows) ? raw!.cashflows : base.cashflows,
    investmentCommitments: Array.isArray(raw?.investmentCommitments) ? raw!.investmentCommitments : base.investmentCommitments,
    assets: Array.isArray(raw?.assets) ? raw!.assets : base.assets,
    loans: Array.isArray(raw?.loans) ? raw!.loans : base.loans,
    insurance: Array.isArray(raw?.insurance) ? raw!.insurance : base.insurance,
    insuranceAnalysis: {
      ...base.insuranceAnalysis,
      ...(raw?.insuranceAnalysis || {}),
      termInsuranceAmount: Number(
        (raw?.insuranceAnalysis as any)?.termInsuranceAmount
          ?? ((raw?.insuranceAnalysis as any)?.insuranceType === 'Term'
              ? (raw?.insuranceAnalysis as any)?.insuranceAmount
              : undefined)
          ?? (raw?.insuranceAnalysis as any)?.existingInsurance
          ?? (raw?.insuranceAnalysis as any)?.immediateAnnualValue
          ?? base.insuranceAnalysis.termInsuranceAmount,
      ),
      healthInsuranceAmount: Number(
        (raw?.insuranceAnalysis as any)?.healthInsuranceAmount
          ?? ((raw?.insuranceAnalysis as any)?.insuranceType === 'Health'
              ? (raw?.insuranceAnalysis as any)?.insuranceAmount
              : undefined)
          ?? base.insuranceAnalysis.healthInsuranceAmount,
      ),
      liabilityCovers: (raw?.insuranceAnalysis as any)?.liabilityCovers ?? base.insuranceAnalysis.liabilityCovers,
      goalCovers: (raw?.insuranceAnalysis as any)?.goalCovers ?? base.insuranceAnalysis.goalCovers,
      assetCovers: (raw?.insuranceAnalysis as any)?.assetCovers ?? base.insuranceAnalysis.assetCovers,
    },
    discountSettings: {
      ...base.discountSettings,
      ...(raw?.discountSettings || {}),
      buckets: Array.isArray((raw?.discountSettings as any)?.buckets)
        ? (raw?.discountSettings as any).buckets
        : base.discountSettings.buckets,
    },
    goals: Array.isArray(raw?.goals) ? raw!.goals : base.goals,
    transactions: Array.isArray(raw?.transactions) ? raw!.transactions : base.transactions,
    notifications: Array.isArray(raw?.notifications) ? raw!.notifications : base.notifications,
    estate: { ...base.estate, ...(raw?.estate || {}) },
    riskProfile: raw?.riskProfile ?? base.riskProfile,
  };
};

const BILLING_APP_PATHS = new Set([
  '/profile',
  '/rewards',
  '/planning-engine',
  '/pricing',
  '/billing/manage',
  '/settings/billing',
  '/data-and-trust',
  '/subscription-terms',
  '/refund-policy',
  '/cancellation-policy',
  '/legal/terms',
  '/legal/refund-policy',
  '/legal/cancellation-policy',
]);

const PUBLIC_INFO_PATHS = new Set([
  '/support',
  '/contact-us',
  '/faq',
  '/privacy-policy',
  '/terms-and-condition',
  '/legal',
  '/site-map',
  '/about',
  '/blog',
]);

const normalizePathname = (value: string) => value.replace(/\/+$/, '').toLowerCase() || '/';

const getBillingViewFromPath = (pathname: string): View | null => {
  const normalized = normalizePathname(pathname);
  if (normalized === '/profile') return 'profile';
  if (normalized === '/rewards') return 'rewards';
  if (normalized === '/planning-engine') return 'planning-engine';
  if (normalized === '/pricing') return 'pricing';
  if (normalized === '/billing/manage' || normalized === '/settings/billing') return 'billing-manage';
  if (normalized === '/data-and-trust') return 'data-trust';
  if (normalized === '/subscription-terms' || normalized === '/legal/terms') return 'subscription-terms';
  if (normalized === '/refund-policy' || normalized === '/legal/refund-policy') return 'refund-policy';
  if (normalized === '/cancellation-policy' || normalized === '/legal/cancellation-policy') return 'cancellation-policy';
  return null;
};

const getPathForBillingView = (view: View): string | null => {
  if (view === 'profile') return '/profile';
  if (view === 'rewards') return '/rewards';
  if (view === 'planning-engine') return '/planning-engine';
  if (view === 'pricing') return '/pricing';
  if (view === 'billing-manage') return '/billing/manage';
  if (view === 'data-trust') return '/data-and-trust';
  if (view === 'subscription-terms') return '/legal/terms';
  if (view === 'refund-policy') return '/legal/refund-policy';
  if (view === 'cancellation-policy') return '/legal/cancellation-policy';
  return null;
};

const getPublicViewFromPath = (pathname: string): { view: View | null; blogSlug: string | null } => {
  const normalized = normalizePathname(pathname);
  if (normalized === '/support' || normalized === '/contact-us') return { view: 'support', blogSlug: null };
  if (normalized === '/faq') return { view: 'faq', blogSlug: null };
  if (normalized === '/privacy-policy') return { view: 'privacy-policy', blogSlug: null };
  if (normalized === '/terms-and-condition') return { view: 'terms-and-condition', blogSlug: null };
  if (normalized === '/legal') return { view: 'legal', blogSlug: null };
  if (normalized === '/site-map') return { view: 'site-map', blogSlug: null };
  if (normalized === '/about') return { view: 'about', blogSlug: null };
  if (normalized === '/blog') return { view: 'blog', blogSlug: null };
  if (normalized.startsWith('/blog/')) {
    const raw = pathname.replace(/\/+$/, '').split('/').slice(2).join('/');
    const slug = decodeURIComponent(raw || '').trim();
    if (slug) return { view: 'blog-post', blogSlug: slug };
  }
  return { view: null, blogSlug: null };
};

const getPathForPublicView = (view: View, blogSlug: string | null): string | null => {
  if (view === 'support') return '/support';
  if (view === 'faq') return '/faq';
  if (view === 'privacy-policy') return '/privacy-policy';
  if (view === 'terms-and-condition') return '/terms-and-condition';
  if (view === 'legal') return '/legal';
  if (view === 'site-map') return '/site-map';
  if (view === 'about') return '/about';
  if (view === 'blog') return '/blog';
  if (view === 'blog-post' && blogSlug) return `/blog/${encodeURIComponent(blogSlug)}`;
  return null;
};

const isRoutedAppPath = (pathname: string) => {
  if (BILLING_APP_PATHS.has(pathname)) return true;
  if (PUBLIC_INFO_PATHS.has(pathname)) return true;
  return pathname.startsWith('/blog/');
};

const PUBLIC_INFO_VIEWS = new Set<View>([
  'support',
  'faq',
  'privacy-policy',
  'terms-and-condition',
  'legal',
  'site-map',
  'about',
  'blog',
  'blog-post',
]);

// ── Cloud sync pill ───────────────────────────────────────────
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const SyncPill: React.FC<{ status: SaveStatus }> = ({ status }) => {
  if (status === 'idle') return null;
  return (
    <div className={`
      fixed bottom-20 lg:bottom-6 right-6 z-50 pointer-events-none
      flex items-center gap-2 px-4 py-2 rounded-full shadow-xl
      text-[10px] font-black uppercase tracking-widest transition-all duration-300
      ${status === 'saving' ? 'bg-teal-600 text-white'
      : status === 'saved'  ? 'bg-emerald-500 text-white'
      :                       'bg-rose-500    text-white'}
    `}>
      {status === 'saving' && <Loader2 size={12} className="animate-spin" />}
      {status === 'saved'  && <Cloud    size={12} />}
      {status === 'error'  && <CloudOff size={12} />}
      {status === 'saving' ? 'Syncing...'
       : status === 'saved'  ? 'Saved to Cloud'
       :                       'Sync Failed'}
    </div>
  );
};

// ── App ───────────────────────────────────────────────────────
const App: React.FC = () => {
  const [view, setViewState]              = useState<View>(() => {
    const path = window.location.pathname;
    return getBillingViewFromPath(path) || getPublicViewFromPath(path).view || 'dashboard';
  });
  const [publicBlogSlug, setPublicBlogSlug] = useState<string | null>(() => getPublicViewFromPath(window.location.pathname).blogSlug);
  const [showAuth, setShowAuth]           = useState(false);
  const [resumeProfile, setResumeProfile] = useState<FinanceState['profile'] | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRestoring, setIsRestoring]     = useState(true);
  const [saveStatus, setSaveStatus]       = useState<SaveStatus>('idle');
  const [billingSnapshot, setBillingSnapshot] = useState<BillingSnapshot | null>(null);
  const [advisorLaunchPrompt, setAdvisorLaunchPrompt] = useState<{ id: number; query: string } | null>(null);
  const [chatLaunchAnimating, setChatLaunchAnimating] = useState(false);
  const [rewardQueue, setRewardQueue] = useState<RewardCelebrationPayload[]>([]);
  const [activeReward, setActiveReward] = useState<RewardCelebrationPayload | null>(null);

  const saveTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);
  const authUserIdRef = useRef<string | null>(null);
  const viewHistoryRef = useRef<View[]>([]);
  const usageSnapshotRef = useRef<{
    familyCount: number;
    goalCount: number;
    assetCount: number;
    loanCount: number;
    txCount: number;
    insuranceCount: number;
    hasRiskProfile: boolean;
  } | null>(null);
  const advisorPromptIdRef = useRef(0);
  const rewardToastIdRef = useRef(0);

  const [financeState, setFinanceState] = useState<FinanceState>(() => {
    const saved = localStorage.getItem(LOCAL_KEY);
    if (saved) {
      try { return normalizeState(JSON.parse(saved)); } catch { /* fall through */ }
    }
    return INITIAL_STATE;
  });
  const journey = useMemo(() => getJourneyProgress(financeState), [financeState]);
  const isPublicInfoView = PUBLIC_INFO_VIEWS.has(view);

  const setView = useCallback((nextView: View) => {
    if (nextView !== 'blog-post') {
      setPublicBlogSlug(null);
    }
    setViewState((currentView) => {
      if (currentView === nextView) return currentView;
      viewHistoryRef.current = [...viewHistoryRef.current.slice(-24), currentView];
      return nextView;
    });
  }, []);

  const openAiAdvisorWithQuery = useCallback((query: string) => {
    setChatLaunchAnimating(false);
    window.requestAnimationFrame(() => setChatLaunchAnimating(true));
    const trimmed = query.trim();
    if (!trimmed) {
      setView('ai-advisor');
      return;
    }
    advisorPromptIdRef.current += 1;
    setAdvisorLaunchPrompt({ id: advisorPromptIdRef.current, query: trimmed });
    setView('ai-advisor');
  }, [setView]);

  const refreshBillingSnapshot = useCallback(async (clearOnError = false) => {
    try {
      const snapshot = await getBillingSnapshot();
      setBillingSnapshot(snapshot);
      return snapshot;
    } catch {
      if (clearOnError) {
        setBillingSnapshot(null);
      }
      return null;
    }
  }, []);

  const awardUsagePointsAndSync = useCallback(async (
    eventType: string,
    sourceRef?: string,
    metadata?: Record<string, unknown>,
  ) => {
    try {
      const result = await awardUsagePoints(eventType, sourceRef, metadata);
      if (!result.skipped && Number(result.awarded || 0) > 0) {
        const awarded = Number(result.awarded || 0);
        setBillingSnapshot(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            points: {
              ...prev.points,
              balance: Number(prev.points?.balance || 0) + awarded,
            },
          };
        });
        rewardToastIdRef.current += 1;
        setRewardQueue(prev => [
          ...prev,
          { id: rewardToastIdRef.current, eventType, points: awarded },
        ]);
        await refreshBillingSnapshot();
      }
    } catch {
      // points awards are best effort and should not block app flows
    }
  }, [refreshBillingSnapshot]);

  useEffect(() => {
    if (!chatLaunchAnimating) return;
    const timer = window.setTimeout(() => setChatLaunchAnimating(false), 540);
    return () => window.clearTimeout(timer);
  }, [chatLaunchAnimating]);

  useEffect(() => {
    if (activeReward || rewardQueue.length === 0) return;
    const [next, ...rest] = rewardQueue;
    setRewardQueue(rest);
    setActiveReward(next);
  }, [activeReward, rewardQueue]);

  useEffect(() => {
    const currentPath = normalizePathname(window.location.pathname);
    const targetPath = getPathForBillingView(view) || getPathForPublicView(view, publicBlogSlug);
    if (targetPath) {
      const normalizedTarget = normalizePathname(targetPath);
      if (currentPath !== normalizedTarget) {
        window.history.replaceState({}, '', targetPath);
      }
      return;
    }
    if (isRoutedAppPath(currentPath)) {
      window.history.replaceState({}, '', '/');
    }
  }, [publicBlogSlug, view]);

  // ── On mount: restore full state from all 6 DB tables ────────
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          authUserIdRef.current = session.user.id;
          setUsageTrackingUserId(session.user.id);
          const loaded = await loadFinanceData(financeState, session.user.id);
          if (loaded) {
            const normalized = normalizeState(loaded);
            setFinanceState(normalized);
            localStorage.setItem(LOCAL_KEY, JSON.stringify(normalized));
            void trackEvent(
              'app.session_restored',
              {
                onboardingDone: normalized.profile?.firstName ? true : normalized.isRegistered,
                goals: normalized.goals.length,
                assets: normalized.assets.length,
                liabilities: normalized.loans.length,
              },
              'app.lifecycle',
              session.user.id
            );
            if (!normalized.isRegistered) {
              setShowAuth(true);
              setResumeProfile(normalized.profile);
            } else {
              setResumeProfile(null);
              await refreshBillingSnapshot(true);
            }
          }
        } else {
          authUserIdRef.current = null;
          setUsageTrackingUserId(null);
          if (financeState.isRegistered) {
            localStorage.removeItem(LOCAL_KEY);
            setFinanceState({ ...INITIAL_STATE });
          }
          setBillingSnapshot(null);
        }
      } catch (err) {
        console.error('Session restore error:', err);
      } finally {
        setIsRestoring(false);
      }
    };

    restoreSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        authUserIdRef.current = session?.user?.id || null;
        setUsageTrackingUserId(session?.user?.id || null);
      }
      if (event === 'SIGNED_OUT') {
        authUserIdRef.current = null;
        setUsageTrackingUserId(null);
        localStorage.removeItem(LOCAL_KEY);
        setFinanceState({ ...INITIAL_STATE });
        setShowAuth(false);
        setResumeProfile(null);
        setBillingSnapshot(null);
        viewHistoryRef.current = [];
      }
    });

    return () => subscription.unsubscribe();
  }, [refreshBillingSnapshot]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!financeState.isRegistered) return;
    let active = true;

    const refreshBilling = async () => {
      const snapshot = await refreshBillingSnapshot();
      if (!active || snapshot) return;
    };

    void refreshBilling();
    const timer = window.setInterval(() => {
      void refreshBilling();
    }, 60_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [financeState.isRegistered, refreshBillingSnapshot]);

  // ── Auto-save: debounced write to all 6 DB tables ────────────
  // saveFinanceData() returns DB-assigned UUIDs (Postgres generates
  // real UUIDs; components use short random strings). We merge them
  // back into state silently so subsequent saves work correctly.
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (!financeState.isRegistered) return;

    // Always update localStorage immediately — UI never blocks
    localStorage.setItem(LOCAL_KEY, JSON.stringify(financeState));

    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus('saving');

    saveTimer.current = setTimeout(async () => {
      try {
        // dbUpdates contains arrays with DB-assigned UUIDs
        const dbUpdates = await saveFinanceData(financeState, authUserIdRef.current);

        // Merge DB UUIDs back into state (silent — no re-render cascade)
        if (Object.keys(dbUpdates).length > 0) {
          setFinanceState(prev => {
            const next = { ...prev, ...dbUpdates };
            localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
            return next;
          });
        }

        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2500);
      } catch {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 4000);
      }
    }, SAVE_DEBOUNCE_MS);

    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [financeState]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setActiveCountry(financeState.profile?.country || 'India');
  }, [financeState.profile?.country]);

  // ── Enforce admin controls: force logout + blocked user sessions ──
  useEffect(() => {
    if (!financeState.isRegistered) return;

    let cancelled = false;

    const enforceAdminFlags = async () => {
      try {
        const flags = await getSelfAdminFlag(authUserIdRef.current);
        if (!flags || cancelled) return;

        if (flags.is_blocked || flags.force_logout_requested_at) {
          await signOut().catch(() => {});
          localStorage.removeItem(LOCAL_KEY);
          setFinanceState({ ...INITIAL_STATE, isRegistered: false });
          setShowAuth(false);
          setResumeProfile(null);
          viewHistoryRef.current = [];
          setViewState('dashboard');

          const reason = flags.is_blocked
            ? `Your account is blocked. ${flags.blocked_reason ? `Reason: ${flags.blocked_reason}` : ''}`
            : 'Your session was reset by operations. Please sign in again.';
          window.alert(reason.trim());
        }
      } catch {
        // Ignore polling errors to keep UX uninterrupted.
      }
    };

    enforceAdminFlags();
    const intervalId = window.setInterval(enforceAdminFlags, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [financeState.isRegistered]);

  useEffect(() => {
    if (!financeState.isRegistered) return;
    void trackEvent('app.view_opened', { view }, 'app.navigation');

    if (view === 'goal-summary') {
      void awardUsagePointsAndSync('report_generated', 'goal_summary_view');
    }
  }, [financeState.isRegistered, view, awardUsagePointsAndSync]);

  useEffect(() => {
    if (!financeState.isRegistered) {
      usageSnapshotRef.current = null;
      return;
    }

    const current = {
      familyCount: financeState.family.length,
      goalCount: financeState.goals.length,
      assetCount: financeState.assets.length,
      loanCount: financeState.loans.length,
      txCount: financeState.transactions.length,
      insuranceCount: financeState.insurance.length,
      hasRiskProfile: Boolean(financeState.riskProfile),
    };

    const previous = usageSnapshotRef.current;
    usageSnapshotRef.current = current;
    if (!previous) return;

    if (current.familyCount > previous.familyCount) {
      void trackEvent('family.member_added', { added: current.familyCount - previous.familyCount, total: current.familyCount }, 'app.family');
    }
    if (current.goalCount > previous.goalCount) {
      void trackEvent('goal.created', { added: current.goalCount - previous.goalCount, total: current.goalCount }, 'app.goals');
      void awardUsagePointsAndSync('goal_added', `goals:${current.goalCount}`, { added: current.goalCount - previous.goalCount });
    }
    if (current.assetCount > previous.assetCount) {
      void trackEvent('asset.added', { added: current.assetCount - previous.assetCount, total: current.assetCount }, 'app.assets');
    }
    if (current.loanCount > previous.loanCount) {
      void trackEvent('liability.added', { added: current.loanCount - previous.loanCount, total: current.loanCount }, 'app.liabilities');
    }
    if (current.txCount > previous.txCount) {
      void trackEvent('transaction.logged', { added: current.txCount - previous.txCount, total: current.txCount }, 'app.transactions');
    }
    if (current.insuranceCount > previous.insuranceCount) {
      void trackEvent('insurance.policy_added', { added: current.insuranceCount - previous.insuranceCount, total: current.insuranceCount }, 'app.insurance');
    }
    if (!previous.hasRiskProfile && current.hasRiskProfile) {
      void trackEvent(
        'risk.profile_completed',
        {
          level: financeState.riskProfile?.level || null,
          score: financeState.riskProfile?.score ?? null,
        },
        'app.risk'
      );
      void awardUsagePointsAndSync('risk_profile_completed', financeState.riskProfile?.level || 'unknown');
    }
  }, [
    financeState.isRegistered,
    financeState.family.length,
    financeState.goals.length,
    financeState.assets.length,
    financeState.loans.length,
    financeState.transactions.length,
    financeState.insurance.length,
    financeState.riskProfile,
    awardUsagePointsAndSync,
  ]);

  useEffect(() => {
    if (!financeState.isRegistered) return;
    void awardUsagePointsAndSync('daily_login', new Date().toISOString().slice(0, 10));
  }, [financeState.isRegistered, awardUsagePointsAndSync]);

  useEffect(() => {
    if (!financeState.isRegistered) return;
    if (journey.completionPct < 100) return;
    void awardUsagePointsAndSync('profile_completion', 'journey_100');
  }, [financeState.isRegistered, journey.completionPct, awardUsagePointsAndSync]);

  // ── Logout ────────────────────────────────────────────────────
  const handleLogout = async () => {
    const confirmed = window.confirm('Terminate session? Your data is saved in the cloud.');
    if (!confirmed) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await saveFinanceData(financeState, authUserIdRef.current).catch(() => {});
    await flushActivityEvents().catch(() => {});
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out failed:', err);
    } finally {
      localStorage.removeItem(LOCAL_KEY);
      setFinanceState({ ...INITIAL_STATE, isRegistered: false });
      setShowAuth(false);
      viewHistoryRef.current = [];
      setViewState('dashboard');
    }
  };

  const handleUpdateState = (data: Partial<FinanceState>) =>
    setFinanceState(prev => ({ ...prev, ...data }));

  const ensureNotification = (id: string, title: string, message: string, type: 'critical' | 'strategy' | 'success') => {
    setFinanceState(prev => {
      const list = prev.notifications || [];
      if (list.some(n => n.id === id)) return prev;
      const next = [{
        id,
        title,
        message,
        type,
        timestamp: new Date().toISOString(),
        read: false,
      }, ...list].slice(0, 80);
      return { ...prev, notifications: next };
    });
  };

  const gateUnlocked = journey.completionPct === 100;
  const isTerminalOnline = financeState.isRegistered && gateUnlocked && saveStatus !== 'error';
  const effectiveBillingAccessState = billingSnapshot?.accessState || 'blocked';
  const shouldShowFreeToProUpgrade = useMemo(() => {
    if (!billingSnapshot) return false;

    const planCode = String(billingSnapshot.subscription?.planCode || '').toLowerCase();
    const planAmount = Number(billingSnapshot.subscription?.amount || 0);
    const hasFreePlanCode =
      planCode.includes('free') || planCode.includes('trial') || planCode.includes('legacy');
    const hasZeroAmountSubscription =
      Boolean(billingSnapshot.subscription) && Number.isFinite(planAmount) && planAmount <= 0;

    return (
      hasFreePlanCode ||
      hasZeroAmountSubscription ||
      billingSnapshot.trial.active ||
      billingSnapshot.lifecycleState === 'trial'
    );
  }, [billingSnapshot]);
  const hasPaidSubscription = useMemo(() => {
    const sub = billingSnapshot?.subscription;
    if (!sub) return false;
    const status = String(sub.status || '').toLowerCase();
    return ['active', 'trialing', 'past_due'].includes(status) && Number(sub.amount || 0) > 0;
  }, [billingSnapshot]);
  const gatedViews = new Set<View>([
    'action-plan',
    'monthly-savings',
    'cashflow',
    'investment-plan',
    'risk-profile',
    'insurance',
    'tax-estate',
  ]);

  const openBillingManage = useCallback(() => {
    setView('pricing');
  }, [setView]);

  const openPricing = useCallback(() => {
    setView('pricing');
  }, [setView]);

  useEffect(() => {
    if (!gateUnlocked && gatedViews.has(view)) {
      setView(journey.nextStep?.view || 'dashboard');
    }
  }, [gateUnlocked, view, journey.nextStep?.view]);

  useEffect(() => {
    if (!financeState.isRegistered) return;

    const monthlyIncome = monthlyIncomeFromDetailed(financeState.profile.income)
      + financeState.family
        .filter(member => member.includeIncomeInPlanning !== false)
        .reduce((sum, member) => sum + monthlyIncomeFromDetailed(member.income), 0);
    const monthlyExpenses = financeState.detailedExpenses.reduce((sum, item) => sum + (item.amount || 0), 0) || financeState.profile.monthlyExpenses || 0;
    const totalMonthlyDebt = financeState.loans.reduce((sum, loan) => sum + (loan.emi || 0), 0);
    const dti = monthlyIncome > 0 ? (totalMonthlyDebt / monthlyIncome) * 100 : 0;
    const financialNodeReady = monthlyIncome > 0 && monthlyExpenses > 0 && financeState.assets.length > 0;

    if (journey.completionPct < 100) {
      ensureNotification(
        'journey-pending',
        'Complete Initialization',
        `Journey is ${journey.completionPct}% complete. Finish remaining setup to unlock full planning modules.`,
        'strategy',
      );
    }

    if (financialNodeReady && !financeState.riskProfile) {
      ensureNotification(
        'risk-profile-required',
        'Risk Profile Required',
        'Financial node is ready. Complete risk profile before finalizing investment decisions.',
        'strategy',
      );
    }

    if (dti >= 40) {
      ensureNotification(
        'high-debt-load',
        'High Debt Service Ratio',
        `Your DTI is ${dti.toFixed(1)}%. Review EMI obligations and rebalance liabilities.`,
        'critical',
      );
    }

    if (financeState.insurance.length === 0 && (financeState.loans.length > 0 || financeState.goals.length > 0)) {
      ensureNotification(
        'insurance-data-missing',
        'Insurance Inventory Missing',
        'Add term and health insurance details to compute required cover and deficit.',
        'strategy',
      );
    }

    if (billingSnapshot?.accessState === 'limited') {
      ensureNotification(
        'billing-access-limited',
        'Dashboard Limited',
        'Payment retries are in progress. Dashboard is locked until payment is completed.',
        'strategy',
      );
    }

    if (billingSnapshot?.accessState === 'blocked') {
      ensureNotification(
        'billing-access-blocked',
        'Dashboard Locked',
        'Subscription is required to unlock dashboard analytics. Use Billing Manage to reactivate access.',
        'critical',
      );
    }
  }, [
    financeState.isRegistered,
    financeState.profile,
    financeState.family,
    financeState.assets.length,
    financeState.detailedExpenses,
    financeState.loans,
    financeState.goals.length,
    financeState.insurance.length,
    financeState.riskProfile,
    journey.completionPct,
    billingSnapshot?.accessState,
  ]);

  useEffect(() => {
    if (!financeState.isRegistered) return;

    const hasLocationData = Boolean(
      (financeState.profile.pincode || '').trim()
      || (financeState.profile.city || '').trim()
      || (financeState.profile.state || '').trim()
    );
    const notifications = financeState.notifications || [];

    if (!shouldShowDataShareReminder({
      hasLocationData,
      transactionCount: financeState.transactions.length,
      notifications,
    })) {
      return;
    }

    const reminder = buildDataShareReminderNotification();
    setFinanceState(prev => {
      const list = prev.notifications || [];
      return {
        ...prev,
        notifications: [reminder, ...list].slice(0, 80),
      };
    });
    recordDataSharePrompt();
  }, [
    financeState.isRegistered,
    financeState.profile.pincode,
    financeState.profile.city,
    financeState.profile.state,
    financeState.transactions.length,
    financeState.notifications,
  ]);

  useEffect(() => {
    const canonicalRoot = `${window.location.origin}/`;

    if (!financeState.isRegistered && !showAuth && !isPublicInfoView) {
      // Landing page handles indexable SEO metadata in Landing.tsx.
      return;
    }

    if (!financeState.isRegistered && showAuth && !isPublicInfoView) {
      applySeoMeta({
        title: 'Start Financial Onboarding | FinVantage',
        description: 'Set up your profile, planning horizon, and intelligence baseline to start financial planning.',
        canonicalUrl: canonicalRoot,
        type: 'website',
        robots: 'noindex,nofollow',
      });
      return;
    }

    if (isPublicInfoView) {
      // Public info pages set their own canonical/SEO meta.
      return;
    }

    const viewMeta: Record<View, { title: string; description: string }> = {
      dashboard: {
        title: 'Financial Dashboard | FinVantage',
        description: 'Monitor net worth, goal progress, and household financial trajectory in one command view.',
      },
      pricing: {
        title: 'Pricing | FinVantage',
        description: 'Choose a subscription plan to unlock dashboard access and continue planning.',
      },
      'billing-manage': {
        title: 'Subscription Management | FinVantage',
        description: 'Manage renewal, retries, coupons, referrals, and plan upgrades.',
      },
      'subscription-terms': {
        title: 'Subscription Terms | FinVantage',
        description: 'Review subscription legal terms for FinVantage billing.',
      },
      'refund-policy': {
        title: 'Refund Policy | FinVantage',
        description: 'Understand refund eligibility, timeline, and approval policy.',
      },
      'cancellation-policy': {
        title: 'Cancellation Policy | FinVantage',
        description: 'Review cancellation-at-period-end and resume policy.',
      },
      family: {
        title: 'Family Financial Profile | FinVantage',
        description: 'Map family members, dependencies, and income planning assumptions.',
      },
      inflow: {
        title: 'Income Planning Node | FinVantage',
        description: 'Track operational and passive income streams for long-term financial planning.',
      },
      outflow: {
        title: 'Expense Planning Node | FinVantage',
        description: 'Capture household expenses and inflation-adjusted cashflow assumptions.',
      },
      insurance: {
        title: 'Insurance Planning Node | FinVantage',
        description: 'Analyze term and health insurance requirements against liabilities and goals.',
      },
      assets: {
        title: 'Assets Register | FinVantage',
        description: 'Track assets available for goals, growth assumptions, and contribution plans.',
      },
      debt: {
        title: 'Liabilities Register | FinVantage',
        description: 'Track loans, obligations, EMI pressure, and outstanding balances.',
      },
      'risk-profile': {
        title: 'Risk Profile | FinVantage',
        description: 'Assess household risk capacity and match portfolio allocation to goals.',
      },
      transactions: {
        title: 'Transactions | FinVantage',
        description: 'Review household transaction flows for planning and analysis.',
      },
      goals: {
        title: 'Goals Configurator | FinVantage',
        description: 'Create and prioritize financial goals with timeline and inflation assumptions.',
      },
      'goal-summary': {
        title: 'Goals Summary | FinVantage',
        description: 'Review all goals with funded status and horizon alignment.',
      },
      cashflow: {
        title: 'Cashflow Plan | FinVantage',
        description: 'Analyze surplus trajectory and future funding capacity.',
      },
      'investment-plan': {
        title: 'Investment Plan | FinVantage',
        description: 'Translate goals into investment strategy and allocation pathways.',
      },
      'action-plan': {
        title: 'Action Plan | FinVantage',
        description: 'Step-by-step recommendations to improve household financial outcomes.',
      },
      'monthly-savings': {
        title: 'Monthly Savings Plan | FinVantage',
        description: 'Calibrate monthly savings targets and execution priorities.',
      },
      profile: {
        title: 'Profile | FinVantage',
        description: 'Manage your account profile and onboarding details.',
      },
      rewards: {
        title: 'Referral & Rewards | FinVantage',
        description: 'Track points, milestones, and referral rewards.',
      },
      'planning-engine': {
        title: 'Planning Engine | FinVantage',
        description: 'Control planner assumptions and bucket strategy.',
      },
      settings: {
        title: 'Profile | FinVantage',
        description: 'Manage your account profile and onboarding details.',
      },
      'data-trust': {
        title: 'Data and Trust | FinVantage',
        description: 'Review data transparency, permissions, and trust controls.',
      },
      notifications: {
        title: 'Notifications | FinVantage',
        description: 'View strategy alerts, risk prompts, and planning notifications.',
      },
      support: {
        title: 'Support & Complaint Tracker | FinVantage',
        description: 'Register complaints and track support ticket status end-to-end.',
      },
      benefits: {
        title: 'Benefits | FinVantage',
        description: 'Explore platform value and outcomes across your financial journey.',
      },
      scenarios: {
        title: 'Scenario Planning | FinVantage',
        description: 'Stress-test decisions with scenario analysis and outcome comparison.',
      },
      'tax-estate': {
        title: 'Tax & Estate Planning | FinVantage',
        description: 'Review tax and estate readiness for wealth continuity.',
      },
      projections: {
        title: 'Retirement Projections | FinVantage',
        description: 'Evaluate retirement trajectory and long-horizon funding sustainability.',
      },
      'ai-advisor': {
        title: 'AI Financial Advisor | FinVantage',
        description: 'Get AI-backed planning suggestions tailored to your financial profile.',
      },
    };

    const meta = viewMeta[view] || viewMeta.dashboard;
    applySeoMeta({
      title: meta.title,
      description: meta.description,
      canonicalUrl: canonicalRoot,
      type: 'website',
      robots: 'noindex,nofollow',
    });
  }, [financeState.isRegistered, showAuth, view]);

  if (isRestoring) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Establishing connection...</p>
        </div>
      </div>
    );
  }

  if (!financeState.isRegistered && !showAuth && !isPublicInfoView) {
    return <Landing onStart={() => setShowAuth(true)} />;
  }

  if (!financeState.isRegistered && showAuth && !isPublicInfoView) {
    return (
      <Onboarding
        onComplete={(data) => {
          setFinanceState(prev => ({ ...prev, ...data, isRegistered: true }));
          setShowAuth(false);
          setResumeProfile(null);
          setView('dashboard');
          void trackEvent(
            'app.onboarding_completed',
            {
              country: data.profile?.country || 'India',
              lifeExpectancy: data.profile?.lifeExpectancy,
              retirementAge: data.profile?.retirementAge,
            },
            'app.onboarding'
          );
        }}
        onBackToLanding={() => {
          setShowAuth(false);
          setResumeProfile(null);
        }}
        initialAuthStep={resumeProfile ? 'onboarding' : undefined}
        resumeProfile={resumeProfile ?? undefined}
      />
    );
  }

  const renderView = () => {
    switch (view) {
      case 'dashboard':       return <Dashboard state={financeState} setView={setView} billingAccessState={effectiveBillingAccessState} onOpenBilling={openBillingManage} showProUpgradeCta={shouldShowFreeToProUpgrade} onOpenPricing={openPricing} pointsBalance={billingSnapshot?.points?.balance || 0} pointsFrozen={Boolean(billingSnapshot?.points?.frozen)} pointsFormula={billingSnapshot?.points?.formula || undefined} pointsEarnedEvents={billingSnapshot?.points?.earnedEvents || []} referralCode={billingSnapshot?.referral?.myCode || null} referralRewardReferrer={billingSnapshot?.referral?.referralReward?.referrer || 25} referralRewardReferred={billingSnapshot?.referral?.referralReward?.referred || 50} hasPaidSubscription={hasPaidSubscription} />;
      case 'pricing':         return <BillingManagePage mode="pricing" externalSnapshot={billingSnapshot} onSnapshotSync={setBillingSnapshot} />;
      case 'billing-manage':  return <BillingManagePage mode="manage" externalSnapshot={billingSnapshot} onSnapshotSync={setBillingSnapshot} />;
      case 'subscription-terms': return <BillingLegalPage type="subscription-terms" />;
      case 'refund-policy':      return <BillingLegalPage type="refund-policy" />;
      case 'cancellation-policy': return <BillingLegalPage type="cancellation-policy" />;
      case 'family':          return <Family state={financeState} updateState={handleUpdateState} setView={setView} />;
      case 'inflow':          return <InflowProfile state={financeState} updateState={handleUpdateState} />;
      case 'outflow':         return <OutflowProfile state={financeState} updateState={handleUpdateState} />;
      case 'insurance':       return <Insurances state={financeState} updateState={handleUpdateState} />;
      case 'assets':          return <Assets state={financeState} updateState={handleUpdateState} />;
      case 'debt':            return <Liabilities state={financeState} updateState={handleUpdateState} />;
      case 'risk-profile':    return <RiskProfile state={financeState} updateState={handleUpdateState} />;
      case 'transactions':    return <Transactions transactions={financeState.transactions} onAddTransaction={(t) => setFinanceState(prev => ({...prev, transactions: [{...t, id: Math.random().toString()}, ...prev.transactions]}))} country={financeState.profile.country} />;
      case 'goals':           return <Goals state={financeState} updateState={handleUpdateState} />;
      case 'goal-summary':    return <GoalSummary state={financeState} setView={setView} />;
      case 'cashflow':        return <Cashflow state={financeState} />;
      case 'investment-plan': return <InvestmentPlan state={financeState} />;
      case 'action-plan':     return <ActionPlan state={financeState} />;
      case 'monthly-savings': return <MonthlySavingsPlan state={financeState} />;
      case 'profile':
      case 'settings':
        return (
          <Settings
            state={financeState}
            updateState={handleUpdateState}
            onLogout={handleLogout}
            setView={setView}
            mode="settings"
            initialTab="profile"
            hideTabBar
          />
        );
      case 'rewards':
        return (
          <Settings
            state={financeState}
            updateState={handleUpdateState}
            onLogout={handleLogout}
            setView={setView}
            mode="settings"
            initialTab="rewards"
            hideTabBar
          />
        );
      case 'planning-engine':
        return (
          <Settings
            state={financeState}
            updateState={handleUpdateState}
            onLogout={handleLogout}
            setView={setView}
            mode="settings"
            initialTab="planning"
            hideTabBar
          />
        );
      case 'data-trust':      return <Settings state={financeState} updateState={handleUpdateState} onLogout={handleLogout} setView={setView} mode="data-trust" />;
      case 'notifications':   return <Notifications state={financeState} updateState={handleUpdateState} setView={setView} />;
      case 'support':         return <SupportDeskPage />;
      case 'faq':             return <StaticInfoPage page="faq" />;
      case 'privacy-policy':  return <StaticInfoPage page="privacy" />;
      case 'terms-and-condition': return <StaticInfoPage page="terms" />;
      case 'legal':           return <StaticInfoPage page="legal" />;
      case 'site-map':        return <StaticInfoPage page="sitemap" />;
      case 'about':           return <StaticInfoPage page="about" />;
      case 'blog':            return <BlogIndexPage />;
      case 'blog-post':       return publicBlogSlug ? <BlogPostPage slug={publicBlogSlug} /> : <BlogIndexPage />;
      case 'tax-estate':      return <TaxEstate state={financeState} />;
      case 'projections':     return <RetirementPlan state={financeState} />;
      case 'ai-advisor':      return <AIAdvisor state={financeState} launchPrompt={advisorLaunchPrompt} />;
      default:                return <Dashboard state={financeState} setView={setView} billingAccessState={effectiveBillingAccessState} onOpenBilling={openBillingManage} showProUpgradeCta={shouldShowFreeToProUpgrade} onOpenPricing={openPricing} pointsBalance={billingSnapshot?.points?.balance || 0} pointsFrozen={Boolean(billingSnapshot?.points?.frozen)} pointsFormula={billingSnapshot?.points?.formula || undefined} pointsEarnedEvents={billingSnapshot?.points?.earnedEvents || []} referralCode={billingSnapshot?.referral?.myCode || null} referralRewardReferrer={billingSnapshot?.referral?.referralReward?.referrer || 25} referralRewardReferred={billingSnapshot?.referral?.referralReward?.referred || 50} hasPaidSubscription={hasPaidSubscription} />;
    }
  };

  return (
    <div className="app-shell app-layout-root font-sans flex overflow-hidden">
      {financeState.isRegistered && (
        <div className="app-sidebar-rail hidden lg:block fixed left-0 top-0 h-full z-50 shrink-0">
          <Sidebar currentView={view} setView={setView} state={financeState} />
        </div>
      )}

      {financeState.isRegistered && (
        <div className={`fixed inset-0 z-[60] lg:hidden transition-all duration-500 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
          <div className={`absolute left-0 top-0 h-full w-[var(--app-sidebar-w)] transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <Sidebar currentView={view} setView={setView} onClose={() => setIsSidebarOpen(false)} state={financeState} />
          </div>
        </div>
      )}

      <main className="app-main-shell flex-1 flex flex-col relative">
        <Header
          onMenuClick={() => {
            if (!financeState.isRegistered) return;
            setIsSidebarOpen(true);
          }}
          title={view}
          state={financeState}
          setView={setView}
          onLogout={financeState.isRegistered ? handleLogout : () => setShowAuth(true)}
          isTerminalOnline={isTerminalOnline}
          referralCode={billingSnapshot?.referral?.myCode || null}
          pointsBalance={billingSnapshot?.points?.balance || 0}
          pointsFrozen={Boolean(billingSnapshot?.points?.frozen)}
          onAskQuery={openAiAdvisorWithQuery}
        />
        <div className="app-content-scroll flex-1 w-full no-scrollbar scroll-smooth">
          <div
            key={view}
            className={`w-full min-w-0 animate-in fade-in slide-in-from-bottom-2 duration-500 ${
              view === 'ai-advisor' && chatLaunchAnimating ? 'chat-launch-enter' : ''
            }`}
          >
            <Suspense
              fallback={
                <div className="px-6 py-10 text-sm font-semibold text-slate-500">
                  Loading module...
                </div>
              }
            >
              {renderView()}
            </Suspense>
          </div>
        </div>

        {financeState.isRegistered && (
          <div className="app-mobile-nav lg:hidden fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-xl border-t border-white/60 flex items-center justify-around px-4 z-40 shadow-2xl">
            <button onClick={() => setView('dashboard')} className={`flex flex-col items-center gap-1 shrink-0 px-3 py-1.5 rounded-xl transition-all ${view === 'dashboard' ? 'text-teal-600 bg-teal-50 shadow-inner' : 'text-slate-400'}`}>
              <LayoutDashboard size={18} /><span className="text-[7px] font-black uppercase tracking-widest">Dash</span>
            </button>
            <button onClick={() => setView('notifications')} className={`flex flex-col items-center gap-1 shrink-0 px-3 py-1.5 rounded-xl transition-all ${view === 'notifications' ? 'text-teal-600 bg-teal-50 shadow-inner' : 'text-slate-400'}`}>
              <Bell size={18} /><span className="text-[7px] font-black uppercase tracking-widest">Alerts</span>
            </button>
          </div>
        )}
      </main>

      <SyncPill status={saveStatus} />
      <RewardCelebration reward={activeReward} onDone={() => setActiveReward(null)} />
    </div>
  );
};

export default App;
