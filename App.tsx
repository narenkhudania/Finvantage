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
import { FinanceState, View, DetailedIncome } from './types';
import { LayoutDashboard, Bell, ListChecks } from 'lucide-react';
import { supabase } from "./services/supabase";
import Auth from "./components/Auth"


const INITIAL_INCOME: DetailedIncome = {
  salary: 0,
  bonus: 0,
  reimbursements: 0,
  business: 0,
  rental: 0,
  investment: 0,
  expectedIncrease: 6
};

const INITIAL_STATE: FinanceState = {
  isRegistered: false,
  onboardingStep: 0,
  profile: {
    firstName: '', 
    lastName: '', 
    dob: '', 
    mobile: '', 
    email: '',
    lifeExpectancy: 85, 
    retirementAge: 60, 
    pincode: '', 
    city: '', 
    state: '',
    country: 'India', 
    incomeSource: 'salaried', 
    income: { ...INITIAL_INCOME }, 
    monthlyExpenses: 0
  },
  family: [],
  detailedExpenses: [],
  assets: [],
  loans: [],
  insurance: [],
  goals: [],
  estate: { hasWill: false, nominationsUpdated: false },
  transactions: [],
  notifications: [
    { 
      id: 'welcome-1', 
      title: 'System Online', 
      message: 'Initialize your financial node to begin long-term projections.', 
      type: 'success', 
      timestamp: new Date().toISOString(), 
      read: false 
    }
  ],
  riskProfile: undefined
};

const App: React.FC = () => {
  const [view, setView] = useState<View>('dashboard'); 
  const [showAuth, setShowAuth] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [financeState, setFinanceState] = useState<FinanceState>(() => {
    const saved = localStorage.getItem('finvantage_clean_state_v1');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved state", e);
      }
    }
    return INITIAL_STATE;
  });

  // ✅ Test Supabase Connection
  useEffect(() => {
    async function testConnection() {
      const { data, error } = await supabase
        .from("users")
        .select("*");

      console.log("SUPABASE DATA:", data);
      console.log("SUPABASE ERROR:", error);
    }

    testConnection();
  }, []);

  useEffect(() => {
    localStorage.setItem('finvantage_clean_state_v1', JSON.stringify(financeState));
  }, [financeState]);

  const handleLogout = () => {
    const confirmed = window.confirm("Terminate session? Local data will be preserved unless you clear browser storage.");
    if (confirmed) {
      localStorage.removeItem('finvantage_clean_state_v1');
      setFinanceState({ ...INITIAL_STATE, isRegistered: false });
      setShowAuth(false);
      setView('dashboard');
      window.scrollTo(0, 0);
    }
  };

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
      case 'dashboard': return <Dashboard state={financeState} setView={setView} />;
      case 'family': return <Family state={financeState} updateState={handleUpdateState} setView={setView} />;
      case 'inflow': return <InflowProfile state={financeState} updateState={handleUpdateState} />;
      case 'outflow': return <OutflowProfile state={financeState} updateState={handleUpdateState} />;
      case 'insurance': return <Insurances state={financeState} updateState={handleUpdateState} />;
      case 'assets': return <Assets state={financeState} updateState={handleUpdateState} />;
      case 'debt': return <Liabilities state={financeState} updateState={handleUpdateState} />;
      case 'risk-profile': return <RiskProfile state={financeState} updateState={handleUpdateState} />;
      case 'transactions': 
        return (
          <Transactions 
            transactions={financeState.transactions} 
            onAddTransaction={(t) => 
              setFinanceState(prev => ({
                ...prev,
                transactions: [{ ...t, id: Math.random().toString() }, ...prev.transactions]
              }))
            } 
          />
        );
      case 'goals': return <Goals state={financeState} updateState={handleUpdateState} />;
      case 'goal-summary': return <GoalSummary state={financeState} />;
      case 'cashflow': return <GoalFunding state={financeState} />;
      case 'investment-plan': return <InvestmentPlan state={financeState} />;
      case 'action-plan': return <ActionPlan state={financeState} />;
      case 'monthly-savings': return <MonthlySavingsPlan state={financeState} />;
      case 'settings': return <Settings state={financeState} updateState={handleUpdateState} onLogout={handleLogout} />;
      case 'notifications': return <Notifications state={financeState} updateState={handleUpdateState} />;
      case 'tax-estate': return <TaxEstate state={financeState} />;
      case 'projections': return <RetirementPlan state={financeState} />;
      default: return <Dashboard state={financeState} setView={setView} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans selection:bg-indigo-100 flex overflow-hidden">
      <div className="hidden lg:block fixed left-0 top-0 h-full w-[260px] z-50 shrink-0">
        <Sidebar currentView={view} setView={setView} state={financeState} />
      </div>

      <main className="flex-1 lg:ml-[260px] flex flex-col min-h-screen relative h-screen">
        <Header 
          onMenuClick={() => setIsSidebarOpen(true)} 
          title={view} 
          state={financeState} 
          setView={setView} 
          onLogout={handleLogout} 
        />

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 md:p-10 max-w-[1400px] mx-auto w-full">
          {renderView()}
        </div>
      </main>
    </div>
  );
};
const [session, setSession] = useState<any>(null)

useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    setSession(session)
  })

  const { data: listener } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      setSession(session)
    }
  )

  return () => {
    listener.subscription.unsubscribe()
  }
}, []);


export default App;
