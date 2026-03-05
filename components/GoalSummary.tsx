import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Gauge,
  Landmark,
  Layers,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { FinanceState, Goal, RelativeDate, View } from '../types';
import { formatCurrency } from '../lib/currency';
import {
  buildBucketDiscountFactors,
  getGoalIntervalYears,
  getLifeExpectancyYear,
  getRiskReturnAssumption,
  inflateByBuckets,
} from '../lib/financeMath';
import { annualIncomeFromDetailed } from '../lib/incomeMath';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const annualizeAmount = (amount: number, frequency?: 'Monthly' | 'Quarterly' | 'Annually' | 'One time') => {
  if (!Number.isFinite(amount)) return 0;
  if (frequency === 'Quarterly') return amount * 4;
  if (frequency === 'Annually' || frequency === 'One time') return amount;
  return amount * 12;
};

const futureValue = (principal: number, monthlyContribution: number, annualReturn: number, years: number) => {
  const months = Math.max(0, Math.round(years * 12));
  if (months === 0) return principal;
  const monthlyRate = annualReturn / 100 / 12;
  if (monthlyRate <= 0) return principal + (monthlyContribution * months);
  const growth = Math.pow(1 + monthlyRate, months);
  return principal * growth + monthlyContribution * ((growth - 1) / monthlyRate);
};

const requiredMonthlyContribution = (targetFv: number, currentCorpus: number, annualReturn: number, years: number) => {
  const months = Math.max(1, Math.round(years * 12));
  if (targetFv <= currentCorpus) return 0;
  const monthlyRate = annualReturn / 100 / 12;
  if (monthlyRate <= 0) {
    return Math.max(0, (targetFv - currentCorpus) / months);
  }

  const growth = Math.pow(1 + monthlyRate, months);
  const futureFromCurrent = currentCorpus * growth;
  if (targetFv <= futureFromCurrent) return 0;

  const denominator = (growth - 1) / monthlyRate;
  if (denominator <= 0) return Math.max(0, (targetFv - currentCorpus) / months);
  return Math.max(0, (targetFv - futureFromCurrent) / denominator);
};

const frequencyLabel = (goal: Goal) => {
  if (!goal.isRecurring) return 'One time';
  if (goal.frequencyIntervalYears && goal.frequencyIntervalYears > 1) return `Every ${goal.frequencyIntervalYears} years`;
  return goal.frequency || 'Yearly';
};

const describeFundingStatus = (ratio: number): 'Surplus' | 'Fully Funded' | 'Partially Funded' | 'Shortfall' => {
  if (ratio >= 1.05) return 'Surplus';
  if (ratio >= 1) return 'Fully Funded';
  if (ratio >= 0.75) return 'Partially Funded';
  return 'Shortfall';
};

type GoalStatus = 'onTrack' | 'attention' | 'critical';

type GoalInsight = Goal & {
  srNo: number;
  startYear: number;
  endYear: number;
  corpusAtStart: number;
  corpusToday: number;
  sumCorpus: number;
  currentCorpusRequired: number;
  progressPct: number;
  fundingGap: number;
  yearsRemaining: number;
  status: GoalStatus;
};

const statusMeta: Record<GoalStatus, { label: string; tone: string; accent: string }> = {
  onTrack: {
    label: 'On Track',
    tone: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    accent: 'bg-emerald-500',
  },
  attention: {
    label: 'Needs Attention',
    tone: 'bg-amber-50 text-amber-700 border border-amber-100',
    accent: 'bg-amber-500',
  },
  critical: {
    label: 'Critically Underfunded',
    tone: 'bg-rose-50 text-rose-700 border border-rose-100',
    accent: 'bg-rose-500',
  },
};

const GoalSummary: React.FC<{ state: FinanceState; setView: (view: View) => void }> = ({ state, setView }) => {
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const [summaryMode, setSummaryMode] = useState<'all' | 'executive' | 'tables' | 'analysis'>('all');

  const currentYear = new Date().getFullYear();
  const birthYear = state.profile.dob ? new Date(state.profile.dob).getFullYear() : currentYear - 30;

  const goalsData = useMemo<GoalInsight[]>(() => {
    const resolveYear = (rel: RelativeDate): number => {
      switch (rel.type) {
        case 'Year':
          return rel.value;
        case 'Age':
          return birthYear + rel.value;
        case 'Retirement':
          return birthYear + state.profile.retirementAge + rel.value;
        case 'LifeExpectancy':
          return birthYear + state.profile.lifeExpectancy + rel.value;
        default:
          return rel.value;
      }
    };

    const baseReturn = getRiskReturnAssumption(state.riskProfile?.level);
    const discountSettings = state.discountSettings;
    const discountFallback = discountSettings?.defaultDiscountRate ?? baseReturn;
    const retirementYear = state.profile.dob
      ? new Date(state.profile.dob).getFullYear() + state.profile.retirementAge
      : (currentYear + 30);

    const maxGoalYear = state.goals.reduce((maxYear, goal) => Math.max(maxYear, resolveYear(goal.endDate)), currentYear + 1);
    const endYear = Math.max(
      maxGoalYear,
      getLifeExpectancyYear(state.profile.dob, state.profile.lifeExpectancy) ?? (currentYear + 35),
    );

    const discountFactors = buildBucketDiscountFactors(currentYear, endYear, retirementYear, discountSettings, discountFallback);

    const inflateFromCurrent = (amount: number, fromYear: number, toYear: number, rate: number) => {
      if (toYear <= fromYear) return amount;
      if (!discountSettings?.useBucketInflation) {
        const years = Math.max(0, toYear - fromYear);
        return amount * Math.pow(1 + (rate / 100), years);
      }
      return inflateByBuckets(amount, fromYear, toYear, currentYear, retirementYear, discountSettings, rate);
    };

    return state.goals
      .slice()
      .sort((a, b) => a.priority - b.priority)
      .map((goal, idx) => {
        const sYear = resolveYear(goal.startDate);
        const eYear = resolveYear(goal.endDate);
        const yearsToStart = Math.max(0, sYear - currentYear);
        const inflationFallback = discountSettings?.defaultInflationRate ?? goal.inflationRate;
        const fvAtStart = discountSettings?.useBucketInflation
          ? inflateByBuckets(goal.targetAmountToday, currentYear, sYear, currentYear, retirementYear, discountSettings, inflationFallback)
          : (goal.startGoalAmount ?? (goal.targetAmountToday * Math.pow(1 + (goal.inflationRate / 100), yearsToStart)));

        let sumCorpus = 0;
        let currentCorpusRequired = 0;
        let corpusToday = 0;

        for (let year = sYear; year <= eYear; year++) {
          const nominal = (() => {
            if (!goal.isRecurring) {
              return year === eYear ? fvAtStart : 0;
            }

            const yearsFromStart = Math.max(0, year - sYear);
            const baseAmount = discountSettings?.useBucketInflation
              ? inflateByBuckets(fvAtStart, sYear, year, currentYear, retirementYear, discountSettings, inflationFallback)
              : fvAtStart * Math.pow(1 + (goal.inflationRate / 100), yearsFromStart);

            const interval = getGoalIntervalYears(goal.frequency, goal.frequencyIntervalYears);
            if (interval > 1 && (year - sYear) % interval !== 0) return 0;
            if (goal.frequency === 'Monthly') return baseAmount * 12;
            return baseAmount;
          })();

          if (nominal <= 0) continue;
          sumCorpus += nominal;
          const factor = discountFactors[year] || 1;
          currentCorpusRequired += nominal / factor;
        }

        if (!goal.isRecurring) {
          corpusToday = inflateFromCurrent(goal.targetAmountToday, currentYear, eYear, inflationFallback);
        } else {
          for (let year = sYear; year <= eYear; year++) {
            const interval = getGoalIntervalYears(goal.frequency, goal.frequencyIntervalYears);
            if (interval > 1 && (year - sYear) % interval !== 0) continue;
            const baseAmount = inflateFromCurrent(goal.targetAmountToday, currentYear, year, inflationFallback);
            corpusToday += goal.frequency === 'Monthly' ? baseAmount * 12 : baseAmount;
          }
        }

        const progressPct = sumCorpus > 0 ? clamp((goal.currentAmount / sumCorpus) * 100, 0, 100) : 0;
        const fundingGap = Math.max(0, sumCorpus - goal.currentAmount);
        const yearsRemaining = Math.max(1, eYear - currentYear);
        const status: GoalStatus = progressPct >= 80 ? 'onTrack' : progressPct >= 40 ? 'attention' : 'critical';

        return {
          ...goal,
          srNo: idx + 1,
          startYear: sYear,
          endYear: eYear,
          corpusAtStart: fvAtStart,
          corpusToday,
          sumCorpus,
          currentCorpusRequired,
          progressPct,
          fundingGap,
          yearsRemaining,
          status,
        };
      });
  }, [state.goals, state.profile, state.discountSettings, state.riskProfile, currentYear, birthYear]);

  const primaryGoal = useMemo(() => {
    if (goalsData.length === 0) return null;
    return goalsData.find(g => g.type === 'Retirement') ?? goalsData[0];
  }, [goalsData]);

  const categoryDefaultReturns: Record<string, number> = {
    Equity: 15,
    Debt: 8,
    'Gold/Silver': 7,
    Liquid: 3,
    'Real Estate': 5,
  };

  const availableAssets = state.assets.filter(a => a.availableForGoals);
  const assetPool = availableAssets.length > 0 ? availableAssets : state.assets;
  const totalAssetValue = assetPool.reduce((sum, a) => sum + a.currentValue, 0);

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

  const returnGap = currentAvailableReturn - recommendedReturn;

  const annualIncome = [
    state.profile.income,
    ...state.family.filter(member => member.includeIncomeInPlanning !== false).map(member => member.income),
  ].reduce((sum, income) => sum + annualIncomeFromDetailed(income), 0);

  const annualExpenses = state.detailedExpenses.length > 0
    ? state.detailedExpenses.reduce((sum, item) => sum + annualizeAmount(item.amount || 0, item.frequency), 0)
    : (state.profile.monthlyExpenses || 0) * 12;

  const annualDebtService = state.loans.reduce((sum, loan) => sum + ((loan.emi || 0) * 12), 0);
  const annualCommitments = state.investmentCommitments.reduce((sum, commitment) => {
    return sum + annualizeAmount(commitment.amount || 0, commitment.frequency);
  }, 0);

  const annualSurplus = Math.max(0, annualIncome - annualExpenses - annualDebtService - annualCommitments);
  const availableMonthlyContribution = annualSurplus / 12;

  const totalInsuranceCover = state.insurance.reduce((sum, policy) => sum + (policy.sumAssured || policy.sumInsured || 0), 0);
  const totalInsurancePremium = state.insurance.reduce((sum, policy) => sum + (policy.premium || 0), 0);
  const totalDebtOutstanding = state.loans.reduce((sum, loan) => sum + (loan.outstandingAmount || 0), 0);
  const debtServiceRatio = annualIncome > 0 ? (annualDebtService / annualIncome) * 100 : 0;

  const goalModel = useMemo(() => {
    if (!primaryGoal) return null;

    const futureGoalValue = primaryGoal.sumCorpus;
    const currentSavings = primaryGoal.currentAmount;
    const yearsRemaining = Math.max(1, primaryGoal.yearsRemaining);
    const targetYear = primaryGoal.endYear;
    const fundingGap = Math.max(0, futureGoalValue - currentSavings);
    const fundingProgress = futureGoalValue > 0 ? clamp((currentSavings / futureGoalValue) * 100, 0, 100) : 0;

    const monthlyNeededCurrent = requiredMonthlyContribution(
      futureGoalValue,
      currentSavings,
      Math.max(0, currentAvailableReturn),
      yearsRemaining,
    );

    const monthlyNeededOptimized = requiredMonthlyContribution(
      futureGoalValue,
      currentSavings,
      Math.max(0, recommendedReturn),
      yearsRemaining,
    );

    const projectedCurrent = futureValue(
      currentSavings,
      availableMonthlyContribution,
      Math.max(0, currentAvailableReturn),
      yearsRemaining,
    );

    const projectedOptimized = futureValue(
      currentSavings,
      Math.max(availableMonthlyContribution, monthlyNeededOptimized),
      Math.max(0, recommendedReturn),
      yearsRemaining,
    );

    const shortfallCurrent = Math.max(0, futureGoalValue - projectedCurrent);
    const shortfallOptimized = Math.max(0, futureGoalValue - projectedOptimized);

    const probabilityCurrent = futureGoalValue > 0 ? clamp((projectedCurrent / futureGoalValue) * 100, 0, 99) : 0;
    const probabilityOptimized = futureGoalValue > 0 ? clamp((projectedOptimized / futureGoalValue) * 100, 0, 100) : 0;

    const contributionAdequacyScore = monthlyNeededOptimized > 0
      ? clamp((availableMonthlyContribution / monthlyNeededOptimized) * 100, 0, 100)
      : 100;

    const fundingProgressScore = fundingProgress;
    const returnAlignmentScore = clamp(100 - (Math.max(0, recommendedReturn - currentAvailableReturn) * 12), 20, 100);
    const riskMatchScore = state.riskProfile?.level ? (returnGap >= 0 ? 88 : 72) : 65;
    const horizonFitScore = yearsRemaining >= 20 ? 90 : yearsRemaining >= 12 ? 80 : yearsRemaining >= 6 ? 68 : 54;

    const goalHealthScore = Math.round(
      (fundingProgressScore * 0.35) +
      (returnAlignmentScore * 0.2) +
      (contributionAdequacyScore * 0.2) +
      (riskMatchScore * 0.15) +
      (horizonFitScore * 0.1)
    );

    const healthStatus: GoalStatus = goalHealthScore >= 75 ? 'onTrack' : goalHealthScore >= 50 ? 'attention' : 'critical';

    const trajectoryFractions = [0, 0.25, 0.5, 0.75, 1];
    const targetSeries = trajectoryFractions.map(f => currentSavings + ((futureGoalValue - currentSavings) * f));
    const currentSeries = trajectoryFractions.map(f => futureValue(
      currentSavings,
      availableMonthlyContribution,
      Math.max(0, currentAvailableReturn),
      yearsRemaining * f,
    ));
    const optimizedSeries = trajectoryFractions.map(f => futureValue(
      currentSavings,
      Math.max(availableMonthlyContribution, monthlyNeededOptimized),
      Math.max(0, recommendedReturn),
      yearsRemaining * f,
    ));

    const projectionMax = Math.max(1, ...targetSeries, ...currentSeries, ...optimizedSeries);

    return {
      futureGoalValue,
      currentSavings,
      yearsRemaining,
      targetYear,
      fundingGap,
      fundingProgress,
      monthlyNeededCurrent,
      monthlyNeededOptimized,
      projectedCurrent,
      projectedOptimized,
      shortfallCurrent,
      shortfallOptimized,
      probabilityCurrent,
      probabilityOptimized,
      goalHealthScore,
      healthStatus,
      contributionAdequacyScore,
      returnAlignmentScore,
      riskMatchScore,
      horizonFitScore,
      targetSeries,
      currentSeries,
      optimizedSeries,
      projectionMax,
    };
  }, [primaryGoal, currentAvailableReturn, recommendedReturn, availableMonthlyContribution, returnGap, state.riskProfile?.level]);

  const totalGoals = goalsData.length;
  const totalCorpusRequiredToday = goalsData.reduce((sum, goal) => sum + goal.currentCorpusRequired, 0);
  const totalProjectedRequirement = goalsData.reduce((sum, goal) => sum + goal.sumCorpus, 0);
  const totalCurrentSavings = goalsData.reduce((sum, goal) => sum + goal.currentAmount, 0);
  const retirementGoal = goalsData.find((goal) => goal.type === 'Retirement') || null;
  const retirementYear = state.profile.dob
    ? new Date(state.profile.dob).getFullYear() + state.profile.retirementAge
    : currentYear + 30;
  const lifeExpectancyYear = getLifeExpectancyYear(state.profile.dob, state.profile.lifeExpectancy) ?? (currentYear + 35);
  const yearsToLifeExpectancy = Math.max(1, lifeExpectancyYear - currentYear);

  const projectedCorpusAtLifeExpectancy = futureValue(
    totalCurrentSavings,
    availableMonthlyContribution,
    Math.max(0, recommendedReturn),
    yearsToLifeExpectancy,
  );

  const projectedSurplusAtLife = projectedCorpusAtLifeExpectancy - totalProjectedRequirement;
  const feasibilityRatio = totalProjectedRequirement > 0 ? projectedCorpusAtLifeExpectancy / totalProjectedRequirement : 0;
  const feasibilityResult = describeFundingStatus(feasibilityRatio);
  const allGoalsAchievable = feasibilityRatio >= 1;
  const requiredMonthlyForAllGoals = requiredMonthlyContribution(
    totalProjectedRequirement,
    totalCurrentSavings,
    Math.max(0, recommendedReturn),
    yearsToLifeExpectancy,
  );
  const additionalMonthlyRequired = Math.max(0, requiredMonthlyForAllGoals - availableMonthlyContribution);

  const annualFundingPressure = useMemo(() => {
    const resolveYear = (rel: RelativeDate): number => {
      switch (rel.type) {
        case 'Year':
          return rel.value;
        case 'Age':
          return birthYear + rel.value;
        case 'Retirement':
          return birthYear + state.profile.retirementAge + rel.value;
        case 'LifeExpectancy':
          return birthYear + state.profile.lifeExpectancy + rel.value;
        default:
          return rel.value;
      }
    };

    const discountSettings = state.discountSettings;
    const inflateAmount = (amount: number, fromYear: number, toYear: number, fallbackRate: number) => {
      if (toYear <= fromYear) return amount;
      if (!discountSettings?.useBucketInflation) {
        const years = Math.max(0, toYear - fromYear);
        return amount * Math.pow(1 + fallbackRate / 100, years);
      }
      return inflateByBuckets(amount, fromYear, toYear, currentYear, retirementYear, discountSettings, fallbackRate);
    };

    const rows: Array<{ year: number; amount: number }> = [];
    for (let year = currentYear; year <= lifeExpectancyYear; year += 1) {
      const amount = state.goals.reduce((sum, goal) => {
        const sYear = resolveYear(goal.startDate);
        const eYear = resolveYear(goal.endDate);
        if (year < sYear || year > eYear) return sum;
        const inflationFallback = state.discountSettings?.defaultInflationRate ?? goal.inflationRate;
        const baseForYear = inflateAmount(goal.targetAmountToday, currentYear, year, inflationFallback);
        if (!goal.isRecurring) {
          return year === eYear ? sum + baseForYear : sum;
        }
        const interval = getGoalIntervalYears(goal.frequency, goal.frequencyIntervalYears);
        if (interval > 1 && (year - sYear) % interval !== 0) return sum;
        return sum + (goal.frequency === 'Monthly' ? (baseForYear * 12) : baseForYear);
      }, 0);
      rows.push({ year, amount });
    }
    return rows;
  }, [state.goals, state.profile, state.discountSettings, birthYear, currentYear, lifeExpectancyYear, retirementYear]);

  const topFundingPressureYears = [...annualFundingPressure]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3)
    .filter((item) => item.amount > 0);

  const priorityFundingRows = useMemo(() => {
    const sorted = goalsData.slice().sort((a, b) => a.priority - b.priority);
    let remainingProjected = Math.max(0, projectedCorpusAtLifeExpectancy);
    let remainingMonthly = Math.max(0, availableMonthlyContribution);

    return sorted.map((goal) => {
      const required = goal.sumCorpus;
      const projectedAvailable = Math.min(required, remainingProjected);
      remainingProjected = Math.max(0, remainingProjected - projectedAvailable);

      const additionalDepositRequired = Math.max(0, required - projectedAvailable);
      const requiredMonthlyForGoal = requiredMonthlyContribution(
        goal.sumCorpus,
        goal.currentAmount,
        Math.max(0, recommendedReturn),
        Math.max(1, goal.yearsRemaining),
      );

      const assignedMonthly = Math.min(remainingMonthly, requiredMonthlyForGoal);
      remainingMonthly = Math.max(0, remainingMonthly - assignedMonthly);
      const additionalMonthlySavingsRequired = Math.max(0, requiredMonthlyForGoal - assignedMonthly);

      return {
        goal,
        amountRequired: required,
        projectedAvailable,
        pctFunded: required > 0 ? (projectedAvailable / required) * 100 : 100,
        additionalDepositRequired,
        additionalMonthlySavingsRequired,
      };
    });
  }, [goalsData, projectedCorpusAtLifeExpectancy, availableMonthlyContribution, recommendedReturn]);

  const highPriorityRows = useMemo(() => {
    const hardPriority = priorityFundingRows.filter((row) => row.goal.priority <= 2);
    if (hardPriority.length > 0) return hardPriority;
    return priorityFundingRows.slice(0, Math.max(1, Math.ceil(priorityFundingRows.length / 2)));
  }, [priorityFundingRows]);

  const lowPriorityRows = useMemo(() => {
    const highIds = new Set(highPriorityRows.map((row) => row.goal.id));
    return priorityFundingRows.filter((row) => !highIds.has(row.goal.id));
  }, [priorityFundingRows, highPriorityRows]);

  const resourceMappingRows = useMemo(() => {
    const cashInHand = state.assets
      .filter((asset) => asset.category === 'Liquid' || asset.subCategory.toLowerCase().includes('cash') || asset.name.toLowerCase().includes('cash'))
      .reduce((sum, asset) => sum + asset.currentValue, 0);

    const mutualFunds = state.assets
      .filter((asset) => asset.category === 'Equity' && (
        asset.subCategory.toLowerCase().includes('mutual')
        || asset.subCategory.toLowerCase().includes('mf')
        || asset.name.toLowerCase().includes('mutual')
      ))
      .reduce((sum, asset) => sum + asset.currentValue, 0);

    const directEquity = state.assets
      .filter((asset) => asset.category === 'Equity' && !(
        asset.subCategory.toLowerCase().includes('mutual')
        || asset.subCategory.toLowerCase().includes('mf')
        || asset.name.toLowerCase().includes('mutual')
      ))
      .reduce((sum, asset) => sum + asset.currentValue, 0);

    const epf = state.assets
      .filter((asset) => {
        const text = `${asset.subCategory} ${asset.name}`.toLowerCase();
        return asset.category === 'Debt' && (text.includes('epf') || text.includes('gpf') || text.includes('dsop') || text.includes('ppf'));
      })
      .reduce((sum, asset) => sum + asset.currentValue, 0);

    const rsus = state.assets
      .filter((asset) => {
        const text = `${asset.subCategory} ${asset.name}`.toLowerCase();
        return text.includes('rsu') || text.includes('esop') || text.includes('stock option');
      })
      .reduce((sum, asset) => sum + asset.currentValue, 0);

    const sipContributions = state.investmentCommitments
      .filter((commitment) => {
        const text = commitment.label.toLowerCase();
        return text.includes('sip') || text.includes('mutual') || text.includes('mf');
      })
      .reduce((sum, commitment) => sum + annualizeAmount(commitment.amount, commitment.frequency), 0);

    const mapped = [
      {
        resource: 'Cash in hand',
        currentValue: cashInHand,
        contributionPattern: 'Immediate liquidity reserve',
        allocatedTo: 'Emergency buffer and near-term goals',
      },
      {
        resource: 'Mutual Funds',
        currentValue: mutualFunds,
        contributionPattern: 'Market-linked accumulation',
        allocatedTo: 'Mid and long-term goals (priority wise)',
      },
      {
        resource: 'Direct Equity',
        currentValue: directEquity,
        contributionPattern: 'Growth sleeve with periodic rebalancing',
        allocatedTo: 'Long-term growth and inflation hedge',
      },
      {
        resource: 'EPF / Retirement debt bucket',
        currentValue: epf,
        contributionPattern: 'Structured retirement corpus build-up',
        allocatedTo: 'Retirement income continuity',
      },
      {
        resource: 'RSUs / Stock-linked wealth',
        currentValue: rsus,
        contributionPattern: 'Vesting-led opportunistic deployment',
        allocatedTo: 'High-value future goals and reserve funding',
      },
      {
        resource: 'SIP contributions',
        currentValue: sipContributions,
        contributionPattern: `${formatCurrency(Math.round(sipContributions / 12), state.profile.country)} monthly equivalent`,
        allocatedTo: 'Systematic long-term goal funding',
      },
      {
        resource: 'Surplus cashflow',
        currentValue: annualSurplus,
        contributionPattern: `${formatCurrency(Math.round(availableMonthlyContribution), state.profile.country)} monthly deployable surplus`,
        allocatedTo: 'Funding gap closure across priority goals',
      },
    ];

    return mapped.filter((row) => row.currentValue > 0);
  }, [state.assets, state.investmentCommitments, state.profile.country, annualSurplus, availableMonthlyContribution]);

  const keyInsights = useMemo(() => {
    const insights: string[] = [];
    const retirementPressure = retirementGoal ? retirementGoal.sumCorpus / Math.max(1, totalProjectedRequirement) : 0;
    const inflationHeavy = goalsData
      .filter((goal) => goal.inflationRate >= 7)
      .sort((a, b) => b.inflationRate - a.inflationRate)
      .slice(0, 2);

    insights.push(`Total goals tracked: ${totalGoals}, with projected requirement of ${formatCurrency(Math.round(totalProjectedRequirement), state.profile.country)}.`);
    if (inflationHeavy.length > 0) {
      insights.push(`Inflation-sensitive goals (${inflationHeavy.map((goal) => goal.type).join(', ')}) are increasing long-term capital demand.`);
    }
    if (retirementGoal) {
      insights.push(`Retirement represents ${Math.round(retirementPressure * 100)}% of projected goal funding load, making it the anchor objective.`);
    }
    if (topFundingPressureYears.length > 0) {
      insights.push(`Highest funding pressure is concentrated around ${topFundingPressureYears.map((item) => item.year).join(', ')}.`);
    }
    if (availableMonthlyContribution > 0) {
      insights.push(`Current monthly surplus of ${formatCurrency(Math.round(availableMonthlyContribution), state.profile.country)} provides flexibility for systematic gap closure.`);
    }
    if (projectedSurplusAtLife >= 0) {
      insights.push(`Projected plan-end surplus suggests optionality for legacy, early retirement flexibility, or strategic reinvestment.`);
    } else {
      insights.push(`Current projection indicates a gap by life expectancy; incremental monthly savings and allocation optimization are recommended.`);
    }
    insights.push(`Goal funding discipline improves consistency and reduces dependence on last-minute high-risk return assumptions.`);

    return insights.slice(0, 8);
  }, [
    totalGoals,
    totalProjectedRequirement,
    state.profile.country,
    goalsData,
    retirementGoal,
    topFundingPressureYears,
    availableMonthlyContribution,
    projectedSurplusAtLife,
  ]);

  const fullyFundedGoals = goalsData.filter((goal) => goal.progressPct >= 100).length;
  const partiallyFundedGoals = goalsData.filter((goal) => goal.progressPct >= 60 && goal.progressPct < 100).length;
  const criticalGoals = goalsData.filter((goal) => goal.progressPct < 60).length;
  const averageFundingPct = goalsData.length > 0
    ? goalsData.reduce((sum, goal) => sum + goal.progressPct, 0) / goalsData.length
    : 0;

  const projectionPath = (series: number[], max: number) => {
    const width = 320;
    const height = 140;
    if (series.length === 0 || max <= 0) return '';
    return series.map((value, idx) => {
      const x = (idx / Math.max(1, series.length - 1)) * width;
      const y = height - ((value / max) * height);
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(' ');
  };

  const actionItems = useMemo(() => {
    if (!goalModel || !primaryGoal) return [] as Array<{
      title: string;
      description: string;
      impact: string;
      cta: string;
      view: View;
    }>;

    const contributionLift = Math.max(0, goalModel.monthlyNeededOptimized - availableMonthlyContribution);
    const successAfterRebalance = goalModel.futureGoalValue > 0
      ? clamp((futureValue(
          goalModel.currentSavings,
          availableMonthlyContribution,
          Math.max(0, recommendedReturn),
          goalModel.yearsRemaining,
        ) / goalModel.futureGoalValue) * 100, 0, 100)
      : 0;

    const extendYears = primaryGoal.type === 'Retirement' ? 2 : 1;
    const extendedMonthlyNeed = requiredMonthlyContribution(
      goalModel.futureGoalValue,
      goalModel.currentSavings,
      Math.max(0, recommendedReturn),
      goalModel.yearsRemaining + extendYears,
    );

    const probabilityFromContribution = goalModel.futureGoalValue > 0
      ? clamp((futureValue(
          goalModel.currentSavings,
          availableMonthlyContribution + contributionLift,
          Math.max(0, recommendedReturn),
          goalModel.yearsRemaining,
        ) / goalModel.futureGoalValue) * 100, 0, 100)
      : 0;

    return [
      {
        title: `Increase monthly contribution by ${formatCurrency(Math.round(contributionLift), state.profile.country)}`,
        description: 'Strengthen monthly inflow toward this goal to close the capital gap faster.',
        impact: `Improves funding probability by ${Math.max(0, Math.round(probabilityFromContribution - goalModel.probabilityCurrent))}%.`,
        cta: 'Tune Cash Flow',
        view: 'cashflow',
      },
      {
        title: `Rebalance allocation toward ${recommendedReturn.toFixed(1)}% target return`,
        description: 'Reduce return drag by aligning assets with your risk profile and long-horizon objective.',
        impact: `Potentially improves funding probability by ${Math.max(0, Math.round(successAfterRebalance - goalModel.probabilityCurrent))}%.`,
        cta: 'Optimize Allocation',
        view: 'investment-plan',
      },
      {
        title: `Evaluate extending timeline by ${extendYears} year${extendYears > 1 ? 's' : ''}`,
        description: 'A modest horizon extension can reduce pressure on monthly contributions.',
        impact: `Monthly requirement may drop to ${formatCurrency(Math.round(extendedMonthlyNeed), state.profile.country)}.`,
        cta: 'Run Scenario',
        view: 'projections',
      },
      {
        title: 'Optimize tax efficiency and account placement',
        description: 'Use tax-aware deployment to reduce drag and preserve compounding power.',
        impact: `Can improve annual deployable surplus from ${formatCurrency(Math.round(annualSurplus), state.profile.country)}.` ,
        cta: 'Review Tax Plan',
        view: 'tax-estate',
      },
    ];
  }, [goalModel, primaryGoal, availableMonthlyContribution, recommendedReturn, state.profile.country, annualSurplus]);

  const currencyCountry = state.profile.country;

  if (!primaryGoal || !goalModel) {
    return (
      <div className="w-full min-w-0 max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-700 pb-24">
        <div className="surface-dark p-10 md:p-14 rounded-[2.5rem] md:rounded-[4rem] text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 blur-[100px] rounded-full translate-x-1/3 -translate-y-1/3" />
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-teal-500/30 bg-teal-500/10 text-teal-300 text-[10px] font-black uppercase tracking-[0.25em]">
              <Layers size={14} /> Goal Funding Terminal
            </div>
            <h2 className="text-4xl md:text-6xl font-black tracking-tight">Goal Summary</h2>
            <p className="text-slate-300 text-sm md:text-base font-medium max-w-2xl">
              Add at least one goal to activate the executive funding dashboard and ranked action strategy.
            </p>
          </div>
        </div>
        <div className="bg-white rounded-[2rem] md:rounded-[3rem] border border-slate-200 p-10 md:p-14 shadow-sm text-center">
          <p className="text-slate-600 font-medium mb-6">No goal data is available yet.</p>
          <button
            type="button"
            onClick={() => setView('goals')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-teal-600 text-white text-xs font-black uppercase tracking-widest hover:bg-teal-700 transition-colors"
          >
            Create Your First Goal <ArrowRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  const status = statusMeta[goalModel.healthStatus];
  const inflationImpact = Math.max(0, goalModel.futureGoalValue - primaryGoal.targetAmountToday);
  const returnGapImpact = Math.max(0, goalModel.fundingGap * (Math.max(0, recommendedReturn - currentAvailableReturn) / Math.max(1, recommendedReturn)));

  const deepDivePanels = [
    {
      id: 'risk',
      icon: ShieldCheck,
      title: 'Risk & Allocation',
      subtitle: 'Risk alignment and return efficiency across investable assets.',
      body: (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Risk Profile</p>
            <p className="text-xl font-black text-slate-900 mt-2">{state.riskProfile?.level || 'Balanced'}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Current Return</p>
            <p className="text-xl font-black text-slate-900 mt-2">{currentAvailableReturn.toFixed(2)}%</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Target Return</p>
            <p className="text-xl font-black text-slate-900 mt-2">{recommendedReturn.toFixed(2)}%</p>
          </div>
        </div>
      ),
    },
    {
      id: 'cashflow',
      icon: Wallet,
      title: 'Cash Flow Contribution Engine',
      subtitle: 'Contribution capacity derived from household surplus after obligations.',
      body: (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Annual Surplus</p>
            <p className="text-xl font-black text-slate-900 mt-2">{formatCurrency(Math.round(annualSurplus), currencyCountry)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Available Monthly</p>
            <p className="text-xl font-black text-slate-900 mt-2">{formatCurrency(Math.round(availableMonthlyContribution), currencyCountry)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Required Monthly</p>
            <p className="text-xl font-black text-slate-900 mt-2">{formatCurrency(Math.round(goalModel.monthlyNeededOptimized), currencyCountry)}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'protection',
      icon: Sparkles,
      title: 'Protection & Insurance',
      subtitle: 'Coverage adequacy and premium load against goal obligations.',
      body: (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Cover</p>
            <p className="text-xl font-black text-slate-900 mt-2">{formatCurrency(Math.round(totalInsuranceCover), currencyCountry)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Annual Premium</p>
            <p className="text-xl font-black text-slate-900 mt-2">{formatCurrency(Math.round(totalInsurancePremium), currencyCountry)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Coverage / Goal</p>
            <p className="text-xl font-black text-slate-900 mt-2">
              {goalModel.futureGoalValue > 0 ? `${((totalInsuranceCover / goalModel.futureGoalValue) * 100).toFixed(1)}%` : '0.0%'}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'tax',
      icon: TrendingUp,
      title: 'Tax Efficiency',
      subtitle: 'Tax drag control to improve net deployable investment flow.',
      body: (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Annual Income</p>
            <p className="text-xl font-black text-slate-900 mt-2">{formatCurrency(Math.round(annualIncome), currencyCountry)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Annual Commitments</p>
            <p className="text-xl font-black text-slate-900 mt-2">{formatCurrency(Math.round(annualCommitments), currencyCountry)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Estimated Tax Drag</p>
            <p className="text-xl font-black text-slate-900 mt-2">{formatCurrency(Math.round(annualIncome * 0.08), currencyCountry)}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'loan',
      icon: Landmark,
      title: 'Loan Strategy',
      subtitle: 'Debt servicing impact on monthly contribution and long-term flexibility.',
      body: (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Outstanding Debt</p>
            <p className="text-xl font-black text-slate-900 mt-2">{formatCurrency(Math.round(totalDebtOutstanding), currencyCountry)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Annual EMI Outflow</p>
            <p className="text-xl font-black text-slate-900 mt-2">{formatCurrency(Math.round(annualDebtService), currencyCountry)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Debt Service Ratio</p>
            <p className="text-xl font-black text-slate-900 mt-2">{debtServiceRatio.toFixed(1)}%</p>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="w-full min-w-0 max-w-[1400px] mx-auto overflow-x-hidden space-y-6 md:space-y-8 animate-in fade-in duration-700 pb-24">
      <div className="surface-dark p-8 md:p-12 rounded-[2.5rem] md:rounded-[4rem] text-white relative overflow-hidden shadow-2xl shadow-teal-900/20">
        <div className="absolute top-0 right-0 w-[420px] h-[420px] bg-teal-600/15 blur-[120px] rounded-full translate-x-1/4 -translate-y-1/4" />
        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-8">
          <div className="space-y-4 max-w-3xl text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-teal-500/30 bg-teal-500/10 text-teal-300 text-[10px] font-black uppercase tracking-[0.25em]">
              <Layers size={14} /> Guided Goal Intelligence
            </div>
            <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.95]">Goal Funding Terminal</h2>
            <p className="text-slate-300 text-sm md:text-base font-medium max-w-2xl">
              A calm, decision-first view of your retirement readiness. We focus on what to do next, not on reporting noise.
            </p>
          </div>
          <div className="inline-flex items-center gap-3 self-start xl:self-auto px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-[11px] font-black uppercase tracking-widest text-slate-300">
            <CalendarClock size={14} className="text-teal-400" />
            {goalModel.yearsRemaining} years to target window
          </div>
        </div>
      </div>

      <div className="sticky top-2 z-20 bg-white/90 backdrop-blur-xl rounded-[1.5rem] border border-slate-200 shadow-sm px-3 py-3 md:px-5 md:py-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSummaryMode('executive')}
              className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-colors ${
                summaryMode === 'executive' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-200 hover:border-teal-200 hover:text-teal-700'
              }`}
            >
              Executive Focus
            </button>
            <button
              type="button"
              onClick={() => setSummaryMode('tables')}
              className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-colors ${
                summaryMode === 'tables' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-200 hover:border-teal-200 hover:text-teal-700'
              }`}
            >
              Tables Focus
            </button>
            <button
              type="button"
              onClick={() => setSummaryMode('analysis')}
              className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-colors ${
                summaryMode === 'analysis' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-200 hover:border-teal-200 hover:text-teal-700'
              }`}
            >
              Analysis Focus
            </button>
            <button
              type="button"
              onClick={() => setSummaryMode('all')}
              className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-colors ${
                summaryMode === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              Full View
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 min-w-0 w-full lg:w-auto">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Funded</p>
              <p className="text-sm font-black text-emerald-700 mt-1">{fullyFundedGoals}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Partial</p>
              <p className="text-sm font-black text-amber-700 mt-1">{partiallyFundedGoals}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Critical</p>
              <p className="text-sm font-black text-rose-700 mt-1">{criticalGoals}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Avg Funded</p>
              <p className="text-sm font-black text-slate-900 mt-1">{averageFundingPct.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] md:rounded-[3rem] border border-slate-200 shadow-sm p-6 md:p-8 lg:p-10">
        <div className="flex flex-col xl:flex-row gap-8 xl:items-start xl:justify-between">
          <div className="space-y-5 max-w-3xl text-left">
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-teal-700">Executive Goal Snapshot</p>
            <div className="space-y-3">
              <h3 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight leading-[0.95]">
                {primaryGoal.type} <span className="text-slate-400">Target {goalModel.targetYear}</span>
              </h3>
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest ${status.tone}`}>
                {goalModel.healthStatus === 'critical' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                {status.label}
              </div>
              <p className="text-slate-600 font-medium leading-relaxed text-sm md:text-base max-w-2xl">
                You have made consistent progress so far. To reach your retirement target with higher confidence, we should strengthen monthly funding and return efficiency.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 md:gap-8 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5 md:px-8 md:py-6 self-start w-full sm:w-auto">
            <div
              className="w-24 h-24 rounded-full p-2"
              style={{ background: `conic-gradient(#0d9488 ${goalModel.goalHealthScore * 3.6}deg, #e2e8f0 0deg)` }}
            >
              <div className="w-full h-full rounded-full bg-white flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-slate-900 leading-none">{goalModel.goalHealthScore}</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Health</span>
              </div>
            </div>
            <div className="text-left space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Probability of Success</p>
              <p className="text-3xl font-black text-slate-900 leading-none">{goalModel.probabilityCurrent.toFixed(1)}%</p>
              <p className="text-[11px] text-slate-500 font-semibold">Current pace scenario</p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-200 p-4 bg-white text-left">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Future Goal Value</p>
            <p className="text-xl md:text-2xl font-black text-slate-900 mt-2">{formatCurrency(Math.round(goalModel.futureGoalValue), currencyCountry)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4 bg-white text-left">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Current Savings</p>
            <p className="text-xl md:text-2xl font-black text-slate-900 mt-2">{formatCurrency(Math.round(goalModel.currentSavings), currencyCountry)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4 bg-white text-left">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Funding Gap</p>
            <p className="text-xl md:text-2xl font-black text-slate-900 mt-2">{formatCurrency(Math.round(goalModel.fundingGap), currencyCountry)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4 bg-white text-left">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Funding Progress</p>
            <p className="text-xl md:text-2xl font-black text-slate-900 mt-2">{goalModel.fundingProgress.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {(summaryMode !== 'tables') && (
      <div className="bg-white rounded-[2rem] md:rounded-[3rem] border border-slate-200 shadow-sm p-6 md:p-8 text-left">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="space-y-2 max-w-3xl">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">2) Executive Summary (Client-Specific)</p>
            <h4 className="text-2xl md:text-3xl font-black text-slate-900">Goal Funding Outlook</h4>
            <p className="text-sm text-slate-600 font-medium leading-relaxed">
              You currently track {totalGoals} goal{totalGoals > 1 ? 's' : ''}. Total corpus required today is {formatCurrency(Math.round(totalCorpusRequiredToday), currencyCountry)}, and inflation-adjusted projected funding requirement is {formatCurrency(Math.round(totalProjectedRequirement), currencyCountry)}.
              {' '}Retirement is modelled from age {state.profile.retirementAge} ({retirementYear}) to age {state.profile.lifeExpectancy} ({lifeExpectancyYear}).
            </p>
            <p className="text-sm text-slate-600 font-medium leading-relaxed">
              Overall feasibility: <span className="font-black text-slate-900">{feasibilityResult}</span>. {allGoalsAchievable ? 'All goals are currently achievable under projected assumptions.' : 'Not all goals are fully achievable yet under current assumptions.'}
              {' '}Additional monthly savings required: <span className="font-black text-slate-900">{formatCurrency(Math.round(additionalMonthlyRequired), currencyCountry)}</span>.
              {' '}Projected {projectedSurplusAtLife >= 0 ? 'surplus' : 'shortfall'} at life expectancy: <span className="font-black text-slate-900">{formatCurrency(Math.round(Math.abs(projectedSurplusAtLife)), currencyCountry)}</span>.
            </p>
          </div>
          <div className={`inline-flex self-start rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest border ${
            feasibilityResult === 'Surplus' || feasibilityResult === 'Fully Funded'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : feasibilityResult === 'Partially Funded'
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}>
            Feasibility: {feasibilityResult}
          </div>
        </div>
      </div>
      )}

      {(summaryMode === 'all' || summaryMode === 'tables') && (
      <div className="bg-white rounded-[2rem] md:rounded-[3rem] border border-slate-200 shadow-sm p-4 sm:p-6 md:p-8 text-left overflow-x-auto max-w-full [-webkit-overflow-scrolling:touch]">
        <div className="mb-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">4) Goals Funding Overview Table</p>
          <h4 className="text-2xl font-black text-slate-900 mt-2">At-a-Glance Funding Position</h4>
        </div>
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Goal Name</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Year(s)</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Corpus Required Today</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Projected Requirement</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">% Goal Funded</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Funding Visual</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {goalsData.map((goal) => {
              const meta = statusMeta[goal.status];
              return (
                <tr key={`overview-${goal.id}`} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-black text-slate-800">{goal.type}</td>
                  <td className="px-4 py-3 font-semibold text-slate-600">{goal.startYear} - {goal.endYear}</td>
                  <td className="px-4 py-3 text-right font-black text-slate-800">{formatCurrency(Math.round(goal.currentCorpusRequired), currencyCountry)}</td>
                  <td className="px-4 py-3 text-right font-black text-slate-800">{formatCurrency(Math.round(goal.sumCorpus), currencyCountry)}</td>
                  <td className="px-4 py-3 text-right font-black text-slate-800">{goal.progressPct.toFixed(1)}%</td>
                  <td className="px-4 py-3">
                    <div className="h-2.5 rounded-full bg-slate-100 border border-slate-200 overflow-hidden min-w-[120px]">
                      <div
                        className={`h-full ${
                          goal.progressPct >= 100 ? 'bg-emerald-500' : goal.progressPct >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, goal.progressPct)}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${meta.tone}`}>{meta.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      {(summaryMode === 'all' || summaryMode === 'tables') && (
      <div className="bg-white rounded-[2rem] md:rounded-[3rem] border border-slate-200 shadow-sm p-4 sm:p-6 md:p-8 text-left overflow-x-auto max-w-full [-webkit-overflow-scrolling:touch]">
        <div className="mb-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">5) Detailed Goal Table (Client Specific)</p>
          <h4 className="text-2xl font-black text-slate-900 mt-2">Goal-Level Funding Details</h4>
        </div>
        <table className="w-full min-w-[860px] text-left text-xs">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Goal Name</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Goal Description</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Year(s)</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Corpus Required Today</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Corpus Required At Start</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Total Amount Required</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Inflation</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Funding Sources</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Priority</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">% Goal Funded</th>
            </tr>
          </thead>
          <tbody>
            {goalsData.map((goal) => (
              <tr key={`detail-${goal.id}`} className="border-t border-slate-100 align-top">
                <td className="px-4 py-3 font-black text-slate-800">{goal.type}</td>
                <td className="px-4 py-3 font-semibold text-slate-600">{goal.description || goal.type}</td>
                <td className="px-4 py-3 font-semibold text-slate-600">{goal.startYear} - {goal.endYear} ({frequencyLabel(goal)})</td>
                <td className="px-4 py-3 text-right font-black text-slate-800">{formatCurrency(Math.round(goal.currentCorpusRequired), currencyCountry)}</td>
                <td className="px-4 py-3 text-right font-black text-slate-800">{formatCurrency(Math.round(goal.corpusAtStart), currencyCountry)}</td>
                <td className="px-4 py-3 text-right font-black text-slate-800">{formatCurrency(Math.round(goal.sumCorpus), currencyCountry)}</td>
                <td className="px-4 py-3 text-right font-black text-slate-800">{goal.inflationRate.toFixed(1)}%</td>
                <td className="px-4 py-3 font-semibold text-slate-600">{goal.resourceBuckets.join(', ') || 'Planner-assigned resources'}</td>
                <td className="px-4 py-3 text-right font-black text-slate-800">{goal.priority}</td>
                <td className="px-4 py-3 text-right font-black text-slate-800">{goal.progressPct.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {(summaryMode === 'all' || summaryMode === 'tables') && (
      <div className="bg-white rounded-[2rem] md:rounded-[3rem] border border-slate-200 shadow-sm p-4 sm:p-6 md:p-8 text-left overflow-x-auto max-w-full [-webkit-overflow-scrolling:touch]">
        <div className="mb-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">6) Financial Resource Mapping</p>
          <h4 className="text-2xl font-black text-slate-900 mt-2">How Resources Are Aligned to Goals</h4>
          <p className="text-xs text-slate-600 mt-1 font-medium">Resources are mapped to short, medium, and long-duration goals to reduce timing mismatch and forced liquidation risk.</p>
        </div>
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Resource</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Current Value</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Contribution Pattern</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Allocated To</th>
            </tr>
          </thead>
          <tbody>
            {resourceMappingRows.length === 0 && (
              <tr className="border-t border-slate-100">
                <td className="px-4 py-4 text-xs font-semibold text-slate-500" colSpan={4}>
                  No mappable resource buckets detected yet. Add assets and commitments to enable this section.
                </td>
              </tr>
            )}
            {resourceMappingRows.map((row) => (
              <tr key={`resource-${row.resource}`} className="border-t border-slate-100">
                <td className="px-4 py-3 font-black text-slate-800">{row.resource}</td>
                <td className="px-4 py-3 text-right font-black text-slate-800">{formatCurrency(Math.round(row.currentValue), currencyCountry)}</td>
                <td className="px-4 py-3 font-semibold text-slate-600">{row.contributionPattern}</td>
                <td className="px-4 py-3 font-semibold text-slate-600">{row.allocatedTo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {(summaryMode === 'all' || summaryMode === 'analysis') && (
      <div className="bg-white rounded-[2rem] md:rounded-[3rem] border border-slate-200 shadow-sm p-6 md:p-8 text-left">
        <div className="mb-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">7) Goal Cost Projection Analysis</p>
          <h4 className="text-2xl font-black text-slate-900 mt-2">Inflation, Funding Peaks, and Planning Impact</h4>
        </div>
        <div className="space-y-3 text-sm text-slate-600 font-medium leading-relaxed">
          <p>
            Inflation compounds goal costs over time, increasing total projected requirement from {formatCurrency(Math.round(totalCorpusRequiredToday), currencyCountry)} in today&apos;s terms
            to {formatCurrency(Math.round(totalProjectedRequirement), currencyCountry)} over the full planning horizon.
          </p>
          <p>
            Highest funding pressure years are {topFundingPressureYears.length > 0 ? topFundingPressureYears.map((item) => item.year).join(', ') : 'not concentrated yet'}, where large or clustered goals create peak capital demand.
          </p>
          <p>
            Retirement marker: {retirementYear}. Life expectancy marker: {lifeExpectancyYear}. Funding plan should remain resilient across this full window to avoid late-stage shortfalls.
          </p>
        </div>
      </div>
      )}

      {(summaryMode !== 'executive') && (
      <div className="bg-white rounded-[2rem] md:rounded-[3rem] border border-slate-200 shadow-sm p-4 sm:p-6 md:p-8 text-left overflow-x-auto max-w-full [-webkit-overflow-scrolling:touch]">
        <div className="mb-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">8) Goal Funding Summary by Priority</p>
          <h4 className="text-2xl font-black text-slate-900 mt-2">Priority-Wise Funding Outcomes</h4>
        </div>

        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Table A: High Priority Goals</p>
        <table className="w-full min-w-[820px] text-left text-xs mb-6">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Goal</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Amount Required</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Projected Available</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">% Funded</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Additional Deposit Required</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Additional Monthly Savings Required</th>
            </tr>
          </thead>
          <tbody>
            {highPriorityRows.map((row) => (
              <tr key={`high-${row.goal.id}`} className="border-t border-slate-100">
                <td className="px-4 py-3 font-black text-slate-800">{row.goal.type}</td>
                <td className="px-4 py-3 text-right font-black text-slate-800">{formatCurrency(Math.round(row.amountRequired), currencyCountry)}</td>
                <td className="px-4 py-3 text-right font-black text-slate-800">{formatCurrency(Math.round(row.projectedAvailable), currencyCountry)}</td>
                <td className="px-4 py-3 text-right font-black text-slate-800">{row.pctFunded.toFixed(1)}%</td>
                <td className="px-4 py-3 text-right font-black text-slate-800">{formatCurrency(Math.round(row.additionalDepositRequired), currencyCountry)}</td>
                <td className="px-4 py-3 text-right font-black text-slate-800">{formatCurrency(Math.round(row.additionalMonthlySavingsRequired), currencyCountry)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Table B: Lower Priority Goals</p>
        <table className="w-full min-w-[820px] text-left text-xs">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Goal</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Amount Required</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Projected Available</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">% Funded</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Additional Deposit Required</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Additional Monthly Savings Required</th>
            </tr>
          </thead>
          <tbody>
            {lowPriorityRows.length === 0 && (
              <tr className="border-t border-slate-100">
                <td className="px-4 py-4 text-xs font-semibold text-slate-500" colSpan={6}>No lower-priority goals available in current plan.</td>
              </tr>
            )}
            {lowPriorityRows.map((row) => (
              <tr key={`low-${row.goal.id}`} className="border-t border-slate-100">
                <td className="px-4 py-3 font-black text-slate-800">{row.goal.type}</td>
                <td className="px-4 py-3 text-right font-black text-slate-800">{formatCurrency(Math.round(row.amountRequired), currencyCountry)}</td>
                <td className="px-4 py-3 text-right font-black text-slate-800">{formatCurrency(Math.round(row.projectedAvailable), currencyCountry)}</td>
                <td className="px-4 py-3 text-right font-black text-slate-800">{row.pctFunded.toFixed(1)}%</td>
                <td className="px-4 py-3 text-right font-black text-slate-800">{formatCurrency(Math.round(row.additionalDepositRequired), currencyCountry)}</td>
                <td className="px-4 py-3 text-right font-black text-slate-800">{formatCurrency(Math.round(row.additionalMonthlySavingsRequired), currencyCountry)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs font-medium text-slate-600">
          Fully funded goals are at 100% projected coverage. Rows below 100% indicate partial funding and shortfall risk.
        </p>
      </div>
      )}

      {(summaryMode !== 'tables') && (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm text-left">
          <div className="mb-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">9) Retirement Analysis</p>
            <h4 className="text-2xl font-black text-slate-900 mt-2">Retirement Sustainability</h4>
          </div>
          {retirementGoal ? (
            <div className="space-y-3 text-sm text-slate-600 font-medium leading-relaxed">
              <p>Retirement corpus required: <span className="font-black text-slate-900">{formatCurrency(Math.round(retirementGoal.sumCorpus), currencyCountry)}</span>.</p>
              <p>
                Expected retirement cashflow need: <span className="font-black text-slate-900">{formatCurrency(Math.round((retirementGoal.frequency === 'Monthly' ? retirementGoal.corpusAtStart * 12 : retirementGoal.corpusAtStart) / 12), currencyCountry)}</span> per month.
              </p>
              <p>
                Sustainability assessment: projected retirement funding is <span className="font-black text-slate-900">{(priorityFundingRows.find((row) => row.goal.id === retirementGoal.id)?.pctFunded || 0).toFixed(1)}%</span> of retirement need through age {state.profile.lifeExpectancy}.
              </p>
              <p>
                Based on current projections, your retirement income remains sustainable until age{' '}
                <span className="font-black text-slate-900">
                  {Math.round(
                    state.profile.retirementAge +
                    ((state.profile.lifeExpectancy - state.profile.retirementAge) * Math.min(100, priorityFundingRows.find((row) => row.goal.id === retirementGoal.id)?.pctFunded || 0)) / 100
                  )}
                </span>.
              </p>
            </div>
          ) : (
            <p className="text-sm font-medium text-slate-600">No explicit retirement goal is configured yet. Add one to activate retirement sustainability diagnostics.</p>
          )}
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm text-left">
          <div className="mb-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">10) Surplus / Shortfall Analysis</p>
            <h4 className="text-2xl font-black text-slate-900 mt-2">{projectedSurplusAtLife >= 0 ? 'Projected Surplus' : 'Projected Shortfall'}</h4>
          </div>
          {projectedSurplusAtLife >= 0 ? (
            <div className="space-y-3 text-sm text-slate-600 font-medium leading-relaxed">
              <p>Total projected surplus at plan end: <span className="font-black text-slate-900">{formatCurrency(Math.round(projectedSurplusAtLife), currencyCountry)}</span>.</p>
              <p>Options: reinvest surplus for higher resilience, evaluate early-retirement flexibility, or allocate toward legacy planning.</p>
              <p>Maintain annual review discipline so surplus is preserved under inflation and return assumption changes.</p>
            </div>
          ) : (
            <div className="space-y-3 text-sm text-slate-600 font-medium leading-relaxed">
              <p>Total projected shortfall at plan end: <span className="font-black text-slate-900">{formatCurrency(Math.round(Math.abs(projectedSurplusAtLife)), currencyCountry)}</span>.</p>
              <p>Required additional monthly savings: <span className="font-black text-slate-900">{formatCurrency(Math.round(additionalMonthlyRequired), currencyCountry)}</span>.</p>
              <p>Suggested response: prioritize high-value goals first, raise SIPs systematically, and rebalance overweight low-efficiency assets.</p>
            </div>
          )}
        </div>
      </div>
      )}

      {(summaryMode !== 'tables') && (
      <div className="bg-white rounded-[2rem] md:rounded-[3rem] border border-slate-200 shadow-sm p-6 md:p-8 text-left">
        <div className="mb-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">11) Key Insights & Observations</p>
          <h4 className="text-2xl font-black text-slate-900 mt-2">Planning Insights</h4>
        </div>
        <ul className="space-y-2">
          {keyInsights.map((insight) => (
            <li key={insight} className="text-sm text-slate-700 font-medium leading-relaxed flex items-start gap-2">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
              <span>{insight}</span>
            </li>
          ))}
        </ul>
      </div>
      )}

      {(summaryMode !== 'tables') && (
      <div className="bg-white rounded-[2rem] md:rounded-[3rem] border border-slate-200 shadow-sm p-6 md:p-8 text-left">
        <div className="mb-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">12) Recommended Next Steps</p>
          <h4 className="text-2xl font-black text-slate-900 mt-2">Action Plan</h4>
        </div>
        <div className="space-y-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            Continue your current savings plan and protect contribution continuity.
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            Increase SIP by {formatCurrency(Math.round(additionalMonthlyRequired), currencyCountry)}{additionalMonthlyRequired <= 0 ? ' (optional at current assumptions)' : ''} to improve funding certainty.
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            Review plan assumptions annually and after major life events.
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            Monitor inflation assumptions and rebalance allocation drift periodically.
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            Revalidate goal priorities if new commitments or timeline changes emerge.
          </div>
        </div>
      </div>
      )}

      {(summaryMode !== 'tables') && (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="bg-white rounded-[2rem] border border-slate-200 p-6 text-left shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Target size={16} className="text-teal-600" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Goal Cost Evolution</p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Start corpus</span>
              <span className="text-sm font-black text-slate-900">{formatCurrency(Math.round(primaryGoal.targetAmountToday), currencyCountry)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-slate-300 to-teal-500 w-full" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Inflation impact</span>
              <span className="text-sm font-black text-slate-900">+{formatCurrency(Math.round(inflationImpact), currencyCountry)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-teal-500 w-full" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Final future value ({goalModel.targetYear})</span>
              <span className="text-sm font-black text-slate-900">{formatCurrency(Math.round(goalModel.futureGoalValue), currencyCountry)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-200 p-6 text-left shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Gauge size={16} className="text-teal-600" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Return Efficiency</p>
          </div>
          <p className="text-sm text-slate-600 font-medium leading-relaxed">
            Your portfolio return is below the optimized target by <span className="font-black text-slate-900">{Math.abs(returnGap).toFixed(2)}%</span>.
          </p>
          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Current return</span>
              <span className="text-slate-900">{currentAvailableReturn.toFixed(2)}%</span>
            </div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Optimized target</span>
              <span className="text-slate-900">{recommendedReturn.toFixed(2)}%</span>
            </div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Estimated gap impact</span>
              <span className="text-slate-900">{formatCurrency(Math.round(returnGapImpact), currencyCountry)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setView('investment-plan')}
            className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-teal-700 transition-colors"
          >
            Optimize Allocation <ArrowRight size={13} />
          </button>
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-200 p-6 text-left shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <SlidersHorizontal size={16} className="text-teal-600" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Funding Progress</p>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <span className="text-xs font-bold text-slate-500">Funded</span>
              <span className="text-lg font-black text-slate-900">{goalModel.fundingProgress.toFixed(1)}%</span>
            </div>
            <div className="h-3 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
              <div className={`h-full ${status.accent}`} style={{ width: `${goalModel.fundingProgress}%` }} />
            </div>
            <div className="text-xs text-slate-600 font-medium leading-relaxed">
              If you invest <span className="font-black text-slate-900">{formatCurrency(Math.round(goalModel.monthlyNeededOptimized), currencyCountry)}</span> monthly at {recommendedReturn.toFixed(1)}%, you can close the gap by {goalModel.targetYear}.
            </div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>Time remaining</span>
              <span className="text-slate-900">{goalModel.yearsRemaining} years</span>
            </div>
          </div>
        </div>
      </div>
      )}

      {(summaryMode !== 'tables') && (
      <div className="bg-white rounded-[2rem] md:rounded-[3rem] border border-slate-200 p-6 md:p-8 shadow-sm text-left">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
          <div className="space-y-5 max-w-3xl">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Long-Term Projection Summary</p>
              <h4 className="text-2xl md:text-3xl font-black text-slate-900 mt-2">Current vs Optimized Path</h4>
            </div>
            <div className="space-y-3 text-sm text-slate-600 font-medium leading-relaxed">
              <p>
                If current contribution continues: projected corpus <span className="font-black text-slate-900">{formatCurrency(Math.round(goalModel.projectedCurrent), currencyCountry)}</span>, shortfall <span className="font-black text-slate-900">{formatCurrency(Math.round(goalModel.shortfallCurrent), currencyCountry)}</span>.
              </p>
              <p>
                If optimized: projected corpus <span className="font-black text-slate-900">{formatCurrency(Math.round(goalModel.projectedOptimized), currencyCountry)}</span>, gap reduces by <span className="font-black text-slate-900">{formatCurrency(Math.round(Math.max(0, goalModel.shortfallCurrent - goalModel.shortfallOptimized)), currencyCountry)}</span>.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Current Required Monthly</p>
                <p className="text-xl font-black text-slate-900 mt-2">{formatCurrency(Math.round(goalModel.monthlyNeededCurrent), currencyCountry)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Optimized Required Monthly</p>
                <p className="text-xl font-black text-slate-900 mt-2">{formatCurrency(Math.round(goalModel.monthlyNeededOptimized), currencyCountry)}</p>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-[380px] rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">3-Line Projection Graph</p>
            <svg viewBox="0 0 340 180" className="w-full h-auto">
              <line x1="0" y1="150" x2="330" y2="150" stroke="#cbd5e1" strokeWidth="1" />
              <line x1="0" y1="100" x2="330" y2="100" stroke="#e2e8f0" strokeWidth="1" />
              <line x1="0" y1="50" x2="330" y2="50" stroke="#f1f5f9" strokeWidth="1" />

              <path d={projectionPath(goalModel.targetSeries, goalModel.projectionMax)} stroke="#64748b" strokeWidth="2.5" fill="none" strokeDasharray="5 4" />
              <path d={projectionPath(goalModel.currentSeries, goalModel.projectionMax)} stroke="#f59e0b" strokeWidth="3" fill="none" />
              <path d={projectionPath(goalModel.optimizedSeries, goalModel.projectionMax)} stroke="#0d9488" strokeWidth="3" fill="none" />
            </svg>
            <div className="mt-4 space-y-2 text-[11px] font-bold text-slate-500">
              <div className="flex items-center justify-between"><span>Target trajectory</span><span className="text-slate-700">Dashed slate</span></div>
              <div className="flex items-center justify-between"><span>Current trajectory</span><span className="text-amber-600">Amber</span></div>
              <div className="flex items-center justify-between"><span>Optimized trajectory</span><span className="text-teal-600">Teal</span></div>
            </div>
          </div>
        </div>
      </div>
      )}

      {(summaryMode !== 'tables') && (
      <div className="bg-white rounded-[2rem] md:rounded-[3rem] border border-slate-200 p-6 md:p-8 shadow-sm text-left">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Recommended Actions (Ranked)</p>
            <h4 className="text-2xl md:text-3xl font-black text-slate-900 mt-2">What You Should Do Next</h4>
          </div>
        </div>
        <div className="space-y-3">
          {actionItems.map((item, index) => (
            <div key={item.title} className="rounded-2xl border border-slate-200 p-4 md:p-5 bg-slate-50 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-teal-600 text-white text-xs font-black flex items-center justify-center shrink-0">{index + 1}</div>
                <div className="space-y-1">
                  <p className="text-sm md:text-base font-black text-slate-900">{item.title}</p>
                  <p className="text-xs md:text-sm text-slate-600 font-medium">{item.description}</p>
                  <p className="text-[11px] font-bold text-teal-700">{item.impact}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setView(item.view)}
                className="self-start lg:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:border-teal-300 hover:text-teal-700 transition-colors"
              >
                {item.cta} <ArrowRight size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
      )}

      {(summaryMode !== 'analysis') && (
      <div className="bg-white rounded-[2rem] md:rounded-[3rem] border border-slate-200 p-6 md:p-8 shadow-sm text-left">
        <div className="mb-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Goal Summary</p>
          <h4 className="text-2xl font-black text-slate-900 mt-2">Portfolio Goal Lineup</h4>
        </div>
        <div className="space-y-3">
          {goalsData.map(goal => {
            const meta = statusMeta[goal.status];
            return (
              <div key={goal.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-black text-slate-900">{goal.type}</p>
                  <p className="text-xs font-semibold text-slate-500">Target year {goal.endYear}</p>
                </div>
                <div className="flex items-center gap-3 md:gap-5">
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Progress</p>
                    <p className="text-sm font-black text-slate-900">{goal.progressPct.toFixed(1)}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Gap</p>
                    <p className="text-sm font-black text-slate-900">{formatCurrency(Math.round(goal.fundingGap), currencyCountry)}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${meta.tone}`}>{meta.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {(summaryMode === 'analysis' || summaryMode === 'all') && (
      <div className="bg-white rounded-[2rem] md:rounded-[3rem] border border-slate-200 p-6 md:p-8 shadow-sm text-left">
        <div className="mb-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Deep Dive Modules</p>
          <h4 className="text-2xl font-black text-slate-900 mt-2">Expandable Intelligence Panels</h4>
        </div>
        <div className="space-y-3">
          {deepDivePanels.map(panel => {
            const Icon = panel.icon;
            const isOpen = openPanel === panel.id;
            return (
              <div key={panel.id} className="rounded-2xl border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenPanel(isOpen ? null : panel.id)}
                  className="w-full px-5 py-4 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-teal-600">
                      <Icon size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900">{panel.title}</p>
                      <p className="text-xs font-medium text-slate-500">{panel.subtitle}</p>
                    </div>
                  </div>
                  {isOpen ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                </button>
                {isOpen && (
                  <div className="p-5 bg-white border-t border-slate-100">
                    {panel.body}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      )}
    </div>
  );
};

export default GoalSummary;
