
import React, { useState, useMemo } from 'react';
import { FinanceState, Insurance } from '../types';
import { 
  ShieldCheck, Plus, Trash2, User, Activity, AlertCircle, 
  ChevronDown, Calculator, TrendingUp, Wallet, ArrowUpRight,
  ShieldAlert, CheckCircle2, Info, Landmark, BarChart3, ArrowRight
} from 'lucide-react';
import { clampNumber, parseNumber } from '../lib/validation';
import { formatCurrency } from '../lib/currency';
import { buildDiscountFactors, getGoalIntervalYears, getLifeExpectancyYear, getRiskReturnAssumption } from '../lib/financeMath';

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

  const hlvData = useMemo(() => {
    const annualExpenses = (state.detailedExpenses.reduce((s, e) => s + e.amount, 0) || state.profile.monthlyExpenses) * 12;
    const realRate = ((1 + analysisConfig.investmentRate / 100) / (1 + analysisConfig.inflation / 100)) - 1;
    const pvFactor = realRate > 0
      ? (1 - Math.pow(1 + realRate, -analysisConfig.replacementYears)) / realRate
      : analysisConfig.replacementYears;
    // Annuity due (expenses at period start)
    const expenseReplacement = annualExpenses * pvFactor * (1 + realRate);

    const retirementYear = state.profile.dob
      ? new Date(state.profile.dob).getFullYear() + state.profile.retirementAge
      : new Date().getFullYear() + 30;
    const baseReturn = getRiskReturnAssumption(state.riskProfile?.level);

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
    const discountFactors = buildDiscountFactors(new Date().getFullYear(), endYear, retirementYear, baseReturn);

    const goalCoverMap: Record<string, number> = {
      'Retirement': 60,
      'Vacation': 60,
      'Car': 100,
      'Child Education': 100,
      'Child Marriage': 100,
      'Others': 100,
      'Land / Home': 0,
      'Corpus for Start-up': 0,
      'Commercial': 0,
      'Home Renovation': 100,
      'Holiday Home': 0,
      'Charity / Philanthropy': 0,
      'Child-birth Expenses': 100,
      'Big Purchases': 100,
      'Estate for Children': 100,
    };

    const goals = state.goals.map(goal => {
      const sYear = resolveYear(goal.startDate);
      const eYear = resolveYear(goal.endDate);
      const inflation = goal.inflationRate / 100;
      const yearsToStart = Math.max(0, sYear - new Date().getFullYear());
      const startFV = goal.startGoalAmount ?? (goal.targetAmountToday * Math.pow(1 + inflation, yearsToStart));

      let sumCorpus = 0;
      let currentCorpus = 0;
      for (let year = sYear; year <= eYear; year++) {
        let nominal = 0;
        if (!goal.isRecurring) {
          nominal = year === eYear ? startFV : 0;
        } else {
          const yearsFromStart = Math.max(0, year - sYear);
          const baseAmount = startFV * Math.pow(1 + inflation, yearsFromStart);
          const interval = getGoalIntervalYears(goal.frequency);
          if (interval > 1 && ((year - sYear) % interval !== 0)) {
            nominal = 0;
          } else if (goal.frequency === 'Monthly') {
            nominal = baseAmount * 12;
          } else {
            nominal = baseAmount;
          }
        }
        if (nominal <= 0) continue;
        sumCorpus += nominal;
        const factor = discountFactors[year] || 1;
        currentCorpus += nominal / factor;
      }

      const coverPct = goalCoverMap[goal.type] ?? 100;
      const coveredValue = currentCorpus * (coverPct / 100);

      return {
        id: goal.id,
        type: goal.type,
        coverPct,
        currentCorpus,
        sumCorpus,
        coveredValue,
      };
    });

    const liabilities = state.loans.map(loan => ({
      id: loan.id,
      type: loan.type,
      value: loan.outstandingAmount,
      coverPct: 100,
      coveredValue: loan.outstandingAmount,
    }));

    const debtRepayment = liabilities.reduce((sum, l) => sum + l.coveredValue, 0);
    const financialGoals = goals.reduce((sum, g) => sum + g.coveredValue, 0);

    const financialAssets = state.assets.filter(a => ['Liquid', 'Equity', 'Debt'].includes(a.category)).reduce((sum, a) => sum + a.currentValue, 0);
    const personalAssets = state.assets.filter(a => ['Real Estate', 'Personal', 'Vehicle'].includes(a.category)).reduce((sum, a) => sum + a.currentValue, 0);
    const assetCoveragePct = analysisConfig.financialAssetDiscount;
    const assetCovered = financialAssets * (assetCoveragePct / 100);

    const totalExistingInsurance = state.insurance
      .filter(p => p.category === 'Life Insurance')
      .reduce((sum, p) => sum + p.sumAssured, 0);

    const totalRequirement = analysisConfig.immediateNeeds + expenseReplacement + debtRepayment + financialGoals;
    const totalAvailable = assetCovered + totalExistingInsurance;
    const gap = totalAvailable - totalRequirement;

    return {
      immediateNeeds: analysisConfig.immediateNeeds,
      annualExpenses,
      expenseReplacement,
      liabilities,
      debtRepayment,
      goals,
      financialGoals,
      financialAssets,
      personalAssets,
      assetCoveragePct,
      assetCovered,
      totalExistingInsurance,
      totalRequirement,
      totalAvailable,
      gap,
      safetyScore: Math.min(100, Math.round((totalAvailable / (totalRequirement || 1)) * 100)),
    };
  }, [state, analysisConfig]);

  const updateAnalysisConfig = (field: keyof typeof analysisConfig, value: number) => {
    const sanitized = parseNumber(value, analysisConfig[field] as number);
    let nextValue = sanitized;
    if (field === 'inflation') nextValue = clampNumber(sanitized, 0, 15);
    if (field === 'investmentRate') nextValue = clampNumber(sanitized, 0, 25);
    if (field === 'replacementYears') nextValue = clampNumber(sanitized, 1, 60);
    if (field === 'immediateNeeds') nextValue = Math.max(0, sanitized);
    if (field === 'financialAssetDiscount') nextValue = clampNumber(sanitized, 0, 100);

    updateState({
      insuranceAnalysis: {
        ...analysisConfig,
        [field]: nextValue,
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
             <h4 className={`text-4xl md:text-5xl font-black tracking-tighter ${hlvData.gap > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
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
            <h3 className="text-xl md:text-2xl font-black text-slate-900 mb-8">Parameters</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Inflation</label>
                  <span className="text-lg md:text-xl font-black text-teal-600">{analysisConfig.inflation}%</span>
                </div>
                <input type="range" min="0" max="15" step="0.5" value={analysisConfig.inflation} onChange={e => updateAnalysisConfig('inflation', parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-100 rounded-full appearance-none accent-teal-600" />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Investment Rate</label>
                  <span className="text-lg md:text-xl font-black text-teal-600">{analysisConfig.investmentRate}%</span>
                </div>
                <input type="range" min="0" max="25" step="0.5" value={analysisConfig.investmentRate} onChange={e => updateAnalysisConfig('investmentRate', parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-100 rounded-full appearance-none accent-teal-600" />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Replacement Years</label>
                  <span className="text-lg md:text-xl font-black text-teal-600">{analysisConfig.replacementYears}</span>
                </div>
                <input type="range" min="1" max="60" step="1" value={analysisConfig.replacementYears} onChange={e => updateAnalysisConfig('replacementYears', parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-100 rounded-full appearance-none accent-teal-600" />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Immediate Cash Needs</label>
                  <span className="text-lg md:text-xl font-black text-teal-600">{formatCurrency(analysisConfig.immediateNeeds, currencyCountry)}</span>
                </div>
                <input type="number" value={analysisConfig.immediateNeeds} onChange={e => updateAnalysisConfig('immediateNeeds', parseFloat(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] px-5 py-3 font-bold" />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Financial Asset Coverage</label>
                  <span className="text-lg md:text-xl font-black text-teal-600">{analysisConfig.financialAssetDiscount}%</span>
                </div>
                <input type="range" min="0" max="100" step="5" value={analysisConfig.financialAssetDiscount} onChange={e => updateAnalysisConfig('financialAssetDiscount', parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-100 rounded-full appearance-none accent-teal-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] md:rounded-[4rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-100 bg-slate-50/60">
              <h3 className="text-lg md:text-xl font-black text-slate-900">Term Insurance Calculation</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">Growth / Inflation: {analysisConfig.inflation}%</p>
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
                    <td className="px-6 py-4 text-xs font-bold text-slate-700 text-right">{formatCurrency(analysisConfig.immediateNeeds, currencyCountry)}</td>
                    <td className="px-4 py-4 text-xs font-bold text-slate-600 text-right">1</td>
                    <td className="px-4 py-4 text-xs font-bold text-slate-600 text-right">{analysisConfig.investmentRate}%</td>
                    <td className="px-6 py-4 text-xs font-black text-slate-900 text-right">{formatCurrency(analysisConfig.immediateNeeds, currencyCountry)}</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-xs font-bold text-slate-700">Income/Expense Replacement</td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-700 text-right">{formatCurrency(hlvData.annualExpenses, currencyCountry)}</td>
                    <td className="px-4 py-4 text-xs font-bold text-slate-600 text-right">{analysisConfig.replacementYears}</td>
                    <td className="px-4 py-4 text-xs font-bold text-slate-600 text-right">{analysisConfig.investmentRate}%</td>
                    <td className="px-6 py-4 text-xs font-black text-slate-900 text-right">{formatCurrency(Math.round(hlvData.expenseReplacement), currencyCountry)}</td>
                  </tr>
                  <tr className="bg-slate-50/60">
                    <td className="px-6 py-4 text-xs font-black text-slate-500" colSpan={4}>Total</td>
                    <td className="px-6 py-4 text-xs font-black text-slate-900 text-right">{formatCurrency(Math.round(hlvData.immediateNeeds + hlvData.expenseReplacement), currencyCountry)}</td>
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
                        <td className="px-4 py-3 text-xs font-bold text-slate-600 text-right">{loan.coverPct}%</td>
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
                <div className="flex justify-between text-xs font-bold"><span className="text-slate-500">Immediate Cash Needs</span><span className="text-slate-900">{formatCurrency(hlvData.immediateNeeds, currencyCountry)}</span></div>
                <div className="flex justify-between text-xs font-bold"><span className="text-slate-500">Income/Expense Replacement</span><span className="text-slate-900">{formatCurrency(Math.round(hlvData.expenseReplacement), currencyCountry)}</span></div>
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
                      <td className="px-4 py-3 text-xs font-bold text-slate-600 text-right">{goal.coverPct}%</td>
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
                      <td className="px-4 py-3 text-xs font-bold text-slate-600 text-right">{hlvData.assetCoveragePct}%</td>
                      <td className="px-4 py-3 text-xs font-black text-slate-900 text-right">{formatCurrency(Math.round(hlvData.assetCovered), currencyCountry)}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-xs font-bold text-slate-700">Personal Assets</td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-700 text-right">{formatCurrency(Math.round(hlvData.personalAssets), currencyCountry)}</td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-600 text-right">0%</td>
                      <td className="px-4 py-3 text-xs font-black text-slate-900 text-right">{formatCurrency(0, currencyCountry)}</td>
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
                <div className="flex justify-between text-xs font-bold"><span className="text-slate-500">Term Insurance</span><span className="text-slate-900">{formatCurrency(Math.round(hlvData.totalExistingInsurance), currencyCountry)}</span></div>
                <div className="flex justify-between text-sm font-black border-t border-slate-100 pt-3"><span className="text-slate-600">Total Cover</span><span className="text-slate-900">{formatCurrency(Math.round(hlvData.totalAvailable), currencyCountry)}</span></div>
                <div className={`flex justify-between text-sm font-black ${hlvData.gap < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  <span>Surplus / Deficit</span>
                  <span>{formatCurrency(Math.round(hlvData.gap), currencyCountry)}</span>
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
