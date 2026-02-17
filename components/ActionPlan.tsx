
import React, { useMemo, useState } from 'react';
import { 
  Zap, ShieldAlert, Target, TrendingUp, 
  ArrowRight, CheckCircle2, AlertCircle, Sparkles,
  ArrowUpRight, ListChecks, Wallet, Activity, ArrowDownToLine,
  ChevronRight, ShieldCheck, Clock, Gauge, BarChart3, Lock
} from 'lucide-react';
import { FinanceState } from '../types';

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

  const calculations = useMemo(() => {
    const monthlyIncome = (state.profile.income.salary || 0) + (state.profile.income.investment || 0);
    const yearlyInflow = monthlyIncome * 12;
    
    const livingExpensesPa = (state.profile.monthlyExpenses || 0) * 12;
    const committedSavingsPa = 1020000; 
    const repaymentsPa = state.loans.reduce((acc, l) => acc + (l.emi * 12), 0) || 1080000;
    
    const totalOutflowPa = livingExpensesPa + committedSavingsPa + repaymentsPa;
    const deficit = totalOutflowPa - yearlyInflow;

    return {
      monthlyIncome,
      deficit,
      outflowRatio: (totalOutflowPa / yearlyInflow) * 100,
      investmentRatio: (committedSavingsPa / yearlyInflow) * 100,
      debtRatio: (repaymentsPa / yearlyInflow) * 100
    };
  }, [state]);

  const actions: Action[] = [
    {
      id: 1,
      priority: 'Critical',
      title: 'Eliminate Cashflow Leakage',
      description: 'The ₹70k annual deficit is eroding your emergency buffer. Re-partitioning core liquidity is required.',
      impact: 'Stops Capital Erosion',
      delta: '+₹70k/yr',
      tactics: [
        'Cap discretionary lifestyle spend at 15% of inflow',
        'Consolidate high-interest Personal Loans',
        'Automate transfer to "Success Silo"'
      ],
      icon: ShieldAlert,
      color: 'rose',
      status: 'pending'
    },
    {
      id: 2,
      priority: 'Strategic',
      title: 'Skoda Debt Zeroing',
      description: 'Accelerate the closure of the car loan to reclaim ₹2.4L in annual servicing capacity.',
      impact: 'Boosts Savings Rate',
      delta: '18mo Payoff',
      tactics: [
        'Allocate annual bonuses to Skoda principal',
        'Redirect EMI to Equity SIP post-closure',
        'Improve Debt-to-Income by 12%'
      ],
      icon: Target,
      color: 'indigo',
      status: 'pending'
    },
    {
      id: 3,
      priority: 'Maintenance',
      title: 'Tax Shield Optimization',
      description: 'NPS and 80C pathways are underutilized. Strategic re-routing of funds can save ₹45k in tax.',
      impact: 'Tax Alpha Generation',
      delta: '+₹45k Tax Saved',
      tactics: [
        'Initialize NPS Tier-1 contribution',
        'Verify ELSS limits for current FY',
        'Update medical insurance under 80D'
      ],
      icon: ShieldCheck,
      color: 'emerald',
      status: 'pending'
    }
  ];

  const completionRate = Math.round((completedIds.length / actions.length) * 100);

  const toggleComplete = (id: number) => {
    setCompletedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-1000 pb-24">
      {/* Strategic Header Terminal */}
      <div className="bg-[#05070a] p-10 md:p-20 rounded-[4rem] text-white relative overflow-hidden shadow-2xl border border-white/5">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-indigo-600/10 blur-[180px] rounded-full translate-x-1/3 -translate-y-1/3" />
        
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-12">
          <div className="space-y-8 text-left max-w-2xl">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-indigo-500/10 text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-indigo-500/20">
              <Zap size={14} className="animate-pulse" /> Operational Command
            </div>
            <h2 className="text-5xl md:text-8xl font-black tracking-tighter leading-[0.85]">Strategic <br/><span className="text-indigo-500">Maneuvers.</span></h2>
            <p className="text-slate-400 text-lg md:text-xl font-medium leading-relaxed">
              Targeted implementations to reach <span className="text-white">Financial Sovereignty</span>. Current focus: <span className="text-rose-400">Deficit Erasure.</span>
            </p>
          </div>
          
          <div className="flex flex-col gap-6 w-full lg:w-auto">
            <div className="bg-white/[0.03] border border-white/10 p-10 rounded-[3rem] backdrop-blur-xl flex flex-col items-center gap-4 shadow-inner min-w-[340px]">
               <div className="relative w-32 h-32">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/5" />
                    <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray="364.4" strokeDashoffset={364.4 - (364.4 * completionRate) / 100} className="text-indigo-500 transition-all duration-1000 ease-out" strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black">{completionRate}%</span>
                    <span className="text-[8px] font-black text-slate-500 uppercase">Ready</span>
                  </div>
               </div>
               <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Sovereignty Score</p>
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
               <div key={action.id} className={`group bg-white p-8 md:p-12 rounded-[3.5rem] border transition-all duration-500 flex flex-col md:flex-row gap-10 items-start ${isDone ? 'border-emerald-200 opacity-60' : 'border-slate-200 hover:border-indigo-400 shadow-sm hover:shadow-xl hover:-translate-y-1'}`}>
                  <div className={`p-6 rounded-[2rem] shrink-0 transition-all duration-500 ${isDone ? 'bg-emerald-50 text-emerald-500' : `bg-${action.color}-50 text-${action.color}-600 group-hover:bg-${action.color}-600 group-hover:text-white`}`}>
                    {isDone ? <CheckCircle2 size={32} /> : <action.icon size={32} />}
                  </div>
                  
                  <div className="flex-1 space-y-6 text-left">
                    <div className="flex flex-wrap items-center gap-3">
                       <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${isDone ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : `bg-${action.color}-50 text-${action.color}-600 border-${action.color}-100`}`}>
                         {action.priority}
                       </span>
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                         <TrendingUp size={12} className="text-indigo-400"/> {action.impact}
                       </span>
                    </div>
                    
                    <div className="space-y-3">
                       <h4 className={`text-2xl font-black tracking-tight ${isDone ? 'line-through text-slate-400' : 'text-slate-900'}`}>{action.title}</h4>
                       <p className="text-sm font-medium text-slate-500 leading-relaxed max-w-xl">{action.description}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       {action.tactics.map((tactic, i) => (
                         <div key={i} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 group/tactic hover:border-indigo-200 transition-all">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover/tactic:bg-indigo-500 transition-colors" />
                            <span className="text-xs font-bold text-slate-600">{tactic}</span>
                         </div>
                       ))}
                    </div>
                  </div>

                  <div className="w-full md:w-auto flex flex-col gap-4 shrink-0">
                    <div className="p-6 bg-slate-950 rounded-[2.5rem] text-center border border-white/5">
                       <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Wealth Delta</p>
                       <p className="text-xl font-black text-indigo-400">{action.delta}</p>
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
           <div className="bg-slate-950 p-10 rounded-[4rem] text-white space-y-10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600/10 blur-[80px] rounded-full translate-x-1/2 -translate-y-1/2" />
              <div className="space-y-2 relative z-10 text-left">
                 <h3 className="text-2xl font-black flex items-center gap-3 italic tracking-tight"><BarChart3 className="text-indigo-500" size={24}/> Engine Health</h3>
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Real-time Load Balancing</p>
              </div>
              
              <div className="space-y-8 relative z-10">
                 {[
                   { label: 'Survival Load', val: calculations.outflowRatio - calculations.investmentRatio - calculations.debtRatio, color: '#f59e0b' },
                   { label: 'Servicing Drag', val: calculations.debtRatio, color: '#ef4444' },
                   { label: 'Success Velocity', val: calculations.investmentRatio, color: '#6366f1' }
                 ].map((stat, i) => (
                   <div key={i} className="space-y-2">
                      <div className="flex justify-between items-end">
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</span>
                         <span className="text-sm font-black">{Math.round(stat.val)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                         <div className="h-full transition-all duration-1000" style={{ width: `${stat.val}%`, backgroundColor: stat.color }} />
                      </div>
                   </div>
                 ))}
              </div>

              <div className="pt-8 border-t border-white/5 space-y-6 relative z-10 text-left">
                 <div className="p-6 bg-white/5 rounded-[2.5rem] border border-white/10 flex items-center gap-4">
                    <div className="p-3 bg-rose-500/20 text-rose-400 rounded-2xl"><ShieldAlert size={20}/></div>
                    <div>
                       <p className="text-[9px] font-black text-slate-500 uppercase">Annual Deficit</p>
                       <p className="text-xl font-black text-rose-500">₹{calculations.deficit.toLocaleString()}</p>
                    </div>
                 </div>
                 <p className="text-[10px] font-medium text-slate-400 leading-relaxed italic">"A high success velocity ({'>'}25%) is the primary driver of your 5-year wealth trajectory."</p>
              </div>
           </div>

           <div className="bg-white p-10 rounded-[4rem] border border-slate-200 shadow-sm flex flex-col gap-6 text-left">
              <div className="p-4 bg-indigo-50 text-indigo-600 rounded-[1.5rem] w-fit shadow-inner"><Lock size={24}/></div>
              <h4 className="text-xl font-black tracking-tight">Actuarial Lock</h4>
              <p className="text-sm font-medium text-slate-500 leading-relaxed">Implementing these 3 actions locks in a <span className="text-emerald-500 font-bold">14.2% higher</span> terminal wealth projection at year 15.</p>
              <button className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">Download Strategy PDF <ArrowRight size={14}/></button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default ActionPlan;
