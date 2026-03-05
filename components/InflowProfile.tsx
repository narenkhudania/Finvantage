
import React, { useState, useMemo } from 'react';
import { 
  Calculator, Briefcase, TrendingUp, Home, ChevronRight, 
  Users, ArrowUpRight, Wallet, Landmark, LineChart, 
  CheckCircle2, Plus, Coins, Sparkles, User, Edit3, PieChart
} from 'lucide-react';
import { FinanceState, DetailedIncome } from '../types';
import { clampNumber, parseNumber } from '../lib/validation';
import { formatCurrency, getCurrencySymbol } from '../lib/currency';
import { monthlyIncomeBreakdown, monthlyIncomeFromDetailed } from '../lib/incomeMath';
import PlanningAssistStrip from './common/PlanningAssistStrip';

interface InflowProfileProps {
  state: FinanceState;
  updateState: (data: Partial<FinanceState>) => void;
}

type IncomeInputConfig = {
  label: string;
  field: keyof DetailedIncome;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  min: number;
  max: number;
  helper: string;
};

const OPERATIONAL_FIELDS: IncomeInputConfig[] = [
  {
    label: 'Net Salary (Monthly)',
    field: 'salary',
    icon: Briefcase,
    min: 5000,
    max: 1000000,
    helper: 'Enter your net take-home amount per month.',
  },
  {
    label: 'Bonus (Yearly)',
    field: 'bonus',
    icon: Sparkles,
    min: 12000,
    max: 5000000,
    helper: 'Enter yearly bonus. We convert it to monthly (divide by 12).',
  },
  {
    label: 'Reimbursements (Yearly)',
    field: 'reimbursements',
    icon: Coins,
    min: 1200,
    max: 250000,
    helper: 'Enter yearly reimbursements. We convert them to monthly (divide by 12).',
  },
];

const PASSIVE_FIELDS: IncomeInputConfig[] = [
  {
    label: 'Rental Income (Monthly)',
    field: 'rental',
    icon: Home,
    min: 5000,
    max: 5000000,
    helper: 'Add recurring rental receipts.',
  },
  {
    label: 'Annual Dividends (Yearly)',
    field: 'investment',
    icon: TrendingUp,
    min: 1200,
    max: 2000000,
    helper: 'Enter yearly dividends/interest. We convert it to monthly (divide by 12).',
  },
  {
    label: 'Side Business (Monthly)',
    field: 'business',
    icon: Calculator,
    min: 5000,
    max: 5000000,
    helper: 'Add business or freelance income.',
  },
  {
    label: 'Pension (Monthly)',
    field: 'pension',
    icon: Landmark,
    min: 5000,
    max: 1500000,
    helper: 'Add pension credited on a recurring basis.',
  },
];

const InflowProfile: React.FC<InflowProfileProps> = ({ state, updateState }) => {
  const [editingId, setEditingId] = useState<'self' | string | null>(null);
  const [salaryShockPct, setSalaryShockPct] = useState(0);
  const [variableIncomeHaircutPct, setVariableIncomeHaircutPct] = useState(0);
  const [growthScenarioPct, setGrowthScenarioPct] = useState(
    Math.max(0, Math.round(Number(state.profile.income.expectedIncrease || 6))),
  );

  const members = useMemo(() => [
    { id: 'self', name: state.profile.firstName || 'Primary Member', relation: 'Self', income: state.profile.income },
    ...state.family.map(f => ({ id: f.id, name: f.name, relation: f.relation, income: f.income }))
  ], [state.profile, state.family]);

  const totalHouseholdInflow = useMemo(() => {
    return members.reduce((acc, m) => acc + monthlyIncomeFromDetailed(m.income), 0);
  }, [members]);

  const sanitizeDigits = (value: string) => value.replace(/[^\d]/g, '');

  const updateIncomeField = (id: string, field: keyof DetailedIncome, value: number | string) => {
    const sanitized = Math.max(0, parseNumber(value, 0));
    const finalValue =
      field === 'expectedIncrease'
        ? clampNumber(sanitized, 0, 25)
        : sanitized;
    if (id === 'self') {
      updateState({
        profile: { ...state.profile, income: { ...state.profile.income, [field]: finalValue } }
      });
    } else {
      updateState({
        family: state.family.map(f => f.id === id ? { ...f, income: { ...f.income, [field]: finalValue } } : f)
      });
    }
  };

  const getBracketError = (memberIncome: DetailedIncome, item: IncomeInputConfig) => {
    const raw = memberIncome[item.field];
    const value = Number(raw || 0);
    if (!Number.isFinite(value) || value <= 0) return null;
    if (value < item.min) {
      return `${item.label} is lower than the usual bracket (${formatCurrency(item.min, currencyCountry)} - ${formatCurrency(item.max, currencyCountry)}).`;
    }
    if (value > item.max) {
      return `${item.label} is higher than the usual bracket (${formatCurrency(item.min, currencyCountry)} - ${formatCurrency(item.max, currencyCountry)}).`;
    }
    return null;
  };

  const renderIncomeForm = (member: any) => (
    <div className="bg-slate-50 p-6 md:p-12 rounded-[3.5rem] border border-slate-200 animate-in slide-in-from-top-6 duration-500 space-y-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
         <h3 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-3"><Edit3 className="text-teal-600"/> Calibrate: {member.name}</h3>
         <button onClick={() => setEditingId(null)} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">Close Form</button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
        <div className="space-y-8">
           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Operational Core</h4>
           {OPERATIONAL_FIELDS.map(item => {
             const fieldError = getBracketError(member.income, item);
             return (
             <div key={item.field} className="space-y-2">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-2">{item.label}</label>
                <div className="relative group">
                   <item.icon className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-teal-600 transition-colors" size={18}/>
                   <input 
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={member.income[item.field] || ''} 
                    onChange={e => updateIncomeField(member.id, item.field, sanitizeDigits(e.target.value))}
                    className={`w-full bg-white border rounded-2xl px-12 md:px-14 py-3.5 md:py-4 font-black text-lg md:text-xl outline-none transition-all shadow-sm ${
                      fieldError ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200 focus:border-teal-600'
                    }`}
                    placeholder="0"
                   />
                </div>
                <p className={`text-[9px] font-bold ml-2 ${fieldError ? 'text-rose-500' : 'text-slate-400'}`}>
                  {fieldError || item.helper}
                </p>
             </div>
           );
           })}
        </div>
        <div className="space-y-8">
           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Passive & Secondary</h4>
           {PASSIVE_FIELDS.map(item => {
             const fieldError = getBracketError(member.income, item);
             return (
             <div key={item.field} className="space-y-2">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-2">{item.label}</label>
                <div className="relative group">
                   <item.icon className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-teal-600 transition-colors" size={18}/>
                   <input 
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={member.income[item.field] || ''} 
                    onChange={e => updateIncomeField(member.id, item.field, sanitizeDigits(e.target.value))}
                    className={`w-full bg-white border rounded-2xl px-12 md:px-14 py-3.5 md:py-4 font-black text-lg md:text-xl outline-none transition-all shadow-sm ${
                      fieldError ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200 focus:border-teal-600'
                    }`}
                    placeholder="0"
                   />
                </div>
                <p className={`text-[9px] font-bold ml-2 ${fieldError ? 'text-rose-500' : 'text-slate-400'}`}>
                  {fieldError || item.helper}
                </p>
             </div>
           );
           })}
        </div>
      </div>
    </div>
  );

  const editingMember = useMemo(() => {
    if (!editingId) return null;
    return members.find(m => m.id === editingId) || null;
  }, [editingId, members]);

  const currencyCountry = state.profile.country;
  const currencySymbol = getCurrencySymbol(currencyCountry);

  const inflowAnalysis = useMemo(() => {
    const inflationAssumption = Math.max(
      0,
      Number(state.discountSettings?.defaultInflationRate ?? state.insuranceAnalysis?.inflation ?? 6),
    );
    const aggregate = members.reduce((acc, member) => {
      const breakdown = monthlyIncomeBreakdown(member.income);
      acc.salary += breakdown.salary;
      acc.bonus += breakdown.bonus;
      acc.reimbursements += breakdown.reimbursements;
      acc.business += breakdown.business;
      acc.rental += breakdown.rental;
      acc.investment += breakdown.investment;
      acc.pension += breakdown.pension;
      return acc;
    }, {
      salary: 0,
      bonus: 0,
      reimbursements: 0,
      business: 0,
      rental: 0,
      investment: 0,
      pension: 0,
    });

    const fixedCore = aggregate.salary + aggregate.pension;
    const variablePool = aggregate.bonus + aggregate.reimbursements + aggregate.business + aggregate.rental + aggregate.investment;
    const stressedMonthly = Math.max(
      0,
      fixedCore * (1 + salaryShockPct / 100) + variablePool * (1 - variableIncomeHaircutPct / 100),
    );
    const projectedAnnual = stressedMonthly * 12 * (1 + growthScenarioPct / 100);
    const monthlyOutflow =
      state.detailedExpenses.reduce((sum, expense) => sum + Math.max(0, Number(expense.amount || 0)), 0)
      + state.loans.reduce((sum, loan) => sum + Math.max(0, Number(loan.emi || 0)), 0);
    const stressedSurplus = stressedMonthly - monthlyOutflow;
    const liquidReserves = state.assets
      .filter(asset => asset.availableForGoals && (asset.category === 'Liquid' || asset.category === 'Debt'))
      .reduce((sum, asset) => sum + Math.max(0, Number(asset.currentValue || 0)), 0);
    const runwayMonths = monthlyOutflow > 0 ? liquidReserves / monthlyOutflow : 0;

    const biggestContributor = members
      .map(member => ({ name: member.name, monthly: monthlyIncomeFromDetailed(member.income) }))
      .sort((a, b) => b.monthly - a.monthly)[0];

    const sourceRows = [
      { label: 'Salary + Pension', value: fixedCore },
      { label: 'Bonus + Reimbursements', value: aggregate.bonus + aggregate.reimbursements },
      { label: 'Rental + Dividends', value: aggregate.rental + aggregate.investment },
      { label: 'Business', value: aggregate.business },
    ].filter(row => row.value > 0);
    const topSource = sourceRows.reduce((top, row) => (!top || row.value > top.value ? row : top), null as { label: string; value: number } | null);
    const sourceConcentrationPct = topSource && totalHouseholdInflow > 0 ? (topSource.value / totalHouseholdInflow) * 100 : 0;
    const sourceHhiPct = sourceRows.reduce((sum, row) => {
      const share = totalHouseholdInflow > 0 ? row.value / totalHouseholdInflow : 0;
      return sum + share * share;
    }, 0) * 100;
    const annualNormalizedMonthly = aggregate.bonus + aggregate.reimbursements + aggregate.investment;
    const growthInflationGap = growthScenarioPct - inflationAssumption;
    const incomeVolatilityScore = Math.min(100, Math.max(0, (variablePool / (totalHouseholdInflow || 1)) * 100));
    const planningImpact = members
      .filter(member => member.id !== 'self')
      .map(member => {
        const monthly = monthlyIncomeFromDetailed(member.income);
        const familyMember = state.family.find(f => f.id === member.id);
        const included = Boolean(familyMember && !familyMember.isDependent && (familyMember.includeIncomeInPlanning ?? false));
        return {
          id: member.id,
          name: member.name,
          included,
          monthly,
        };
      })
      .filter(item => item.monthly > 0);
    const planningIncludedIncome = planningImpact.filter(item => item.included).reduce((sum, item) => sum + item.monthly, 0);
    const planningExcludedIncome = planningImpact.filter(item => !item.included).reduce((sum, item) => sum + item.monthly, 0);

    return {
      aggregate,
      fixedCore,
      variablePool,
      stressedMonthly,
      projectedAnnual,
      monthlyOutflow,
      stressedSurplus,
      liquidReserves,
      runwayMonths,
      biggestContributor,
      sourceRows,
      topSource,
      sourceConcentrationPct,
      sourceHhiPct,
      annualNormalizedMonthly,
      growthInflationGap,
      inflationAssumption,
      incomeVolatilityScore,
      planningImpact,
      planningIncludedIncome,
      planningExcludedIncome,
      variableSharePct: totalHouseholdInflow > 0 ? (variablePool / totalHouseholdInflow) * 100 : 0,
      fixedSharePct: totalHouseholdInflow > 0 ? (fixedCore / totalHouseholdInflow) * 100 : 0,
    };
  }, [
    members,
    salaryShockPct,
    variableIncomeHaircutPct,
    growthScenarioPct,
    state.detailedExpenses,
    state.loans,
    state.assets,
    state.family,
    state.discountSettings?.defaultInflationRate,
    state.insuranceAnalysis?.inflation,
    totalHouseholdInflow,
  ]);

  const inflowAssistStats = useMemo(() => {
    const growthGapTone = inflowAnalysis.growthInflationGap >= 0 ? 'positive' : 'critical';
    const runwayTone = inflowAnalysis.runwayMonths >= 12
      ? 'positive'
      : inflowAnalysis.runwayMonths >= 6
        ? 'warning'
        : 'critical';

    return [
      {
        label: 'Monthly Inflow',
        value: formatCurrency(totalHouseholdInflow, currencyCountry),
        tone: 'positive',
      },
      {
        label: 'Variable Share',
        value: `${inflowAnalysis.variableSharePct.toFixed(1)}%`,
        tone: inflowAnalysis.variableSharePct <= 35 ? 'positive' : 'warning',
      },
      {
        label: 'Runway',
        value: `${inflowAnalysis.runwayMonths.toFixed(1)} months`,
        tone: runwayTone,
      },
      {
        label: 'Growth - Inflation',
        value: `${inflowAnalysis.growthInflationGap >= 0 ? '+' : ''}${inflowAnalysis.growthInflationGap.toFixed(1)}%`,
        tone: growthGapTone,
      },
      {
        label: 'Volatility Score',
        value: `${inflowAnalysis.incomeVolatilityScore.toFixed(1)} / 100`,
        tone: inflowAnalysis.incomeVolatilityScore <= 40 ? 'positive' : 'warning',
      },
    ] as const;
  }, [inflowAnalysis, totalHouseholdInflow, currencyCountry]);

  return (
    <div className="space-y-8 md:space-y-12 animate-in fade-in duration-700 pb-24">
      <PlanningAssistStrip
        title="Normalize and stress-test household income"
        description="Annual inflows are converted to monthly equivalents so cash-flow and goal funding stay comparable."
        tip="Update only changed fields during salary revisions to keep trend analysis stable."
        stats={inflowAssistStats.map((stat) => ({
          label: stat.label,
          value: stat.value,
          tone: stat.tone,
        }))}
      />

      {/* Member Contribution Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
           <div className="bg-white rounded-[2.5rem] md:rounded-[4rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 md:px-12 py-6 md:py-8 bg-slate-50/50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                 <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Node Contributions</h3>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{members.length} Active Earners</p>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden p-6 space-y-4">
                {members.map(m => {
                  const mTotal = monthlyIncomeFromDetailed(m.income);
                  const share = (mTotal / (totalHouseholdInflow || 1)) * 100;
                  return (
                    <div key={m.id} className="border border-slate-200 rounded-3xl p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400"><User size={20}/></div>
                          <div>
                            <p className="text-sm font-black text-slate-900">{m.name}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{m.relation}</p>
                          </div>
                        </div>
                        <button onClick={() => setEditingId(m.id)} className="p-2.5 bg-slate-100 text-slate-400 hover:bg-teal-600 hover:text-white rounded-xl transition-all shadow-sm"><Edit3 size={16}/></button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Monthly Inflow</p>
                          <p className="text-lg font-black text-slate-900">{formatCurrency(mTotal, currencyCountry)}</p>
                        </div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 text-teal-600 rounded-full text-[10px] font-black border border-teal-100">{share.toFixed(1)}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto no-scrollbar">
                 <table className="w-full text-left min-w-[720px]">
                    <thead>
                       <tr className="bg-white">
                          <th className="px-8 md:px-12 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Earner Name</th>
                          <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Relation</th>
                          <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Inflow ({currencySymbol})</th>
                          <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Share</th>
                          <th className="px-8 md:px-12 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {members.map(m => {
                          const mTotal = monthlyIncomeFromDetailed(m.income);
                          const share = (mTotal / (totalHouseholdInflow || 1)) * 100;
                          return (
                             <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-8 md:px-12 py-6">
                                   <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400"><User size={20}/></div>
                                      <span className="text-sm font-black text-slate-900">{m.name}</span>
                                   </div>
                                </td>
                                <td className="px-6 py-6 text-[10px] font-bold text-slate-500 uppercase">{m.relation}</td>
                                <td className="px-6 py-6 text-sm font-black text-slate-900 text-right">{formatCurrency(mTotal, currencyCountry)}</td>
                                <td className="px-6 py-6 text-center">
                                   <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 text-teal-600 rounded-full text-[10px] font-black border border-teal-100">{share.toFixed(1)}%</div>
                                </td>
                                <td className="px-8 md:px-12 py-6 text-right">
                                   <button onClick={() => setEditingId(m.id)} className="p-2.5 bg-slate-100 text-slate-400 hover:bg-teal-600 hover:text-white rounded-xl transition-all shadow-sm"><Edit3 size={16}/></button>
                                </td>
                             </tr>
                          );
                       })}
                    </tbody>
                 </table>
              </div>
           </div>
           
           {editingMember ? renderIncomeForm(editingMember) : null}
        </div>

        <div className="space-y-8">
           <div className="surface-dark p-10 rounded-[3.5rem] text-white space-y-10 relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-teal-600/10 blur-[80px] rounded-full translate-x-1/2 -translate-y-1/2" />
              <div className="space-y-2 relative z-10">
                 <h3 className="text-2xl font-black tracking-tight">Diversification Pool.</h3>
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Inflow Concentration Audit</p>
              </div>
              
              <div className="space-y-6 relative z-10">
                 {[
                   {
                     label: 'Operational Core',
                     val: members.reduce((s, m) => {
                       const b = monthlyIncomeBreakdown(m.income);
                       return s + b.salary + b.bonus + b.reimbursements;
                     }, 0),
                     color: '#0f766e'
                   },
                   {
                     label: 'Passive Yields',
                     val: members.reduce((s, m) => {
                       const b = monthlyIncomeBreakdown(m.income);
                       return s + b.rental + b.investment + b.pension;
                     }, 0),
                     color: '#10b981'
                   },
                   { label: 'Side/Business', val: members.reduce((s, m) => s + (m.income.business || 0), 0), color: '#f59e0b' }
                 ].map((pool, i) => (
                    <div key={i} className="space-y-2">
                       <div className="flex justify-between items-end">
                          <span className="text-[10px] font-black uppercase text-slate-400">{pool.label}</span>
                          <span className="text-sm font-black">{formatCurrency(pool.val, currencyCountry)}</span>
                       </div>
                       <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full transition-all duration-1000" style={{ width: `${(pool.val / (totalHouseholdInflow || 1)) * 100}%`, backgroundColor: pool.color }} />
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_1fr] gap-6">
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6 text-left">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Income Analysis Lab</p>
              <h3 className="text-2xl font-black text-slate-900">Stress Test Your Inflow</h3>
            </div>
            <div className="px-3 py-2 rounded-2xl border border-slate-200 bg-slate-50 text-right">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Variable share</p>
              <p className="text-lg font-black text-slate-900">{inflowAnalysis.variableSharePct.toFixed(1)}%</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Salary shock</label>
                <span className="text-sm font-black text-slate-900">{salaryShockPct}%</span>
              </div>
              <input
                type="range"
                min={-40}
                max={20}
                step={1}
                value={salaryShockPct}
                onChange={(event) => setSalaryShockPct(Number(event.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-full appearance-none accent-teal-600 cursor-pointer"
              />
            </div>
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Variable haircut</label>
                <span className="text-sm font-black text-slate-900">{variableIncomeHaircutPct}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={80}
                step={1}
                value={variableIncomeHaircutPct}
                onChange={(event) => setVariableIncomeHaircutPct(Number(event.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-full appearance-none accent-amber-500 cursor-pointer"
              />
            </div>
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Growth assumption</label>
                <span className="text-sm font-black text-slate-900">{growthScenarioPct}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                step={1}
                value={growthScenarioPct}
                onChange={(event) => setGrowthScenarioPct(Number(event.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-full appearance-none accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Stressed monthly inflow</p>
              <p className="text-lg font-black text-slate-900 mt-1">{formatCurrency(inflowAnalysis.stressedMonthly, currencyCountry)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Projected annual inflow</p>
              <p className="text-lg font-black text-slate-900 mt-1">{formatCurrency(inflowAnalysis.projectedAnnual, currencyCountry)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Stressed monthly surplus</p>
              <p className={`text-lg font-black mt-1 ${inflowAnalysis.stressedSurplus >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatCurrency(inflowAnalysis.stressedSurplus, currencyCountry)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Liquidity runway</p>
              <p className="text-lg font-black text-slate-900 mt-1">{inflowAnalysis.runwayMonths.toFixed(1)} months</p>
            </div>
          </div>
        </div>

        <div className="surface-dark p-6 md:p-8 rounded-[2.5rem] text-white space-y-5 shadow-xl text-left">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Depth Signals</p>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Source concentration risk</p>
            <p className="text-xl font-black text-teal-400 mt-1">
              {inflowAnalysis.sourceConcentrationPct.toFixed(1)}%
            </p>
            <p className="text-xs font-semibold text-slate-300 mt-1">
              HHI: {inflowAnalysis.sourceHhiPct.toFixed(1)} (higher means concentration risk).
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Annual-to-month normalized</p>
            <p className="text-lg font-black text-slate-100 mt-1">
              {formatCurrency(inflowAnalysis.annualNormalizedMonthly, currencyCountry)} / month
            </p>
            <p className="text-xs font-semibold text-slate-300 mt-1">
              Bonus, reimbursements, and dividends converted from annual values.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Growth vs inflation gap</p>
            <p className={`text-lg font-black mt-1 ${inflowAnalysis.growthInflationGap >= 0 ? 'text-emerald-400' : 'text-rose-300'}`}>
              {inflowAnalysis.growthInflationGap >= 0 ? '+' : ''}{inflowAnalysis.growthInflationGap.toFixed(1)}%
            </p>
            <p className="text-xs font-semibold text-slate-300 mt-1">
              Growth {growthScenarioPct}% vs inflation {inflowAnalysis.inflationAssumption.toFixed(1)}%.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Income volatility score</p>
            <p className="text-lg font-black text-amber-300 mt-1">
              {inflowAnalysis.incomeVolatilityScore.toFixed(1)} / 100
            </p>
            <p className="text-xs font-semibold text-slate-300 mt-1">
              Based on variable share of total income.
            </p>
          </div>
          <div className="space-y-4">
            {inflowAnalysis.sourceRows.map(row => (
              <div key={row.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <span>{row.label}</span>
                  <span>{formatCurrency(row.value, currencyCountry)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-teal-400"
                    style={{ width: `${Math.min(100, (row.value / (totalHouseholdInflow || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Key insight</p>
            <p className="text-sm font-semibold text-slate-200">
              {inflowAnalysis.topSource
                ? `${inflowAnalysis.topSource.label} is your largest income engine.`
                : 'Add income data to unlock concentration insights.'}
            </p>
            <p className="text-sm font-semibold text-slate-200">
              {inflowAnalysis.biggestContributor
                ? `${inflowAnalysis.biggestContributor.name} contributes ${formatCurrency(inflowAnalysis.biggestContributor.monthly, currencyCountry)} per month.`
                : 'No contributor data yet.'}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Consider in planning impact</p>
            <p className="text-xs font-semibold text-slate-200">
              Included: {formatCurrency(inflowAnalysis.planningIncludedIncome, currencyCountry)} • Excluded: {formatCurrency(inflowAnalysis.planningExcludedIncome, currencyCountry)}
            </p>
            {inflowAnalysis.planningImpact.slice(0, 3).map(item => (
              <div key={item.id} className="flex items-center justify-between text-xs text-slate-200">
                <span>{item.name}</span>
                <span className={`font-black ${item.included ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {item.included ? 'Included' : 'Excluded'} · {formatCurrency(item.monthly, currencyCountry)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InflowProfile;
