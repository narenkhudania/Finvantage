
import React, { useMemo, useState } from 'react';
import { 
  Zap, ShieldAlert, Target, TrendingUp, 
  ArrowRight, CheckCircle2, AlertCircle, Sparkles,
  ArrowUpRight, ListChecks, Wallet, Activity, ArrowDownToLine,
  ChevronRight, ShieldCheck, Clock, Gauge, BarChart3, Lock
} from 'lucide-react';
import { FinanceState, DetailedIncome } from '../types';

interface Action {
  id: number;
  priority: 'Critical' | 'Strategic' | 'Maintenance';
  title: string;
  description: string;
  impact: string;
  delta: string;
  tactics: string[];
  icon: any;
  color: string;
  status: 'pending' | 'completed';
}

const ActionPlan: React.FC<{ state: FinanceState }> = ({ state }) => {
  const [completedIds, setCompletedIds] = useState<number[]>([]);

  const formatCurrency = (value: number) => Math.max(0, Math.round(value)).toLocaleString();

  const sumIncome = (income: DetailedIncome) => (
    (income.salary || 0) +
    (income.bonus || 0) +
    (income.reimbursements || 0) +
    (income.business || 0) +
    (income.rental || 0) +
    (income.investment || 0)
  );

  const calculations = useMemo(() => {
    const selfIncome = sumIncome(state.profile.income);
    const familyIncome = state.family.reduce((sum, member) => sum + sumIncome(member.income), 0);
    const monthlyIncome = selfIncome + familyIncome;

    const monthlyExpenses = state.detailedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0) || (state.profile.monthlyExpenses || 0);
    const monthlyDebt = state.loans.reduce((sum, loan) => sum + (loan.emi || 0), 0);
    const monthlyCommitments = monthlyExpenses + monthlyDebt;
    const monthlySurplus = monthlyIncome - monthlyCommitments;

    const safeIncome = monthlyIncome || 1;
    const survivalRatio = Math.min(100, Math.max(0, (monthlyExpenses / safeIncome) * 100));
    const debtRatio = Math.min(100, Math.max(0, (monthlyDebt / safeIncome) * 100));
    const successRatio = Math.min(100, Math.max(0, (Math.max(0, monthlySurplus) / safeIncome) * 100));
    const deficit = monthlySurplus < 0 ? Math.abs(monthlySurplus * 12) : 0;

    const liquidAssets = state.assets
      .filter(asset => ['Liquid', 'Equity', 'Debt'].includes(asset.category))
      .reduce((sum, asset) => sum + (asset.currentValue || 0), 0);
    const emergencyMonths = monthlyCommitments > 0 ? liquidAssets / monthlyCommitments : 0;

    const analysis = state.insuranceAnalysis ?? {
      inflation: 6,
      investmentRate: 11.5,
      replacementYears: 20,
      immediateNeeds: 1000000,
      financialAssetDiscount: 50,
    };
    const realRate = ((1 + analysis.investmentRate / 100) / (1 + analysis.inflation / 100)) - 1;
    const annualExpenses = monthlyExpenses * 12;
    const pvFactor = realRate > 0
      ? (1 - Math.pow(1 + realRate, -analysis.replacementYears)) / realRate
      : analysis.replacementYears;
    const expenseReplacement = annualExpenses * pvFactor;
    const totalDebt = state.loans.reduce((sum, loan) => sum + (loan.outstandingAmount || 0), 0);
    const goalRequirements = state.goals.reduce((sum, goal) => sum + (goal.targetAmountToday || 0) * (goal.type === 'Retirement' ? 0.6 : 1), 0);
    const totalExistingInsurance = state.insurance
      .filter(policy => policy.category === 'Life Insurance')
      .reduce((sum, policy) => sum + (policy.sumAssured || 0), 0);
    const usableAssets = liquidAssets * (analysis.financialAssetDiscount / 100);
    const totalRequirement = analysis.immediateNeeds + expenseReplacement + totalDebt + goalRequirements;
    const totalAvailable = totalExistingInsurance + usableAssets;
    const insuranceGap = Math.max(0, totalRequirement - totalAvailable);

    return {
      monthlyIncome,
      monthlyExpenses,
      monthlyDebt,
      monthlyCommitments,
      monthlySurplus,
      survivalRatio,
      debtRatio,
      successRatio,
      deficit,
      emergencyMonths,
      insuranceGap,
      liquidAssets,
    };
  }, [state]);

  const actions: Action[] = useMemo(() => {
    const list: Action[] = [];
    const ids = {
      deficit: 1,
      emergency: 2,
      debt: 3,
      insurance: 4,
      savings: 5,
      goals: 6,
      risk: 7,
      income: 8,
    };

    const monthlyIncome = calculations.monthlyIncome;
    const monthlySurplus = calculations.monthlySurplus;
    const monthlyDebt = calculations.monthlyDebt;

    if (monthlyIncome <= 0) {
      list.push({
        id: ids.income,
        priority: 'Critical',
        title: 'Add Primary Income Stream',
        description: 'Household income is not recorded yet. The plan engine needs a baseline inflow to forecast accurately.',
        impact: 'Unlocks Full Planning',
        delta: 'Income Baseline',
        tactics: [
          'Update salary or business inflow in Inflow Profile',
          'Add family members with income if applicable',
          'Confirm monthly reimbursements or rental inflow'
        ],
        icon: TrendingUp,
        color: 'teal',
        status: 'pending'
      });
    }

    if (monthlySurplus < 0) {
      const deficitMonthly = Math.abs(monthlySurplus);
      list.push({
        id: ids.deficit,
        priority: 'Critical',
        title: 'Eliminate Cashflow Leakage',
        description: `Monthly outflow exceeds inflow by ₹${formatCurrency(deficitMonthly)}. This deficit erodes your safety buffer.`,
        impact: 'Stops Capital Erosion',
        delta: `+₹${formatCurrency(deficitMonthly)}/mo`,
        tactics: [
          'Cap discretionary spend at 15% of inflow',
          'Restructure high-interest EMIs first',
          'Add a short-term income stream to close the gap'
        ],
        icon: ShieldAlert,
        color: 'rose',
        status: 'pending'
      });
    }

    if (calculations.monthlyCommitments > 0 && calculations.emergencyMonths < 6) {
      const targetBuffer = calculations.monthlyCommitments * 6;
      const bufferGap = Math.max(0, targetBuffer - calculations.liquidAssets);
      list.push({
        id: ids.emergency,
        priority: calculations.emergencyMonths < 3 ? 'Critical' : 'Strategic',
        title: 'Build Emergency Buffer',
        description: `Liquid assets cover ${calculations.emergencyMonths.toFixed(1)} months. Target 6 months for resilience.`,
        impact: 'Protects Downside',
        delta: `₹${formatCurrency(bufferGap)} buffer`,
        tactics: [
          'Auto-sweep surplus into liquid funds',
          'Pause low-priority goals until buffer is complete',
          'Maintain buffer in low-volatility instruments'
        ],
        icon: ShieldCheck,
        color: calculations.emergencyMonths < 3 ? 'rose' : 'amber',
        status: 'pending'
      });
    }

    if (state.loans.length > 0 && calculations.debtRatio > 20) {
      const highestInterestLoan = state.loans.reduce((top, loan) => (
        loan.interestRate > top.interestRate ? loan : top
      ), state.loans[0]);
      list.push({
        id: ids.debt,
        priority: calculations.debtRatio > 35 ? 'Critical' : 'Strategic',
        title: 'Reduce Debt Load',
        description: `Debt servicing consumes ${Math.round(calculations.debtRatio)}% of income. Prioritize ${highestInterestLoan.type} at ${highestInterestLoan.interestRate}% interest.`,
        impact: 'Boosts Savings Rate',
        delta: `₹${formatCurrency(monthlyDebt)}/mo freed`,
        tactics: [
          'Prepay highest-interest debt first',
          'Explore refinancing if rate > 12%',
          'Redirect freed EMI into investments'
        ],
        icon: Target,
        color: calculations.debtRatio > 35 ? 'rose' : 'amber',
        status: 'pending'
      });
    }

    if (calculations.insuranceGap > 0) {
      list.push({
        id: ids.insurance,
        priority: 'Strategic',
        title: 'Close Protection Gap',
        description: `Current coverage falls short by ₹${formatCurrency(calculations.insuranceGap)} based on HLV needs.`,
        impact: 'Secures Family Goals',
        delta: `₹${formatCurrency(calculations.insuranceGap)} cover`,
        tactics: [
          'Top up term cover for primary earner',
          'Verify employer cover and nominations',
          'Align coverage with debt + goals'
        ],
        icon: ShieldCheck,
        color: 'teal',
        status: 'pending'
      });
    }

    if (monthlySurplus > 0 && calculations.successRatio < 20) {
      const targetSavings = monthlyIncome * 0.2;
      const gap = Math.max(0, targetSavings - monthlySurplus);
      list.push({
        id: ids.savings,
        priority: 'Strategic',
        title: 'Increase Savings Rate',
        description: `Current savings rate is ${calculations.successRatio.toFixed(1)}%. Lift to 20% for faster goal funding.`,
        impact: 'Accelerates Goals',
        delta: `+₹${formatCurrency(gap)}/mo`,
        tactics: [
          'Increase SIPs in line with inflow growth',
          'Cap lifestyle upgrades until 20% savings achieved',
          'Review recurring expenses quarterly'
        ],
        icon: Wallet,
        color: 'teal',
        status: 'pending'
      });
    }

    if (state.goals.length === 0) {
      list.push({
        id: ids.goals,
        priority: 'Maintenance',
        title: 'Define Life Goals',
        description: 'Goal targets are missing. Adding goals enables funding strategy and timeline projections.',
        impact: 'Unlocks Roadmap',
        delta: 'Goals Created',
        tactics: [
          'Add 2–3 near-term goals',
          'Define long-term retirement target',
          'Assign priorities for funding order'
        ],
        icon: ListChecks,
        color: 'emerald',
        status: 'pending'
      });
    }

    if (!state.riskProfile) {
      list.push({
        id: ids.risk,
        priority: 'Maintenance',
        title: 'Complete Risk Profile',
        description: 'Risk identity is missing. Complete it to align investment allocation and volatility tolerance.',
        impact: 'Portfolio Alignment',
        delta: 'Risk DNA Set',
        tactics: [
          'Answer the risk calibration questionnaire',
          'Review recommended allocation mix',
          'Update annually or after life events'
        ],
        icon: Activity,
        color: 'emerald',
        status: 'pending'
      });
    }

    if (list.length === 0) {
      list.push({
        id: 99,
        priority: 'Maintenance',
        title: 'Maintain Momentum',
        description: 'All core systems look healthy. Keep tracking monthly to stay on course.',
        impact: 'Stability Preserved',
        delta: 'On Track',
        tactics: [
          'Review allocations quarterly',
          'Audit expenses every 30 days',
          'Update goals after major milestones'
        ],
        icon: Sparkles,
        color: 'emerald',
        status: 'pending'
      });
    }

    const priorityOrder = { Critical: 0, Strategic: 1, Maintenance: 2 };
    return list.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }, [calculations, state]);

  const completionRate = Math.round((completedIds.length / actions.length) * 100) || 0;
  const focusAction = actions[0];

  const toggleComplete = (id: number) => {
    setCompletedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-1000 pb-24">
      {/* Strategic Header Terminal */}
      <div className="surface-dark p-10 md:p-20 rounded-[4rem] text-white relative overflow-hidden shadow-2xl border border-white/5">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-teal-600/10 blur-[180px] rounded-full translate-x-1/3 -translate-y-1/3" />
        
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-12">
          <div className="space-y-8 text-left max-w-2xl">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-teal-500/10 text-teal-400 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-teal-500/20">
              <Zap size={14} className="animate-pulse" /> Operational Command
            </div>
            <h2 className="text-5xl md:text-8xl font-black tracking-tighter leading-[0.85]">Strategic <br/><span className="text-teal-500">Maneuvers.</span></h2>
            <p className="text-slate-400 text-lg md:text-xl font-medium leading-relaxed">
              Targeted implementations to reach <span className="text-white">Financial Sovereignty</span>. Current focus: <span className={`${focusAction?.priority === 'Critical' ? 'text-rose-400' : 'text-teal-400'}`}>{focusAction?.title || 'Momentum Maintenance'}.</span>
            </p>
          </div>
          
          <div className="flex flex-col gap-6 w-full lg:w-auto">
            <div className="bg-white/[0.03] border border-white/10 p-10 rounded-[3rem] backdrop-blur-xl flex flex-col items-center gap-4 shadow-inner min-w-[340px]">
               <div className="relative w-32 h-32">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/5" />
                    <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray="364.4" strokeDashoffset={364.4 - (364.4 * completionRate) / 100} className="text-teal-500 transition-all duration-1000 ease-out" strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black">{completionRate}%</span>
                    <span className="text-[8px] font-black text-slate-500 uppercase">Ready</span>
                  </div>
               </div>
               <p className="text-[10px] font-black text-teal-400 uppercase tracking-widest">Sovereignty Score</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Checklist */}
        <div className="lg:col-span-8 space-y-6">
           <div className="flex items-center justify-between px-2 mb-4">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">Critical Path Checklist</h3>
              <div className="flex gap-4">
                <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase"><Clock size={12}/> Q1 Focus</span>
              </div>
           </div>

           {actions.map((action) => {
             const isDone = completedIds.includes(action.id);
             return (
               <div key={action.id} className={`group bg-white p-8 md:p-12 rounded-[3.5rem] border transition-all duration-500 flex flex-col md:flex-row gap-10 items-start ${isDone ? 'border-emerald-200 opacity-60' : 'border-slate-200 hover:border-teal-400 shadow-sm hover:shadow-xl hover:-translate-y-1'}`}>
                  <div className={`p-6 rounded-[2rem] shrink-0 transition-all duration-500 ${isDone ? 'bg-emerald-50 text-emerald-500' : `bg-${action.color}-50 text-${action.color}-600 group-hover:bg-${action.color}-600 group-hover:text-white`}`}>
                    {isDone ? <CheckCircle2 size={32} /> : <action.icon size={32} />}
                  </div>
                  
                  <div className="flex-1 space-y-6 text-left">
                    <div className="flex flex-wrap items-center gap-3">
                       <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${isDone ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : `bg-${action.color}-50 text-${action.color}-600 border-${action.color}-100`}`}>
                         {action.priority}
                       </span>
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                         <TrendingUp size={12} className="text-teal-400"/> {action.impact}
                       </span>
                    </div>
                    
                    <div className="space-y-3">
                       <h4 className={`text-2xl font-black tracking-tight ${isDone ? 'line-through text-slate-400' : 'text-slate-900'}`}>{action.title}</h4>
                       <p className="text-sm font-medium text-slate-500 leading-relaxed max-w-xl">{action.description}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       {action.tactics.map((tactic, i) => (
                         <div key={i} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 group/tactic hover:border-teal-200 transition-all">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover/tactic:bg-teal-500 transition-colors" />
                            <span className="text-xs font-bold text-slate-600">{tactic}</span>
                         </div>
                       ))}
                    </div>
                  </div>

                  <div className="w-full md:w-auto flex flex-col gap-4 shrink-0">
                    <div className="p-6 surface-dark rounded-[2.5rem] text-center border border-white/5">
                       <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Wealth Delta</p>
                       <p className="text-xl font-black text-teal-400">{action.delta}</p>
                    </div>
                    <button 
                      onClick={() => toggleComplete(action.id)}
                      className={`w-full py-5 rounded-[2rem] font-black text-[10px] uppercase tracking-widest transition-all ${isDone ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-900 hover:bg-slate-900 hover:text-white'}`}
                    >
                      {isDone ? 'Implementation Verified' : 'Mark Completed'}
                    </button>
                  </div>
               </div>
             );
           })}
        </div>

        {/* Tactical Metrics Sidebar */}
        <div className="lg:col-span-4 space-y-8">
           <div className="surface-dark p-10 rounded-[4rem] text-white space-y-10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-teal-600/10 blur-[80px] rounded-full translate-x-1/2 -translate-y-1/2" />
              <div className="space-y-2 relative z-10 text-left">
                 <h3 className="text-2xl font-black flex items-center gap-3 italic tracking-tight"><BarChart3 className="text-teal-500" size={24}/> Engine Health</h3>
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Real-time Load Balancing</p>
              </div>
              
              <div className="space-y-8 relative z-10">
                   {[
                   { label: 'Survival Load', val: calculations.survivalRatio, color: '#f59e0b' },
                   { label: 'Servicing Drag', val: calculations.debtRatio, color: '#ef4444' },
                   { label: 'Success Velocity', val: calculations.successRatio, color: '#0f766e' }
                 ].map((stat, i) => (
                   <div key={i} className="space-y-2">
                      <div className="flex justify-between items-end">
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</span>
                         <span className="text-sm font-black">{Math.round(stat.val)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                         <div className="h-full transition-all duration-1000" style={{ width: `${Math.min(100, Math.max(0, stat.val))}%`, backgroundColor: stat.color }} />
                      </div>
                   </div>
                 ))}
              </div>

              <div className="pt-8 border-t border-white/5 space-y-6 relative z-10 text-left">
                 <div className="p-6 bg-white/5 rounded-[2.5rem] border border-white/10 flex items-center gap-4">
                    <div className="p-3 bg-rose-500/20 text-rose-400 rounded-2xl"><ShieldAlert size={20}/></div>
                    <div>
                       <p className="text-[9px] font-black text-slate-500 uppercase">Annual Deficit</p>
                       <p className="text-xl font-black text-rose-500">₹{formatCurrency(calculations.deficit)}</p>
                    </div>
                 </div>
                 <p className="text-[10px] font-medium text-slate-400 leading-relaxed italic">"A success velocity above 20% compounds your long-term trajectory faster than any other lever."</p>
              </div>
           </div>

           <div className="bg-white p-10 rounded-[4rem] border border-slate-200 shadow-sm flex flex-col gap-6 text-left">
              <div className="p-4 bg-teal-50 text-teal-600 rounded-[1.5rem] w-fit shadow-inner"><Lock size={24}/></div>
              <h4 className="text-xl font-black tracking-tight">Actuarial Lock</h4>
              <p className="text-sm font-medium text-slate-500 leading-relaxed">Implementing these 3 actions locks in a <span className="text-emerald-500 font-bold">14.2% higher</span> terminal wealth projection at year 15.</p>
              <button className="w-full py-5 bg-teal-600 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-teal-700 transition-all flex items-center justify-center gap-2">Download Strategy PDF <ArrowRight size={14}/></button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default ActionPlan;
