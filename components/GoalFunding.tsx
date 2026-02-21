
import React, { useMemo, useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, Target, Landmark, 
  ArrowUpRight, ArrowDownRight, Calendar, Calculator,
  ChevronRight, ChevronDown, CheckCircle2, AlertCircle,
  PieChart, Activity, Wallet, Info, Search, ShieldCheck,
  Zap, ArrowRight, DollarSign, ListOrdered, BarChartHorizontal
} from 'lucide-react';
import { FinanceState, Goal, RelativeDate, Asset } from '../types';
import { formatCurrency } from '../lib/currency';
import { annualizeAmount, getGoalIntervalYears, getLifeExpectancyYear, getReturnRateForYear, getRiskReturnAssumption, inflateByBuckets } from '../lib/financeMath';
import { inferTenureMonths } from '../lib/loanMath';

const GoalFunding: React.FC<{ state: FinanceState }> = ({ state }) => {
  const assumedReturn = getRiskReturnAssumption(state.riskProfile?.level);
  const BUCKETS = [
    { key: 'savings', label: 'Cash / Savings' },
    { key: 'directEquity', label: 'Direct Equity' },
    { key: 'mutualFunds', label: 'Mutual Funds' },
    { key: 'gold', label: 'Gold / Silver' },
    { key: 'realEstate', label: 'Property / Alt' },
    { key: 'netSavings', label: 'Corpus' },
  ] as const;

  type BucketKey = typeof BUCKETS[number]['key'];

  const [activeTab, setActiveTab] = useState<'audit' | 'timeline'>('audit');
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [overrideValue, setOverrideValue] = useState<number>(assumedReturn);
  const [liquidationOrder, setLiquidationOrder] = useState<BucketKey[]>([
    'savings',
    'gold',
    'realEstate',
    'mutualFunds',
    'directEquity',
  ]);
  const currencyCountry = state.profile.country;

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

  const mapAssetToBucket = (asset: Asset): BucketKey | null => {
    const sub = asset.subCategory.toLowerCase();
    if (asset.category === 'Equity') {
      if (sub.includes('mutual') || sub.includes('mf') || sub.includes('index')) return 'mutualFunds';
      return 'directEquity';
    }
    if (asset.category === 'Debt') {
      if (sub.includes('epf') || sub.includes('gpf') || sub.includes('dsop')) return null;
      if (sub.includes('nps')) return null;
      return 'savings';
    }
    if (asset.category === 'Liquid') return 'savings';
    if (asset.category === 'Gold/Silver') return 'gold';
    if (asset.category === 'Real Estate') return 'realEstate';
    return null;
  };

  const mapCommitmentToBucket = (label: string): BucketKey | null => {
    const l = label.toLowerCase();
    if (l.includes('nps')) return null;
    if (l.includes('epf') || l.includes('gpf') || l.includes('dsop')) return null;
    if (l.includes('mutual') || l.includes('mf')) return 'mutualFunds';
    if (l.includes('equity')) return 'directEquity';
    return 'savings';
  };


  const getGoalAmountForYear = (goal: Goal, year: number, retirementYearValue: number) => {
    const s = resolveYear(goal.startDate);
    const e = resolveYear(goal.endDate);
    if (year < s || year > e) return 0;
    const yearsFromStart = Math.max(0, year - s);
    const discountSettings = state.discountSettings;
    const inflationFallback = discountSettings?.defaultInflationRate ?? goal.inflationRate;
    const startAmount = discountSettings?.useBucketInflation
      ? inflateByBuckets(goal.targetAmountToday, currentYear, s, currentYear, retirementYearValue, discountSettings, inflationFallback)
      : (goal.startGoalAmount ?? goal.targetAmountToday);
    const inflated = discountSettings?.useBucketInflation
      ? inflateByBuckets(startAmount, s, year, currentYear, retirementYearValue, discountSettings, inflationFallback)
      : startAmount * Math.pow(1 + (goal.inflationRate / 100), yearsFromStart);
    if (!goal.isRecurring) {
      return year === e ? inflated : 0;
    }
    const interval = getGoalIntervalYears(goal.frequency, goal.frequencyIntervalYears);
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

  const effectiveReturn = overrideEnabled ? overrideValue : assumedReturn;

  useEffect(() => {
    if (!overrideEnabled) {
      setOverrideValue(assumedReturn);
    }
  }, [assumedReturn, overrideEnabled]);

  const moveLiquidation = (index: number, direction: -1 | 1) => {
    setLiquidationOrder(prev => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return next;
    });
  };
  const retirementYear = state.profile.dob ? (new Date(state.profile.dob).getFullYear() + state.profile.retirementAge) : (currentYear + 30);

  const fundingTimeline = useMemo(() => {
    const startYear = currentYear + 1;
    const endYear = getLifeExpectancyYear(state.profile.dob, state.profile.lifeExpectancy) ?? (currentYear + 35);

    const assets = state.assets || [];
    const sellableAssets = assets.filter(a => a.availableForGoals);
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
    const discountSettings = state.discountSettings;
    const defaultInflation = discountSettings?.defaultInflationRate ?? 6;
    const applyInflation = (base: number, fromYear: number, toYear: number, fallbackRate: number) => {
      if (toYear <= fromYear) return base;
      if (!discountSettings?.useBucketInflation) {
        const years = Math.max(0, toYear - fromYear);
        return base * Math.pow(1 + fallbackRate / 100, years);
      }
      return inflateByBuckets(base, fromYear, toYear, currentYear, retirementYear, discountSettings, fallbackRate);
    };

    const defaultBucketReturns: Record<BucketKey, number> = {
      savings: 3,
      directEquity: 15,
      mutualFunds: 13,
      gold: 7,
      realEstate: 5,
      netSavings: effectiveReturn,
    };

    const futureAdds: Record<number, Record<BucketKey, number>> = {};
    const bucketReturnBasis: Record<BucketKey, { value: number; weighted: number }> = {
      savings: { value: 0, weighted: 0 },
      directEquity: { value: 0, weighted: 0 },
      mutualFunds: { value: 0, weighted: 0 },
      gold: { value: 0, weighted: 0 },
      realEstate: { value: 0, weighted: 0 },
      netSavings: { value: 0, weighted: 0 },
    };

    sellableAssets.forEach(asset => {
      const bucket = mapAssetToBucket(asset);
      if (!bucket) return;
      const availableYear = asset.availableFrom ?? currentYear;
      const targetYear = Math.max(availableYear, startYear);
      const yearsToAdd = Math.max(0, targetYear - currentYear);
      const growthRate = asset.growthRate ?? defaultBucketReturns[bucket];
      const valueAtAdd = asset.currentValue * Math.pow(1 + (growthRate / 100), yearsToAdd);
      if (!futureAdds[targetYear]) {
        futureAdds[targetYear] = {
          savings: 0,
          directEquity: 0,
          mutualFunds: 0,
          gold: 0,
          realEstate: 0,
          netSavings: 0,
        };
      }
      futureAdds[targetYear][bucket] += valueAtAdd;
      bucketReturnBasis[bucket].value += asset.currentValue;
      bucketReturnBasis[bucket].weighted += asset.currentValue * growthRate;
    });

    const bucketReturnRates: Record<BucketKey, number> = { ...defaultBucketReturns };
    BUCKETS.forEach(bucket => {
      if (bucket.key === 'netSavings') return;
      const basis = bucketReturnBasis[bucket.key];
      if (basis.value > 0) {
        bucketReturnRates[bucket.key] = basis.weighted / basis.value;
      }
    });

    const timeline: any[] = [];
    let balances: Record<BucketKey, number> = {
      savings: 0,
      directEquity: 0,
      mutualFunds: 0,
      gold: 0,
      realEstate: 0,
      netSavings: 0,
    };

    for (let year = startYear; year <= endYear; year++) {
      const yearIndex = year - startYear;
      const growthFactor = Math.pow(1 + incomeGrowthRate, yearIndex);

      if (futureAdds[year]) {
        BUCKETS.forEach(bucket => {
          balances[bucket.key] += futureAdds[year][bucket.key] || 0;
        });
      }

      const opening = { ...balances };
      const openingTotal = BUCKETS.reduce((sum, b) => sum + opening[b.key], 0);

      const inflow = hasCashflows
        ? (state.cashflows || []).reduce((sum, flow) => {
            if (flow.flowType && flow.flowType !== 'Income') return sum;
            if (year < flow.startYear || year > flow.endYear) return sum;
            const baseAnnual = annualizeAmount(flow.amount, flow.frequency);
            const adjusted = applyInflation(baseAnnual, flow.startYear, year, flow.growthRate ?? defaultInflation);
            if (flow.frequency === 'One time') {
              return sum + (year === flow.startYear ? adjusted : 0);
            }
            return sum + adjusted;
          }, 0)
        : baseMonthlyIncome * 12 * growthFactor;

      const expenseFromFlows = (state.cashflows || []).reduce((sum, flow) => {
        if (flow.flowType !== 'Expense') return sum;
        if (year < flow.startYear || year > flow.endYear) return sum;
        const baseAnnual = annualizeAmount(flow.amount, flow.frequency);
        const adjusted = applyInflation(baseAnnual, flow.startYear, year, flow.growthRate ?? defaultInflation);
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
            const baseAnnual = annualizeAmount(e.amount, frequency);
            const inflationRate = Number.isFinite(e.inflationRate as number) ? (e.inflationRate as number) : defaultInflation;
            const adjusted = applyInflation(baseAnnual, sYear, year, inflationRate);
            if (frequency === 'One time') {
              return sum + (year === sYear ? adjusted : 0);
            }
            return sum + adjusted;
          }, 0) + expenseFromFlows
        : applyInflation(baseMonthlyExpenses * 12, currentYear, year, defaultInflation) + expenseFromFlows;

      const debtTotal = state.loans.reduce((sum, loan) => {
        const start = loan.startYear ?? startYear;
        const tenureMonths = inferTenureMonths(loan).months;
        const tenureYears = Math.ceil(tenureMonths / 12);
        const end = start + Math.max(0, tenureYears - 1);
        if (year < start || year > end) return sum;
        return sum + (loan.emi || 0) * 12;
      }, 0);

      const contributions: Record<BucketKey, number> = {
        savings: 0,
        directEquity: 0,
        mutualFunds: 0,
        gold: 0,
        realEstate: 0,
        netSavings: 0,
      };

      commitments.forEach(c => {
        if (year < c.startYear || year > c.endYear) return;
        const yearsFromStart = Math.max(0, year - c.startYear);
        const baseAnnual = annualizeAmount(c.amount, c.frequency);
        const adjusted = baseAnnual * Math.pow(1 + (c.stepUp || 0) / 100, yearsFromStart);
        const bucket = mapCommitmentToBucket(c.label);
        if (bucket) contributions[bucket] += adjusted;
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
      const netAvailable = inflow - expenseTotal - debtTotal - committedTotal + opening.netSavings;

      const goalMap: Record<string, number> = {};
      const goalNominalMap: Record<string, number> = {};
      orderedGoals.forEach(goal => {
        const nominal = getGoalAmountForYear(goal, year, retirementYear);
        goalNominalMap[goal.id] = nominal;
        goalMap[goal.id] = nominal;
      });
      const goalTotal = Object.values(goalMap).reduce((sum, v) => sum + v, 0);

      const withdrawals: Record<BucketKey, number> = {
        savings: 0,
        directEquity: 0,
        mutualFunds: 0,
        gold: 0,
        realEstate: 0,
        netSavings: 0,
      };

      const assetPool = BUCKETS.filter(b => b.key !== 'netSavings')
        .reduce((sum, b) => sum + balances[b.key], 0);
      const fundable = Math.max(0, assetPool + netAvailable);
      const goalFundedTotal = Math.min(goalTotal, fundable);
      const assetNeeded = Math.max(0, goalTotal - netAvailable);
      let remainingShortfall = Math.min(assetNeeded, assetPool);
      const liquidationSequence = liquidationOrder
        .map(key => BUCKETS.find(b => b.key === key))
        .filter(Boolean) as typeof BUCKETS[number][];

      const fallbackSequence = BUCKETS.filter(b => b.key !== 'netSavings')
        .slice()
        .sort((a, b) => (bucketReturnRates[a.key] ?? 0) - (bucketReturnRates[b.key] ?? 0));

      (liquidationSequence.length > 0 ? liquidationSequence : fallbackSequence).forEach(bucket => {
        if (remainingShortfall <= 0) return;
        const available = balances[bucket.key];
        const used = Math.min(available, remainingShortfall);
        if (used > 0) {
          balances[bucket.key] -= used;
          withdrawals[bucket.key] = used;
          remainingShortfall -= used;
        }
      });

      const withdrawalTotal = Object.values(withdrawals).reduce((sum, v) => sum + v, 0);

      const goalAchievements: Record<string, number> = {};
      const goalFundingSplit: Record<string, { cash: number; assets: number }> = {};
      let remainingToFund = fundable;
      let cashRemaining = Math.max(0, netAvailable);
      let assetRemaining = Math.max(0, assetNeeded - remainingShortfall);
      orderedGoals.forEach(goal => {
        const required = goalMap[goal.id] || 0;
        if (required <= 0) {
          goalAchievements[goal.id] = 0;
          goalFundingSplit[goal.id] = { cash: 0, assets: 0 };
          return;
        }
        const funded = Math.min(remainingToFund, required);
        remainingToFund -= funded;

        const cashUsed = Math.min(cashRemaining, required);
        cashRemaining -= cashUsed;
        const assetNeededForGoal = Math.max(0, required - cashUsed);
        const assetUsed = Math.min(assetRemaining, assetNeededForGoal);
        assetRemaining -= assetUsed;

        goalFundingSplit[goal.id] = { cash: cashUsed, assets: assetUsed };
        goalAchievements[goal.id] = required > 0 ? ((cashUsed + assetUsed) / required) * 100 : 0;
      });

      const returns: Record<BucketKey, number> = {
        savings: 0,
        directEquity: 0,
        mutualFunds: 0,
        gold: 0,
        realEstate: 0,
        netSavings: 0,
      };
      const closing: Record<BucketKey, number> = {
        savings: 0,
        directEquity: 0,
        mutualFunds: 0,
        gold: 0,
        realEstate: 0,
        netSavings: 0,
      };

      const newCorpus = Math.max(0, netAvailable - goalTotal);
      balances.netSavings = newCorpus;
      contributions.netSavings = newCorpus;

      BUCKETS.forEach(b => {
        if (b.key === 'netSavings') return;
        balances[b.key] += contributions[b.key];
      });

      const returnRate = getReturnRateForYear(year, currentYear, retirementYear, effectiveReturn);
      BUCKETS.forEach(b => {
        const rate = b.key === 'netSavings' ? returnRate : (bucketReturnRates[b.key] ?? returnRate);
        const baseValue = balances[b.key];
        const growth = baseValue * (rate / 100);
        returns[b.key] = growth;
        closing[b.key] = baseValue + growth;
      });

      balances = { ...closing };

      const returnTotal = Object.values(returns).reduce((sum, v) => sum + v, 0);
      const closingTotal = Object.values(closing).reduce((sum, v) => sum + v, 0);

      timeline.push({
        year,
        age: birthYear ? year - birthYear : 30 + (year - currentYear),
        opening,
        openingTotal,
        contributions,
        contributionTotal: Object.values(contributions).reduce((sum, v) => sum + v, 0),
        goals: goalMap,
        goalsNominal: goalNominalMap,
        goalTotal,
        withdrawals,
        withdrawalTotal,
        returns,
        returnTotal,
        closing,
        closingTotal,
        netAvailable,
        assetNeeded,
        goalFundingSplit,
        achievementPct: goalTotal > 0 ? (goalFundedTotal / goalTotal) * 100 : 100,
        goalAchievements,
      });
    }

    return timeline;
  }, [state, currentYear, orderedGoals, effectiveReturn, resolveYear, birthYear, liquidationOrder, overrideEnabled, overrideValue]);

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
                <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Return Target: {effectiveReturn.toFixed(2)}%</p>
              </div>
           </div>

           <div className="px-8 md:px-12 pb-8 border-b border-slate-50 grid grid-cols-1 lg:grid-cols-2 gap-8">
             <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4">
               <div className="flex items-center justify-between">
                 <div>
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Planner Return Target</p>
                   <p className="text-xs text-slate-400 font-medium">Override risk profile for corpus growth.</p>
                 </div>
                 <button
                   type="button"
                   onClick={() => setOverrideEnabled(prev => !prev)}
                   className={`w-16 h-9 rounded-full transition-all relative ${overrideEnabled ? 'bg-teal-600' : 'bg-slate-200'}`}
                 >
                   <div className={`absolute top-1 w-7 h-7 rounded-full bg-white transition-all shadow-md ${overrideEnabled ? 'left-8' : 'left-1'}`} />
                 </button>
               </div>
               <div className="flex items-center gap-4">
                 <input
                   type="number"
                   min={0}
                   max={30}
                   step={0.1}
                   value={overrideValue}
                   disabled={!overrideEnabled}
                   onChange={e => setOverrideValue(Number.isFinite(parseFloat(e.target.value)) ? parseFloat(e.target.value) : assumedReturn)}
                   className={`w-28 px-3 py-2 rounded-xl border text-sm font-black outline-none ${overrideEnabled ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-100 border-slate-100 text-slate-400'}`}
                 />
                 <span className="text-xs font-black text-slate-400 uppercase tracking-widest">%</span>
                 {!overrideEnabled && (
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Using Risk Profile</span>
                 )}
               </div>
             </div>

             <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4">
               <div className="flex items-center justify-between">
                 <div>
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Liquidation Priority</p>
                   <p className="text-xs text-slate-400 font-medium">Order of asset sales when goals fall short.</p>
                 </div>
               </div>
               <div className="space-y-2">
                 {liquidationOrder.map((key, index) => {
                   const bucket = BUCKETS.find(b => b.key === key);
                   if (!bucket) return null;
                   return (
                     <div key={`liq-${key}`} className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-3 py-2">
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{bucket.label}</span>
                       <div className="flex items-center gap-2">
                         <button
                           type="button"
                           onClick={() => moveLiquidation(index, -1)}
                           className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:text-teal-600"
                         >
                           ↑
                         </button>
                         <button
                           type="button"
                           onClick={() => moveLiquidation(index, 1)}
                           className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:text-teal-600"
                         >
                           ↓
                         </button>
                       </div>
                     </div>
                   );
                 })}
               </div>
             </div>
           </div>
           
           <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left min-w-[2200px]">
                 <thead>
                    <tr className="bg-slate-50/60">
                       <th rowSpan={2} className="px-6 md:px-8 py-5 md:py-7 text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-widest">Year (Age)</th>
                       <th colSpan={BUCKETS.length + 1} className="px-3 py-4 text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-widest text-center">Opening Balances</th>
                       <th colSpan={BUCKETS.length + 1} className="px-3 py-4 text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-widest text-center">Committed Investments</th>
                       <th colSpan={Math.max(orderedGoals.length, 1) + 1} className="px-3 py-4 text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-widest text-center">Goals (Nominal)</th>
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
                            const split = row.goalFundingSplit?.[goal.id];
                            return (
                              <td
                                key={`goalv-${row.year}-${goal.id}`}
                                title={nominal > 0 ? `Nominal: ${formatCurrency(Math.round(nominal), currencyCountry)}` : undefined}
                                className="px-3 py-4 md:py-6 text-right text-[11px] font-bold text-slate-700"
                              >
                                {value > 0 ? (
                                  <div className="flex flex-col items-end gap-1">
                                    <span className="font-black">{formatCurrency(Math.round(value), currencyCountry)}</span>
                                    {split && (split.cash > 0 || split.assets > 0) && (
                                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        C {formatCurrency(Math.round(split.cash), currencyCountry)} · A {formatCurrency(Math.round(split.assets), currencyCountry)}
                                      </span>
                                    )}
                                  </div>
                                ) : '—'}
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
