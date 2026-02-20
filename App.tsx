// App.tsx — all original auth/session/routing code preserved.
// Updated: saveFinanceData() now returns DB-assigned UUIDs which
// are merged back into state so subsequent saves use real UUIDs.

import React, { useState, useEffect, useRef } from 'react';
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
import { FinanceState, View, DetailedIncome, IncomeSource } from './types';
import { LayoutDashboard, Bell, ListChecks, Cloud, CloudOff, Loader2 } from 'lucide-react';
import { supabase } from './services/supabase';
import { signOut } from './services/authService';
import { saveFinanceData, loadFinanceData } from './services/dbService';
import { getJourneyProgress } from './lib/journey';
import { setActiveCountry } from './lib/currency';

const LOCAL_KEY        = 'finvantage_active_session';
const SAVE_DEBOUNCE_MS = 1500;

const INITIAL_INCOME: DetailedIncome = {
  salary: 0, bonus: 0, reimbursements: 0,
  business: 0, rental: 0, investment: 0, expectedIncrease: 6,
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
  family: [], detailedExpenses: [], assets: [], loans: [],
  insurance: [],
  insuranceAnalysis: {
    inflation: 6,
    investmentRate: 11.5,
    replacementYears: 20,
    immediateNeeds: 1000000,
    financialAssetDiscount: 50,
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
    assets: Array.isArray(raw?.assets) ? raw!.assets : base.assets,
    loans: Array.isArray(raw?.loans) ? raw!.loans : base.loans,
    insurance: Array.isArray(raw?.insurance) ? raw!.insurance : base.insurance,
    insuranceAnalysis: { ...base.insuranceAnalysis, ...(raw?.insuranceAnalysis || {}) },
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
  const [view, setView]                   = useState<View>('dashboard');
  const [showAuth, setShowAuth]           = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRestoring, setIsRestoring]     = useState(true);
  const [saveStatus, setSaveStatus]       = useState<SaveStatus>('idle');

  const saveTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  const [financeState, setFinanceState] = useState<FinanceState>(() => {
    const saved = localStorage.getItem(LOCAL_KEY);
    if (saved) {
      try { return normalizeState(JSON.parse(saved)); } catch { /* fall through */ }
    }
    return INITIAL_STATE;
  });

  // ── On mount: restore full state from all 6 DB tables ────────
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as any).supabase = supabase;
    }

    const restoreSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const loaded = await loadFinanceData(financeState);
          if (loaded) {
            const normalized = normalizeState(loaded);
            setFinanceState(normalized);
            localStorage.setItem(LOCAL_KEY, JSON.stringify(normalized));
          }
        } else {
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem(LOCAL_KEY);
        setFinanceState({ ...INITIAL_STATE });
        setShowAuth(false);
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
        const dbUpdates = await saveFinanceData(financeState);

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

  // ── Logout ────────────────────────────────────────────────────
  const handleLogout = async () => {
    const confirmed = window.confirm('Terminate session? Your data is saved in the cloud.');
    if (confirmed) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      await saveFinanceData(financeState).catch(() => {});
      await signOut();
      localStorage.removeItem(LOCAL_KEY);
      setFinanceState({ ...INITIAL_STATE, isRegistered: false });
      setShowAuth(false);
      setView('dashboard');
    }
  };

  const handleUpdateState = (data: Partial<FinanceState>) =>
    setFinanceState(prev => ({ ...prev, ...data }));

  const journey = getJourneyProgress(financeState);
  const gateUnlocked = journey.completionPct === 100;
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
        onComplete={(data) => setFinanceState(prev => ({ ...prev, ...data, isRegistered: true }))}
        onBackToLanding={() => setShowAuth(false)}
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
      case 'transactions':    return <Transactions transactions={financeState.transactions} onAddTransaction={(t) => setFinanceState(prev => ({...prev, transactions: [{...t, id: Math.random().toString()}, ...prev.transactions]}))} />;
      case 'goals':           return <Goals state={financeState} updateState={handleUpdateState} />;
      case 'goal-summary':    return <GoalSummary state={financeState} />;
      case 'cashflow':        return <Cashflow state={financeState} />;
      case 'investment-plan': return <InvestmentPlan state={financeState} />;
      case 'action-plan':     return <ActionPlan state={financeState} />;
      case 'monthly-savings': return <MonthlySavingsPlan state={financeState} />;
      case 'settings':        return <Settings state={financeState} updateState={handleUpdateState} onLogout={handleLogout} />;
      case 'notifications':   return <Notifications state={financeState} updateState={handleUpdateState} />;
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
        <Header onMenuClick={() => setIsSidebarOpen(true)} title={view} state={financeState} setView={setView} onLogout={handleLogout} />
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 pb-24 md:p-10 md:pb-10 max-w-[1400px] mx-auto w-full no-scrollbar scroll-smooth">
          <div key={view} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {renderView()}
          </div>
        </div>

        <div className="lg:hidden fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-xl border-t border-white/60 h-16 flex items-center justify-around px-4 z-40 pb-safe shadow-2xl">
          <button onClick={() => setView('dashboard')} className={`flex flex-col items-center gap-1 shrink-0 px-3 py-1.5 rounded-xl transition-all ${view === 'dashboard' ? 'text-teal-600 bg-teal-50 shadow-inner' : 'text-slate-400'}`}>
            <LayoutDashboard size={18} /><span className="text-[7px] font-black uppercase tracking-widest">Dash</span>
          </button>
          {gateUnlocked && (
            <button onClick={() => setView('action-plan')} className={`flex flex-col items-center gap-1 shrink-0 px-3 py-1.5 rounded-xl transition-all ${view === 'action-plan' ? 'text-teal-600 bg-teal-50 shadow-inner' : 'text-slate-400'}`}>
              <ListChecks size={18} /><span className="text-[7px] font-black uppercase tracking-widest">Plan</span>
            </button>
          )}
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
