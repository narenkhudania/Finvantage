
import React from 'react';
import { 
  TrendingUp, ShieldCheck, Zap, Target, ArrowRight, 
  CheckCircle2, Bot, Calculator, Lock, Wallet, 
  History, Coins, ChevronRight, Sparkles, BarChart3,
  Globe, Layout, Cpu, Database, Activity, Car,
  Clock, Flame, Shield, ArrowUpRight, Check,
  Home, GraduationCap, Plane, Building, Users, FileJson,
  Layers
} from 'lucide-react';

interface LandingProps {
  onStart: () => void;
}

const Landing: React.FC<LandingProps> = ({ onStart }) => {
  return (
    <div className="min-h-screen bg-[#fcfdfe] text-slate-900 font-sans selection:bg-indigo-100 overflow-x-hidden">
      {/* Premium Glass Header - Clean Version */}
      <nav className="fixed top-0 w-full bg-white/70 backdrop-blur-2xl z-[60] border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 md:px-8 h-20 md:h-24 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 md:p-2.5 rounded-xl md:rounded-2xl shadow-[0_0_25px_rgba(79,70,229,0.3)]">
              <TrendingUp className="text-white w-5 h-5 md:w-6 md:h-6" />
            </div>
            <span className="text-xl md:text-2xl font-black tracking-tighter text-slate-900 italic">FinVantage<span className="text-indigo-600">.</span></span>
          </div>
          {/* Navigation removed as requested for a cleaner UI/UX */}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-36 md:pt-52 pb-24 md:pb-32 px-6 md:px-8 overflow-hidden text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[160%] md:w-[140%] h-[600px] md:h-[800px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100/40 via-transparent to-transparent -z-10" />
        
        <div className="max-w-7xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-2 md:gap-3 px-4 md:px-5 py-2 md:py-2.5 bg-indigo-600 text-white rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] mb-8 md:mb-12 shadow-xl shadow-indigo-600/20">
            <Sparkles size={14} className="animate-pulse" /> Precision Wealth Engineering
          </div>
          
          <h1 className="text-5xl md:text-9xl font-black text-slate-950 leading-[1.1] md:leading-[0.85] tracking-tight mb-8 md:mb-10">
            Plan for Life, <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-indigo-400">Not Just Money.</span>
          </h1>
          
          <p className="text-lg md:text-3xl text-slate-500 max-w-4xl leading-relaxed mb-12 md:mb-16 font-medium">
            Get the clarity you need to make life's biggest decisions. From <span className="text-indigo-600 font-black">buying your first car</span> to achieving <span className="text-indigo-600 font-black">FIRE</span>.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 md:gap-6 w-full max-w-md md:max-w-none justify-center">
            <button 
              onClick={onStart}
              className="bg-indigo-600 text-white px-10 md:px-14 py-6 md:py-8 rounded-[1.5rem] md:rounded-[2.5rem] font-black text-lg md:text-xl flex items-center justify-center gap-3 md:gap-4 hover:bg-indigo-700 hover:scale-105 transition-all shadow-[0_20px_60px_-15px_rgba(79,70,229,0.5)] group"
            >
              Start Free Planning <ArrowRight className="group-hover:translate-x-2 transition-transform" />
            </button>
            <div className="flex items-center gap-4 md:gap-5 px-8 md:px-10 py-6 md:py-8 rounded-[1.5rem] md:rounded-[2.5rem] bg-white border border-slate-100 shadow-xl shadow-slate-200/20">
               <div className="p-2.5 md:p-3 bg-indigo-50 text-indigo-600 rounded-xl md:rounded-2xl">
                 <Shield size={20} className="md:w-6 md:h-6" />
               </div>
               <div className="text-left">
                  <p className="text-[11px] md:text-xs font-black text-slate-900 italic">Privacy-First</p>
                  <p className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Local Node Simulation</p>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Enhanced Core Pillars Section */}
      <section id="benefits" className="py-24 md:py-40 px-6 md:px-8 bg-slate-50/50">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-end justify-between mb-16 md:mb-24 gap-8">
            <div className="max-w-2xl text-left">
               <div className="inline-flex items-center gap-3 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-indigo-100 mb-6">
                 <Layers size={14}/> Wealth Architecture
               </div>
               <h2 className="text-4xl md:text-7xl font-black text-slate-900 mb-6 tracking-tight leading-none">The Core <br/><span className="text-indigo-600">Pillars.</span></h2>
               <p className="text-slate-500 text-lg md:text-2xl font-medium leading-relaxed">Six technological anchors that power the FinVantage intelligence engine, ensuring your wealth remains <span className="text-indigo-600 font-bold">Resilient and Goal-Oriented.</span></p>
            </div>
            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm hidden md:block">
               <Activity size={32} className="text-indigo-600 animate-pulse" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
            {[
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
            ].map((pillar, i) => (
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
      </section>

      {/* Premium Scenario Lab Section */}
      <section id="scenarios" className="py-24 md:py-40 px-6 md:px-8 bg-slate-950 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-indigo-600/10 blur-[150px] rounded-full translate-x-1/2 -translate-y-1/2" />
        
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20 md:mb-32">
             <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/20 text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-6">
                <Zap size={14}/> Pre-Live Your Future
             </div>
             <h2 className="text-4xl md:text-8xl font-black text-white mb-8 tracking-tighter leading-none">The Scenario <span className="text-indigo-500">Lab.</span></h2>
             <p className="text-slate-400 text-lg md:text-2xl max-w-3xl mx-auto font-medium leading-relaxed">
               Run high-fidelity simulations of life's biggest moves. Our engine calculates the <span className="text-white font-bold">Opportunity Cost</span> of every rupee in your specific context.
             </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 md:gap-16">
            {[
              {
                title: "The First House Acquisition",
                scenario: "Should I buy a ₹1.8Cr home in Year 5 or keep renting and invest the difference?",
                result: "Renting wins by ₹85L in net worth over 20 years, unless property appreciation hits 9.2%.",
                icon: Home,
                color: "indigo"
              },
              {
                title: "The Ivy League Pipeline",
                scenario: "How much extra monthly SIP is needed to fund an Ivy League MBA in 2035 at 12% annual cost inflation?",
                result: "Required: ₹1.4L additional surplus monthly from today to hit the ₹3.2Cr target.",
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
                scenario: "Buying a ₹25L EV today vs ₹15L Petrol car. factoring in fuel savings and initial capital loss.",
                result: "Break-even at Year 4. EV adds ₹12k to monthly surplus after loan closure.",
                icon: Car,
                color: "indigo"
              }
            ].map((card, i) => (
              <div key={i} className="bg-white/[0.03] border border-white/10 p-10 md:p-16 rounded-[4rem] group hover:bg-white/[0.05] transition-all relative overflow-hidden flex flex-col justify-between min-h-[480px]">
                <div className="absolute top-0 right-0 p-10 text-white/5 group-hover:text-white/10 transition-colors">
                  <card.icon size={160} />
                </div>
                <div className="relative z-10 space-y-8">
                   <div className={`p-4 bg-${card.color}-500/20 text-${card.color}-400 rounded-2xl w-fit`}>
                      <card.icon size={28} />
                   </div>
                   <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-tight">{card.title}</h3>
                   <div className="space-y-6">
                      <p className="text-slate-400 text-lg font-medium italic leading-relaxed">"{card.scenario}"</p>
                      <div className="p-8 bg-white/5 rounded-[2.5rem] border border-white/10 space-y-4">
                         <div className="flex items-center gap-2">
                            <TrendingUp size={14} className="text-indigo-400" />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Alpha Projection</p>
                         </div>
                         <p className="text-base font-bold text-slate-200 leading-relaxed">{card.result}</p>
                      </div>
                   </div>
                </div>
                <div className="relative z-10 pt-10 border-t border-white/5 flex items-center justify-between">
                   <button onClick={onStart} className="flex items-center gap-2 text-xs font-black text-white uppercase tracking-[0.3em] hover:text-indigo-400 transition-colors group/btn">
                      Simulate My Version <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                   </button>
                   <span className="px-3 py-1 bg-white/5 rounded-full text-[8px] font-black text-slate-500 uppercase tracking-widest">Actuarial v4.2</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 md:py-40 px-6 md:px-8 bg-white text-center">
        <div className="max-w-5xl mx-auto">
          <div className="space-y-6 mb-20 md:mb-32">
             <h2 className="text-4xl md:text-7xl font-black text-slate-950 tracking-tight leading-none">The Pricing <br/><span className="text-indigo-600 underline decoration-indigo-200 decoration-8 underline-offset-8">Terminal.</span></h2>
             <p className="text-slate-500 text-lg md:text-2xl font-medium max-w-2xl mx-auto">Enterprise-grade financial intelligence, made available to every household for free.</p>
          </div>

          <div className="relative">
             <div className="absolute inset-0 bg-indigo-600 blur-[120px] opacity-10 -z-10 rounded-full" />
             <div className="bg-slate-900 text-white p-10 md:p-24 rounded-[5rem] shadow-2xl relative overflow-hidden border border-slate-800">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[80px] rounded-full translate-x-1/2 -translate-y-1/2" />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                   <div className="text-left space-y-10">
                      <div className="space-y-2">
                         <h3 className="text-4xl md:text-6xl font-black tracking-tighter italic">The Sovereign Plan.</h3>
                         <p className="text-indigo-400 text-sm font-black uppercase tracking-[0.3em]">Full Terminal Access</p>
                      </div>
                      
                      <div className="space-y-6">
                         {[
                           "Unlimited Scenario Simulations",
                           "Advanced AY 24-25 Tax Audit",
                           "Precision Goal Funding Waterfalls",
                           "Multi-Earner Income Mapping",
                           "Local-Only Data Residency (Secure)",
                           "Strategy Command Center"
                         ].map((feature, i) => (
                           <div key={i} className="flex items-center gap-4 group">
                              <div className="w-6 h-6 bg-emerald-500 text-slate-950 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                 <Check size={14} strokeWidth={4} />
                              </div>
                              <span className="text-sm md:text-lg font-bold text-slate-300">{feature}</span>
                           </div>
                         ))}
                      </div>
                   </div>

                   <div className="bg-white/5 border border-white/10 p-12 rounded-[4rem] flex flex-col justify-center items-center gap-8 backdrop-blur-xl">
                      <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em]">Monthly Subscription</p>
                      <div className="space-y-2">
                         <h4 className="text-7xl md:text-9xl font-black tracking-tighter leading-none italic">₹0</h4>
                         <p className="text-emerald-400 text-xs font-black uppercase tracking-widest">100% Free • Forever</p>
                      </div>
                      <div className="w-full pt-8 border-t border-white/5">
                         <button 
                           onClick={onStart}
                           className="w-full py-6 md:py-8 bg-white text-slate-950 rounded-[2rem] md:rounded-[3rem] font-black text-lg md:text-xl hover:bg-indigo-500 hover:text-white transition-all shadow-2xl active:scale-95"
                         >
                           Access My Node
                         </button>
                      </div>
                      <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest px-8">No Credit Card • No Cloud Sync • Private Planning</p>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* Security Banner */}
      <section className="py-24 md:py-40 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-12">
           <div className="flex-1 text-left space-y-6">
              <div className="p-4 bg-indigo-600 rounded-3xl w-fit text-white shadow-xl shadow-indigo-600/20"><Database size={32}/></div>
              <h3 className="text-3xl md:text-5xl font-black text-slate-950 tracking-tight leading-none">Your Wealth DNA, <br/><span className="text-indigo-600">Your Storage.</span></h3>
              <p className="text-slate-500 text-lg md:text-xl font-medium leading-relaxed max-w-xl">
                FinVantage is built on the principle of <span className="text-slate-900 font-bold">Local-Only Data residency</span>. Your sensitive income and asset data never touches our servers. It lives in your browser's encrypted vault.
              </p>
           </div>
           <div className="grid grid-cols-2 gap-4 w-full md:w-auto shrink-0">
              {[
                { label: "AES-256", icon: Lock, desc: "Local Encryption" },
                { label: "0% Leakage", icon: Shield, desc: "Private Analytics" },
                { label: "Open Node", icon: Cpu, desc: "Browser-Based" },
                { label: "Audit-Ready", icon: FileJson, desc: "Clean State" }
              ].map((item, i) => (
                <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 text-center space-y-3 hover:border-indigo-400 transition-all">
                   <item.icon size={24} className="text-indigo-600 mx-auto" />
                   <p className="text-xs font-black text-slate-900 uppercase tracking-widest">{item.label}</p>
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{item.desc}</p>
                </div>
              ))}
           </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 md:py-24 bg-white border-t border-slate-100 text-center px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-12 mb-16 border-b border-slate-50 pb-16">
             <div className="flex items-center gap-3">
               <div className="bg-indigo-600 p-1.5 rounded-lg shadow-lg shadow-indigo-600/20">
                 <TrendingUp className="text-white w-5 h-5" />
               </div>
               <span className="text-2xl font-black tracking-tighter text-slate-900 italic">FinVantage<span className="text-indigo-600">.</span></span>
             </div>
             <div className="flex gap-10">
                <a href="#benefits" className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600">Pillars</a>
                <a href="#scenarios" className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600">Lab</a>
                <a href="#pricing" className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600">Plans</a>
                <button onClick={onStart} className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Terminal</button>
             </div>
          </div>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">© 2025 FinVantage Intelligence Labs • Licensed for Household Use • Local Node Security Active</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
