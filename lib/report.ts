import type {
  FinanceState,
  ReportSnapshot,
  DetailedIncome,
  Asset,
  Loan,
  AllocationBreakdown,
} from '../types';
import { currentYear, getRiskReturnAssumption, resolveRelativeYear, inflateByBuckets, getGoalIntervalYears } from './financeMath';
import { getJourneyProgress } from './journey';

const sum = (values: number[]) => values.reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0);

const calculateTotalMemberIncome = (income: DetailedIncome) => {
  return (income.salary || 0) + (income.bonus || 0) + (income.reimbursements || 0)
    + (income.business || 0) + (income.rental || 0) + (income.investment || 0);
};

const toPercent = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0);

const buildAllocationBreakdown = (assets: Asset[]): AllocationBreakdown => {
  const buckets = { equity: 0, debt: 0, gold: 0, liquid: 0 };
  assets.forEach(asset => {
    if (asset.category === 'Equity') buckets.equity += asset.currentValue;
    if (asset.category === 'Debt') buckets.debt += asset.currentValue;
    if (asset.category === 'Gold/Silver') buckets.gold += asset.currentValue;
    if (asset.category === 'Liquid') buckets.liquid += asset.currentValue;
  });
  const total = sum(Object.values(buckets));
  return {
    equity: toPercent(buckets.equity, total),
    debt: toPercent(buckets.debt, total),
    gold: toPercent(buckets.gold, total),
    liquid: toPercent(buckets.liquid, total),
  };
};

export const buildReportSnapshot = (state: FinanceState): ReportSnapshot => {
  const now = new Date();
  const asOf = now.toISOString();
  const journey = getJourneyProgress(state);
  const nowYear = currentYear();
  const retirementYear = state.profile.dob
    ? new Date(state.profile.dob).getFullYear() + state.profile.retirementAge
    : nowYear + 30;

  const totalAssets = sum(state.assets.map(a => a.currentValue));
  const totalLiabilities = sum(state.loans.map(l => l.outstandingAmount));
  const netWorth = totalAssets - totalLiabilities;

  const householdIncome = calculateTotalMemberIncome(state.profile.income)
    + sum(state.family.map(m => calculateTotalMemberIncome(m.income)));
  const householdExpenses = state.detailedExpenses.length > 0
    ? sum(state.detailedExpenses.map(e => e.amount))
    : state.profile.monthlyExpenses;
  const totalMonthlyDebt = sum(state.loans.map(l => l.emi));
  const monthlySurplus = householdIncome - householdExpenses - totalMonthlyDebt;
  const savingsRatePct = householdIncome > 0 ? (monthlySurplus / householdIncome) * 100 : 0;
  const dtiPct = householdIncome > 0 ? (totalMonthlyDebt / householdIncome) * 100 : 0;

  const financialSet = new Set(['Liquid', 'Debt', 'Equity', 'Gold/Silver']);
  const isResidentialAsset = (asset: Asset) => {
    const label = `${asset.subCategory || ''} ${asset.name || ''}`.toLowerCase();
    return /residential|home|house|apartment|villa|bungalow/.test(label);
  };

  const formatAssetLabel = (asset: Asset) => {
    const name = (asset.name || '').trim();
    const sub = (asset.subCategory || '').trim();
    if (asset.category === 'Gold/Silver') return name ? `Gold (${name})` : 'Gold / Silver';
    if (asset.category === 'Equity') return 'Portfolio (Equity & Mutual Fund)';
    if (asset.category === 'Liquid') return sub ? `Cash in Hand (${sub})` : 'Cash in Hand (Bank Balance)';
    if (asset.category === 'Debt') {
      const combo = `${sub} ${name}`.toLowerCase();
      if (/nps|epf|gpf|dsop/.test(combo)) return 'Other Govt. Schemes (NPS & EPF)';
      return sub || 'Debt Instruments';
    }
    if (asset.category === 'Real Estate') {
      const label = name || sub || 'Property';
      return isResidentialAsset(asset) ? `Residential Property (${label})` : `Investment Property (${label})`;
    }
    if (asset.category === 'Personal') {
      const label = name || sub || 'Personal Asset';
      if (/car|bike|vehicle|two wheeler|two-wheeler/.test(label.toLowerCase())) {
        return `Car / Two Wheeler (${label})`;
      }
      if (/house|home|residential/.test(label.toLowerCase())) {
        return `Residential Property (${label})`;
      }
      return `House Contents (${label})`;
    }
    return name || sub || asset.category;
  };

  const addRow = (map: Record<string, number>, label: string, value: number) => {
    map[label] = (map[label] || 0) + value;
  };

  const investmentsMap: Record<string, number> = {};
  const otherAssetsMap: Record<string, number> = {};

  state.assets.forEach(asset => {
    const label = formatAssetLabel(asset);
    const isInvestment = financialSet.has(asset.category) || (asset.category === 'Real Estate' && !isResidentialAsset(asset));
    if (isInvestment) addRow(investmentsMap, label, asset.currentValue);
    else addRow(otherAssetsMap, label, asset.currentValue);
  });

  const investments = Object.entries(investmentsMap)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  const otherAssets = Object.entries(otherAssetsMap)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const totalInvestments = sum(investments.map(i => i.value));
  const totalOtherAssets = sum(otherAssets.map(i => i.value));

  const liabilities = state.loans
    .map((loan: Loan) => ({ label: loan.type, value: loan.outstandingAmount }))
    .filter(l => l.value > 0)
    .sort((a, b) => b.value - a.value);

  const debtToAssets = totalAssets > 0 ? totalLiabilities / totalAssets : 0;
  const majorAssets = [...state.assets]
    .sort((a, b) => b.currentValue - a.currentValue)
    .slice(0, 3)
    .map(a => formatAssetLabel(a));
  const majorLiabilities = [...state.loans]
    .sort((a, b) => b.outstandingAmount - a.outstandingAmount)
    .slice(0, 2)
    .map(l => l.type);

  const discountSettings = state.discountSettings;
  const inflateFromCurrent = (amount: number, fromYear: number, toYear: number, rate: number) => {
    if (toYear <= fromYear) return amount;
    if (!discountSettings?.useBucketInflation) {
      const years = Math.max(0, toYear - fromYear);
      return amount * Math.pow(1 + rate / 100, years);
    }
    return inflateByBuckets(amount, fromYear, toYear, nowYear, retirementYear, discountSettings, rate);
  };

  const goalCostSummary = state.goals.reduce((acc, goal) => {
    const startYear = resolveRelativeYear(goal.startDate, state.profile.dob, state.profile.retirementAge, state.profile.lifeExpectancy);
    const endYear = resolveRelativeYear(goal.endDate, state.profile.dob, state.profile.retirementAge, state.profile.lifeExpectancy);
    const inflationRate = discountSettings?.defaultInflationRate ?? goal.inflationRate;
    const corpusAtStart = inflateFromCurrent(goal.targetAmountToday, nowYear, startYear, inflationRate);
    let corpusToday = 0;
    if (!goal.isRecurring) {
      corpusToday = inflateFromCurrent(goal.targetAmountToday, nowYear, endYear, inflationRate);
    } else {
      const interval = getGoalIntervalYears(goal.frequency, goal.frequencyIntervalYears);
      for (let year = startYear; year <= endYear; year++) {
        if (interval > 1 && (year - startYear) % interval !== 0) continue;
        const baseAmount = inflateFromCurrent(goal.targetAmountToday, nowYear, year, inflationRate);
        corpusToday += goal.frequency === 'Monthly' ? baseAmount * 12 : baseAmount;
      }
    }
    acc.corpusToday += corpusToday;
    acc.corpusAtStart += corpusAtStart;
    acc.totalSpent += goal.currentAmount || 0;
    return acc;
  }, { corpusToday: 0, corpusAtStart: 0, totalSpent: 0 });

  const categoryDefaultReturns: Record<string, number> = {
    Equity: 15,
    Debt: 8,
    'Gold/Silver': 7,
    Liquid: 3,
    'Real Estate': 5,
  };
  const availableAssets = state.assets.filter(a => a.availableForGoals);
  const assetPool = availableAssets.length > 0 ? availableAssets : state.assets;
  const totalAssetValue = sum(assetPool.map(a => a.currentValue));
  const currentAvailableReturn = totalAssetValue > 0
    ? assetPool.reduce((sum, a) => {
        const fallback = categoryDefaultReturns[a.category] ?? 0;
        const rate = Number.isFinite(a.growthRate as number) ? (a.growthRate as number) : fallback;
        return sum + (a.currentValue * rate);
      }, 0) / totalAssetValue
    : 0;

  const fallbackRecommended = (() => {
    const risk = state.riskProfile?.level || 'Balanced';
    if (risk === 'Conservative') return { equity: 25, debt: 60, gold: 15, liquid: 0 };
    if (risk === 'Moderate') return { equity: 40, debt: 45, gold: 10, liquid: 5 };
    if (risk === 'Balanced') return { equity: 60, debt: 30, gold: 10, liquid: 0 };
    if (risk === 'Aggressive') return { equity: 80, debt: 15, gold: 5, liquid: 0 };
    if (risk === 'Very Aggressive') return { equity: 90, debt: 5, gold: 5, liquid: 0 };
    return { equity: 60, debt: 30, gold: 10, liquid: 0 };
  })();
  const recommendedAllocation = state.riskProfile?.recommendedAllocation ?? fallbackRecommended;
  const recommendedReturn = (
    (recommendedAllocation.equity || 0) * categoryDefaultReturns.Equity +
    (recommendedAllocation.debt || 0) * categoryDefaultReturns.Debt +
    (recommendedAllocation.gold || 0) * categoryDefaultReturns['Gold/Silver'] +
    (recommendedAllocation.liquid || 0) * categoryDefaultReturns.Liquid
  ) / 100;

  const totalTargetToday = sum(state.goals.map(g => g.targetAmountToday));
  const totalCurrent = sum(state.goals.map(g => g.currentAmount));
  const fundedCount = state.goals.filter(g => g.targetAmountToday > 0 && g.currentAmount >= g.targetAmountToday).length;

  const nextGoal = state.goals
    .map(goal => ({
      goal,
      year: resolveRelativeYear(goal.startDate, state.profile.dob, state.profile.retirementAge, state.profile.lifeExpectancy),
    }))
    .filter(item => item.year >= nowYear)
    .sort((a, b) => a.year - b.year)[0];

  const reportReturn = getRiskReturnAssumption(state.riskProfile?.level);
  const currentAllocation = buildAllocationBreakdown(state.assets);

  return {
    generatedAt: asOf,
    asOf,
    currency: state.profile.country,
    intro: {
      completionPct: journey.completionPct,
      memberCount: state.family.length + 1,
      goalCount: state.goals.length,
      assetCount: state.assets.length,
      liabilityCount: state.loans.length,
    },
    executiveSummary: {
      netWorth,
      totalAssets,
      totalLiabilities,
      monthlySurplus,
      savingsRatePct,
      dtiPct,
      riskLevel: state.riskProfile?.level,
    },
    statementOfPosition: {
      investments,
      otherAssets,
      liabilities,
      totals: {
        investments: totalInvestments,
        otherAssets: totalOtherAssets,
        assets: totalAssets,
        liabilities: totalLiabilities,
        netWorth,
        debtToAssets,
      },
      majorAssets,
      majorLiabilities,
    },
    cashFlow: {
      monthly: {
        income: householdIncome,
        expenses: householdExpenses,
        debt: totalMonthlyDebt,
        surplus: monthlySurplus,
      },
      annual: {
        income: householdIncome * 12,
        expenses: householdExpenses * 12,
        debt: totalMonthlyDebt * 12,
        surplus: monthlySurplus * 12,
      },
    },
    goals: {
      totalGoals: state.goals.length,
      fundedCount,
      totalTargetToday,
      totalCurrent,
      costSummary: {
        corpusToday: goalCostSummary.corpusToday,
        corpusAtStart: goalCostSummary.corpusAtStart,
        totalSpent: goalCostSummary.totalSpent,
      },
      returnComparison: {
        currentReturn: currentAvailableReturn,
        recommendedReturn,
        delta: currentAvailableReturn - recommendedReturn,
      },
      nextGoal: nextGoal ? {
        label: nextGoal.goal.description || nextGoal.goal.type,
        year: nextGoal.year,
        amount: nextGoal.goal.targetAmountToday,
      } : undefined,
    },
    riskProfile: {
      score: state.riskProfile?.score ?? 0,
      level: state.riskProfile?.level,
      recommendedAllocation,
      currentAllocation,
    },
    assumptions: {
      inflation: state.insuranceAnalysis.inflation,
      investmentRate: state.insuranceAnalysis.investmentRate,
      expectedIncomeGrowth: state.profile.income.expectedIncrease,
      retirementAge: state.profile.retirementAge,
      lifeExpectancy: state.profile.lifeExpectancy,
      returnAssumption: reportReturn,
    },
  };
};
