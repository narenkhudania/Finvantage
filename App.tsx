// App.tsx — Production ready. Diagnostic removed.

import React, { useState, useEffect } from 'react';
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
import { LayoutDashboard, Bell, ListChecks } from 'lucide-react';
import { supabase } from './services/supabase';
import { getProfile, signOut } from './services/authService';

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
  insurance: [], goals: [],
  estate: { hasWill: false, nominationsUpdated: false },
  transactions: [],
  notifications: [{
    id: 'welcome-1', title: 'System Online',
    message: 'Initialize your financial node to begin long-term projections.',
    type: 'success', timestamp: new Date().toISOString(), read: false,
  }],
  riskProfile: undefined,
};

const App: React.FC = () => {
  const [view, setView]                   = useState<View>('dashboard');
  const [showAuth, setShowAuth]           = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRestoring, setIsRestoring]     = useState(true);

  const [financeState, setFinanceState] = useState<FinanceState>(() => {
    const saved = localStorage.getItem('finvantage_active_session');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* fall through */ }
    }
    return INITIAL_STATE;
  });

  // On mount: verify Supabase session is still valid
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          if (!financeState.isRegistered) {
            const profile = await getProfile();
            if (profile) {
              setFinanceState(prev => ({
                ...prev,
                isRegistered: true,
                profile: {
                  ...prev.profile,
                  firstName:       profile.first_name,
                  lastName:        profile.last_name ?? '',
                  email:           profile.identifier.includes('@') && !profile.identifier.includes('@auth.finvantage.app')
                                     ? profile.identifier : '',
                  mobile:          !profile.identifier.includes('@')
                                     ? profile.identifier : '',
                  dob:             profile.dob ?? '',
                  lifeExpectancy:  profile.life_expectancy,
                  retirementAge:   profile.retirement_age,
                  pincode:         profile.pincode ?? '',
                  city:            profile.city    ?? '',
                  state:           profile.state   ?? '',
                  country:         profile.country,
                  incomeSource:    profile.income_source as IncomeSource,
                  iqScore:         profile.iq_score,
                  income: { salary: 50000, bonus: 0, reimbursements: 0, business: 0, rental: 0, investment: 0, expectedIncrease: 6 },
                  monthlyExpenses: 20000,
                },
              }));
            }
          }
        } else {
          if (financeState.isRegistered) {
            localStorage.removeItem('finvantage_active_session');
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
        localStorage.removeItem('finvantage_active_session');
        setFinanceState({ ...INITIAL_STATE });
        setShowAuth(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist state to localStorage whenever it changes
  useEffect(() => {
    if (financeState.isRegistered) {
      localStorage.setItem('finvantage_active_session', JSON.stringify(financeState));
    }
  }, [financeState]);

  const handleLogout = async () => {
    const confirmed = window.confirm('Terminate session? Your data is saved in the cloud.');
    if (confirmed) {
      await signOut();
      localStorage.removeItem('finvantage_active_session');
      setFinanceState({ ...INITIAL_STATE, isRegistered: false });
      setShowAuth(false);
      setView('dashboard');
    }
  };

  // Show spinner while verifying session on reload
  if (isRestoring) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Establishing connection...</p>
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

  const handleUpdateState = (data: Partial<FinanceState>) =>
    setFinanceState(prev => ({ ...prev, ...data }));

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
    <div className="min-h-screen bg-[#f8fafc] font-sans selection:bg-indigo-100 flex overflow-hidden">
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
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 md:p-10 max-w-[1400px] mx-auto w-full no-scrollbar scroll-smooth">
          <div key={view} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {renderView()}
          </div>
        </div>

        <div className="lg:hidden fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 h-16 flex items-center justify-around px-4 z-40 pb-safe shadow-2xl">
          <button onClick={() => setView('dashboard')} className={`flex flex-col items-center gap-1 shrink-0 px-3 py-1.5 rounded-xl transition-all ${view === 'dashboard' ? 'text-indigo-600 bg-indigo-50 shadow-inner' : 'text-slate-400'}`}>
            <LayoutDashboard size={18} /><span className="text-[7px] font-black uppercase tracking-widest">Dash</span>
          </button>
          <button onClick={() => setView('action-plan')} className={`flex flex-col items-center gap-1 shrink-0 px-3 py-1.5 rounded-xl transition-all ${view === 'action-plan' ? 'text-indigo-600 bg-indigo-50 shadow-inner' : 'text-slate-400'}`}>
            <ListChecks size={18} /><span className="text-[7px] font-black uppercase tracking-widest">Plan</span>
          </button>
          <button onClick={() => setView('notifications')} className={`flex flex-col items-center gap-1 shrink-0 px-3 py-1.5 rounded-xl transition-all ${view === 'notifications' ? 'text-indigo-600 bg-indigo-50 shadow-inner' : 'text-slate-400'}`}>
            <Bell size={18} /><span className="text-[7px] font-black uppercase tracking-widest">Alerts</span>
          </button>
        </div>
      </main>
    </div>
  );
};

export default App;
