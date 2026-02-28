import React, { useMemo, useState } from 'react';
import { FinanceState } from '../types';
import { ShieldCheck, Trash2, AlertCircle, Activity, HeartPulse } from 'lucide-react';
import { clampNumber, parseNumber } from '../lib/validation';
import { formatCurrency } from '../lib/currency';
import {
  buildBucketDiscountFactors,
  getGoalIntervalYears,
  getLifeExpectancyYear,
  getRiskReturnAssumption,
  inflateByBuckets,
} from '../lib/financeMath';

const Insurances: React.FC<{ state: FinanceState, updateState: (data: Partial<FinanceState>) => void }> = ({ state, updateState }) => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'analysis'>('analysis');
  const [inventoryType, setInventoryType] = useState<'all' | 'Term' | 'Health'>('all');
  const [newPolicyType, setNewPolicyType] = useState<'Term' | 'Health'>('Term');
  const [newPolicyInsured, setNewPolicyInsured] = useState<string>('self');
  const [newPolicyAmount, setNewPolicyAmount] = useState<number>(0);
  const [newPolicyPremium, setNewPolicyPremium] = useState<number>(0);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const analysisConfig = state.insuranceAnalysis;

  const removePolicy = (id: string) => {
    updateState({ insurance: state.insurance.filter(p => p.id !== id) });
  };

  const addPolicy = () => {
    setInventoryError(null);

    if (newPolicyAmount <= 0) {
      setInventoryError('Insurance amount must be greater than 0.');
      return;
    }

    const isValidOwner = newPolicyInsured === 'self' || state.family.some(member => member.id === newPolicyInsured);
    if (!isValidOwner) {
      setInventoryError('Please select a valid insured member.');
      return;
    }

    const policy = {
      id: Math.random().toString(36).slice(2, 11),
      category: newPolicyType === 'Term' ? 'Life Insurance' : 'General Insurance',
      type: newPolicyType,
      proposer: 'self',
      insured: newPolicyInsured,
      sumAssured: newPolicyAmount,
      sumInsured: newPolicyType === 'Health' ? newPolicyAmount : undefined,
      premium: Math.max(0, newPolicyPremium),
      isMoneyBack: false,
      moneyBackYears: [],
      moneyBackAmounts: [],
    } as any;

    updateState({ insurance: [policy, ...state.insurance] });
    setNewPolicyAmount(0);
    setNewPolicyPremium(0);
  };

  const getMemberName = (id: string) => {
    if (id === 'self') return state.profile.firstName || 'Self';
    return state.family.find(f => f.id === id)?.name || 'Unknown';
  };

  const analysisData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const monthlyExpenses = state.detailedExpenses.reduce((sum, item) => sum + (item.amount || 0), 0) || state.profile.monthlyExpenses || 0;
    const annualExpenses = monthlyExpenses * 12;
    const emergencyFund12Months = monthlyExpenses * 12;

    const retirementYear = state.profile.dob
      ? new Date(state.profile.dob).getFullYear() + state.profile.retirementAge
      : currentYear + 30;

    const baseReturn = getRiskReturnAssumption(state.riskProfile?.level);
    const discountSettings = state.discountSettings;
    const discountFallback = discountSettings?.defaultDiscountRate ?? baseReturn;

    const resolveYear = (rel: any): number => {
      const birthYear = state.profile.dob ? new Date(state.profile.dob).getFullYear() : currentYear - 30;
      if (rel.type === 'Year') return rel.value;
      if (rel.type === 'Age') return birthYear + rel.value;
      if (rel.type === 'Retirement') return birthYear + state.profile.retirementAge + rel.value;
      if (rel.type === 'LifeExpectancy') return birthYear + state.profile.lifeExpectancy + rel.value;
      return rel.value;
    };

    const maxGoalYear = state.goals.reduce((maxYear, goal) => {
      const endYear = resolveYear(goal.endDate);
      return Math.max(maxYear, endYear);
    }, currentYear + 1);

    const endYear = Math.max(
      maxGoalYear,
      getLifeExpectancyYear(state.profile.dob, state.profile.lifeExpectancy) ?? (currentYear + 35),
    );

    const discountFactors = buildBucketDiscountFactors(currentYear, endYear, retirementYear, discountSettings, discountFallback);

    const goals = state.goals.map(goal => {
      const startYear = resolveYear(goal.startDate);
      const goalEndYear = resolveYear(goal.endDate);
      const inflationFallback = discountSettings?.defaultInflationRate ?? goal.inflationRate;
      const yearsToStart = Math.max(0, startYear - currentYear);
      const startFV = discountSettings?.useBucketInflation
        ? inflateByBuckets(goal.targetAmountToday, currentYear, startYear, currentYear, retirementYear, discountSettings, inflationFallback)
        : (goal.startGoalAmount ?? (goal.targetAmountToday * Math.pow(1 + (goal.inflationRate / 100), yearsToStart)));

      let currentCorpus = 0;
      for (let year = startYear; year <= goalEndYear; year++) {
        let nominal = 0;
        if (!goal.isRecurring) {
          nominal = year === goalEndYear ? startFV : 0;
        } else {
          const yearsFromStart = Math.max(0, year - startYear);
          const baseAmount = discountSettings?.useBucketInflation
            ? inflateByBuckets(startFV, startYear, year, currentYear, retirementYear, discountSettings, inflationFallback)
            : startFV * Math.pow(1 + (goal.inflationRate / 100), yearsFromStart);
          const interval = getGoalIntervalYears(goal.frequency, goal.frequencyIntervalYears);
          if (interval > 1 && ((year - startYear) % interval !== 0)) {
            nominal = 0;
          } else if (goal.frequency === 'Monthly') {
            nominal = baseAmount * 12;
          } else {
            nominal = baseAmount;
          }
        }
        if (nominal <= 0) continue;
        const factor = discountFactors[year] || 1;
        currentCorpus += nominal / factor;
      }

      const coverPct = analysisConfig.goalCovers?.[goal.id] ?? 100;
      const coveredValue = currentCorpus * (coverPct / 100);

      return {
        id: goal.id,
        type: goal.type,
        currentCorpus,
        coverPct,
        coveredValue,
      };
    });

    const liabilities = state.loans.map(loan => {
      const coverPct = analysisConfig.liabilityCovers?.[loan.id] ?? 100;
      return {
        id: loan.id,
        type: loan.type,
        value: loan.outstandingAmount,
        coverPct,
        coveredValue: loan.outstandingAmount * (coverPct / 100),
      };
    });

    const debtRepayment = liabilities.reduce((sum, loan) => sum + loan.coveredValue, 0);
    const familyGoalsCoverage = goals.reduce((sum, goal) => sum + goal.coveredValue, 0);

    const financialAssets = state.assets
      .filter(asset => ['Liquid', 'Equity', 'Debt', 'Gold/Silver'].includes(asset.category))
      .reduce((sum, asset) => sum + asset.currentValue, 0);
    const personalAssets = state.assets
      .filter(asset => ['Real Estate', 'Personal', 'Vehicle'].includes(asset.category))
      .reduce((sum, asset) => sum + asset.currentValue, 0);

    const inheritanceValue = analysisConfig.inheritanceValue || 0;
    const assetCovers = analysisConfig.assetCovers || { financial: 50, personal: 0, inheritance: 100 };
    const assetCovered = (financialAssets * (assetCovers.financial / 100))
      + (personalAssets * (assetCovers.personal / 100))
      + (inheritanceValue * (assetCovers.inheritance / 100));

    const termRequirementBeforeAssets = emergencyFund12Months + debtRepayment + familyGoalsCoverage;
    const termRequirementAfterAssets = Math.max(0, termRequirementBeforeAssets - assetCovered);
    const enteredTermCover = analysisConfig.termInsuranceAmount || 0;
    const termDeficit = Math.max(0, termRequirementAfterAssets - enteredTermCover);
    const termSurplus = Math.max(0, enteredTermCover - termRequirementAfterAssets);

    const birthYear = state.profile.dob ? new Date(state.profile.dob).getFullYear() : currentYear - 30;
    const selfAge = Math.max(0, currentYear - birthYear);
    const oldestAge = state.family.reduce((maxAge, member) => Math.max(maxAge, member.age || 0), selfAge);
    const familySize = Math.max(1, state.family.length + 1);

    const ageRiskMultiplier = oldestAge >= 60
      ? 2.8
      : oldestAge >= 50
        ? 2.3
        : oldestAge >= 40
          ? 1.8
          : oldestAge >= 30
            ? 1.4
            : 1.2;

    const familySizeMultiplier = 1 + Math.min(1.5, Math.max(0, familySize - 1) * 0.25);
    const hospitalizationBuffer = monthlyExpenses * 6;
    const criticalIllnessBuffer = monthlyExpenses * 3;
    const inflationBuffer = 1 + ((analysisConfig.inflation || 6) / 100) * 3;

    const healthModelRequirement = (hospitalizationBuffer * ageRiskMultiplier * familySizeMultiplier + criticalIllnessBuffer) * inflationBuffer;
    const healthMinimumFloor = familySize * 500000;
    const healthRequirement = Math.max(healthModelRequirement, healthMinimumFloor);

    const enteredHealthCover = analysisConfig.healthInsuranceAmount || 0;
    const healthDeficit = Math.max(0, healthRequirement - enteredHealthCover);
    const healthSurplus = Math.max(0, enteredHealthCover - healthRequirement);

    return {
      monthlyExpenses,
      annualExpenses,
      emergencyFund12Months,
      liabilities,
      debtRepayment,
      goals,
      familyGoalsCoverage,
      financialAssets,
      personalAssets,
      assetCovered,
      assetCovers,
      inheritanceValue,
      termRequirementBeforeAssets,
      termRequirementAfterAssets,
      enteredTermCover,
      termDeficit,
      termSurplus,
      oldestAge,
      familySize,
      ageRiskMultiplier,
      familySizeMultiplier,
      hospitalizationBuffer,
      criticalIllnessBuffer,
      inflationBuffer,
      healthModelRequirement,
      healthMinimumFloor,
      healthRequirement,
      enteredHealthCover,
      healthDeficit,
      healthSurplus,
      termProtectionScore: Math.min(100, Math.round((enteredTermCover / (termRequirementAfterAssets || 1)) * 100)),
      healthProtectionScore: Math.min(100, Math.round((enteredHealthCover / (healthRequirement || 1)) * 100)),
    };
  }, [analysisConfig, state]);

  const updateAnalysisConfig = (patch: Partial<typeof analysisConfig>) => {
    updateState({
      insuranceAnalysis: {
        ...analysisConfig,
        ...patch,
      },
    });
  };

  const updateNumericField = (
    field: 'termInsuranceAmount' | 'healthInsuranceAmount' | 'inflation' | 'inheritanceValue',
    value: number,
    min = 0,
    max?: number,
  ) => {
    const sanitized = parseNumber(value, analysisConfig[field] as number);
    let nextValue = Math.max(min, sanitized);
    if (Number.isFinite(max as number)) nextValue = clampNumber(nextValue, min, max as number);
    updateAnalysisConfig({ [field]: nextValue } as Partial<typeof analysisConfig>);
  };

  const updateCoverMap = (key: 'liabilityCovers' | 'goalCovers', id: string, value: number) => {
    const sanitized = clampNumber(parseNumber(value, 100), 0, 100);
    updateAnalysisConfig({
      [key]: {
        ...(analysisConfig as any)[key],
        [id]: sanitized,
      },
    } as Partial<typeof analysisConfig>);
  };

  const updateAssetCover = (field: 'financial' | 'personal' | 'inheritance', value: number) => {
    const sanitized = clampNumber(parseNumber(value, 0), 0, 100);
    updateAnalysisConfig({
      assetCovers: {
        ...(analysisConfig.assetCovers || { financial: 50, personal: 0, inheritance: 100 }),
        [field]: sanitized,
      },
    });
  };

  const currencyCountry = state.profile.country;
  const filteredPolicies = state.insurance.filter(policy => {
    if (inventoryType === 'all') return true;
    return policy.type === inventoryType;
  });

  return (
    <div className="space-y-8 md:space-y-10 animate-in fade-in duration-700 pb-24">
      <div className="surface-dark p-8 md:p-16 rounded-[2.5rem] md:rounded-[4rem] text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-600/10 blur-[120px] rounded-full translate-x-1/4 -translate-y-1/4" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8 md:gap-12">
          <div className="space-y-4 md:space-y-6">
            <div className="inline-flex items-center gap-2 md:gap-3 px-3 md:px-4 py-1.5 md:py-2 bg-teal-500/10 text-teal-300 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] border border-teal-500/20">
              <ShieldCheck size={14} /> Risk Protection Node
            </div>
            <h2 className="text-3xl md:text-7xl font-black tracking-tighter leading-tight md:leading-[0.85]">
              Term + Health
              <br />
              <span className="text-teal-500">Analysis.</span>
            </h2>
            <p className="text-slate-400 text-sm md:text-lg font-medium max-w-lg leading-relaxed">
              Analyze both insurance buckets separately with dedicated required vs deficit outputs.
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] backdrop-blur-xl shadow-inner w-full md:w-auto md:min-w-[320px] space-y-3">
            <div className="flex justify-between text-xs font-black uppercase tracking-widest text-slate-400"><span>Term Protection</span><span>{analysisData.termProtectionScore}%</span></div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-teal-500" style={{ width: `${analysisData.termProtectionScore}%` }} /></div>
            <div className="flex justify-between text-xs font-black uppercase tracking-widest text-slate-400"><span>Health Protection</span><span>{analysisData.healthProtectionScore}%</span></div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${analysisData.healthProtectionScore}%` }} /></div>
          </div>
        </div>
      </div>

      <div className="flex p-1.5 bg-white rounded-2xl md:rounded-[2.5rem] border border-slate-200 w-full md:w-fit mx-auto shadow-sm">
        <button onClick={() => setActiveTab('analysis')} className={`flex-1 md:flex-none px-4 md:px-10 py-3 md:py-4 rounded-xl md:rounded-[2rem] text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'analysis' ? 'bg-teal-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-900'}`}>Analysis</button>
        <button onClick={() => setActiveTab('inventory')} className={`flex-1 md:flex-none px-4 md:px-10 py-3 md:py-4 rounded-xl md:rounded-[2rem] text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'inventory' ? 'bg-teal-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-900'}`}>Inventory</button>
      </div>

      {activeTab === 'analysis' ? (
        <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-700">
          <div className="bg-white p-8 md:p-12 rounded-[2rem] md:rounded-[4rem] border border-slate-200 shadow-sm">
            <h3 className="text-xl md:text-2xl font-black text-slate-900 mb-8">Coverage Inputs</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-3">
                <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Term Insurance Amount</label>
                <input
                  type="number"
                  value={analysisConfig.termInsuranceAmount}
                  onChange={e => updateNumericField('termInsuranceAmount', parseFloat(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-5 py-3 font-bold"
                />
                <p className="text-[10px] text-slate-500 font-semibold">Current active term cover for family protection.</p>
              </div>

              <div className="space-y-3">
                <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Health Insurance Amount</label>
                <input
                  type="number"
                  value={analysisConfig.healthInsuranceAmount}
                  onChange={e => updateNumericField('healthInsuranceAmount', parseFloat(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-5 py-3 font-bold"
                />
                <p className="text-[10px] text-slate-500 font-semibold">Current family health cover (floater + individual combined).</p>
              </div>

              <div className="space-y-3">
                <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Medical Inflation (%)</label>
                <input
                  type="number"
                  min={0}
                  max={25}
                  value={analysisConfig.inflation}
                  onChange={e => updateNumericField('inflation', parseFloat(e.target.value), 0, 25)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-5 py-3 font-bold"
                />
                <p className="text-[10px] text-slate-500 font-semibold">Used in health insurance requirement algorithm.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white rounded-[2rem] md:rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/60">
                <h3 className="text-lg font-black text-slate-900">Term Insurance Requirement</h3>
                <p className="text-[10px] mt-1 font-black uppercase tracking-widest text-slate-500">Required vs Deficit</p>
              </div>
              <div className="p-6 space-y-3">
                <div className="flex justify-between text-xs font-bold"><span className="text-slate-500">Emergency Fund (12 months expense)</span><span className="text-slate-900">{formatCurrency(Math.round(analysisData.emergencyFund12Months), currencyCountry)}</span></div>
                <div className="flex justify-between text-xs font-bold"><span className="text-slate-500">Liabilities to Cover</span><span className="text-slate-900">{formatCurrency(Math.round(analysisData.debtRepayment), currencyCountry)}</span></div>
                <div className="flex justify-between text-xs font-bold"><span className="text-slate-500">Family Goals to Protect</span><span className="text-slate-900">{formatCurrency(Math.round(analysisData.familyGoalsCoverage), currencyCountry)}</span></div>
                <div className="flex justify-between text-sm font-black border-t border-slate-100 pt-3"><span className="text-slate-600">Gross Requirement</span><span className="text-slate-900">{formatCurrency(Math.round(analysisData.termRequirementBeforeAssets), currencyCountry)}</span></div>
                <div className="flex justify-between text-xs font-bold text-emerald-700"><span>Less Covered Assets</span><span>- {formatCurrency(Math.round(analysisData.assetCovered), currencyCountry)}</span></div>
                <div className="flex justify-between text-sm font-black border-t border-slate-100 pt-3"><span className="text-slate-600">Required Term Insurance</span><span className="text-slate-900">{formatCurrency(Math.round(analysisData.termRequirementAfterAssets), currencyCountry)}</span></div>
                <div className="flex justify-between text-xs font-bold"><span className="text-slate-500">Current Term Cover</span><span className="text-slate-900">{formatCurrency(Math.round(analysisData.enteredTermCover), currencyCountry)}</span></div>
                <div className={`flex justify-between text-sm font-black ${analysisData.termDeficit > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  <span>{analysisData.termDeficit > 0 ? 'Term Insurance Deficit' : 'Term Insurance Surplus'}</span>
                  <span>{formatCurrency(Math.round(analysisData.termDeficit > 0 ? analysisData.termDeficit : analysisData.termSurplus), currencyCountry)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] md:rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/60">
                <h3 className="text-lg font-black text-slate-900">Health Insurance Requirement</h3>
                <p className="text-[10px] mt-1 font-black uppercase tracking-widest text-slate-500">Algorithm-based Estimate</p>
              </div>
              <div className="p-6 space-y-3">
                <div className="flex justify-between text-xs font-bold"><span className="text-slate-500">Monthly Household Expense</span><span className="text-slate-900">{formatCurrency(Math.round(analysisData.monthlyExpenses), currencyCountry)}</span></div>
                <div className="flex justify-between text-xs font-bold"><span className="text-slate-500">Hospitalization Buffer (6 months)</span><span className="text-slate-900">{formatCurrency(Math.round(analysisData.hospitalizationBuffer), currencyCountry)}</span></div>
                <div className="flex justify-between text-xs font-bold"><span className="text-slate-500">Critical Illness Buffer (3 months)</span><span className="text-slate-900">{formatCurrency(Math.round(analysisData.criticalIllnessBuffer), currencyCountry)}</span></div>
                <div className="flex justify-between text-xs font-bold"><span className="text-slate-500">Age Risk Multiplier ({analysisData.oldestAge} years)</span><span className="text-slate-900">{analysisData.ageRiskMultiplier.toFixed(2)}x</span></div>
                <div className="flex justify-between text-xs font-bold"><span className="text-slate-500">Family Size Multiplier ({analysisData.familySize} members)</span><span className="text-slate-900">{analysisData.familySizeMultiplier.toFixed(2)}x</span></div>
                <div className="flex justify-between text-xs font-bold"><span className="text-slate-500">Medical Inflation Buffer (3-year)</span><span className="text-slate-900">{analysisData.inflationBuffer.toFixed(2)}x</span></div>
                <div className="flex justify-between text-xs font-bold"><span className="text-slate-500">Model Requirement</span><span className="text-slate-900">{formatCurrency(Math.round(analysisData.healthModelRequirement), currencyCountry)}</span></div>
                <div className="flex justify-between text-xs font-bold"><span className="text-slate-500">Minimum Family Floor</span><span className="text-slate-900">{formatCurrency(Math.round(analysisData.healthMinimumFloor), currencyCountry)}</span></div>
                <div className="flex justify-between text-sm font-black border-t border-slate-100 pt-3"><span className="text-slate-600">Required Health Insurance</span><span className="text-slate-900">{formatCurrency(Math.round(analysisData.healthRequirement), currencyCountry)}</span></div>
                <div className="flex justify-between text-xs font-bold"><span className="text-slate-500">Current Health Cover</span><span className="text-slate-900">{formatCurrency(Math.round(analysisData.enteredHealthCover), currencyCountry)}</span></div>
                <div className={`flex justify-between text-sm font-black ${analysisData.healthDeficit > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  <span>{analysisData.healthDeficit > 0 ? 'Health Insurance Deficit' : 'Health Insurance Surplus'}</span>
                  <span>{formatCurrency(Math.round(analysisData.healthDeficit > 0 ? analysisData.healthDeficit : analysisData.healthSurplus), currencyCountry)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white rounded-[2rem] md:rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/60">
                <h3 className="text-lg font-black text-slate-900">Emergency Fund Check</h3>
              </div>
              <div className="p-6 space-y-3">
                <div className="flex justify-between text-xs font-bold"><span className="text-slate-500">Monthly Household Expense</span><span className="text-slate-900">{formatCurrency(Math.round(analysisData.monthlyExpenses), currencyCountry)}</span></div>
                <div className="flex justify-between text-xs font-bold"><span className="text-slate-500">Annual Expense</span><span className="text-slate-900">{formatCurrency(Math.round(analysisData.annualExpenses), currencyCountry)}</span></div>
                <div className="flex justify-between text-sm font-black border-t border-slate-100 pt-3"><span className="text-slate-600">Emergency Corpus (12 months)</span><span className="text-slate-900">{formatCurrency(Math.round(analysisData.emergencyFund12Months), currencyCountry)}</span></div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  This emergency corpus is included in required term cover to protect your family in case of income interruption.
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] md:rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/60">
                <h3 className="text-lg font-black text-slate-900">Health Algorithm Notes</h3>
              </div>
              <div className="p-6 space-y-4 text-sm text-slate-600">
                <div className="flex gap-2 items-start"><HeartPulse size={16} className="mt-0.5 text-teal-600" /><p><span className="font-bold text-slate-800">Risk core:</span> 6-month hospitalization expense + 3-month critical illness buffer.</p></div>
                <div className="flex gap-2 items-start"><Activity size={16} className="mt-0.5 text-teal-600" /><p><span className="font-bold text-slate-800">Family/age scaling:</span> Coverage increases with oldest age and family size to reflect claim severity and simultaneous treatment risk.</p></div>
                <div className="flex gap-2 items-start"><AlertCircle size={16} className="mt-0.5 text-teal-600" /><p><span className="font-bold text-slate-800">Inflation safety:</span> A 3-year medical inflation buffer is applied to avoid underinsurance.</p></div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  Formula: <span className="font-bold">max(((6M expense x age factor x family factor + 3M expense) x inflation buffer), family floor)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] md:rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/60">
              <h3 className="text-lg font-black text-slate-900">Liability and Goal Coverage Controls</h3>
              <p className="text-[10px] mt-1 font-black uppercase tracking-widest text-slate-500">Used in term insurance requirement</p>
            </div>
            <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase">Liability</th>
                      <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase text-right">Value</th>
                      <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase text-right">Cover %</th>
                      <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase text-right">Covered</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analysisData.liabilities.map(loan => (
                      <tr key={loan.id}>
                        <td className="px-4 py-3 text-xs font-bold text-slate-700">{loan.type}</td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-700 text-right">{formatCurrency(Math.round(loan.value), currencyCountry)}</td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-600 text-right">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={loan.coverPct}
                            onChange={e => updateCoverMap('liabilityCovers', loan.id, parseFloat(e.target.value))}
                            className="w-16 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-right font-bold"
                          />
                        </td>
                        <td className="px-4 py-3 text-xs font-black text-slate-900 text-right">{formatCurrency(Math.round(loan.coveredValue), currencyCountry)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50/60">
                      <td className="px-4 py-3 text-xs font-black text-slate-500" colSpan={3}>Total</td>
                      <td className="px-4 py-3 text-xs font-black text-slate-900 text-right">{formatCurrency(Math.round(analysisData.debtRepayment), currencyCountry)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase">Goal</th>
                      <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase text-right">PV Value</th>
                      <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase text-right">Cover %</th>
                      <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase text-right">Covered</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analysisData.goals.map(goal => (
                      <tr key={goal.id}>
                        <td className="px-4 py-3 text-xs font-bold text-slate-700">{goal.type}</td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-700 text-right">{formatCurrency(Math.round(goal.currentCorpus), currencyCountry)}</td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-600 text-right">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={goal.coverPct}
                            onChange={e => updateCoverMap('goalCovers', goal.id, parseFloat(e.target.value))}
                            className="w-16 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-right font-bold"
                          />
                        </td>
                        <td className="px-4 py-3 text-xs font-black text-slate-900 text-right">{formatCurrency(Math.round(goal.coveredValue), currencyCountry)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50/60">
                      <td className="px-4 py-3 text-xs font-black text-slate-500" colSpan={3}>Total</td>
                      <td className="px-4 py-3 text-xs font-black text-slate-900 text-right">{formatCurrency(Math.round(analysisData.familyGoalsCoverage), currencyCountry)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] md:rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/60">
              <h3 className="text-lg font-black text-slate-900">Assets Deduction for Term Calculation</h3>
            </div>
            <div className="p-6 overflow-x-auto">
              <table className="w-full min-w-[420px] text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase">Asset</th>
                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase text-right">Value</th>
                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase text-right">Cover %</th>
                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase text-right">Deduction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-4 py-3 text-xs font-bold text-slate-700">Financial Assets</td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-700 text-right">{formatCurrency(Math.round(analysisData.financialAssets), currencyCountry)}</td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-600 text-right">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={analysisData.assetCovers.financial}
                        onChange={e => updateAssetCover('financial', parseFloat(e.target.value))}
                        className="w-16 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-right font-bold"
                      />
                    </td>
                    <td className="px-4 py-3 text-xs font-black text-slate-900 text-right">
                      {formatCurrency(Math.round(analysisData.financialAssets * (analysisData.assetCovers.financial / 100)), currencyCountry)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-xs font-bold text-slate-700">Personal Assets</td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-700 text-right">{formatCurrency(Math.round(analysisData.personalAssets), currencyCountry)}</td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-600 text-right">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={analysisData.assetCovers.personal}
                        onChange={e => updateAssetCover('personal', parseFloat(e.target.value))}
                        className="w-16 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-right font-bold"
                      />
                    </td>
                    <td className="px-4 py-3 text-xs font-black text-slate-900 text-right">
                      {formatCurrency(Math.round(analysisData.personalAssets * (analysisData.assetCovers.personal / 100)), currencyCountry)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-xs font-bold text-slate-700">Inheritance</td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-700 text-right">
                      <input
                        type="number"
                        value={analysisConfig.inheritanceValue}
                        onChange={e => updateNumericField('inheritanceValue', parseFloat(e.target.value))}
                        className="w-28 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-right font-bold"
                      />
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-600 text-right">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={analysisData.assetCovers.inheritance}
                        onChange={e => updateAssetCover('inheritance', parseFloat(e.target.value))}
                        className="w-16 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-right font-bold"
                      />
                    </td>
                    <td className="px-4 py-3 text-xs font-black text-slate-900 text-right">
                      {formatCurrency(Math.round(analysisData.inheritanceValue * (analysisData.assetCovers.inheritance / 100)), currencyCountry)}
                    </td>
                  </tr>
                  <tr className="bg-slate-50/60">
                    <td className="px-4 py-3 text-xs font-black text-slate-500" colSpan={3}>Total Asset Deduction</td>
                    <td className="px-4 py-3 text-xs font-black text-slate-900 text-right">{formatCurrency(Math.round(analysisData.assetCovered), currencyCountry)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-700">
          <div className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Add Insurance Policy</h3>
                <p className="text-[10px] mt-1 font-black uppercase tracking-widest text-slate-500">Separate capture for term and health</p>
              </div>
              <div className="flex p-1 bg-slate-100 rounded-xl w-fit">
                <button
                  type="button"
                  onClick={() => setNewPolicyType('Term')}
                  className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${newPolicyType === 'Term' ? 'bg-teal-600 text-white' : 'text-slate-500'}`}
                >
                  Term
                </button>
                <button
                  type="button"
                  onClick={() => setNewPolicyType('Health')}
                  className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${newPolicyType === 'Health' ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}
                >
                  Health
                </button>
              </div>
            </div>

            {inventoryError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-bold">
                {inventoryError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Insured</label>
                <select
                  value={newPolicyInsured}
                  onChange={e => setNewPolicyInsured(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold"
                >
                  <option value="self">Self</option>
                  {state.family.map(member => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  {newPolicyType === 'Term' ? 'Term Insurance Amount' : 'Health Insurance Amount'}
                </label>
                <input
                  type="number"
                  min={0}
                  value={newPolicyAmount || ''}
                  onChange={e => setNewPolicyAmount(parseNumber(e.target.value, 0))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Annual Premium (Optional)</label>
                <input
                  type="number"
                  min={0}
                  value={newPolicyPremium || ''}
                  onChange={e => setNewPolicyPremium(parseNumber(e.target.value, 0))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-transparent uppercase tracking-widest">Action</label>
                <button
                  type="button"
                  onClick={addPolicy}
                  className="w-full py-3 px-4 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-teal-600 transition-all"
                >
                  Add {newPolicyType} Policy
                </button>
              </div>
            </div>
          </div>

          <div className="flex p-1 bg-white border border-slate-200 rounded-xl w-fit shadow-sm">
            {[
              { key: 'all', label: 'All' },
              { key: 'Term', label: 'Term' },
              { key: 'Health', label: 'Health' },
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setInventoryType(tab.key as 'all' | 'Term' | 'Health')}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${inventoryType === tab.key ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {state.insurance.length === 0 ? (
            <div className="bg-white p-8 rounded-[2rem] border border-slate-200 text-center">
              <p className="text-sm font-semibold text-slate-600">No insurance policies added yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {filteredPolicies.map((policy) => {
                const displaySum = policy.category === 'General Insurance' && policy.sumInsured
                  ? policy.sumInsured
                  : policy.sumAssured;
                return (
                  <div key={policy.id} className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-slate-200 shadow-sm group transition-all flex flex-col justify-between min-h-[200px]">
                    <div className="flex justify-between items-start">
                      <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0 ${policy.category === 'Life Insurance' ? 'bg-teal-50 text-teal-600' : 'bg-emerald-50 text-emerald-600'}`}><ShieldCheck size={24} /></div>
                      <button onClick={() => removePolicy(policy.id)} className="p-2 text-slate-200 hover:text-rose-500 transition-colors"><Trash2 size={18} /></button>
                    </div>
                    <div className="mt-4 md:mt-6">
                      <h4 className="text-xl md:text-2xl font-black text-slate-900">{formatCurrency(displaySum, currencyCountry)}</h4>
                      <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase">{policy.type} • {getMemberName(policy.insured)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {state.insurance.length > 0 && filteredPolicies.length === 0 && (
            <div className="bg-white p-8 rounded-[2rem] border border-slate-200 text-center">
              <p className="text-sm font-semibold text-slate-600">No {inventoryType} insurance policies found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Insurances;
