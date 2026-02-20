
import React, { useMemo, useState } from 'react';
import { 
  ClipboardList, Target, Calculator, TrendingUp, 
  Calendar, ArrowUpRight, Info, AlertCircle, Sparkles,
  Layers, CheckCircle2, Circle, ArrowRight, Wallet,
  PieChart, RefreshCw, Zap, Activity, ShieldCheck, Edit3
} from 'lucide-react';
import { FinanceState, Goal, RelativeDate, ResourceBucket } from '../types';

const GoalSummary: React.FC<{ state: FinanceState }> = ({ state }) => {
  const [hoveredGoalId, setHoveredGoalId] = useState<string | null>(null);
  
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

  const goalsData = useMemo(() => {
    return state.goals.sort((a,b) => a.priority - b.priority).map((goal, idx) => {
      const sYear = resolveYear(goal.startDate);
      const eYear = resolveYear(goal.endDate);
      const yearsToStart = Math.max(0, sYear - currentYear);
      const duration = Math.max(1, eYear - sYear + 1);
      
      const inflation = goal.inflationRate / 100;
      const fvAtStart = goal.targetAmountToday * Math.pow(1 + inflation, yearsToStart);
      
      let sumCorpus = 0;
      if (goal.isRecurring) {
        // Simple accumulation for recurring goals
        for (let i = 0; i < duration; i++) {
          sumCorpus += goal.targetAmountToday * Math.pow(1 + inflation, yearsToStart + i);
        }
      } else {
        sumCorpus = fvAtStart;
      }

      const progressPct = sumCorpus > 0 ? Math.min(100, (goal.currentAmount / sumCorpus) * 100) : 0;

      return {
        ...goal,
        srNo: idx + 1,
        startYear: sYear,
        endYear: eYear,
        corpusAtStart: fvAtStart,
        sumCorpus,
        progressPct
      };
    });
  }, [state.goals, currentYear, birthYear]);

  const totalSumCorpus = goalsData.reduce((acc, g) => acc + g.sumCorpus, 0);

  return (
    <div className="space-y-12 animate-in fade-in duration-1000 pb-24">
      {/* Header Strategy Node */}
      <div className="surface-dark p-12 md:p-16 rounded-[5rem] text-white relative overflow-hidden shadow-2xl shadow-teal-900/30">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-600/10 blur-[120px] rounded-full translate-x-1/4 -translate-y-1/4" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-12">
          <div className="space-y-6 text-left">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-teal-500/10 text-teal-300 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-teal-500/20">
              <Layers size={14}/> Goal Funding Terminal
            </div>
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.85]">Funding <br/><span className="text-teal-500">Summary.</span></h2>
          </div>
          
          <div className="bg-white/5 border border-white/10 p-10 rounded-[4rem] backdrop-blur-xl flex flex-col items-center gap-3 shadow-inner">
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Global Lifecycle Corpus (FV)</p>
             <h4 className="text-4xl md:text-5xl font-black text-white tracking-tighter">₹{totalSumCorpus.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h4>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {goalsData.map((goal) => (
          <div 
            key={goal.id} 
            className="bg-white p-10 rounded-[4rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:border-teal-400 transition-all flex flex-col justify-between min-h-[420px]"
            onMouseEnter={() => setHoveredGoalId(goal.id)}
            onMouseLeave={() => setHoveredGoalId(null)}
          >
             {/* Actuarial Tooltip Overlay */}
             <div className={`absolute inset-0 bg-slate-900/95 backdrop-blur-md p-10 text-white z-20 transition-all duration-500 flex flex-col justify-center gap-6 ${hoveredGoalId === goal.id ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
                <div className="flex items-center gap-4 text-teal-400 border-b border-white/10 pb-4">
                   <Zap size={24}/>
                   <h5 className="text-xl font-black uppercase tracking-tight">Actuarial Forecast</h5>
                </div>
                <div className="space-y-3 text-left">
                   <div className="flex justify-between text-xs font-bold"><span className="opacity-70 uppercase tracking-widest">Inflation Burden</span><span className="text-rose-400">+{goal.inflationRate}% p.a.</span></div>
                   <div className="flex justify-between text-xs font-bold"><span className="opacity-70 uppercase tracking-widest">Projected FV (Year {goal.startYear})</span><span className="text-teal-400">₹{Math.round(goal.corpusAtStart).toLocaleString()}</span></div>
                   <div className="flex justify-between text-xs font-bold"><span className="opacity-70 uppercase tracking-widest">Global Sum Required</span><span className="text-teal-400">₹{Math.round(goal.sumCorpus).toLocaleString()}</span></div>
                   <div className="flex justify-between text-xs font-bold border-t border-white/10 pt-4"><span className="opacity-70 uppercase tracking-widest">Funding Deficit</span><span className="text-emerald-400">₹{Math.max(0, Math.round(goal.sumCorpus - goal.currentAmount)).toLocaleString()}</span></div>
                </div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-relaxed mt-4">Simulated with priority rank {goal.priority}. Cross-asset dependencies applied.</p>
             </div>

             <div className="flex justify-between items-start mb-8 text-left">
                <div className="flex items-center gap-6">
                   <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-2xl">
                      {goal.priority}
                   </div>
                   <div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">{goal.description || goal.type}</h3>
                      <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest mt-1">{goal.startYear} — {goal.endYear}</p>
                   </div>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl group-hover:bg-teal-50 transition-colors">
                  <Edit3 size={18} className="text-slate-300 group-hover:text-teal-600" />
                </div>
             </div>

             <div className="space-y-8 flex-1 text-left">
                <div className="space-y-3">
                   <div className="flex justify-between items-end">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Funding Progress (vs FV Target)</span>
                      <span className="text-xl font-black text-slate-900">{goal.progressPct.toFixed(1)}%</span>
                   </div>
                   <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200 relative">
                      <div className={`h-full bg-teal-600 transition-all duration-1000 ease-out`} style={{ width: `${goal.progressPct}%` }} />
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saved to Date</p>
                      <h4 className="text-2xl font-black text-slate-900">₹{goal.currentAmount.toLocaleString()}</h4>
                   </div>
                   <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Future Target (FV)</p>
                      <h4 className="text-2xl font-black text-teal-600">₹{Math.round(goal.sumCorpus).toLocaleString()}</h4>
                   </div>
                </div>
             </div>

             <div className="mt-10 pt-8 border-t border-slate-50 space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Strategic Resource Waterfall</p>
                <div className="flex flex-wrap gap-2">
                   {goal.resourceBuckets.map(rb => (
                      <span key={rb} className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100 flex items-center gap-2">
                         <CheckCircle2 size={12}/> {rb}
                      </span>
                   ))}
                </div>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GoalSummary;
