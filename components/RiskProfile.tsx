import React, { useEffect, useMemo, useState } from 'react';
import {
  BrainCircuit,
  ChevronRight,
  ArrowLeft,
  RefreshCw,
  PieChart,
  LineChart,
  Wallet,
  Target,
  CalendarDays,
  Gauge,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import { FinanceState, RiskLevel, RiskQuestionAnswer } from '../types';
import {
  RISK_QUESTIONS,
  RISK_LEVEL_ALLOCATIONS,
  RISK_LEVEL_CHARACTERISTICS,
  buildRiskProfileFromAnswers,
} from '../lib/riskProfile';
import { getRiskReturnAssumption } from '../lib/financeMath';
import { formatCurrency } from '../lib/currency';
import { monthlyIncomeFromDetailed } from '../lib/incomeMath';

const RISK_LEVEL_ORDER: RiskLevel[] = ['Conservative', 'Moderate', 'Balanced', 'Aggressive', 'Very Aggressive'];

const projectCorpus = (principal: number, annualContribution: number, annualReturnPct: number, years: number) => {
  const r = annualReturnPct / 100;
  if (!Number.isFinite(r) || years <= 0) return principal;
  if (r === 0) return principal + annualContribution * years;
  const growth = Math.pow(1 + r, years);
  return principal * growth + annualContribution * ((growth - 1) / r);
};

const estimateRequiredAnnualContribution = (
  targetCorpus: number,
  principal: number,
  annualReturnPct: number,
  years: number,
) => {
  if (targetCorpus <= 0 || years <= 0) return 0;
  const r = annualReturnPct / 100;
  if (r === 0) return Math.max(0, (targetCorpus - principal) / years);
  const growth = Math.pow(1 + r, years);
  const numerator = targetCorpus - (principal * growth);
  const denominator = (growth - 1) / r;
  if (!Number.isFinite(denominator) || denominator <= 0) return 0;
  return Math.max(0, numerator / denominator);
};

const getReadinessState = (readinessPct: number) => {
  if (readinessPct >= 100) return { label: 'On Track', badgeClass: 'bg-emerald-100 text-emerald-700' };
  if (readinessPct >= 75) return { label: 'Needs Attention', badgeClass: 'bg-amber-100 text-amber-700' };
  return { label: 'At Risk', badgeClass: 'bg-rose-100 text-rose-700' };
};

const RiskProfile: React.FC<{ state: FinanceState, updateState: (data: Partial<FinanceState>) => void }> = ({ state, updateState }) => {
  const [currentStep, setCurrentStep] = useState<'intro' | 'quiz' | 'result'>(state.riskProfile ? 'result' : 'intro');
  const [answers, setAnswers] = useState<RiskQuestionAnswer[]>([]);
  const [activeQuestion, setActiveQuestion] = useState(0);

  const handleAnswer = (selectedOption: { text: string; score: number }) => {
    const question = RISK_QUESTIONS[activeQuestion];
    const answer: RiskQuestionAnswer = {
      questionId: question.id,
      question: question.text,
      selectedOption: selectedOption.text,
      score: selectedOption.score,
    };
    const newAnswers = [...answers, answer];
    if (activeQuestion < RISK_QUESTIONS.length - 1) {
      setAnswers(newAnswers);
      setActiveQuestion(activeQuestion + 1);
    } else {
      const result = buildRiskProfileFromAnswers(newAnswers);
      updateState({ riskProfile: result });
      setCurrentStep('result');
    }
  };

  const reset = () => {
    setAnswers([]);
    setActiveQuestion(0);
    setCurrentStep('quiz');
  };

  const result = state.riskProfile;
  const currentRiskLevel: RiskLevel = result?.level ?? 'Balanced';
  const allocation = result?.recommendedAllocation ?? RISK_LEVEL_ALLOCATIONS[currentRiskLevel];
  const riskQuestionAnswers = result?.questionnaireAnswers ?? [];
  const currencyCountry = state.profile.country;
  const [scenarioLevel, setScenarioLevel] = useState<RiskLevel>(currentRiskLevel);

  useEffect(() => {
    setScenarioLevel(currentRiskLevel);
  }, [currentRiskLevel]);

  const householdIncome = useMemo(() => {
    const selfIncome = monthlyIncomeFromDetailed(state.profile.income);
    const familyIncome = state.family
      .filter(member => member.includeIncomeInPlanning !== false)
      .reduce((sum, member) => sum + monthlyIncomeFromDetailed(member.income), 0);
    return selfIncome + familyIncome;
  }, [state.profile.income, state.family]);

  const householdExpenses = useMemo(() => (
    state.detailedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0) || state.profile.monthlyExpenses
  ), [state.detailedExpenses, state.profile.monthlyExpenses]);

  const totalMonthlyDebt = useMemo(() => (
    state.loans.reduce((sum, loan) => sum + (loan.emi || 0), 0)
  ), [state.loans]);

  const surplusValue = householdIncome - householdExpenses - totalMonthlyDebt;

  const financialInvestableCorpus = useMemo(() => (
    state.assets
      .filter(asset => ['Liquid', 'Debt', 'Equity', 'Gold/Silver'].includes(asset.category))
      .reduce((sum, asset) => sum + (asset.currentValue || 0), 0)
  ), [state.assets]);

  const annualInvestableContribution = Math.max(0, surplusValue * 12);
  const currentYear = new Date().getFullYear();
  const projectionHorizonYears = useMemo(() => {
    const retirementYear = state.profile.dob
      ? new Date(state.profile.dob).getFullYear() + state.profile.retirementAge
      : currentYear + 10;
    return Math.max(5, Math.min(20, retirementYear - currentYear));
  }, [state.profile.dob, state.profile.retirementAge, currentYear]);

  const goalCorpusTargetToday = useMemo(() => (
    state.goals.reduce((sum, goal) => sum + (goal.targetAmountToday || 0), 0)
  ), [state.goals]);

  const riskComparisonRows = useMemo(() => {
    const rows = RISK_LEVEL_ORDER.map(level => {
      const assumedReturn = getRiskReturnAssumption(level);
      const projectedCorpus = projectCorpus(
        financialInvestableCorpus,
        annualInvestableContribution,
        assumedReturn,
        projectionHorizonYears,
      );
      const goalReadinessPct = goalCorpusTargetToday > 0
        ? Math.min(999, (projectedCorpus / goalCorpusTargetToday) * 100)
        : 100;
      return {
        level,
        assumedReturn,
        allocation: RISK_LEVEL_ALLOCATIONS[level],
        characteristics: RISK_LEVEL_CHARACTERISTICS[level],
        projectedCorpus,
        goalReadinessPct,
      };
    });
    const currentRow = rows.find(row => row.level === currentRiskLevel)
      ?? rows.find(row => row.level === 'Balanced')
      ?? rows[0];
    return rows.map(row => ({
      ...row,
      deltaCorpusVsCurrent: row.projectedCorpus - currentRow.projectedCorpus,
      deltaReturnVsCurrent: row.assumedReturn - currentRow.assumedReturn,
    }));
  }, [
    currentRiskLevel,
    financialInvestableCorpus,
    annualInvestableContribution,
    projectionHorizonYears,
    goalCorpusTargetToday,
  ]);

  const currentRiskRow = riskComparisonRows.find(row => row.level === currentRiskLevel);
  const currentExpectedReturn = getRiskReturnAssumption(currentRiskLevel);
  const bestGoalRow = riskComparisonRows.reduce((best, row) => (
    row.goalReadinessPct > best.goalReadinessPct ? row : best
  ), riskComparisonRows[0]);
  const readinessState = getReadinessState(currentRiskRow?.goalReadinessPct ?? 0);
  const requiredAnnualContribution = estimateRequiredAnnualContribution(
    goalCorpusTargetToday,
    financialInvestableCorpus,
    currentExpectedReturn,
    projectionHorizonYears,
  );
  const additionalMonthlyNeeded = Math.max(0, (requiredAnnualContribution - annualInvestableContribution) / 12);
  const scenarioRow = riskComparisonRows.find(row => row.level === scenarioLevel) ?? currentRiskRow;
  const currentGoalReadinessPct = currentRiskRow?.goalReadinessPct ?? 0;
  const scenarioGoalReadinessDelta = (scenarioRow?.goalReadinessPct ?? 0) - currentGoalReadinessPct;
  const scenarioCorpusDelta = (scenarioRow?.projectedCorpus ?? 0) - (currentRiskRow?.projectedCorpus ?? 0);
  const scenarioReadinessState = getReadinessState(scenarioRow?.goalReadinessPct ?? 0);
  const lastUpdatedLabel = useMemo(() => {
    const parsed = new Date(result?.lastUpdated ?? '');
    if (Number.isNaN(parsed.getTime())) return 'Recently';
    return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }, [result?.lastUpdated]);

  if (currentStep === 'intro') {
    return (
      <div className="max-w-4xl mx-auto py-8 md:py-12 px-4 md:px-6 animate-in fade-in slide-in-from-bottom-4">
        <div className="bg-white rounded-[2.5rem] md:rounded-[4rem] border border-slate-200 shadow-2xl overflow-hidden p-8 md:p-20 text-center space-y-8 md:space-y-10 relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-teal-50/50 blur-[100px] -z-10 rounded-full translate-x-1/2 -translate-y-1/2" />
          <div className="mx-auto w-16 h-16 md:w-24 md:h-24 bg-teal-600 text-white rounded-2xl md:rounded-[2.5rem] flex items-center justify-center shadow-2xl">
            <BrainCircuit size={32} />
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl md:text-6xl font-black text-slate-900 leading-tight">Risk DNA</h1>
            <p className="text-sm md:text-lg text-slate-500 max-w-2xl mx-auto font-medium">A scientific assessment of capacity for volatility. Discover your ideal asset allocation.</p>
          </div>
          <button
            onClick={() => setCurrentStep('quiz')}
            className="w-full md:w-auto px-10 md:px-12 py-5 md:py-6 bg-teal-600 text-white rounded-[1.5rem] md:rounded-[2rem] font-black text-base md:text-xl hover:bg-teal-700 transition-all flex items-center justify-center gap-3 mx-auto shadow-xl"
          >
            Start Assessment <ChevronRight />
          </button>
        </div>
      </div>
    );
  }

  if (currentStep === 'quiz') {
    const q = RISK_QUESTIONS[activeQuestion];
    const progress = ((activeQuestion + 1) / RISK_QUESTIONS.length) * 100;
    return (
      <div className="max-w-3xl mx-auto py-6 md:py-12 px-4 md:px-6 animate-in fade-in zoom-in-95">
        <div className="bg-white rounded-[2.5rem] md:rounded-[3.5rem] border border-slate-200 shadow-xl overflow-hidden">
          <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <button onClick={() => activeQuestion > 0 ? setActiveQuestion(activeQuestion - 1) : setCurrentStep('intro')} className="p-2 hover:bg-white rounded-full text-slate-400 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1 px-4 md:px-8">
              <div className="w-full h-1.5 md:h-2 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-teal-600 transition-all duration-500" style={{ width: `${progress}%` }} /></div>
            </div>
            <span className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest">{activeQuestion + 1}/{RISK_QUESTIONS.length}</span>
          </div>
          <div className="p-8 md:p-16 space-y-8 md:space-y-10">
            <p className="text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-400">Choose what matches you best. There are no right or wrong answers.</p>
            <h2 className="text-xl md:text-3xl font-black text-slate-900 leading-tight">{q.text}</h2>
            <div className="space-y-3 md:space-y-4">
              {q.options.map((opt, i) => (
                <button key={i} onClick={() => handleAnswer(opt)} className="w-full p-5 md:p-6 text-left border-2 border-slate-100 rounded-2xl md:rounded-[1.5rem] hover:border-teal-600 hover:bg-teal-50/50 transition-all group flex items-center justify-between">
                  <span className="text-xs md:text-sm font-bold text-slate-700 group-hover:text-teal-900">{opt.text}</span>
                  <div className="w-5 h-5 md:w-6 md:h-6 rounded-full border-2 border-slate-200 flex items-center justify-center group-hover:border-teal-600 transition-colors shrink-0 ml-4"><div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-teal-600 scale-0 group-hover:scale-100 transition-transform" /></div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="max-w-4xl mx-auto py-8 md:py-12 px-4 md:px-6">
        <div className="bg-white rounded-[2.5rem] md:rounded-[3rem] border border-slate-200 shadow-sm p-8 md:p-12 text-center space-y-5">
          <h2 className="text-2xl md:text-3xl font-black text-slate-900">Risk Profile Not Available</h2>
          <p className="text-sm text-slate-500 font-medium">Complete the assessment to unlock risk analysis and profile comparison.</p>
          <button
            onClick={() => setCurrentStep('quiz')}
            className="px-6 py-3 rounded-2xl bg-teal-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-teal-500 transition-all"
          >
            Start Assessment
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-700 pb-24">
      <div className="w-full surface-dark p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] text-white flex flex-col md:flex-row items-center gap-6 md:gap-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-teal-600/20 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2" />
        <div className="relative shrink-0">
          <svg className="w-32 h-32 md:w-44 md:h-44 transform -rotate-90">
            <circle cx="50%" cy="50%" r="45%" stroke="currentColor" strokeWidth="10" fill="transparent" className="text-white/10" />
            <circle cx="50%" cy="50%" r="45%" stroke="currentColor" strokeWidth="10" fill="transparent" strokeDasharray="450" strokeDashoffset={450 - (450 * result.score) / 100} className="text-teal-500 transition-all duration-1000 ease-out" strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl md:text-5xl font-black">{result.score}</span>
            <span className="text-[8px] md:text-[10px] font-black text-teal-400 uppercase tracking-widest">Score</span>
          </div>
        </div>
        <div className="flex-1 space-y-3 md:space-y-4 text-center md:text-left">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
            <h2 className="text-2xl md:text-4xl font-black leading-none"><span className="text-teal-500">{result.level}</span> Profile</h2>
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${readinessState.badgeClass}`}>
              {readinessState.label}
            </span>
          </div>
          <p className="text-slate-400 font-medium text-xs md:text-base max-w-xl">{RISK_LEVEL_CHARACTERISTICS[result.level].returnNarrative}</p>
          <div className="flex flex-wrap items-center gap-2 justify-center md:justify-start">
            <span className="px-2.5 py-1 rounded-full bg-white/10 text-[10px] font-black uppercase tracking-widest text-slate-200">
              Volatility: {RISK_LEVEL_CHARACTERISTICS[result.level].volatilityBand}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-white/10 text-[10px] font-black uppercase tracking-widest text-slate-200">
              Horizon: {RISK_LEVEL_CHARACTERISTICS[result.level].suitableHorizon}
            </span>
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Last updated: {lastUpdatedLabel}</p>
          <button onClick={reset} className="flex items-center gap-2 text-[9px] md:text-[11px] font-black text-teal-400 uppercase tracking-widest hover:text-white transition-colors mx-auto md:mx-0">
            <RefreshCw size={14} /> Reassess Risk Profile
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: 'Investable Corpus',
            value: formatCurrency(Math.round(financialInvestableCorpus), currencyCountry),
            helper: 'Current assets available for compounding',
            icon: Wallet,
          },
          {
            label: 'Annual Investable',
            value: formatCurrency(Math.round(annualInvestableContribution), currencyCountry),
            helper: 'Current surplus available each year',
            icon: Gauge,
          },
          {
            label: 'Planning Horizon',
            value: `${projectionHorizonYears} Years`,
            helper: 'Used for projection and comparisons',
            icon: CalendarDays,
          },
          {
            label: 'Goal Readiness',
            value: `${currentGoalReadinessPct.toFixed(0)}%`,
            helper: readinessState.label,
            icon: Target,
          },
        ].map((card) => (
          <div key={card.label} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-4">
              <card.icon size={18} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{card.label}</p>
            <p className="text-xl font-black text-slate-900 mt-1">{card.value}</p>
            <p className="text-xs text-slate-500 mt-1">{card.helper}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <h3 className="text-lg md:text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
            <PieChart className="text-teal-600" size={20} /> Recommended Allocation
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {[
              { label: 'Equity', value: allocation.equity, colorClass: 'text-teal-600' },
              { label: 'Debt', value: allocation.debt, colorClass: 'text-emerald-600' },
              { label: 'Gold', value: allocation.gold, colorClass: 'text-amber-600' },
              { label: 'Liquid', value: allocation.liquid, colorClass: 'text-slate-900' },
            ].map((item) => (
              <div key={item.label} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/40 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{item.label}</p>
                <p className={`text-2xl font-black mt-1 ${item.colorClass}`}>{item.value}%</p>
              </div>
            ))}
          </div>
          {additionalMonthlyNeeded > 0 ? (
            <div className="mt-5 p-4 rounded-2xl bg-amber-50 border border-amber-200">
              <p className="text-xs font-black uppercase tracking-widest text-amber-700">Funding Gap Detected</p>
              <p className="text-sm text-amber-800 mt-1">
                To target 100% goal readiness, add about <span className="font-black">{formatCurrency(Math.round(additionalMonthlyNeeded), currencyCountry)}</span> per month.
              </p>
            </div>
          ) : (
            <div className="mt-5 p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
              <p className="text-xs font-black uppercase tracking-widest text-emerald-700">On Track</p>
              <p className="text-sm text-emerald-800 mt-1">Current contribution pace is enough for your modeled goal corpus.</p>
            </div>
          )}
        </div>

        <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-5">
          <h3 className="text-lg md:text-xl font-black text-slate-900">Profile Switch Simulator</h3>
          <p className="text-sm text-slate-500">See how changing risk profile impacts projected corpus and goal readiness before you reassess.</p>
          <div>
            <label htmlFor="scenario-level" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Try a different profile</label>
            <select
              id="scenario-level"
              value={scenarioLevel}
              onChange={(e) => setScenarioLevel(e.target.value as RiskLevel)}
              className="mt-2 w-full h-12 px-4 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-400"
            >
              {RISK_LEVEL_ORDER.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Expected Return</p>
              <p className="text-lg font-black text-slate-900 mt-1">{(scenarioRow?.assumedReturn ?? 0).toFixed(2)}%</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Goal Readiness</p>
              <p className="text-lg font-black text-slate-900 mt-1">{(scenarioRow?.goalReadinessPct ?? 0).toFixed(0)}%</p>
            </div>
          </div>
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
            <p className={`inline-flex px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${scenarioReadinessState.badgeClass}`}>
              {scenarioReadinessState.label}
            </p>
            <p className={`text-sm font-black ${scenarioCorpusDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {scenarioCorpusDelta >= 0 ? '+' : ''}{formatCurrency(Math.round(scenarioCorpusDelta), currencyCountry)} corpus impact vs current profile
            </p>
            <p className={`text-sm font-medium ${scenarioGoalReadinessDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {scenarioGoalReadinessDelta >= 0 ? '+' : ''}{scenarioGoalReadinessDelta.toFixed(0)}% goal-readiness impact
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200">
            <p className="text-xs text-teal-900">
              Highest modeled readiness in current data: <span className="font-black">{bestGoalRow.level}</span> ({bestGoalRow.goalReadinessPct.toFixed(0)}%).
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-3xl border border-slate-200 bg-white">
          <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">Why Risk Profile Matters</h4>
          <div className="space-y-3 text-sm text-slate-600">
            <p className="flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 text-teal-600" />
              <span><span className="font-black text-slate-800">Allocation fit:</span> It sets the right equity/debt mix for your risk capacity.</span>
            </p>
            <p className="flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 text-teal-600" />
              <span><span className="font-black text-slate-800">Projection engine:</span> Return assumptions in planning and goal projections update from this risk level.</span>
            </p>
            <p className="flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 text-teal-600" />
              <span><span className="font-black text-slate-800">Goal confidence:</span> Goal readiness and recommendations are calibrated to your selected profile.</span>
            </p>
          </div>
        </div>
        <div className="p-6 rounded-3xl border border-slate-200 bg-white">
          <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">What Changes If You Change Profile</h4>
          <div className="space-y-3 text-sm text-slate-600">
            <p className="flex items-start gap-2">
              <ShieldAlert size={16} className="mt-0.5 text-amber-500" />
              <span><span className="font-black text-slate-800">Return assumption:</span> Planning growth rates and long-term corpus projections change.</span>
            </p>
            <p className="flex items-start gap-2">
              <ShieldAlert size={16} className="mt-0.5 text-amber-500" />
              <span><span className="font-black text-slate-800">Target allocation:</span> Recommended equity/debt/gold/liquid percentages are recalculated.</span>
            </p>
            <p className="flex items-start gap-2">
              <ShieldAlert size={16} className="mt-0.5 text-amber-500" />
              <span><span className="font-black text-slate-800">Action guidance:</span> Rebalancing and investment recommendations adjust to the new profile.</span>
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 rounded-3xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Questions Answered</h4>
          <button
            onClick={reset}
            className="px-4 py-2 rounded-xl bg-teal-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-teal-500 transition-all"
          >
            Reassess Risk Profile
          </button>
        </div>
        {riskQuestionAnswers.length > 0 ? (
          <div className="space-y-3">
            {riskQuestionAnswers.map((answer) => (
              <div key={answer.questionId} className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <p className="text-xs font-black text-slate-800">{answer.question}</p>
                <p className="text-xs text-slate-600 mt-1">Answer: {answer.selectedOption}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Historical answers are not available for this profile yet. Reassess once to capture them.</p>
        )}
      </div>

      <div className="p-6 rounded-3xl border border-slate-200 bg-white overflow-x-auto">
        <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
          <LineChart size={16} className="text-teal-600" />
          Customer Drill-down Report ({projectionHorizonYears}Y Projection)
        </h4>
        <table className="w-full min-w-[920px] text-left">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Risk Profile</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Expected Return</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Delta Return</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Projected Corpus</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Delta vs Current</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Goal Readiness</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Allocation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {riskComparisonRows.map((row) => {
              const isCurrent = row.level === result.level;
              return (
                <tr key={row.level} className={isCurrent ? 'bg-teal-50/60' : ''}>
                  <td className="px-4 py-3 text-xs font-black text-slate-900">
                    {row.level} {isCurrent ? '(Current)' : ''}
                  </td>
                  <td className="px-4 py-3 text-xs font-black text-slate-700 text-right">{row.assumedReturn.toFixed(2)}%</td>
                  <td className={`px-4 py-3 text-xs font-black text-right ${row.deltaReturnVsCurrent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {row.deltaReturnVsCurrent >= 0 ? '+' : ''}{row.deltaReturnVsCurrent.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-xs font-black text-slate-900 text-right">{formatCurrency(Math.round(row.projectedCorpus), currencyCountry)}</td>
                  <td className={`px-4 py-3 text-xs font-black text-right ${row.deltaCorpusVsCurrent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {row.deltaCorpusVsCurrent >= 0 ? '+' : ''}{formatCurrency(Math.round(row.deltaCorpusVsCurrent), currencyCountry)}
                  </td>
                  <td className="px-4 py-3 text-xs font-black text-right text-slate-700">{row.goalReadinessPct.toFixed(0)}%</td>
                  <td className="px-4 py-3 text-xs font-bold text-slate-600">
                    E{row.allocation.equity} / D{row.allocation.debt} / G{row.allocation.gold} / L{row.allocation.liquid}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-[11px] text-slate-500 mt-3">
          Based on current investable assets {formatCurrency(Math.round(financialInvestableCorpus), currencyCountry)} and annual investable contribution {formatCurrency(Math.round(annualInvestableContribution), currencyCountry)}.
        </p>
      </div>

      <div className="p-6 rounded-3xl border border-slate-200 bg-white overflow-x-auto">
        <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">Overall Risk Profile Comparison</h4>
        <table className="w-full min-w-[840px] text-left">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Risk Profile</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Expected Return</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Volatility</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Drawdown</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Suitable Horizon</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Goal/Return Impact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {RISK_LEVEL_ORDER.map((level) => (
              <tr key={level}>
                <td className="px-4 py-3 text-xs font-black text-slate-900">{level}</td>
                <td className="px-4 py-3 text-xs font-black text-right text-slate-700">{getRiskReturnAssumption(level).toFixed(2)}%</td>
                <td className="px-4 py-3 text-xs font-bold text-slate-600">{RISK_LEVEL_CHARACTERISTICS[level].volatilityBand}</td>
                <td className="px-4 py-3 text-xs font-bold text-slate-600">{RISK_LEVEL_CHARACTERISTICS[level].drawdownBand}</td>
                <td className="px-4 py-3 text-xs font-bold text-slate-600">{RISK_LEVEL_CHARACTERISTICS[level].suitableHorizon}</td>
                <td className="px-4 py-3 text-xs font-bold text-slate-600">{RISK_LEVEL_CHARACTERISTICS[level].goalImpact}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {currentRiskRow && (
        <div className="p-6 rounded-3xl border border-teal-200 bg-teal-50/50">
          <h4 className="text-sm font-black text-teal-900 uppercase tracking-widest mb-2">Current Profile Impact Snapshot</h4>
          <p className="text-sm text-teal-900 font-medium">
            Your current <span className="font-black">{currentRiskRow.level}</span> profile uses an assumed return of <span className="font-black">{currentRiskRow.assumedReturn.toFixed(2)}%</span>.
            At this rate, projected corpus over {projectionHorizonYears} years is <span className="font-black">{formatCurrency(Math.round(currentRiskRow.projectedCorpus), currencyCountry)}</span>,
            with estimated goal readiness of <span className="font-black">{currentRiskRow.goalReadinessPct.toFixed(0)}%</span>.
          </p>
        </div>
      )}
    </div>
  );
};

export default RiskProfile;
