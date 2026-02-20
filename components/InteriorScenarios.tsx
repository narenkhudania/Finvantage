
import React from 'react';
import { 
  Sparkles, Zap, ArrowRight, Home, GraduationCap, Plane, Car, 
  Clock, Info, ChevronRight, Activity, TrendingUp
} from 'lucide-react';
import { FinanceState } from '../types';
import { formatCurrency } from '../lib/currency';

const InteriorScenarios: React.FC<{ state: FinanceState }> = ({ state }) => {
  const currencyCountry = state.profile.country;
  const money = (value: number) => formatCurrency(value, currencyCountry);

  const scenarios = [
    {
      title: "The First House Acquisition",
      scenario: `Should I buy a ${money(18000000)} home in Year 5 or keep renting and invest the difference?`,
      result: `Renting wins by ${money(8500000)} in net worth over 20 years, unless property appreciation hits 9.2%.`,
      icon: Home,
      color: "teal"
    },
    {
      title: "The Ivy League Pipeline",
      scenario: "How much extra monthly SIP is needed to fund an Ivy League MBA in 2035 at 12% annual cost inflation?",
      result: `Required: ${money(140000)} additional surplus monthly from today to hit the ${money(32000000)} target.`,
      icon: GraduationCap,
      color: "emerald"
    },
    {
      title: "The Sovereign Sabbatical",
      scenario: "Can I take a 2-year sabbatical in Year 10 without pushing my FIRE age past 50?",
      result: "Sabbatical shifts FIRE from age 47 to 49.5. Suggesting 15% aggressive equity tilt to offset.",
      icon: Plane,
      color: "amber"
    },
    {
      title: "The EV Upgrade Math",
      scenario: `Buying a ${money(2500000)} EV today vs ${money(1500000)} Petrol car. factoring in fuel savings and initial capital loss.`,
      result: `Break-even at Year 4. EV adds ${money(12000)} to monthly surplus after loan closure.`,
      icon: Car,
      color: "teal"
    }
  ];

  return (
    <div className="space-y-12 animate-in fade-in duration-1000 pb-24">
      {/* Strategic Header */}
      <div className="surface-dark p-12 md:p-16 rounded-[4rem] md:rounded-[5rem] text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-teal-600/10 blur-[120px] rounded-full translate-x-1/4 -translate-y-1/4" />
        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-teal-500/10 text-teal-300 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-teal-500/20">
            <Zap size={14}/> Pre-Live Your Future
          </div>
          <h2 className="text-4xl md:text-7xl font-black tracking-tighter leading-[0.85]">Scenario <br/><span className="text-teal-500">Lab.</span></h2>
          <p className="text-slate-400 text-lg font-medium max-w-2xl leading-relaxed">
            Run high-fidelity simulations of life's biggest moves. Our engine calculates the <span className="text-white font-bold">Opportunity Cost</span> of every rupee in your specific context.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-10">
        {scenarios.map((card, i) => (
          <div key={i} className="bg-white border border-slate-200 p-10 md:p-16 rounded-[4rem] group hover:border-teal-400 transition-all relative overflow-hidden flex flex-col justify-between min-h-[480px]">
            <div className="absolute top-0 right-0 p-12 text-slate-50 opacity-10 group-hover:opacity-20 transition-all group-hover:rotate-6">
              <card.icon size={160} />
            </div>
            
            <div className="relative z-10 space-y-8">
               <div className={`p-4 bg-${card.color}-50 text-${card.color}-600 rounded-2xl w-fit shadow-sm`}>
                  <card.icon size={28} />
               </div>
               <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">{card.title}</h3>
               <div className="space-y-6">
                  <p className="text-slate-500 text-lg font-medium italic leading-relaxed">"{card.scenario}"</p>
                  <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 space-y-4">
                     <div className="flex items-center gap-2">
                        <TrendingUp size={14} className="text-teal-600" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-600">Alpha Projection</p>
                     </div>
                     <p className="text-base font-bold text-slate-800 leading-relaxed">{card.result}</p>
                  </div>
               </div>
            </div>

            <div className="relative z-10 pt-10 border-t border-slate-50 flex items-center justify-between">
               <button className="flex items-center gap-2 text-xs font-black text-teal-600 uppercase tracking-[0.3em] hover:text-teal-700 transition-colors group/btn">
                  Simulate Version <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
               </button>
               <span className="px-3 py-1 bg-slate-100 rounded-full text-[8px] font-black text-slate-400 uppercase tracking-widest">Actuarial v4.2</span>
            </div>
          </div>
        ))}
      </div>

      <div className="surface-dark p-12 rounded-[5rem] text-white flex flex-col md:flex-row items-center justify-between gap-12 relative overflow-hidden shadow-2xl">
         <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[80px] rounded-full" />
         <div className="space-y-4 relative z-10">
            <h4 className="text-3xl font-black tracking-tight flex items-center gap-3">
              <Sparkles size={24} className="text-teal-400" /> Custom Logic Request
            </h4>
            <p className="text-slate-400 font-medium max-w-xl leading-relaxed">
              Have a unique life scenario not covered in the Lab? Our AI can compute cross-asset dependencies for any global wealth mission.
            </p>
         </div>
         <button className="px-10 py-6 bg-white text-slate-950 rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-teal-600 hover:text-white transition-all shadow-xl relative z-10">Ask Command Center</button>
      </div>
    </div>
  );
};

export default InteriorScenarios;
