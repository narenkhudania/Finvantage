import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  Info,
  Lock,
  RefreshCw,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { FinanceState, View } from '../types';
import { getJourneyProgress } from '../lib/journey';
import { formatCurrency } from '../lib/currency';
import { buildReportSnapshot } from '../lib/report';
import { monthlyIncomeFromDetailed } from '../lib/incomeMath';
import { AppButton, SectionHeader, SurfaceCard, StatusPill } from './common/ui';

interface DashboardProps {
  state: FinanceState;
  setView: (view: View) => void;
}

type DashboardMode = 'simple' | 'advanced';
type WidgetId = 'cashflow' | 'obligations' | 'alerts' | 'insights' | 'allocation';

type AttentionSeverity = 'high' | 'medium' | 'low';

interface AttentionItem {
  id: string;
  severity: AttentionSeverity;
  title: string;
  description: string;
  actionLabel: string;
  actionView: View;
}

const PREFS_KEY = 'finvantage.dashboard.preferences.v3';
const ALL_WIDGETS: WidgetId[] = ['cashflow', 'obligations', 'alerts', 'insights', 'allocation'];
const SIMPLE_WIDGETS: WidgetId[] = ['cashflow', 'obligations', 'alerts', 'insights'];

const WIDGET_META: Record<WidgetId, { title: string; description: string }> = {
  cashflow: {
    title: 'Cash Flow Overview',
    description: 'Income, expenses, and net cash flow in one view.',
  },
  obligations: {
    title: 'Upcoming Liabilities',
    description: 'EMIs and debt pressure with clear next actions.',
  },
  alerts: {
    title: 'Attention Alerts',
    description: 'Items that need your attention right now.',
  },
  insights: {
    title: 'Insights & Next Steps',
    description: 'What this means and what to do next.',
  },
  allocation: {
    title: 'Allocation & Reallocation',
    description: 'Current mix vs risk-profile target and actions.',
  },
};

const clampPct = (value: number) => Math.max(0, Math.min(100, value));

const normalizeWidgetOrder = (input: WidgetId[]): WidgetId[] => {
  const valid = input.filter((id, idx) => ALL_WIDGETS.includes(id) && input.indexOf(id) === idx);
  return [...valid, ...ALL_WIDGETS.filter(id => !valid.includes(id))];
};

const MiniTrend: React.FC<{ values: number[]; positive: boolean }> = ({ values, positive }) => {
  if (values.length < 2) {
    return <div className="h-10 rounded-xl bg-slate-100" />;
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(1, max - min);

  const points = values.map((value, idx) => {
    const x = (idx / (values.length - 1)) * 100;
    const y = 30 - ((value - min) / range) * 30;
    return { x, y };
  });

  const path = points.map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const stroke = positive ? '#16a34a' : '#dc2626';

  return (
    <svg viewBox="0 0 100 32" className="w-full h-10" preserveAspectRatio="none" aria-hidden="true">
      <path d={path} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ state, setView }) => {
  const [mode, setMode] = useState<DashboardMode>('simple');
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [widgetOrder, setWidgetOrder] = useState<WidgetId[]>(ALL_WIDGETS);
  const [hiddenWidgets, setHiddenWidgets] = useState<WidgetId[]>([]);

  const journey = useMemo(() => getJourneyProgress(state), [state]);
  const reportSnapshot = useMemo(() => buildReportSnapshot(state), [state]);

  const totalAssets = useMemo(
    () => state.assets.reduce((sum, asset) => sum + Number(asset.currentValue || 0), 0),
    [state.assets],
  );
  const totalLiabilities = useMemo(
    () => state.loans.reduce((sum, loan) => sum + Number(loan.outstandingAmount || 0), 0),
    [state.loans],
  );
  const netWorth = totalAssets - totalLiabilities;

  const monthlyIncome = useMemo(() => {
    const selfIncome = monthlyIncomeFromDetailed(state.profile.income);
    const familyIncome = state.family
      .filter(member => member.includeIncomeInPlanning !== false)
      .reduce((sum, member) => sum + monthlyIncomeFromDetailed(member.income), 0);
    return selfIncome + familyIncome;
  }, [state.profile.income, state.family]);

  const monthlyExpenses = useMemo(
    () => state.detailedExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0) || state.profile.monthlyExpenses,
    [state.detailedExpenses, state.profile.monthlyExpenses],
  );

  const monthlyDebt = useMemo(
    () => state.loans.reduce((sum, loan) => sum + Number(loan.emi || 0), 0),
    [state.loans],
  );

  const monthlyNetCashFlow = monthlyIncome - monthlyExpenses - monthlyDebt;
  const dtiRatio = monthlyIncome > 0 ? (monthlyDebt / monthlyIncome) * 100 : 0;

  const liquidAssets = useMemo(
    () => state.assets
      .filter(asset => ['Liquid', 'Debt'].includes(asset.category))
      .reduce((sum, asset) => sum + Number(asset.currentValue || 0), 0),
    [state.assets],
  );

  const emergencyMonthsCovered = monthlyExpenses > 0 ? liquidAssets / monthlyExpenses : 0;

  const monthlyNetTrend = useMemo(() => {
    const now = new Date();

    const getMonthNet = (year: number, month: number) => {
      const periodTransactions = state.transactions.filter(txn => {
        const date = new Date(txn.date);
        return date.getFullYear() === year && date.getMonth() === month;
      });

      if (periodTransactions.length === 0) {
        return monthlyNetCashFlow;
      }

      return periodTransactions.reduce((sum, txn) => {
        const signedAmount = txn.type === 'income' ? Number(txn.amount || 0) : -Number(txn.amount || 0);
        return sum + signedAmount;
      }, 0);
    };

    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      return getMonthNet(date.getFullYear(), date.getMonth());
    });
  }, [state.transactions, monthlyNetCashFlow]);

  const currentMonthNet = monthlyNetTrend[monthlyNetTrend.length - 1] ?? monthlyNetCashFlow;
  const previousMonthNet = monthlyNetTrend[monthlyNetTrend.length - 2] ?? monthlyNetCashFlow;
  const monthChangePct = previousMonthNet === 0 ? 0 : ((currentMonthNet - previousMonthNet) / Math.abs(previousMonthNet)) * 100;

  const currentAllocation = useMemo(() => {
    const allocationValue = {
      equity: 0,
      debt: 0,
      gold: 0,
      liquid: 0,
    };

    state.assets.forEach(asset => {
      const value = Number(asset.currentValue || 0);
      if (asset.category === 'Equity') allocationValue.equity += value;
      if (asset.category === 'Debt') allocationValue.debt += value;
      if (asset.category === 'Gold/Silver') allocationValue.gold += value;
      if (asset.category === 'Liquid') allocationValue.liquid += value;
    });

    const total = allocationValue.equity + allocationValue.debt + allocationValue.gold + allocationValue.liquid;

    return {
      total,
      equity: total > 0 ? (allocationValue.equity / total) * 100 : 0,
      debt: total > 0 ? (allocationValue.debt / total) * 100 : 0,
      gold: total > 0 ? (allocationValue.gold / total) * 100 : 0,
      liquid: total > 0 ? (allocationValue.liquid / total) * 100 : 0,
    };
  }, [state.assets]);

  const recommendedAllocation = useMemo(() => {
    if (state.riskProfile?.recommendedAllocation) {
      return state.riskProfile.recommendedAllocation;
    }
    return { equity: 60, debt: 30, gold: 10, liquid: 0 };
  }, [state.riskProfile]);

  const allocationRows: Array<{ key: 'equity' | 'debt' | 'gold' | 'liquid'; label: string }> = [
    { key: 'equity', label: 'Equity' },
    { key: 'debt', label: 'Debt' },
    { key: 'gold', label: 'Gold' },
    { key: 'liquid', label: 'Liquid' },
  ];

  const reallocationActions = useMemo(() => {
    return allocationRows
      .map(row => {
        const current = currentAllocation[row.key];
        const recommended = recommendedAllocation[row.key];
        const delta = recommended - current;
        const amount = (currentAllocation.total * Math.abs(delta)) / 100;
        return {
          ...row,
          current,
          recommended,
          delta,
          amount,
        };
      })
      .filter(item => Math.abs(item.delta) >= 1);
  }, [allocationRows, currentAllocation, recommendedAllocation]);

  const attentionItems = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];

    if (monthlyNetCashFlow < 0) {
      items.push({
        id: 'negative-cashflow',
        severity: 'high',
        title: 'Negative monthly cash flow',
        description: 'Expenses + EMIs are currently higher than monthly income.',
        actionLabel: 'Review Cash Flow',
        actionView: 'cashflow',
      });
    }

    if (dtiRatio > 40) {
      items.push({
        id: 'high-dti',
        severity: 'high',
        title: 'Debt pressure is high',
        description: `Debt service is ${dtiRatio.toFixed(1)}% of income.`,
        actionLabel: 'Optimize Loans',
        actionView: 'debt',
      });
    }

    if (emergencyMonthsCovered < 6) {
      items.push({
        id: 'low-emergency-fund',
        severity: 'medium',
        title: 'Emergency reserve is below 6 months',
        description: `Current liquid buffer covers ${emergencyMonthsCovered.toFixed(1)} months of expenses.`,
        actionLabel: 'Improve Asset Mix',
        actionView: 'assets',
      });
    }

    if (!state.riskProfile) {
      items.push({
        id: 'risk-profile-missing',
        severity: 'medium',
        title: 'Risk profile is pending',
        description: 'Complete risk profile to align allocation and expected returns.',
        actionLabel: 'Complete Risk Profile',
        actionView: 'risk-profile',
      });
    }

    if (state.notifications && state.notifications.some(notification => !notification.read)) {
      items.push({
        id: 'unread-notifications',
        severity: 'low',
        title: 'You have unread notifications',
        description: 'Check system and planning updates in alert center.',
        actionLabel: 'Open Notifications',
        actionView: 'notifications',
      });
    }

    return items.slice(0, 4);
  }, [dtiRatio, emergencyMonthsCovered, monthlyNetCashFlow, state.notifications, state.riskProfile]);

  const insights = useMemo(() => {
    const items: Array<{ id: string; summary: string; action: string; view: View }> = [];

    if (monthChangePct > 5) {
      items.push({
        id: 'cashflow-up',
        summary: `Net cash flow is up ${Math.abs(monthChangePct).toFixed(1)}% vs last month.`,
        action: 'Lock this improvement into savings automation.',
        view: 'cashflow',
      });
    } else if (monthChangePct < -5) {
      items.push({
        id: 'cashflow-down',
        summary: `Net cash flow is down ${Math.abs(monthChangePct).toFixed(1)}% vs last month.`,
        action: 'Review recurring expenses and subscription outflows.',
        view: 'outflow',
      });
    }

    if (reportSnapshot.goals.totalGoals > 0) {
      items.push({
        id: 'goals-progress',
        summary: `${reportSnapshot.goals.fundedCount} of ${reportSnapshot.goals.totalGoals} goals are funded.`,
        action: 'Review goal priority and funding gaps.',
        view: 'goal-summary',
      });
    }

    if (state.loans.length > 0) {
      items.push({
        id: 'loan-simulation',
        summary: 'Loan planning can improve using prepay and restructure simulations.',
        action: 'Run prepayment and tenure impact scenarios.',
        view: 'debt',
      });
    }

    if (items.length === 0) {
      items.push({
        id: 'stable-status',
        summary: 'Your core indicators look stable this cycle.',
        action: 'Use advanced view for deeper allocation analysis.',
        view: 'investment-plan',
      });
    }

    return items.slice(0, 3);
  }, [monthChangePct, reportSnapshot.goals.fundedCount, reportSnapshot.goals.totalGoals, state.loans.length]);

  const lastRefreshLabel = useMemo(() => {
    const now = new Date();
    return now.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }, [state]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        mode: DashboardMode;
        widgetOrder: WidgetId[];
        hiddenWidgets: WidgetId[];
      }>;

      if (parsed.mode === 'simple' || parsed.mode === 'advanced') {
        setMode(parsed.mode);
      }

      if (Array.isArray(parsed.widgetOrder)) {
        const validOrder = parsed.widgetOrder.filter((id): id is WidgetId => ALL_WIDGETS.includes(id));
        setWidgetOrder(normalizeWidgetOrder(validOrder));
      }

      if (Array.isArray(parsed.hiddenWidgets)) {
        const validHidden = parsed.hiddenWidgets.filter((id): id is WidgetId => ALL_WIDGETS.includes(id));
        setHiddenWidgets(validHidden);
      }
    } catch {
      // Use defaults when preference parsing fails.
    }
  }, []);

  useEffect(() => {
    try {
      const payload = {
        mode,
        widgetOrder,
        hiddenWidgets,
      };
      localStorage.setItem(PREFS_KEY, JSON.stringify(payload));
    } catch {
      // Ignore persistence errors in restricted environments.
    }
  }, [mode, widgetOrder, hiddenWidgets]);

  const moveWidget = (id: WidgetId, direction: 'up' | 'down') => {
    setWidgetOrder(prev => {
      const index = prev.indexOf(id);
      if (index < 0) return prev;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const toggleWidgetVisibility = (id: WidgetId) => {
    setHiddenWidgets(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]));
  };

  const modeScopedOrder = useMemo(() => {
    if (mode === 'simple') {
      return widgetOrder.filter(id => SIMPLE_WIDGETS.includes(id));
    }
    return widgetOrder;
  }, [mode, widgetOrder]);

  const visibleWidgets = modeScopedOrder.filter(id => !hiddenWidgets.includes(id));

  const isOnboardingComplete = journey.completionPct === 100;
  const initializationStepIcons: Record<string, any> = {
    family: Users,
    inflow: Wallet,
    outflow: ArrowDown,
    assets: TrendingUp,
    debt: CreditCard,
    goals: Target,
  };
  const initializationSteps = journey.steps.map(step => ({
    ...step,
    icon: initializationStepIcons[step.id] || Target,
  }));

  if (!isOnboardingComplete) {
    return (
      <div className="space-y-6 pb-24 animate-in fade-in duration-500">
        <SurfaceCard padding="none" className="relative overflow-hidden rounded-[3rem] border-slate-200 p-8 md:p-12">
          <div className="absolute top-0 right-0 w-[340px] h-[340px] bg-teal-50 blur-[90px] rounded-full translate-x-1/3 -translate-y-1/3" />

          <div className="relative z-10 grid grid-cols-1 xl:grid-cols-[1.1fr_1fr] gap-8 items-start">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-200">
                Initialization Required
              </div>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 leading-tight">
                Your Strategy Terminal <br />
                <span className="text-teal-600">is Offline.</span>
              </h2>

              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Progress to Synchronization</span>
                  <span className="text-2xl font-black text-slate-900">{journey.completionPct}%</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div className="h-full bg-teal-600 transition-all duration-700" style={{ width: `${journey.completionPct}%` }} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {initializationSteps.map(step => (
                <button
                  key={step.id}
                  onClick={() => setView(step.view)}
                  className={`text-left rounded-2xl border px-4 py-4 transition ${
                    step.complete
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-teal-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${step.complete ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>
                      <step.icon size={15} />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest">{step.label}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard padding="none" className="rounded-[2.5rem] border-slate-200 p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-teal-600">Why complete setup</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">Benefits of completing your data</h3>
              <p className="text-sm text-slate-600 font-medium mt-2">
                Complete all nodes once to unlock personalized planning and accurate recommendations.
              </p>
            </div>
            <div className="hidden sm:flex items-center justify-center px-3 py-1.5 rounded-full bg-teal-50 text-teal-700 text-[10px] font-black uppercase tracking-widest border border-teal-100">
              {journey.completionPct}% ready
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
            {[
              {
                title: 'Accurate Goal Funding',
                detail: 'See realistic goal costs and whether your current assets can fully fund them.',
                action: { label: 'Complete Mission Targets', view: 'goals' as View },
              },
              {
                title: 'Smarter Investment Mix',
                detail: 'Get allocation guidance aligned to your risk profile, cash flow, and liabilities.',
                action: { label: 'Complete Inflow + Assets', view: 'assets' as View },
              },
              {
                title: 'Better Loan Decisions',
                detail: 'Run prepay/restructure scenarios with monthly impact before taking action.',
                action: { label: 'Complete Liability Map', view: 'debt' as View },
              },
              {
                title: 'Lower Financial Anxiety',
                detail: 'Track one clear dashboard with alerts, not scattered data across pages.',
                action: { label: 'Complete Household Node', view: 'family' as View },
              },
            ].map(item => (
              <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-black text-slate-900">{item.title}</p>
                <p className="text-xs font-semibold text-slate-600 mt-1 leading-relaxed">{item.detail}</p>
                <button
                  onClick={() => setView(item.action.view)}
                  className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-teal-700 hover:text-teal-800"
                >
                  {item.action.label} <ArrowRight size={12} />
                </button>
              </div>
            ))}
          </div>
        </SurfaceCard>
      </div>
    );
  }

  const severityStyle: Record<AttentionSeverity, string> = {
    high: 'border-rose-200 bg-rose-50 text-rose-700',
    medium: 'border-amber-200 bg-amber-50 text-amber-700',
    low: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };

  const renderWidget = (widgetId: WidgetId) => {
    if (widgetId === 'cashflow') {
      return (
        <SurfaceCard padding="lg">
          <SectionHeader
            eyebrow="Cash Flow Overview"
            title="Monthly cash position"
            action={<Wallet size={18} className="text-slate-400 mt-1" />}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Income</p>
              <p className="text-sm font-black text-slate-900 mt-1">{formatCurrency(monthlyIncome, state.profile.country)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Expenses</p>
              <p className="text-sm font-black text-slate-900 mt-1">{formatCurrency(monthlyExpenses, state.profile.country)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Net Cash Flow</p>
              <p className={`text-sm font-black mt-1 ${monthlyNetCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {formatCurrency(monthlyNetCashFlow, state.profile.country)}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <MiniTrend values={monthlyNetTrend} positive={monthChangePct >= 0} />
            <p className="text-xs font-semibold text-slate-600 mt-2">
              {monthChangePct >= 0 ? 'Up' : 'Down'} {Math.abs(monthChangePct).toFixed(1)}% vs last month.
            </p>
          </div>

          <p className="text-xs text-slate-500 mt-4">Net cash flow = income minus expenses and EMI obligations.</p>

          <AppButton
            tone="ghost"
            size="sm"
            onClick={() => setView('cashflow')}
            className="mt-4 !px-0 text-slate-700 hover:text-slate-900"
            trailingIcon={<ArrowRight size={13} />}
          >
            Open cash flow details
          </AppButton>
        </SurfaceCard>
      );
    }

    if (widgetId === 'obligations') {
      return (
        <SurfaceCard padding="lg">
          <SectionHeader
            eyebrow="Upcoming Liabilities"
            title="Loan planning at a glance"
            action={<CreditCard size={18} className="text-slate-400 mt-1" />}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Monthly EMI</p>
              <p className="text-sm font-black text-slate-900 mt-1">{formatCurrency(monthlyDebt, state.profile.country)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Outstanding Debt</p>
              <p className="text-sm font-black text-slate-900 mt-1">{formatCurrency(totalLiabilities, state.profile.country)}</p>
            </div>
          </div>

          <p className="text-xs text-slate-500 mt-4">Debt load = EMI as a share of income. Lower debt load improves flexibility.</p>

          <div className="mt-4 space-y-2">
            {[
              'Prepay impact simulation (tenure vs EMI savings)',
              'Restructure/reschedule what-if preview',
              'Part-payment and closure estimate',
            ].map(item => (
              <p key={item} className="text-xs font-semibold text-slate-600">• {item}</p>
            ))}
          </div>

          <AppButton
            tone="ghost"
            size="sm"
            onClick={() => setView('debt')}
            className="mt-4 !px-0 text-slate-700 hover:text-slate-900"
            trailingIcon={<ArrowRight size={13} />}
          >
            Open loan planner
          </AppButton>
        </SurfaceCard>
      );
    }

    if (widgetId === 'alerts') {
      return (
        <SurfaceCard padding="lg">
          <SectionHeader
            eyebrow="Alerts Requiring Attention"
            title="Priority checks"
            action={<AlertTriangle size={18} className="text-slate-400 mt-1" />}
          />

          {attentionItems.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
              <p className="text-sm font-black">No critical alerts right now.</p>
              <p className="text-xs font-semibold mt-1">System checks are currently stable.</p>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {attentionItems.map(item => (
                <div key={item.id} className={`rounded-2xl border p-4 ${severityStyle[item.severity]}`}>
                  <p className="text-xs font-black uppercase tracking-widest">{item.title}</p>
                  <p className="text-xs font-semibold mt-1">{item.description}</p>
                  <button
                    onClick={() => setView(item.actionView)}
                    className="mt-3 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest"
                  >
                    {item.actionLabel} <ArrowRight size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-slate-500 mt-4">These alerts are prioritized to prevent financial stress and planning drift.</p>
        </SurfaceCard>
      );
    }

    if (widgetId === 'insights') {
      return (
        <SurfaceCard padding="lg">
          <SectionHeader
            eyebrow="Insights & Recommendations"
            title="What this means"
            action={<Target size={18} className="text-slate-400 mt-1" />}
          />

          <div className="mt-5 space-y-3">
            {insights.map(item => (
              <button
                key={item.id}
                onClick={() => setView(item.view)}
                className="w-full text-left rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:border-slate-300 transition"
              >
                <p className="text-sm font-black text-slate-900">{item.summary}</p>
                <p className="text-xs font-semibold text-slate-600 mt-1">Next: {item.action}</p>
              </button>
            ))}
          </div>

          <p className="text-xs text-slate-500 mt-4">Insights answer: what changed, is it good, and what to do next.</p>

          <AppButton
            tone="ghost"
            size="sm"
            onClick={() => setView('goal-summary')}
            className="mt-4 !px-0 text-slate-700 hover:text-slate-900"
            trailingIcon={<ArrowRight size={13} />}
          >
            Open detailed reports
          </AppButton>
        </SurfaceCard>
      );
    }

    return (
      <SurfaceCard padding="lg">
        <SectionHeader
          eyebrow="Portfolio Mapping"
          title="Current vs recommended mix"
          action={<TrendingUp size={18} className="text-slate-400 mt-1" />}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Current Investment Allocation</p>
            <div className="space-y-3">
              {allocationRows.map(row => (
                <div key={`current-${row.key}`}>
                  <div className="flex justify-between text-xs font-black text-slate-700 mb-1">
                    <span>{row.label}</span>
                    <span>{currentAllocation[row.key].toFixed(1)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full bg-slate-700" style={{ width: `${clampPct(currentAllocation[row.key])}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 mb-3">Recommended Allocation (Risk Profile)</p>
            <div className="space-y-3">
              {allocationRows.map(row => (
                <div key={`recommended-${row.key}`}>
                  <div className="flex justify-between text-xs font-black text-emerald-800 mb-1">
                    <span>{row.label}</span>
                    <span>{recommendedAllocation[row.key].toFixed(1)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-emerald-200 overflow-hidden">
                    <div className="h-full bg-emerald-600" style={{ width: `${clampPct(recommendedAllocation[row.key])}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Reallocation Actions</p>
          {reallocationActions.length === 0 ? (
            <p className="text-sm font-semibold text-emerald-700">Allocation is within tolerance. No immediate action required.</p>
          ) : (
            <div className="space-y-2">
              {reallocationActions.map(action => {
                const direction = action.delta > 0 ? 'Increase' : 'Reduce';
                const directionColor = action.delta > 0 ? 'text-emerald-700' : 'text-rose-700';
                return (
                  <p key={action.key} className="text-sm font-semibold text-slate-700">
                    <span className={directionColor}>{direction}</span> {action.label} by {Math.abs(action.delta).toFixed(1)}% (
                    {formatCurrency(action.amount, state.profile.country)}).
                  </p>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-xs text-slate-500 mt-4">Recommended mix comes from your risk profile and improves return-risk consistency.</p>

        <AppButton
          tone="ghost"
          size="sm"
          onClick={() => setView('investment-plan')}
          className="mt-4 !px-0 text-slate-700 hover:text-slate-900"
          trailingIcon={<ArrowRight size={13} />}
        >
          Open allocation planner
        </AppButton>
      </SurfaceCard>
    );
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      <div>
        <SurfaceCard variant="dark" padding="none" className="p-5 md:p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Account Summary</p>
              <div>
                <p className="text-xs font-semibold text-slate-300">Total Portfolio</p>
                <h2 className="text-3xl md:text-4xl font-black tracking-tight">{formatCurrency(totalAssets, state.profile.country)}</h2>
                <p className="text-xs font-semibold text-slate-300 mt-1">Net worth: {formatCurrency(netWorth, state.profile.country)}</p>
              </div>
              <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black ${monthChangePct >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                {monthChangePct >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                {monthChangePct >= 0 ? 'Up' : 'Down'} {Math.abs(monthChangePct).toFixed(1)}% this month
              </div>
            </div>

            <div className="space-y-3 min-w-[250px]">
              <div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data Source</p>
                <p className="text-xs font-semibold text-slate-200 mt-1">Synced from profile, assets, liabilities, and planner inputs.</p>
                <p className="text-[11px] font-semibold text-slate-400 mt-2 inline-flex items-center gap-1"><RefreshCw size={12} /> Updated {lastRefreshLabel}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <StatusPill tone="neutral" className="border-slate-700 bg-slate-800 text-slate-200">
                  <Lock size={12} /> Encrypted
                </StatusPill>
                <StatusPill tone="neutral" className="border-slate-700 bg-slate-800 text-slate-200">
                  <ShieldCheck size={12} /> Secure Sync
                </StatusPill>
                <StatusPill tone="neutral" className="border-slate-700 bg-slate-800 text-slate-200">
                  <Info size={12} /> Audit Ready
                </StatusPill>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="inline-flex rounded-xl bg-slate-800 p-1 border border-slate-700">
              <button
                onClick={() => setMode('simple')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${mode === 'simple' ? 'bg-white text-slate-900' : 'text-slate-300'}`}
              >
                Simple View
              </button>
              <button
                onClick={() => setMode('advanced')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${mode === 'advanced' ? 'bg-white text-slate-900' : 'text-slate-300'}`}
              >
                Advanced View
              </button>
            </div>

            <div className="flex items-center gap-2">
              <AppButton
                onClick={() => setShowCustomizer(prev => !prev)}
                tone="dark"
                size="md"
                className="border-slate-700 bg-slate-800 text-slate-200"
                leadingIcon={<Settings2 size={13} />}
              >
                Customize Widgets
              </AppButton>
              <AppButton
                onClick={() => setView('settings')}
                tone="dark"
                size="md"
                className="border-slate-700 bg-slate-800 text-slate-200"
                leadingIcon={<ShieldCheck size={13} />}
              >
                Data Security
              </AppButton>
            </div>
          </div>
        </SurfaceCard>
      </div>

      {showCustomizer && (
        <SurfaceCard padding="none" className="border-slate-200 p-5 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <SlidersHorizontal size={16} className="text-slate-500" />
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Widget Controls</h3>
          </div>

          <div className="space-y-3">
            {(mode === 'simple' ? SIMPLE_WIDGETS : widgetOrder).map(widgetId => {
              const index = widgetOrder.indexOf(widgetId);
              const isHidden = hiddenWidgets.includes(widgetId);

              return (
                <div key={`customizer-${widgetId}`} className="rounded-2xl border border-slate-200 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-xs font-black text-slate-900">{WIDGET_META[widgetId].title}</p>
                    <p className="text-xs text-slate-500">{WIDGET_META[widgetId].description}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleWidgetVisibility(widgetId)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-700"
                    >
                      {isHidden ? <Eye size={12} /> : <EyeOff size={12} />}
                      {isHidden ? 'Show' : 'Hide'}
                    </button>
                    <button
                      onClick={() => moveWidget(widgetId, 'up')}
                      disabled={index <= 0}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-700 disabled:opacity-40"
                    >
                      Up
                    </button>
                    <button
                      onClick={() => moveWidget(widgetId, 'down')}
                      disabled={index < 0 || index === widgetOrder.length - 1}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-700 disabled:opacity-40"
                    >
                      Down
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </SurfaceCard>
      )}

      {visibleWidgets.length === 0 ? (
        <SurfaceCard padding="none" className="border-slate-200 p-8 text-center">
          <p className="text-lg font-black text-slate-900">No widgets visible</p>
          <p className="text-sm text-slate-500 mt-2">Use Customize Widgets to show at least one section.</p>
          <AppButton
            onClick={() => setHiddenWidgets([])}
            tone="dark"
            size="md"
            className="mt-4 border-slate-800 bg-slate-900 text-white"
          >
            Show All Widgets
          </AppButton>
        </SurfaceCard>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 md:gap-6">
          {visibleWidgets.map(widgetId => (
            <div key={`widget-${widgetId}`}>
              {renderWidget(widgetId)}
            </div>
          ))}
        </div>
      )}

      <SurfaceCard variant="muted" padding="none" className="p-4 md:p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 size={18} className="text-emerald-600 mt-0.5" />
          <div>
            <p className="text-sm font-black text-slate-900">Quick understanding in under 10 seconds</p>
            <p className="text-xs text-slate-600 mt-1">
              Focus on portfolio total, monthly cash flow status, debt pressure, and top alerts. Open each card for deep dive only when needed.
            </p>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
};

export default Dashboard;
