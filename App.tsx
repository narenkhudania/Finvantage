// App.tsx — all original auth/session/routing code preserved.
// Updated: saveFinanceData() now returns DB-assigned UUIDs which
// are merged back into state so subsequent saves use real UUIDs.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Transactions from './components/Transactions';
import Goals from './components/Goals';
import GoalSummary from './components/GoalSummary';
import Onboarding from './components/Onboarding';
import TaxEstate from './components/TaxEstate';
import RetirementPlan from './components/RetirementPlan';
import Family from './components/Family';
import InflowProfile from './components/InflowProfile';
import OutflowProfile from './components/OutflowProfile';
import Insurances from './components/Insurances';
import Assets from './components/Assets';
import Liabilities from './components/Liabilities';
import RiskProfile from './components/RiskProfile';
import Landing from './components/Landing';
import GoalFunding from './components/GoalFunding';
import InvestmentPlan from './components/InvestmentPlan';
import ActionPlan from './components/ActionPlan';
import MonthlySavingsPlan from './components/MonthlySavingsPlan';
import Settings from './components/Settings';
import Notifications from './components/Notifications';
import AIAdvisor from './components/AIAdvisor';
import Cashflow from './components/Cashflow';
import SupportCenter from './components/SupportCenter';
import { FinanceState, View, DetailedIncome, IncomeSource } from './types';
import { LayoutDashboard, Bell, ListChecks, Cloud, CloudOff, Loader2 } from 'lucide-react';
import { supabase } from './services/supabase';
import { signOut } from './services/authService';
import { saveFinanceData, loadFinanceData } from './services/dbService';
import { getSelfAdminFlag } from './services/admin/adminService';
import { flushActivityEvents, setUsageTrackingUserId, trackEvent } from './services/usageTracking';
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
  const [view, setViewState]              = useState<View>('dashboard');
  const [showAuth, setShowAuth]           = useState(false);
  const [resumeProfile, setResumeProfile] = useState<FinanceState['profile'] | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRestoring, setIsRestoring]     = useState(true);
  const [saveStatus, setSaveStatus]       = useState<SaveStatus>('idle');

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

  const [financeState, setFinanceState] = useState<FinanceState>(() => {
    const saved = localStorage.getItem(LOCAL_KEY);
    if (saved) {
      try { return normalizeState(JSON.parse(saved)); } catch { /* fall through */ }
    }
    return INITIAL_STATE;
  });

  const setView = useCallback((nextView: View) => {
    setViewState((currentView) => {
      if (currentView === nextView) return currentView;
      viewHistoryRef.current = [...viewHistoryRef.current.slice(-24), currentView];
      return nextView;
    });
  }, []);

  const handleGoBack = useCallback(() => {
    setViewState((currentView) => {
      if (currentView === 'dashboard') return currentView;
      const history = viewHistoryRef.current;
      if (!history.length) return 'dashboard';
      const previous = history[history.length - 1];
      viewHistoryRef.current = history.slice(0, -1);
      return previous || 'dashboard';
    });
  }, []);

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
            }
          }
        } else {
          authUserIdRef.current = null;
          setUsageTrackingUserId(null);
          if (financeState.isRegistered) {
            localStorage.removeItem(LOCAL_KEY);
            setFinanceState({ ...INITIAL_STATE });
          }
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
        viewHistoryRef.current = [];
      }
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [financeState.isRegistered, view]);

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
  ]);

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

  const journey = getJourneyProgress(financeState);
  const gateUnlocked = journey.completionPct === 100;
  const isTerminalOnline = financeState.isRegistered && gateUnlocked && saveStatus !== 'error';
  const gatedViews = new Set<View>([
    'action-plan',
    'monthly-savings',
    'cashflow',
    'investment-plan',
    'risk-profile',
    'insurance',
    'tax-estate',
  ]);

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

    if (!financeState.isRegistered && !showAuth) {
      // Landing page handles indexable SEO metadata in Landing.tsx.
      return;
    }

    if (!financeState.isRegistered && showAuth) {
      applySeoMeta({
        title: 'Start Financial Onboarding | FinVantage',
        description: 'Set up your profile, planning horizon, and intelligence baseline to start financial planning.',
        canonicalUrl: canonicalRoot,
        type: 'website',
        robots: 'noindex,nofollow',
      });
      return;
    }

    const viewMeta: Record<View, { title: string; description: string }> = {
      dashboard: {
        title: 'Financial Dashboard | FinVantage',
        description: 'Monitor net worth, goal progress, and household financial trajectory in one command view.',
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
      settings: {
        title: 'Settings | FinVantage',
        description: 'Manage account preferences and planning configuration.',
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

  if (!financeState.isRegistered && !showAuth) {
    return <Landing onStart={() => setShowAuth(true)} />;
  }

  if (!financeState.isRegistered && showAuth) {
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
      case 'dashboard':       return <Dashboard state={financeState} setView={setView} />;
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
      case 'settings':        return <Settings state={financeState} updateState={handleUpdateState} onLogout={handleLogout} />;
      case 'notifications':   return <Notifications state={financeState} updateState={handleUpdateState} setView={setView} />;
      case 'support':         return <SupportCenter state={financeState} updateState={handleUpdateState} />;
      case 'tax-estate':      return <TaxEstate state={financeState} />;
      case 'projections':     return <RetirementPlan state={financeState} />;
      case 'ai-advisor':      return <AIAdvisor state={financeState} />;
      default:                return <Dashboard state={financeState} setView={setView} />;
    }
  };

  return (
    <div className="app-shell font-sans flex overflow-hidden">
      <div className="hidden lg:block fixed left-0 top-0 h-full w-[260px] z-50 shrink-0">
        <Sidebar currentView={view} setView={setView} state={financeState} />
      </div>

      <div className={`fixed inset-0 z-[60] lg:hidden transition-all duration-500 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
        <div className={`absolute left-0 top-0 h-full w-[260px] transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <Sidebar currentView={view} setView={setView} onClose={() => setIsSidebarOpen(false)} state={financeState} />
        </div>
      </div>

      <main className="flex-1 lg:ml-[260px] flex flex-col min-h-screen relative h-screen">
        <Header
          onMenuClick={() => setIsSidebarOpen(true)}
          title={view}
          state={financeState}
          setView={setView}
          onBack={handleGoBack}
          onLogout={handleLogout}
          isTerminalOnline={isTerminalOnline}
        />
        <div className="flex-1 overflow-y-auto overflow-x-auto md:overflow-x-hidden p-4 pb-24 md:p-6 md:pb-10 w-full no-scrollbar scroll-smooth">
          <div key={view} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {renderView()}
          </div>
        </div>

        <div className="lg:hidden fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-xl border-t border-white/60 h-16 flex items-center justify-around px-4 z-40 pb-safe shadow-2xl">
          <button onClick={() => setView('dashboard')} className={`flex flex-col items-center gap-1 shrink-0 px-3 py-1.5 rounded-xl transition-all ${view === 'dashboard' ? 'text-teal-600 bg-teal-50 shadow-inner' : 'text-slate-400'}`}>
            <LayoutDashboard size={18} /><span className="text-[7px] font-black uppercase tracking-widest">Dash</span>
          </button>
          <button onClick={() => setView('notifications')} className={`flex flex-col items-center gap-1 shrink-0 px-3 py-1.5 rounded-xl transition-all ${view === 'notifications' ? 'text-teal-600 bg-teal-50 shadow-inner' : 'text-slate-400'}`}>
            <Bell size={18} /><span className="text-[7px] font-black uppercase tracking-widest">Alerts</span>
          </button>
        </div>
      </main>

      <SyncPill status={saveStatus} />
    </div>
  );
};

export default App;
