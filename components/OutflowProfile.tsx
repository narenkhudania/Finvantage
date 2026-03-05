
import React, { useState, useMemo } from 'react';
import { 
  Receipt, ShoppingCart, Users, Activity, Sparkles, Briefcase, 
  HeartPulse, Home, Zap, CreditCard, ArrowDownRight, ShieldCheck,
  Edit3, LayoutGrid, AlertCircle, TrendingDown, ChevronRight, Plus
} from 'lucide-react';
import { FinanceState, ExpenseItem } from '../types';
import { parseNumber } from '../lib/validation';
import { formatCurrency, getCurrencySymbol } from '../lib/currency';
import { monthlyIncomeFromDetailed } from '../lib/incomeMath';
import PlanningAssistStrip from './common/PlanningAssistStrip';

interface OutflowProfileProps {
  state: FinanceState;
  updateState: (data: Partial<FinanceState>) => void;
}

const EXPENSE_CATEGORIES = [
  { name: 'Household/Grocery/Maid', icon: ShoppingCart },
  { name: 'Parents Support', icon: Users },
  { name: 'Travel/Fuel', icon: Activity },
  { name: 'Festival/Gathering', icon: Sparkles },
  { name: 'Education', icon: Briefcase },
  { name: 'Gift/Charity', icon: HeartPulse },
  { name: 'Maintenance/Repair/Tax', icon: Home },
  { name: 'Medical Expenses', icon: Activity },
  { name: 'Utility Bills', icon: Zap },
  { name: 'Shopping/Dining', icon: ShoppingCart },
  { name: 'Personal Care/Gym', icon: Activity },
] as const;

const ESSENTIAL_EXPENSE_CATEGORIES = new Set([
  'Household/Grocery/Maid',
  'Parents Support',
  'Education',
  'Medical Expenses',
  'Utility Bills',
  'Maintenance/Repair/Tax',
]);

const OutflowProfile: React.FC<OutflowProfileProps> = ({ state, updateState }) => {
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [inflationShockPct, setInflationShockPct] = useState(6);
  const [discretionaryCutPct, setDiscretionaryCutPct] = useState(10);
  const [emiShockPct, setEmiShockPct] = useState(0);

  const handleExpenseChange = (categoryName: string, amount: number) => {
    const sanitized = Math.max(0, parseNumber(amount, 0));
    const existing = state.detailedExpenses.find(e => e.category === categoryName);
    let newExpenses;
    if (existing) {
      newExpenses = state.detailedExpenses.map(e => e.category === categoryName ? { ...e, amount: sanitized } : e);
    } else {
      const year = new Date().getFullYear();
      newExpenses = [...state.detailedExpenses, { category: categoryName, amount: sanitized, inflationRate: 6, tenure: 34, frequency: 'Monthly', startYear: year, endYear: year + 34 }];
    }
    updateState({ detailedExpenses: newExpenses });
  };

  const totalHouseholdIncome =
    monthlyIncomeFromDetailed(state.profile.income) +
    state.family.reduce((sum, f) => sum + monthlyIncomeFromDetailed(f.income), 0);

  const totalMonthlyExpenses = state.detailedExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalMonthlyDebt = state.loans.reduce((sum, l) => sum + l.emi, 0);
  const totalMonthlyOutflow = totalMonthlyExpenses + totalMonthlyDebt;
  const primaryInflow = monthlyIncomeFromDetailed(state.profile.income);

  const currencyCountry = state.profile.country;
  const currencySymbol = getCurrencySymbol(currencyCountry);
  const outflowAnalysis = useMemo(() => {
    const expenseRows = state.detailedExpenses
      .map(item => ({ category: item.category, amount: Math.max(0, Number(item.amount || 0)) }))
      .filter(item => item.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    const essentialExpenses = expenseRows
      .filter(item => ESSENTIAL_EXPENSE_CATEGORIES.has(item.category))
      .reduce((sum, item) => sum + item.amount, 0);
    const discretionaryExpenses = Math.max(0, totalMonthlyExpenses - essentialExpenses);
    const stressedEssential = essentialExpenses * (1 + inflationShockPct / 100);
    const stressedDiscretionary = discretionaryExpenses * (1 + inflationShockPct / 100) * (1 - discretionaryCutPct / 100);
    const stressedDebt = totalMonthlyDebt * (1 + emiShockPct / 100);
    const stressedOutflow = stressedEssential + stressedDiscretionary + stressedDebt;
    const stressedSurplus = totalHouseholdIncome - stressedOutflow;
    const burnToIncomePct = totalHouseholdIncome > 0 ? (stressedOutflow / totalHouseholdIncome) * 100 : 0;
    const top3Spend = expenseRows.slice(0, 3).reduce((sum, item) => sum + item.amount, 0);
    const top3ConcentrationPct = totalMonthlyExpenses > 0 ? (top3Spend / totalMonthlyExpenses) * 100 : 0;
    const annualizedBurn = totalMonthlyOutflow * 12;
    const inflationRate = Math.max(0, inflationShockPct) / 100;
    const projectedBurn1Y = totalMonthlyOutflow * Math.pow(1 + inflationRate, 1);
    const projectedBurn5Y = totalMonthlyOutflow * Math.pow(1 + inflationRate, 5);
    const projectedBurn10Y = totalMonthlyOutflow * Math.pow(1 + inflationRate, 10);
    const liquidAssets = state.assets
      .filter(asset => asset.category === 'Liquid' || asset.category === 'Debt')
      .reduce((sum, asset) => sum + Math.max(0, Number(asset.currentValue || 0)), 0);
    const emergencyFundMonths = totalMonthlyOutflow > 0 ? liquidAssets / totalMonthlyOutflow : 0;
    const outlierCategories = expenseRows.filter(item => {
      if (totalMonthlyExpenses <= 0) return false;
      return (item.amount / totalMonthlyExpenses) * 100 >= 20;
    });
    const primaryIncomeDependencyPct = totalHouseholdIncome > 0 ? (primaryInflow / totalHouseholdIncome) * 100 : 0;

    const now = new Date();
    const burnTrend = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const monthExpenseTx = state.transactions
        .filter(txn => {
          const txnDate = new Date(txn.date);
          return txn.type === 'expense' && txnDate.getFullYear() === date.getFullYear() && txnDate.getMonth() === date.getMonth();
        })
        .reduce((sum, txn) => sum + Math.max(0, Number(txn.amount || 0)), 0);
      const monthTotal = monthExpenseTx > 0 ? monthExpenseTx + totalMonthlyDebt : totalMonthlyOutflow;
      return {
        label: `${date.toLocaleString(undefined, { month: 'short' })}`,
        value: monthTotal,
      };
    });
    const currentBurn = burnTrend[burnTrend.length - 1]?.value || totalMonthlyOutflow;
    const previousBurn = burnTrend[burnTrend.length - 2]?.value || totalMonthlyOutflow;
    const burnTrendChangePct = previousBurn > 0 ? ((currentBurn - previousBurn) / previousBurn) * 100 : 0;

    return {
      expenseRows,
      essentialExpenses,
      discretionaryExpenses,
      stressedOutflow,
      stressedSurplus,
      stressedDebt,
      burnToIncomePct,
      top3ConcentrationPct,
      requiredCorrection: Math.max(0, stressedOutflow - totalHouseholdIncome),
      annualizedBurn,
      projectedBurn1Y,
      projectedBurn5Y,
      projectedBurn10Y,
      liquidAssets,
      emergencyFundMonths,
      outlierCategories,
      primaryIncomeDependencyPct,
      burnTrend,
      burnTrendChangePct,
    };
  }, [state.detailedExpenses, state.assets, state.transactions, totalMonthlyExpenses, totalMonthlyDebt, totalMonthlyOutflow, totalHouseholdIncome, primaryInflow, inflationShockPct, discretionaryCutPct, emiShockPct]);

  const outflowAssistStats = useMemo(() => {
    const burnTone = outflowAnalysis.burnToIncomePct <= 65
      ? 'positive'
      : outflowAnalysis.burnToIncomePct <= 85
        ? 'warning'
        : 'critical';
    const emergencyTone = outflowAnalysis.emergencyFundMonths >= 12
      ? 'positive'
      : outflowAnalysis.emergencyFundMonths >= 6
        ? 'warning'
        : 'critical';
    const surplusTone = outflowAnalysis.stressedSurplus >= 0 ? 'positive' : 'critical';

    return [
      {
        label: 'Monthly Burn',
        value: formatCurrency(totalMonthlyOutflow, currencyCountry),
        tone: burnTone,
      },
      {
        label: 'Burn / Income',
        value: `${outflowAnalysis.burnToIncomePct.toFixed(1)}%`,
        tone: burnTone,
      },
      {
        label: 'Emergency Cover',
        value: `${outflowAnalysis.emergencyFundMonths.toFixed(1)} months`,
        tone: emergencyTone,
      },
      {
        label: 'Stressed Surplus',
        value: formatCurrency(outflowAnalysis.stressedSurplus, currencyCountry),
        tone: surplusTone,
      },
      {
        label: 'Top-3 Concentration',
        value: `${outflowAnalysis.top3ConcentrationPct.toFixed(1)}%`,
        tone: outflowAnalysis.top3ConcentrationPct <= 55 ? 'positive' : 'warning',
      },
    ] as const;
  }, [outflowAnalysis, totalMonthlyOutflow, currencyCountry]);

  return (
    <div className="space-y-8 md:space-y-12 animate-in fade-in duration-700 pb-24">
      <PlanningAssistStrip
        title="Track spend quality, not just spend totals"
        description="Use stress controls to evaluate affordability before adding new goals or liabilities."
        tip="If burn-to-income stays above 80%, prioritize trimming discretionary categories first."
        stats={outflowAssistStats.map((stat) => ({
          label: stat.label,
          value: stat.value,
          tone: stat.tone,
        }))}
      />

      {totalHouseholdIncome > 0 && totalMonthlyOutflow > totalHouseholdIncome && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-2xl px-6 py-4 text-xs font-bold uppercase tracking-widest flex items-center gap-3">
          <AlertCircle size={16} />
          Monthly outflow exceeds household income. Review expense entries or loan EMIs.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_1fr] gap-6">
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6 text-left">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Burn Analysis Lab</p>
              <h3 className="text-2xl font-black text-slate-900">Stress-Test Monthly Burn</h3>
            </div>
            <div className="px-3 py-2 rounded-2xl border border-slate-200 bg-slate-50 text-right">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Top-3 concentration</p>
              <p className="text-lg font-black text-slate-900">{outflowAnalysis.top3ConcentrationPct.toFixed(1)}%</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Inflation stress</label>
                <span className="text-sm font-black text-slate-900">{inflationShockPct}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                step={1}
                value={inflationShockPct}
                onChange={(event) => setInflationShockPct(Number(event.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-full appearance-none accent-teal-600 cursor-pointer"
              />
            </div>
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Discretionary cut</label>
                <span className="text-sm font-black text-slate-900">{discretionaryCutPct}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={60}
                step={1}
                value={discretionaryCutPct}
                onChange={(event) => setDiscretionaryCutPct(Number(event.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-full appearance-none accent-emerald-500 cursor-pointer"
              />
            </div>
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">EMI shock</label>
                <span className="text-sm font-black text-slate-900">{emiShockPct}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={emiShockPct}
                onChange={(event) => setEmiShockPct(Number(event.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-full appearance-none accent-amber-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Essential monthly</p>
              <p className="text-lg font-black text-slate-900 mt-1">{formatCurrency(outflowAnalysis.essentialExpenses, currencyCountry)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Discretionary monthly</p>
              <p className="text-lg font-black text-slate-900 mt-1">{formatCurrency(outflowAnalysis.discretionaryExpenses, currencyCountry)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Stressed outflow</p>
              <p className="text-lg font-black text-slate-900 mt-1">{formatCurrency(outflowAnalysis.stressedOutflow, currencyCountry)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Stressed surplus</p>
              <p className={`text-lg font-black mt-1 ${outflowAnalysis.stressedSurplus >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatCurrency(outflowAnalysis.stressedSurplus, currencyCountry)}
              </p>
            </div>
          </div>
        </div>

        <div className="surface-dark p-6 md:p-8 rounded-[2.5rem] text-white space-y-5 shadow-xl text-left">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Outflow Signals</p>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Burn to income</p>
            <p className="text-2xl font-black text-teal-400 mt-1">{outflowAnalysis.burnToIncomePct.toFixed(1)}%</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Burn trend</p>
            <p className={`text-lg font-black mt-1 ${outflowAnalysis.burnTrendChangePct <= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {outflowAnalysis.burnTrendChangePct >= 0 ? '+' : ''}{outflowAnalysis.burnTrendChangePct.toFixed(1)}% vs last month
            </p>
            <p className="text-xs font-semibold text-slate-300 mt-1">
              Annualized burn: {formatCurrency(outflowAnalysis.annualizedBurn, currencyCountry)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Future burn projection</p>
            <div className="space-y-1 mt-2 text-xs font-semibold text-slate-200">
              <p>1Y: {formatCurrency(outflowAnalysis.projectedBurn1Y, currencyCountry)} / month</p>
              <p>5Y: {formatCurrency(outflowAnalysis.projectedBurn5Y, currencyCountry)} / month</p>
              <p>10Y: {formatCurrency(outflowAnalysis.projectedBurn10Y, currencyCountry)} / month</p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Emergency fund adequacy</p>
            <p className={`text-lg font-black mt-1 ${outflowAnalysis.emergencyFundMonths >= 12 ? 'text-emerald-300' : outflowAnalysis.emergencyFundMonths >= 6 ? 'text-amber-300' : 'text-rose-300'}`}>
              {outflowAnalysis.emergencyFundMonths.toFixed(1)} months
            </p>
            <p className="text-xs font-semibold text-slate-300 mt-1">
              Liquid buffer: {formatCurrency(outflowAnalysis.liquidAssets, currencyCountry)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Primary income dependency</p>
            <p className="text-lg font-black text-teal-300 mt-1">{outflowAnalysis.primaryIncomeDependencyPct.toFixed(1)}%</p>
          </div>
          <div className="space-y-3">
            {outflowAnalysis.expenseRows.slice(0, 4).map(row => (
              <div key={row.category} className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <span>{row.category}</span>
                  <span>{formatCurrency(row.amount, currencyCountry)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-400"
                    style={{ width: `${Math.min(100, (row.amount / (totalMonthlyExpenses || 1)) * 100)}%` }}
                  />
                </div>
              </div>
              ))}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Expense leak/outliers</p>
            {outflowAnalysis.outlierCategories.length ? (
              <div className="space-y-1.5 mt-2">
                {outflowAnalysis.outlierCategories.slice(0, 3).map(row => (
                  <p key={row.category} className="text-xs font-semibold text-slate-200">
                    {row.category}: {formatCurrency(row.amount, currencyCountry)}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-xs font-semibold text-slate-300 mt-2">
                No category is above 20% of expense base.
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Action cue</p>
            <p className="text-sm font-semibold text-slate-200 mt-2">
              {outflowAnalysis.requiredCorrection > 0
                ? `Reduce or defer at least ${formatCurrency(outflowAnalysis.requiredCorrection, currencyCountry)} monthly to stay cash-flow positive under this scenario.`
                : 'Current scenario remains cash-flow positive. You can route surplus to goals or emergency reserves.'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-10">
        <div className="lg:col-span-2 space-y-8">
           <div className="bg-white p-8 md:p-14 rounded-[3.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-center mb-10 md:mb-14">
                 <div>
                    <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight text-left">Lifestyle Categories</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 text-left">Operational Spend Nodes</p>
                 </div>
                 <div className="bg-teal-50 text-teal-600 px-4 py-2 rounded-2xl text-[10px] font-black uppercase border border-teal-100">Audit Status: Active</div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {EXPENSE_CATEGORIES.map((cat) => {
                    const expense = state.detailedExpenses.find(e => e.category === cat.name);
                    const isEditing = editingCategory === cat.name;
                    return (
                       <div key={cat.name} className={`p-6 rounded-[2.5rem] border-2 transition-all flex items-center gap-4 group ${isEditing ? 'bg-teal-50 border-teal-600 shadow-lg' : 'bg-slate-50 border-slate-100 hover:border-teal-300'}`}>
                          <div className={`p-3 md:p-4 rounded-2xl group-hover:bg-teal-600 group-hover:text-white transition-all ${isEditing ? 'bg-teal-600 text-white' : 'bg-white text-slate-400'}`}>
                             <cat.icon size={20}/>
                          </div>
                          <div className="flex-1 min-w-0">
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate text-left">{cat.name}</p>
                             <div className="relative">
                                <span className={`absolute left-0 top-1/2 -translate-y-1/2 font-black text-lg ${isEditing ? 'text-teal-600' : 'text-slate-300'}`}>{currencySymbol}</span>
                                <input 
                                   type="number" 
                                   value={expense?.amount || ''} 
                                   onFocus={() => setEditingCategory(cat.name)}
                                   onBlur={() => setEditingCategory(null)}
                                   onChange={e => handleExpenseChange(cat.name, parseFloat(e.target.value) || 0)}
                                   className="w-full bg-transparent pl-5 font-black text-xl outline-none"
                                   placeholder="0"
                                />
                             </div>
                          </div>
                          <button onClick={() => setEditingCategory(isEditing ? null : cat.name)} className={`p-2 transition-colors ${isEditing ? 'text-teal-600' : 'text-slate-300 hover:text-teal-600'}`}><Edit3 size={16}/></button>
                       </div>
                    );
                 })}
              </div>
           </div>
        </div>

        <div className="space-y-8 md:space-y-10">
           {/* Debt Servicing Silo */}
           <div className="surface-dark p-10 rounded-[4rem] text-white space-y-10 relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 p-4 opacity-5"><CreditCard size={120}/></div>
              <div className="space-y-2 relative z-10 text-left">
                 <h3 className="text-2xl font-black leading-none">Servicing Silo</h3>
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Monthly EMI Logistics</p>
              </div>
              
              <div className="space-y-4 relative z-10 max-h-[350px] overflow-y-auto no-scrollbar pr-2">
                 {state.loans.map(loan => (
                    <div key={loan.id} className="flex justify-between items-center p-5 bg-white/5 border border-white/10 rounded-3xl group hover:bg-white/10 transition-all">
                       <div className="min-w-0 text-left">
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest truncate">{loan.type}</p>
                          <p className="text-sm font-black truncate">{loan.source}</p>
                       </div>
                       <p className="text-xl font-black text-rose-400">{formatCurrency(loan.emi, currencyCountry)}</p>
                    </div>
                 ))}
                 {state.loans.length === 0 && (
                   <div className="p-8 border-2 border-dashed border-white/10 rounded-3xl text-center">
                      <ShieldCheck size={32} className="text-white/20 mx-auto mb-4"/>
                      <p className="text-xs text-white/40 font-bold uppercase tracking-widest">No Active Liabilities</p>
                   </div>
                 )}
              </div>

              <div className="pt-8 border-t border-white/5 relative z-10 flex justify-between items-center">
                 <p className="text-[10px] font-black uppercase text-slate-500">Global EMI Aggregation</p>
                 <p className="text-2xl font-black text-rose-500">{formatCurrency(totalMonthlyDebt, currencyCountry)}</p>
              </div>
           </div>

           {/* Inflow Context Node */}
           <div className="bg-white p-8 md:p-10 rounded-[3.5rem] border border-slate-200 shadow-sm space-y-8">
              <div className="flex items-center gap-6">
                 <div className="p-4 bg-teal-50 text-teal-600 rounded-2xl shadow-inner"><ShieldCheck size={28}/></div>
                 <div className="text-left">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inflow Buffer</p>
                    <h4 className="text-lg font-black text-slate-900">{formatCurrency(primaryInflow - totalMonthlyOutflow, currencyCountry)} Surplus</h4>
                 </div>
              </div>
              <div className="space-y-4">
                 <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase"><span>Consumption Ratio</span><span>{Math.round((totalMonthlyOutflow / (primaryInflow || 1)) * 100)}%</span></div>
                 <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 transition-all duration-1000" style={{ width: `${Math.min(100, (totalMonthlyOutflow / (primaryInflow || 1)) * 100)}%` }} />
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default OutflowProfile;
