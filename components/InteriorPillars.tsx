
import React from 'react';
import { 
  Clock, Calculator, ShieldCheck, Target, TrendingUp, Users, 
  Layers, CheckCircle2, Activity, Zap, Sparkles 
} from 'lucide-react';

const InteriorPillars: React.FC = () => {
  const pillars = [
    {
      title: "Temporal Decision Mapping",
      desc: "Stop guessing. Know exactly how buying that car today affects your purchasing power 15 years into retirement.",
      icon: Clock,
      tech: "Actuarial Simulation",
      color: "indigo"
    },
    {
      title: "Regime-Level Tax Tuning",
      desc: "Automatically audit Old vs New regimes to find your monthly cashflow leakage and stop capital flight.",
      icon: Calculator,
      tech: "Legislation Engine",
      color: "emerald"
    },
    {
      title: "Human Life Value Shield",
      desc: "Go beyond 'Insurance'. Map a shield pool that covers every family goal, debt, and income year remaining.",
      icon: ShieldCheck,
      tech: "Risk DNA Math",
      color: "rose"
    },
    {
      title: "Funding Goal Velocity",
      desc: "Align every rupee of your surplus to specific missions like homes or travel with priority-based waterfalls.",
      icon: Target,
      tech: "Priority Matrix",
      color: "amber"
    },
    {
      title: "Inflation Alpha Buffer",
      desc: "Our engine projects your real wealth through decades of 6%+ inflation cycles, adjusting your lifestyle automatically.",
      icon: TrendingUp,
      tech: "CAGR Correction",
      color: "indigo"
    },
    {
      title: "Multi-Earner Sync",
      desc: "Map complex household incomes, bonuses, and side-hustles into a single unified Strategy Lab.",
      icon: Users,
      tech: "Household Node",
      color: "emerald"
    }
  ];

  return (
    <div className="space-y-12 animate-in fade-in duration-1000 pb-24">
      {/* Strategic Header */}
      <div className="bg-slate-950 p-12 md:p-16 rounded-[4rem] md:rounded-[5rem] text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 blur-[120px] rounded-full translate-x-1/4 -translate-y-1/4" />
        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-indigo-500/20 text-indigo-300 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-indigo-500/20">
            <Layers size={14}/> Wealth Architecture
          </div>
          <h2 className="text-4xl md:text-7xl font-black tracking-tighter leading-[0.85]">The Core <br/><span className="text-indigo-500">Pillars.</span></h2>
          <p className="text-slate-400 text-lg font-medium max-w-2xl leading-relaxed">
            The six technological pillars that power the FinVantage intelligence engine, ensuring your wealth remains <span className="text-white font-bold">Resilient and Growth-Oriented.</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
        {pillars.map((pillar, i) => (
          <div key={i} className="bg-white p-10 md:p-14 rounded-[3.5rem] border border-slate-200 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all group flex flex-col justify-between min-h-[420px]">
            <div>
               <div className={`w-16 h-16 bg-${pillar.color}-50 text-${pillar.color}-400 rounded-[1.75rem] flex items-center justify-center mb-10 group-hover:bg-${pillar.color}-600 group-hover:text-white group-hover:rotate-6 transition-all duration-500`}>
                 <pillar.icon size={28} />
               </div>
               <h3 className="text-2xl font-black text-slate-950 mb-4 tracking-tight">{pillar.title}</h3>
               <p className="text-slate-500 text-base font-medium leading-relaxed mb-8">{pillar.desc}</p>
            </div>
            <div className="pt-8 border-t border-slate-50 flex items-center justify-between">
               <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{pillar.tech}</span>
               <div className={`p-2 bg-${pillar.color}-50 rounded-full text-${pillar.color}-600`}><CheckCircle2 size={16} /></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InteriorPillars;
