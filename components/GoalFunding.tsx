
import React, { useMemo, useState } from 'react';
import { 
  TrendingUp, TrendingDown, Target, Landmark, 
  ArrowUpRight, ArrowDownRight, Calendar, Calculator,
  ChevronRight, ChevronDown, CheckCircle2, AlertCircle,
  PieChart, Activity, Wallet, Info, Search, ShieldCheck,
  Zap, ArrowRight, DollarSign, ListOrdered, BarChartHorizontal
} from 'lucide-react';
import { FinanceState, Goal, RelativeDate, Asset } from '../types';
import { formatCurrency, getCurrencySymbol } from '../lib/currency';
import { annualizeAmount, buildDiscountFactors, getGoalIntervalYears, getLifeExpectancyYear, getReturnRateForYear, getRiskReturnAssumption } from '../lib/financeMath';
import { inferTenureMonths } from '../lib/loanMath';

const GoalFunding: React.FC<{ state: FinanceState }> = ({ state }) => {
  const [activeTab, setActiveTab] = useState<'audit' | 'timeline'>('audit');
  const currencyCountry = state.profile.country;
  const currencySymbol = getCurrencySymbol(currencyCountry);

  const currentYear = new Date().getFullYear();
  const birthYear = state.profile.dob ? new Date(state.profile.dob).getFullYear() : currentYear - 30;

  const resolveYear = (rel: RelativeDate): number => {
    switch (rel.type) {
      case 'Year': return rel.value;
      case 'Age': return birthYear + rel.value;
      case 'Retirement': return birthYear + state.profile.retirementAge + rel.value;
      case 'LifeExpectancy': return birthYear + state.profile.lifeExpectancy + rel.value;
      default: return rel.value;
    }
  };

  const BUCKETS = [
    { key: 'directEquity', label: 'Direct Equity' },
    { key: 'savings', label: 'Savings A/C' },
    { key: 'mutualFunds', label: 'Mutual Funds' },
    { key: 'epf', label: 'EPF/GPF/DSOP' },
    { key: 'nps', label: 'NPS-Employer' },
    { key: 'netSavings', label: 'Net Savings' },
  ] as const;

  type BucketKey = typeof BUCKETS[number]['key'];

  const mapAssetToBucket = (asset: Asset): BucketKey | null => {
    const sub = asset.subCategory.toLowerCase();
    if (asset.category === 'Equity') {
      if (sub.includes('mutual') || sub.includes('mf') || sub.includes('index')) return 'mutualFunds';
      return 'directEquity';
    }
    if (asset.category === 'Debt') {
      if (sub.includes('epf') || sub.includes('gpf') || sub.includes('dsop')) return 'epf';
      if (sub.includes('nps')) return 'nps';
      return 'savings';
    }
    if (asset.category === 'Liquid') return 'savings';
    return null;
  };

  const mapCommitmentToBucket = (label: string): BucketKey => {
    const l = label.toLowerCase();
    if (l.includes('nps')) return 'nps';
    if (l.includes('epf') || l.includes('gpf') || l.includes('dsop')) return 'epf';
    if (l.includes('mutual') || l.includes('mf')) return 'mutualFunds';
    if (l.includes('equity')) return 'directEquity';
    return 'savings';
  };


  const getGoalAmountForYear = (goal: Goal, year: number) => {
    const s = resolveYear(goal.startDate);
    const e = resolveYear(goal.endDate);
    if (year < s || year > e) return 0;
    const yearsFromStart = Math.max(0, year - s);
    const baseAmount = goal.startGoalAmount ?? goal.targetAmountToday;
    const inflated = baseAmount * Math.pow(1 + (goal.inflationRate / 100), yearsFromStart);
    if (!goal.isRecurring) {
      return year === e ? inflated : 0;
    }
    const interval = getGoalIntervalYears(goal.frequency);
    if (interval > 1) {
      return (year - s) % interval === 0 ? inflated : 0;
    }
    if (goal.frequency === 'Monthly') {
      return inflated * 12;
    }
    return inflated;
  };


  const orderedGoals = useMemo(() => {
    return state.goals.slice().sort((a, b) => a.priority - b.priority);
  }, [state.goals]);

  const assumedReturn = getRiskReturnAssumption(state.riskProfile?.level);
  const retirementYear = state.profile.dob ? (new Date(state.profile.dob).getFullYear() + state.profile.retirementAge) : (currentYear + 30);

  const fundingTimeline = useMemo(() => {
    const startYear = currentYear + 1;
    const endYear = getLifeExpectancyYear(state.profile.dob, state.profile.lifeExpectancy) ?? (currentYear + 35);

    const assets = state.assets || [];
    const openingBalances: Record<BucketKey, number> = {
      directEquity: 0,
      savings: 0,
      mutualFunds: 0,
      epf: 0,
      nps: 0,
      netSavings: 0,
    };

    assets.forEach(a => {
      const bucket = mapAssetToBucket(a);
      if (!bucket) return;
      openingBalances[bucket] += a.currentValue;
    });

    const commitments = state.investmentCommitments || [];
    const hasCashflows = (state.cashflows || []).length > 0;

    const incomeMembers = [
      { income: state.profile.income },
      ...state.family.map(f => ({ income: f.income })),
    ];
    const baseMonthlyIncome = incomeMembers.reduce((sum, m) => {
      return sum + (m.income.salary || 0) + (m.income.bonus || 0) + (m.income.reimbursements || 0) +
        (m.income.business || 0) + (m.income.rental || 0) + (m.income.investment || 0);
    }, 0);
    const totalIncomeForGrowth = incomeMembers.reduce((sum, m) => {
      return sum + (m.income.salary || 0) + (m.income.bonus || 0) + (m.income.reimbursements || 0) +
        (m.income.business || 0) + (m.income.rental || 0) + (m.income.investment || 0);
    }, 0);
    const weightedGrowth = incomeMembers.reduce((sum, m) => {
      const memberTotal = (m.income.salary || 0) + (m.income.bonus || 0) + (m.income.reimbursements || 0) +
        (m.income.business || 0) + (m.income.rental || 0) + (m.income.investment || 0);
      return sum + (memberTotal * (m.income.expectedIncrease || 0));
    }, 0);
    const incomeGrowthRate = totalIncomeForGrowth > 0 ? (weightedGrowth / totalIncomeForGrowth) / 100 : 0;

    const baseMonthlyExpenses = state.detailedExpenses.reduce((sum, e) => sum + e.amount, 0) || state.profile.monthlyExpenses;

    const timeline: any[] = [];
    let balances = { ...openingBalances };

    const discountFactors = buildDiscountFactors(currentYear, endYear, retirementYear, assumedReturn);

    for (let year = startYear; year <= endYear; year++) {
      const yearIndex = year - startYear;
      const growthFactor = Math.pow(1 + incomeGrowthRate, yearIndex);

      const inflow = hasCashflows
        ? (state.cashflows || []).reduce((sum, flow) => {
            if (flow.flowType && flow.flowType !== 'Income') return sum;
            if (year < flow.startYear || year > flow.endYear) return sum;
            const yearsFromStart = Math.max(0, year - flow.startYear);
            const baseAnnual = annualizeAmount(flow.amount, flow.frequency);
            const adjusted = baseAnnual * Math.pow(1 + (flow.growthRate || 0) / 100, yearsFromStart);
            if (flow.frequency === 'One time') {
              return sum + (year === flow.startYear ? adjusted : 0);
            }
            return sum + adjusted;
          }, 0)
        : baseMonthlyIncome * 12 * growthFactor;

      const expenseFromFlows = (state.cashflows || []).reduce((sum, flow) => {
        if (flow.flowType !== 'Expense') return sum;
        if (year < flow.startYear || year > flow.endYear) return sum;
        const yearsFromStart = Math.max(0, year - flow.startYear);
        const baseAnnual = annualizeAmount(flow.amount, flow.frequency);
        const adjusted = baseAnnual * Math.pow(1 + (flow.growthRate || 0) / 100, yearsFromStart);
        if (flow.frequency === 'One time') {
          return sum + (year === flow.startYear ? adjusted : 0);
        }
        return sum + adjusted;
      }, 0);

      const expenseTotal = (state.detailedExpenses || []).length > 0
        ? state.detailedExpenses.reduce((sum, e) => {
            const frequency = e.frequency || 'Monthly';
            const sYear = e.startYear ?? startYear;
            const eYear = e.endYear ?? endYear;
            if (year < sYear || year > eYear) return sum;
            const yearsFromStart = Math.max(0, year - sYear);
            const baseAnnual = annualizeAmount(e.amount, frequency);
            const adjusted = baseAnnual * Math.pow(1 + (e.inflationRate || 0) / 100, yearsFromStart);
            if (frequency === 'One time') {
              return sum + (year === sYear ? adjusted : 0);
            }
            return sum + adjusted;
          }, 0) + expenseFromFlows
        : (baseMonthlyExpenses * 12 * Math.pow(1.06, yearIndex)) + expenseFromFlows;

      const debtTotal = state.loans.reduce((sum, loan) => {
        const start = loan.startYear ?? startYear;
        const tenureMonths = inferTenureMonths(loan).months;
        const tenureYears = Math.ceil(tenureMonths / 12);
        const end = start + Math.max(0, tenureYears - 1);
        if (year < start || year > end) return sum;
        return sum + (loan.emi || 0) * 12;
      }, 0);

      const contributions: Record<BucketKey, number> = {
        directEquity: 0,
        savings: 0,
        mutualFunds: 0,
        epf: 0,
        nps: 0,
        netSavings: 0,
      };

      commitments.forEach(c => {
        if (year < c.startYear || year > c.endYear) return;
        const yearsFromStart = Math.max(0, year - c.startYear);
        const baseAnnual = annualizeAmount(c.amount, c.frequency);
        const adjusted = baseAnnual * Math.pow(1 + (c.stepUp || 0) / 100, yearsFromStart);
        const bucket = mapCommitmentToBucket(c.label);
        contributions[bucket] += adjusted;
      });

      assets.forEach(a => {
        if (!a.monthlyContribution || !a.contributionFrequency) return;
        const sYear = a.contributionStartYear ?? startYear;
        const eYear = a.contributionEndYear ?? endYear;
        if (year < sYear || year > eYear) return;
        const yearsFromStart = Math.max(0, year - sYear);
        const baseAnnual = annualizeAmount(a.monthlyContribution, a.contributionFrequency);
        const adjusted = baseAnnual * Math.pow(1 + (a.contributionStepUp || 0) / 100, yearsFromStart);
        const bucket = mapAssetToBucket(a);
        if (bucket) contributions[bucket] += adjusted;
      });

      const committedTotal = BUCKETS.filter(b => b.key !== 'netSavings')
        .reduce((sum, b) => sum + contributions[b.key], 0);
      const netSurplus = inflow - expenseTotal - debtTotal - committedTotal;
      contributions.netSavings = netSurplus;
      const contributionTotal = Object.values(contributions).reduce((sum, v) => sum + v, 0);

      const opening = { ...balances };
      const openingTotal = BUCKETS.filter(b => b.key !== 'netSavings')
        .reduce((sum, b) => sum + opening[b.key], 0);

      const goalMap: Record<string, number> = {};
      const goalNominalMap: Record<string, number> = {};
      orderedGoals.forEach(goal => {
        const nominal = getGoalAmountForYear(goal, year);
        const factor = discountFactors[year] || 1;
        goalNominalMap[goal.id] = nominal;
        goalMap[goal.id] = nominal > 0 ? (nominal / factor) : 0;
      });
      const goalTotal = Object.values(goalMap).reduce((sum, v) => sum + v, 0);

      const withdrawals: Record<BucketKey, number> = {
        directEquity: 0,
        savings: 0,
        mutualFunds: 0,
        epf: 0,
        nps: 0,
        netSavings: 0,
      };

      if (openingTotal > 0) {
        BUCKETS.forEach(b => {
          const weight = opening[b.key] / openingTotal;
          withdrawals[b.key] = goalTotal * weight;
        });
      } else {
        withdrawals.netSavings = goalTotal;
      }

      const withdrawalTotal = Object.values(withdrawals).reduce((sum, v) => sum + v, 0);
      const fundingRatio = goalTotal > 0 ? Math.min(1, Math.max(0, withdrawalTotal / goalTotal)) : 1;

      const goalAchievements: Record<string, number> = {};
      orderedGoals.forEach(goal => {
        goalAchievements[goal.id] = goalMap[goal.id] > 0 ? (fundingRatio * 100) : 0;
      });

      const returns: Record<BucketKey, number> = {
        directEquity: 0,
        savings: 0,
        mutualFunds: 0,
        epf: 0,
        nps: 0,
        netSavings: 0,
      };
      const closing: Record<BucketKey, number> = {
        directEquity: 0,
        savings: 0,
        mutualFunds: 0,
        epf: 0,
        nps: 0,
        netSavings: 0,
      };

      const returnRate = getReturnRateForYear(year, currentYear, retirementYear, assumedReturn);
      BUCKETS.forEach(b => {
        const baseValue = opening[b.key] + contributions[b.key] - withdrawals[b.key];
        const growth = baseValue * (returnRate / 100);
        returns[b.key] = growth;
        closing[b.key] = baseValue + growth;
      });

      const returnTotal = Object.values(returns).reduce((sum, v) => sum + v, 0);
      const closingTotal = Object.values(closing).reduce((sum, v) => sum + v, 0);

      timeline.push({
        year,
        age: birthYear ? year - birthYear : 30 + (year - currentYear),
        opening,
        openingTotal,
        contributions,
        contributionTotal,
        goals: goalMap,
        goalsNominal: goalNominalMap,
        goalTotal,
        withdrawals,
        withdrawalTotal,
        returns,
        returnTotal,
        closing,
        closingTotal,
        achievementPct: fundingRatio * 100,
        goalAchievements,
      });

      balances = { ...closing };
    }

    return timeline;
  }, [state, currentYear, orderedGoals, assumedReturn, resolveYear, birthYear]);

  const auditData = useMemo(() => {
    const s = state.profile.income;
    const netSalaryPa = (s.salary || 0) * 12;
    const dividendPa = (s.investment || 0) * 12;
    const totalInflowPa = netSalaryPa + dividendPa;
    const livingExpensesPa = (state.profile.monthlyExpenses || 0) * 12;
    const fallbackSavings = [
      { label: "NPS & EPF", value: 180000 },
      { label: "Portfolio (Eq/MF)", value: 840000 }
    ];
    const commitmentSavings = (state.investmentCommitments || []).map(c => ({
      label: c.label,
      value: (c.frequency === 'Monthly' ? c.amount * 12
        : c.frequency === 'Quarterly' ? c.amount * 4
        : c.amount),
    }));
    const savings = commitmentSavings.length > 0 ? commitmentSavings : fallbackSavings;
    const totalCommittedPa = savings.reduce((sum, i) => sum + i.value, 0);
    const carLoanPa = state.loans.find(l => l.type === 'Car Loan')?.emi ? (state.loans.find(l => l.type === 'Car Loan')!.emi * 12) : 240000;
    const homeLoanPa = state.loans.find(l => l.type === 'Home Loan')?.emi ? (state.loans.find(l => l.type === 'Home Loan')!.emi * 12) : 840000;
    const totalRepaymentsPa = carLoanPa + homeLoanPa;
    const totalOutflowPa = livingExpensesPa + totalCommittedPa + totalRepaymentsPa;
    const netCashFlowPa = totalInflowPa - totalOutflowPa;

    return {
      incomes: [
        { label: "Net Salary Income", value: netSalaryPa },
        { label: "Dividend Income", value: dividendPa }
      ],
      totalInflowPa,
      expenses: [{ label: "Living Expenses", value: livingExpensesPa }],
      totalExpensesPa: livingExpensesPa,
      savings,
      totalSavingsPa: totalCommittedPa,
      repayments: [
        { label: "Vehicle Loans", value: carLoanPa },
        { label: "Housing Loans", value: homeLoanPa }
      ],
      totalRepaymentsPa,
      totalOutflowPa,
      netCashFlowPa
    };
  }, [state]);

  return (
    <div className="space-y-8 md:space-y-12 animate-in fade-in duration-1000 pb-24">
      {/* Strategic Header */}
      <div className="surface-dark p-8 md:p-16 rounded-[2.5rem] md:rounded-[5rem] text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-600/10 blur-[120px] rounded-full translate-x-1/4 -translate-y-1/4" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8 md:gap-12">
          <div className="space-y-4 md:space-y-6">
            <div className="inline-flex items-center gap-2 md:gap-3 px-3 md:px-4 py-1.5 md:py-2 bg-teal-500/10 text-teal-300 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] border border-teal-500/20">
              <Zap size={14}/> Household Liquidity Engine
            </div>
            <h2 className="text-3xl md:text-7xl font-black tracking-tighter leading-tight md:leading-[0.85]">Cashflow <br/><span className="text-teal-500">Radar.</span></h2>
            <p className="text-slate-400 text-sm md:text-lg font-medium max-w-lg leading-relaxed">
              Consolidated audit of annual inflows versus committed outflows and lifestyle burn.
            </p>
          </div>
          
          <div className="flex flex-col gap-4 w-full md:w-auto">
            <div className={`bg-white/5 border border-white/10 p-8 md:p-10 rounded-[2rem] md:rounded-[4rem] backdrop-blur-xl flex flex-col items-center gap-2 md:gap-3 shadow-inner md:min-w-[320px] w-full`}>
               <p className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest">Net Annual Cash Flow</p>
               <h4 className={`text-3xl md:text-5xl font-black tracking-tighter ${auditData.netCashFlowPa >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                  {formatCurrency(Math.abs(auditData.netCashFlowPa), currencyCountry)}
               </h4>
               <div className={`flex items-center gap-2 mt-1 md:mt-2 text-[9px] md:text-[10px] font-bold uppercase tracking-widest px-3 md:px-4 py-1 md:py-1.5 rounded-full border ${auditData.netCashFlowPa >= 0 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20'}`}>
                  {auditData.netCashFlowPa >= 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                  {auditData.netCashFlowPa >= 0 ? 'Surplus Capacity' : 'Deficit Detected'}
               </div>
            </div>
            <div className="flex p-1 bg-white/5 border border-white/10 rounded-2xl w-full">
               <button onClick={() => setActiveTab('audit')} className={`flex-1 py-3 px-4 md:px-8 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'audit' ? 'bg-teal-600 text-white shadow-xl' : 'text-slate-400 hover:text-white'}`}>Audit</button>
               <button onClick={() => setActiveTab('timeline')} className={`flex-1 py-3 px-4 md:px-8 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'timeline' ? 'bg-teal-600 text-white shadow-xl' : 'text-slate-400 hover:text-white'}`}>Timeline</button>
            </div>
          </div>
        </div>
      </div>

      {activeTab === 'audit' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-10 animate-in slide-in-from-bottom-6 duration-700">
           <div className="space-y-6 md:space-y-8">
              <div className="bg-white p-8 md:p-10 rounded-[2.5rem] md:rounded-[4rem] border border-slate-200 shadow-sm">
                 <div className="flex items-center justify-between mb-6 md:mb-8 border-b border-slate-50 pb-4 md:pb-6">
                    <div className="flex items-center gap-3 md:gap-4">
                       <div className="p-2.5 md:p-3 bg-teal-50 text-teal-600 rounded-xl md:rounded-2xl"><Calculator size={20}/></div>
                       <h3 className="text-lg md:text-xl font-black text-slate-900">Incomes</h3>
                    </div>
                    <p className="text-xs md:text-sm font-black text-slate-900">{formatCurrency(auditData.totalInflowPa, currencyCountry)}</p>
                 </div>
                 <div className="space-y-4">
                    {auditData.incomes.map((inc, i) => (
                       <div key={i} className="flex justify-between items-center py-1 md:py-2">
                          <span className="text-xs md:text-sm font-bold text-slate-500">{inc.label}</span>
                          <span className="text-xs md:text-sm font-black text-slate-900">{formatCurrency(inc.value, currencyCountry)}</span>
                       </div>
                    ))}
                 </div>
              </div>

              <div className="bg-white p-8 md:p-10 rounded-[2.5rem] md:rounded-[4rem] border border-slate-200 shadow-sm">
                 <div className="flex items-center justify-between mb-6 md:mb-8 border-b border-slate-50 pb-4 md:pb-6">
                    <div className="flex items-center gap-3 md:gap-4">
                       <div className="p-2.5 md:p-3 bg-rose-50 text-rose-500 rounded-xl md:rounded-2xl"><Activity size={20}/></div>
                       <h3 className="text-lg md:text-xl font-black text-slate-900">Expenses</h3>
                    </div>
                    <p className="text-xs md:text-sm font-black text-rose-600">{formatCurrency(auditData.totalExpensesPa, currencyCountry)}</p>
                 </div>
                 <div className="space-y-4">
                    {auditData.expenses.map((exp, i) => (
                       <div key={i} className="flex justify-between items-center py-1 md:py-2">
                          <span className="text-xs md:text-sm font-bold text-slate-500">{exp.label}</span>
                          <span className="text-xs md:text-sm font-black text-slate-900">{formatCurrency(exp.value, currencyCountry)}</span>
                       </div>
                    ))}
                 </div>
              </div>
           </div>

           <div className="space-y-6 md:space-y-8">
              <div className="bg-white p-8 md:p-10 rounded-[2.5rem] md:rounded-[4rem] border border-slate-200 shadow-sm">
                 <div className="flex items-center justify-between mb-6 md:mb-8 border-b border-slate-50 pb-4 md:pb-6">
                    <div className="flex items-center gap-3 md:gap-4">
                       <div className="p-2.5 md:p-3 bg-teal-50 text-teal-600 rounded-xl md:rounded-2xl"><Landmark size={20}/></div>
                       <h3 className="text-lg md:text-xl font-black text-slate-900">Repayments</h3>
                    </div>
                    <p className="text-xs md:text-sm font-black text-slate-900">{formatCurrency(auditData.totalRepaymentsPa, currencyCountry)}</p>
                 </div>
                 <div className="space-y-4">
                    {auditData.repayments.map((rep, i) => (
                       <div key={i} className="flex justify-between items-center py-1 md:py-2">
                          <span className="text-[11px] md:text-sm font-bold text-slate-500 leading-tight flex-1 mr-4">{rep.label}</span>
                          <span className="text-[11px] md:text-sm font-black text-slate-900 shrink-0">{formatCurrency(rep.value, currencyCountry)}</span>
                       </div>
                    ))}
                 </div>
              </div>

              <div className="surface-dark p-8 md:p-12 rounded-[2.5rem] md:rounded-[5rem] text-white space-y-6 md:space-y-10 relative overflow-hidden shadow-2xl">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[80px] rounded-full translate-x-1/2 -translate-y-1/2" />
                 <h4 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3 relative z-10"><BarChartHorizontal className="text-teal-500" size={24}/> Audit Node</h4>
                 <div className="pt-4 space-y-4 relative z-10">
                    <p className="text-slate-400 text-sm md:text-base font-medium leading-relaxed">
                       Net position: <span className={auditData.netCashFlowPa >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{formatCurrency(auditData.netCashFlowPa, currencyCountry)} p.a.</span>
                    </p>
                    {auditData.netCashFlowPa < 0 && (
                       <div className="p-4 md:p-6 bg-rose-500/10 border border-rose-500/20 rounded-[1.5rem] md:rounded-[2.5rem] flex items-start gap-3 md:gap-4">
                          <AlertCircle className="text-rose-500 shrink-0" size={18} md:size={20}/>
                          <p className="text-[11px] md:text-xs font-bold text-rose-200 italic leading-relaxed">Strategy Alert: Deficit of {formatCurrency(70000, currencyCountry)} detected. Adjust Portfolio targets or living spend.</p>
                       </div>
                    )}
                 </div>
              </div>
           </div>
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] md:rounded-[5rem] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-500">
           <div className="p-8 md:p-12 border-b border-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Timeline Projections</h3>
              <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Return: Variable by year</p>
              </div>
           </div>
           
           <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left min-w-[2200px]">
                 <thead>
                    <tr className="bg-slate-50/60">
                       <th rowSpan={2} className="px-6 md:px-8 py-5 md:py-7 text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-widest">Year (Age)</th>
                       <th colSpan={BUCKETS.length + 1} className="px-3 py-4 text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-widest text-center">Opening Balances</th>
                       <th colSpan={BUCKETS.length + 1} className="px-3 py-4 text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-widest text-center">Committed Investments</th>
                       <th colSpan={Math.max(orderedGoals.length, 1) + 1} className="px-3 py-4 text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-widest text-center">Goals (Discounted)</th>
                       <th colSpan={BUCKETS.length + 1} className="px-3 py-4 text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-widest text-center">Withdrawals</th>
                       <th colSpan={BUCKETS.length + 1} className="px-3 py-4 text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-widest text-center">Returns</th>
                       <th colSpan={BUCKETS.length + 1} className="px-3 py-4 text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-widest text-center">Closing Balances</th>
                       <th colSpan={Math.max(orderedGoals.length, 1)} className="px-3 py-4 text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-widest text-center">Goal Achievement %</th>
                    </tr>
                    <tr className="bg-slate-50/30">
                       {BUCKETS.map(bucket => (
                         <th key={`open-${bucket.key}`} className="px-3 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">{bucket.label}</th>
                       ))}
                       <th className="px-3 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
                       {BUCKETS.map(bucket => (
                         <th key={`commit-${bucket.key}`} className="px-3 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">{bucket.label}</th>
                       ))}
                       <th className="px-3 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
                       {orderedGoals.length > 0 ? orderedGoals.map(goal => (
                         <th key={`goal-${goal.id}`} title={goal.description || goal.type} className="px-3 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                           {(goal.type || goal.description || 'Goal').slice(0, 14)}
                         </th>
                       )) : (
                         <th className="px-3 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">None</th>
                       )}
                       <th className="px-3 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
                       {BUCKETS.map(bucket => (
                         <th key={`wd-${bucket.key}`} className="px-3 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">{bucket.label}</th>
                       ))}
                       <th className="px-3 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
                       {BUCKETS.map(bucket => (
                         <th key={`ret-${bucket.key}`} className="px-3 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">{bucket.label}</th>
                       ))}
                       <th className="px-3 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
                       {BUCKETS.map(bucket => (
                         <th key={`close-${bucket.key}`} className="px-3 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">{bucket.label}</th>
                       ))}
                       <th className="px-3 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
                       {orderedGoals.length > 0 ? orderedGoals.map(goal => (
                         <th key={`ach-${goal.id}`} className="px-3 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                           {(goal.type || goal.description || 'Goal').slice(0, 10)}
                         </th>
                       )) : (
                         <th className="px-3 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Overall</th>
                       )}
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {fundingTimeline.map((row, idx) => (
                       <tr key={`${row.year}-${idx}`} className="hover:bg-teal-50/30 transition-colors">
                          <td className="px-6 md:px-8 py-4 md:py-6">
                             <div className="flex items-center gap-2 md:gap-3">
                                <span className="text-xs md:text-sm font-black text-slate-900">{row.year}</span>
                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[8px] md:text-[9px] font-black uppercase tracking-tighter">Age {row.age}</span>
                             </div>
                          </td>
                          {BUCKETS.map(bucket => (
                            <td key={`open-${row.year}-${bucket.key}`} className="px-3 py-4 md:py-6 text-right text-[11px] font-bold text-slate-700">
                              {formatCurrency(Math.round(row.opening[bucket.key]), currencyCountry)}
                            </td>
                          ))}
                          <td className="px-3 py-4 md:py-6 text-right text-[11px] font-black text-slate-900">
                            {formatCurrency(Math.round(row.openingTotal), currencyCountry)}
                          </td>
                          {BUCKETS.map(bucket => (
                            <td key={`commit-${row.year}-${bucket.key}`} className="px-3 py-4 md:py-6 text-right text-[11px] font-bold text-slate-700">
                              {formatCurrency(Math.round(row.contributions[bucket.key]), currencyCountry)}
                            </td>
                          ))}
                          <td className="px-3 py-4 md:py-6 text-right text-[11px] font-black text-slate-900">
                            {formatCurrency(Math.round(row.contributionTotal), currencyCountry)}
                          </td>
                          {orderedGoals.length > 0 ? orderedGoals.map(goal => {
                            const value = row.goals[goal.id] || 0;
                            const nominal = row.goalsNominal?.[goal.id] || 0;
                            return (
                              <td
                                key={`goalv-${row.year}-${goal.id}`}
                                title={nominal > 0 ? `Nominal: ${formatCurrency(Math.round(nominal), currencyCountry)}` : undefined}
                                className="px-3 py-4 md:py-6 text-right text-[11px] font-bold text-slate-700"
                              >
                                {value > 0 ? formatCurrency(Math.round(value), currencyCountry) : '—'}
                              </td>
                            );
                          }) : (
                            <td className="px-3 py-4 md:py-6 text-right text-[11px] font-bold text-slate-700">—</td>
                          )}
                          <td className="px-3 py-4 md:py-6 text-right text-[11px] font-black text-slate-900">
                            {formatCurrency(Math.round(row.goalTotal), currencyCountry)}
                          </td>
                          {BUCKETS.map(bucket => (
                            <td key={`wd-${row.year}-${bucket.key}`} className="px-3 py-4 md:py-6 text-right text-[11px] font-bold text-slate-700">
                              {formatCurrency(Math.round(row.withdrawals[bucket.key]), currencyCountry)}
                            </td>
                          ))}
                          <td className="px-3 py-4 md:py-6 text-right text-[11px] font-black text-slate-900">
                            {formatCurrency(Math.round(row.withdrawalTotal), currencyCountry)}
                          </td>
                          {BUCKETS.map(bucket => (
                            <td key={`ret-${row.year}-${bucket.key}`} className="px-3 py-4 md:py-6 text-right text-[11px] font-bold text-slate-700">
                              {formatCurrency(Math.round(row.returns[bucket.key]), currencyCountry)}
                            </td>
                          ))}
                          <td className="px-3 py-4 md:py-6 text-right text-[11px] font-black text-slate-900">
                            {formatCurrency(Math.round(row.returnTotal), currencyCountry)}
                          </td>
                          {BUCKETS.map(bucket => (
                            <td key={`close-${row.year}-${bucket.key}`} className="px-3 py-4 md:py-6 text-right text-[11px] font-bold text-slate-700">
                              {formatCurrency(Math.round(row.closing[bucket.key]), currencyCountry)}
                            </td>
                          ))}
                          <td className="px-3 py-4 md:py-6 text-right text-[11px] font-black text-slate-900">
                            {formatCurrency(Math.round(row.closingTotal), currencyCountry)}
                          </td>
                          {orderedGoals.length > 0 ? orderedGoals.map(goal => {
                            const pct = row.goalAchievements[goal.id] || 0;
                            return (
                              <td key={`achv-${row.year}-${goal.id}`} className="px-3 py-4 md:py-6 text-right text-[11px] font-black text-teal-600">
                                {row.goals[goal.id] > 0 ? `${pct.toFixed(0)}%` : '—'}
                              </td>
                            );
                          }) : (
                            <td className="px-3 py-4 md:py-6 text-right text-[11px] font-black text-teal-600">
                              {row.achievementPct.toFixed(0)}%
                            </td>
                          )}
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      )}
    </div>
  );
};

export default GoalFunding;
