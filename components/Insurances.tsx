
import React, { useState, useMemo } from 'react';
import { FinanceState, Insurance } from '../types';
import { 
  ShieldCheck, Plus, Trash2, User, Activity, AlertCircle, 
  ChevronDown, Calculator, TrendingUp, Wallet, ArrowUpRight,
  ShieldAlert, CheckCircle2, Info, Landmark, BarChart3, ArrowRight
} from 'lucide-react';
import { clampNumber, parseNumber } from '../lib/validation';
import { formatCurrency } from '../lib/currency';
import { buildBucketDiscountFactors, getGoalIntervalYears, getLifeExpectancyYear, getRiskReturnAssumption, inflateByBuckets } from '../lib/financeMath';

const Insurances: React.FC<{ state: FinanceState, updateState: (data: Partial<FinanceState>) => void }> = ({ state, updateState }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [activeTab, setActiveTab] = useState<'inventory' | 'analysis'>('analysis');
  const analysisConfig = state.insuranceAnalysis;

  const [newPolicy, setNewPolicy] = useState<Partial<Insurance>>({
    category: 'Life Insurance',
    type: 'Term',
    proposer: 'self',
    insured: 'self',
    sumAssured: 0,
    premium: 0,
    isMoneyBack: false,
    moneyBackYears: [],
    moneyBackAmounts: []
  });

  const handleAdd = () => {
    const policy = { ...newPolicy, id: Math.random().toString(36).substr(2, 9) } as Insurance;
    updateState({ insurance: [...state.insurance, policy] });
    setShowAdd(false);
  };

  const removePolicy = (id: string) => {
    updateState({ insurance: state.insurance.filter(p => p.id !== id) });
  };

  const getMemberName = (id: string) => {
    if (id === 'self') return state.profile.firstName || 'Self';
    return state.family.find(f => f.id === id)?.name || 'Unknown';
  };

  const pvAnnuity = (annual: number, years: number, rate: number) => {
    if (years <= 0) return 0;
    const r = rate / 100;
    if (r === 0) return annual * years;
    return annual * ((1 - Math.pow(1 + r, -years)) / r);
  };

  const hlvData = useMemo(() => {
    const annualExpenses = (state.detailedExpenses.reduce((s, e) => s + e.amount, 0) || state.profile.monthlyExpenses) * 12;
    const investmentRate = analysisConfig.investmentRate;
    const immediateAnnual = analysisConfig.immediateAnnualValue;
    const immediateYears = analysisConfig.immediateYears;
    const incomeAnnual = analysisConfig.incomeAnnualValue;
    const incomeYears = analysisConfig.incomeYears;

    const immediatePV = pvAnnuity(immediateAnnual, immediateYears, investmentRate);
    const incomePV = pvAnnuity(incomeAnnual, incomeYears, investmentRate);

    const retirementYear = state.profile.dob
      ? new Date(state.profile.dob).getFullYear() + state.profile.retirementAge
      : new Date().getFullYear() + 30;
    const baseReturn = getRiskReturnAssumption(state.riskProfile?.level);
    const discountSettings = state.discountSettings;
    const discountFallback = discountSettings?.defaultDiscountRate ?? baseReturn;

    const resolveYear = (rel: any): number => {
      const birthYear = state.profile.dob ? new Date(state.profile.dob).getFullYear() : new Date().getFullYear() - 30;
      if (rel.type === 'Year') return rel.value;
      if (rel.type === 'Age') return birthYear + rel.value;
      if (rel.type === 'Retirement') return birthYear + state.profile.retirementAge + rel.value;
      if (rel.type === 'LifeExpectancy') return birthYear + state.profile.lifeExpectancy + rel.value;
      return rel.value;
    };

    const maxGoalYear = state.goals.reduce((maxYear, goal) => {
      const endYear = resolveYear(goal.endDate);
      return Math.max(maxYear, endYear);
    }, new Date().getFullYear() + 1);
    const endYear = Math.max(
      maxGoalYear,
      getLifeExpectancyYear(state.profile.dob, state.profile.lifeExpectancy) ?? (new Date().getFullYear() + 35),
    );
    const discountFactors = buildBucketDiscountFactors(new Date().getFullYear(), endYear, retirementYear, discountSettings, discountFallback);

    const goals = state.goals.map(goal => {
      const sYear = resolveYear(goal.startDate);
      const eYear = resolveYear(goal.endDate);
      const inflationFallback = discountSettings?.defaultInflationRate ?? goal.inflationRate;
      const yearsToStart = Math.max(0, sYear - new Date().getFullYear());
      const startFV = discountSettings?.useBucketInflation
        ? inflateByBuckets(goal.targetAmountToday, new Date().getFullYear(), sYear, new Date().getFullYear(), retirementYear, discountSettings, inflationFallback)
        : (goal.startGoalAmount ?? (goal.targetAmountToday * Math.pow(1 + (goal.inflationRate / 100), yearsToStart)));

      let currentCorpus = 0;
      for (let year = sYear; year <= eYear; year++) {
        let nominal = 0;
        if (!goal.isRecurring) {
          nominal = year === eYear ? startFV : 0;
        } else {
          const yearsFromStart = Math.max(0, year - sYear);
          const baseAmount = discountSettings?.useBucketInflation
            ? inflateByBuckets(startFV, sYear, year, new Date().getFullYear(), retirementYear, discountSettings, inflationFallback)
            : startFV * Math.pow(1 + (goal.inflationRate / 100), yearsFromStart);
          const interval = getGoalIntervalYears(goal.frequency, goal.frequencyIntervalYears);
          if (interval > 1 && ((year - sYear) % interval !== 0)) {
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
        coverPct,
        currentCorpus,
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

    const debtRepayment = liabilities.reduce((sum, l) => sum + l.coveredValue, 0);
    const financialGoals = goals.reduce((sum, g) => sum + g.coveredValue, 0);

    const financialAssets = state.assets.filter(a => ['Liquid', 'Equity', 'Debt', 'Gold/Silver'].includes(a.category)).reduce((sum, a) => sum + a.currentValue, 0);
    const personalAssets = state.assets.filter(a => ['Real Estate', 'Personal', 'Vehicle'].includes(a.category)).reduce((sum, a) => sum + a.currentValue, 0);
    const inheritanceValue = analysisConfig.inheritanceValue || 0;
    const assetCovers = analysisConfig.assetCovers || { financial: 50, personal: 0, inheritance: 100 };
    const assetCovered = (financialAssets * (assetCovers.financial / 100))
      + (personalAssets * (assetCovers.personal / 100))
      + (inheritanceValue * (assetCovers.inheritance / 100));

    const policyInsuranceTotal = state.insurance
      .filter(p => p.category === 'Life Insurance')
      .reduce((sum, p) => sum + p.sumAssured, 0);
    const totalExistingInsurance = analysisConfig.existingInsurance;

    const totalRequirement = immediatePV + incomePV + debtRepayment + financialGoals;
    const totalAvailable = assetCovered + totalExistingInsurance;
    const shortfall = Math.max(0, totalRequirement - totalAvailable);
    const surplus = Math.max(0, totalAvailable - totalRequirement);

    return {
      annualExpenses,
      immediateAnnual,
      immediateYears,
      immediatePV,
      incomeAnnual,
      incomeYears,
      incomePV,
      liabilities,
      debtRepayment,
      goals,
      financialGoals,
      financialAssets,
      personalAssets,
      inheritanceValue,
      assetCovers,
      assetCovered,
      totalExistingInsurance,
      policyInsuranceTotal,
      totalRequirement,
      totalAvailable,
      shortfall,
      surplus,
      safetyScore: Math.min(100, Math.round((totalAvailable / (totalRequirement || 1)) * 100)),
    };
  }, [state, analysisConfig]);

  const updateAnalysisConfig = (patch: Partial<typeof analysisConfig>) => {
    updateState({
      insuranceAnalysis: {
        ...analysisConfig,
        ...patch,
      },
    });
  };

  const updateNumericField = (field: keyof typeof analysisConfig, value: number, min = 0, max?: number) => {
    const sanitized = parseNumber(value, (analysisConfig as any)[field] as number);
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
        ...analysisConfig.assetCovers,
        [field]: sanitized,
      },
    });
  };

  const currencyCountry = state.profile.country;

  return (
    <div className="space-y-8 md:space-y-10 animate-in fade-in duration-700 pb-24">
      {/* Dynamic Header */}
      <div className="surface-dark p-8 md:p-16 rounded-[2.5rem] md:rounded-[4rem] text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-600/10 blur-[120px] rounded-full translate-x-1/4 -translate-y-1/4" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8 md:gap-12">
          <div className="space-y-4 md:space-y-6">
            <div className="inline-flex items-center gap-2 md:gap-3 px-3 md:px-4 py-1.5 md:py-2 bg-teal-500/10 text-teal-300 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] border border-teal-500/20">
              <ShieldCheck size={14}/> Risk Protection Node
            </div>
            <h2 className="text-3xl md:text-7xl font-black tracking-tighter leading-tight md:leading-[0.85]">Shield <br/><span className="text-teal-500">Security.</span></h2>
            <p className="text-slate-400 text-sm md:text-lg font-medium max-w-lg leading-relaxed">
              Auditing <span className="text-white font-bold">Human Life Value</span> against debt liabilities.
            </p>
          </div>
          
          <div className="bg-white/5 border border-white/10 p-8 md:p-10 rounded-[2rem] md:rounded-[4rem] backdrop-blur-xl flex flex-col items-center gap-2 shadow-inner w-full md:w-auto md:min-w-[280px]">
             <p className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest">Protection Status</p>
             <h4 className={`text-4xl md:text-5xl font-black tracking-tighter ${hlvData.shortfall > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
               {hlvData.safetyScore}%
             </h4>
          </div>
        </div>
      </div>

      {/* Tabs - Better for mobile */}
      <div className="flex p-1.5 bg-white rounded-2xl md:rounded-[2.5rem] border border-slate-200 w-full md:w-fit mx-auto shadow-sm">
        <button onClick={() => setActiveTab('analysis')} className={`flex-1 md:flex-none px-4 md:px-10 py-3 md:py-4 rounded-xl md:rounded-[2rem] text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'analysis' ? 'bg-teal-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-900'}`}>Analysis</button>
        <button onClick={() => setActiveTab('inventory')} className={`flex-1 md:flex-none px-4 md:px-10 py-3 md:py-4 rounded-xl md:rounded-[2rem] text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'inventory' ? 'bg-teal-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-900'}`}>Inventory</button>
      </div>

      {activeTab === 'analysis' ? (
        <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-700">
          <div className="bg-white p-8 md:p-12 rounded-[2rem] md:rounded-[4rem] border border-slate-200 shadow-sm">
            <h3 className="text-xl md:text-2xl font-black text-slate-900 mb-8">Life Cover Inputs</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Immediate Annual Value</label>
                <input
                  type="number"
                  value={analysisConfig.immediateAnnualValue}
                  onChange={e => updateNumericField('immediateAnnualValue', parseFloat(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-5 py-3 font-bold"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Immediate Years</label>
                <input
                  type="number"
                  min={1}
                  value={analysisConfig.immediateYears}
                  onChange={e => updateNumericField('immediateYears', parseFloat(e.target.value), 1, 60)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-5 py-3 font-bold"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Income Annual Replacement</label>
                <input
                  type="number"
                  value={analysisConfig.incomeAnnualValue}
                  onChange={e => updateNumericField('incomeAnnualValue', parseFloat(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-5 py-3 font-bold"
                />
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Current annual expenses: {formatCurrency(Math.round(hlvData.annualExpenses), currencyCountry)}</p>
              </div>
              <div className="space-y-3">
                <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Income Replacement Years</label>
                <input
                  type="number"
                  min={1}
                  value={analysisConfig.incomeYears}
                  onChange={e => updateNumericField('incomeYears', parseFloat(e.target.value), 1, 60)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-5 py-3 font-bold"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Investment Rate (%)</label>
                <input
                  type="number"
                  value={analysisConfig.investmentRate}
                  onChange={e => updateNumericField('investmentRate', parseFloat(e.target.value), 0, 25)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-5 py-3 font-bold"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Existing Insurance</label>
                <input
                  type="number"
                  value={analysisConfig.existingInsurance}
                  onChange={e => updateNumericField('existingInsurance', parseFloat(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-5 py-3 font-bold"
                />
                <button
                  type="button"
                  onClick={() => updateAnalysisConfig({ existingInsurance: hlvData.policyInsuranceTotal })}
                  className="text-[9px] font-black uppercase tracking-widest text-teal-600"
                >
                  Use policy total ({formatCurrency(Math.round(hlvData.policyInsuranceTotal), currencyCountry)})
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] md:rounded-[4rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-100 bg-slate-50/60">
              <h3 className="text-lg md:text-xl font-black text-slate-900">Term Insurance Calculation</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">Present Value of Cashflows</p>
            </div>
            <div className="p-6 md:p-10 overflow-x-auto">
              <table className="w-full min-w-[600px] text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-[9px] font-black text-slate-400 uppercase">Particulars</th>
                    <th className="px-6 py-3 text-[9px] font-black text-slate-400 uppercase text-right">Annual Value</th>
                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase text-right">Years</th>
                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase text-right">Investment Rate</th>
                    <th className="px-6 py-3 text-[9px] font-black text-slate-400 uppercase text-right">Requirement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-6 py-4 text-xs font-bold text-slate-700">Immediate Cash Needs</td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-700 text-right">{formatCurrency(analysisConfig.immediateAnnualValue, currencyCountry)}</td>
                    <td className="px-4 py-4 text-xs font-bold text-slate-600 text-right">{analysisConfig.immediateYears}</td>
                    <td className="px-4 py-4 text-xs font-bold text-slate-600 text-right">{analysisConfig.investmentRate}%</td>
                    <td className="px-6 py-4 text-xs font-black text-slate-900 text-right">{formatCurrency(Math.round(hlvData.immediatePV), currencyCountry)}</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-xs font-bold text-slate-700">Income/Expense Replacement</td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-700 text-right">{formatCurrency(hlvData.incomeAnnual, currencyCountry)}</td>
                    <td className="px-4 py-4 text-xs font-bold text-slate-600 text-right">{analysisConfig.incomeYears}</td>
                    <td className="px-4 py-4 text-xs font-bold text-slate-600 text-right">{analysisConfig.investmentRate}%</td>
                    <td className="px-6 py-4 text-xs font-black text-slate-900 text-right">{formatCurrency(Math.round(hlvData.incomePV), currencyCountry)}</td>
                  </tr>
                  <tr className="bg-slate-50/60">
                    <td className="px-6 py-4 text-xs font-black text-slate-500" colSpan={4}>Total</td>
                    <td className="px-6 py-4 text-xs font-black text-slate-900 text-right">{formatCurrency(Math.round(hlvData.immediatePV + hlvData.incomePV), currencyCountry)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-[2rem] md:rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/60">
                <h3 className="text-lg font-black text-slate-900">Summary of Insurance Requirement</h3>
              </div>
              <div className="p-6 overflow-x-auto">
                <table className="w-full min-w-[480px] text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase">Liability</th>
                      <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase text-right">Value</th>
                      <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase text-right">Cover %</th>
                      <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {hlvData.liabilities.map(loan => (
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
                      <td className="px-4 py-3 text-xs font-black text-slate-900 text-right">{formatCurrency(Math.round(hlvData.debtRepayment), currencyCountry)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] md:rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/60">
                <h3 className="text-lg font-black text-slate-900">Requirements</h3>
              </div>
              <div className="p-6 space-y-3">
                <div className="flex justify-between text-xs font-bold"><span className="text-slate-500">Immediate Cash Needs (PV)</span><span className="text-slate-900">{formatCurrency(Math.round(hlvData.immediatePV), currencyCountry)}</span></div>
                <div className="flex justify-between text-xs font-bold"><span className="text-slate-500">Income Replacement (PV)</span><span className="text-slate-900">{formatCurrency(Math.round(hlvData.incomePV), currencyCountry)}</span></div>
                <div className="flex justify-between text-xs font-bold"><span className="text-slate-500">Debt Repayment</span><span className="text-slate-900">{formatCurrency(Math.round(hlvData.debtRepayment), currencyCountry)}</span></div>
                <div className="flex justify-between text-xs font-bold"><span className="text-slate-500">Financial Goals</span><span className="text-slate-900">{formatCurrency(Math.round(hlvData.financialGoals), currencyCountry)}</span></div>
                <div className="flex justify-between text-sm font-black border-t border-slate-100 pt-3"><span className="text-slate-600">Total Requirement</span><span className="text-slate-900">{formatCurrency(Math.round(hlvData.totalRequirement), currencyCountry)}</span></div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] md:rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/60">
              <h3 className="text-lg font-black text-slate-900">Financial Goals</h3>
            </div>
            <div className="p-6 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase">Goal</th>
                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase text-right">Current Value</th>
                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase text-right">Cover %</th>
                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase text-right">Total Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {hlvData.goals.map(goal => (
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
                    <td className="px-4 py-3 text-xs font-black text-slate-900 text-right">{formatCurrency(Math.round(hlvData.financialGoals), currencyCountry)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-[2rem] md:rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/60">
                <h3 className="text-lg font-black text-slate-900">Assets</h3>
              </div>
              <div className="p-6 overflow-x-auto">
                <table className="w-full min-w-[420px] text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase">Asset</th>
                      <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase text-right">Value</th>
                      <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase text-right">Cover %</th>
                      <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="px-4 py-3 text-xs font-bold text-slate-700">Financial Assets</td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-700 text-right">{formatCurrency(Math.round(hlvData.financialAssets), currencyCountry)}</td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-600 text-right">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={hlvData.assetCovers.financial}
                          onChange={e => updateAssetCover('financial', parseFloat(e.target.value))}
                          className="w-16 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-right font-bold"
                        />
                      </td>
                      <td className="px-4 py-3 text-xs font-black text-slate-900 text-right">
                        {formatCurrency(Math.round(hlvData.financialAssets * (hlvData.assetCovers.financial / 100)), currencyCountry)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-xs font-bold text-slate-700">Personal Assets</td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-700 text-right">{formatCurrency(Math.round(hlvData.personalAssets), currencyCountry)}</td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-600 text-right">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={hlvData.assetCovers.personal}
                          onChange={e => updateAssetCover('personal', parseFloat(e.target.value))}
                          className="w-16 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-right font-bold"
                        />
                      </td>
                      <td className="px-4 py-3 text-xs font-black text-slate-900 text-right">
                        {formatCurrency(Math.round(hlvData.personalAssets * (hlvData.assetCovers.personal / 100)), currencyCountry)}
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
                          value={hlvData.assetCovers.inheritance}
                          onChange={e => updateAssetCover('inheritance', parseFloat(e.target.value))}
                          className="w-16 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-right font-bold"
                        />
                      </td>
                      <td className="px-4 py-3 text-xs font-black text-slate-900 text-right">
                        {formatCurrency(Math.round(hlvData.inheritanceValue * (hlvData.assetCovers.inheritance / 100)), currencyCountry)}
                      </td>
                    </tr>
                    <tr className="bg-slate-50/60">
                      <td className="px-4 py-3 text-xs font-black text-slate-500" colSpan={3}>Total</td>
                      <td className="px-4 py-3 text-xs font-black text-slate-900 text-right">{formatCurrency(Math.round(hlvData.assetCovered), currencyCountry)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] md:rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/60">
                <h3 className="text-lg font-black text-slate-900">Existing Insurance</h3>
              </div>
              <div className="p-6 space-y-3">
                <div className="flex justify-between text-xs font-bold"><span className="text-slate-500">Existing Insurance</span><span className="text-slate-900">{formatCurrency(Math.round(hlvData.totalExistingInsurance), currencyCountry)}</span></div>
                <div className="flex justify-between text-xs font-bold"><span className="text-slate-500">Covered Assets</span><span className="text-slate-900">{formatCurrency(Math.round(hlvData.assetCovered), currencyCountry)}</span></div>
                <div className="flex justify-between text-sm font-black border-t border-slate-100 pt-3"><span className="text-slate-600">Total Available</span><span className="text-slate-900">{formatCurrency(Math.round(hlvData.totalAvailable), currencyCountry)}</span></div>
                <div className={`flex justify-between text-sm font-black ${hlvData.shortfall > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  <span>{hlvData.shortfall > 0 ? 'Insurance Shortfall' : 'Insurance Surplus'}</span>
                  <span>{formatCurrency(Math.round(hlvData.shortfall > 0 ? hlvData.shortfall : hlvData.surplus), currencyCountry)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-700">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {state.insurance.map((policy) => {
                const displaySum = policy.category === 'General Insurance' && policy.sumInsured
                  ? policy.sumInsured
                  : policy.sumAssured;
                return (
                <div key={policy.id} className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-slate-200 shadow-sm group transition-all flex flex-col justify-between min-h-[200px]">
                   <div className="flex justify-between items-start">
                      <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0 ${policy.category === 'Life Insurance' ? 'bg-teal-50 text-teal-600' : 'bg-emerald-50 text-emerald-600'}`}><ShieldCheck size={24} md:size={28} /></div>
                      <button onClick={() => removePolicy(policy.id)} className="p-2 text-slate-200 hover:text-rose-500 transition-colors"><Trash2 size={18} /></button>
                   </div>
                   <div className="mt-4 md:mt-6">
                      <h4 className="text-xl md:text-2xl font-black text-slate-900">{formatCurrency(displaySum, currencyCountry)}</h4>
                      <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase">{policy.type} • {getMemberName(policy.insured)}</p>
                   </div>
                </div>
              )})}
           </div>
        </div>
      )}
    </div>
  );
};

export default Insurances;
