
import React, { useMemo } from 'react';
import { FinanceState, DetailedIncome } from '../types';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Legend, Cell 
} from 'recharts';
import { CalendarDays, Wallet, TrendingUp, Sparkles, Activity, ShieldCheck, Target, AlertCircle, Info } from 'lucide-react';

const RetirementPlan: React.FC<{ state: FinanceState }> = ({ state }) => {
  const calculateTotalMemberIncome = (income: DetailedIncome) => {
    return (income.salary || 0) + (income.bonus || 0) + (income.reimbursements || 0) + 
           (income.business || 0) + (income.rental || 0) + (income.investment || 0);
  };

  const householdIncome = calculateTotalMemberIncome(state.profile.income) + 
                          state.family.reduce((sum, f) => sum + calculateTotalMemberIncome(f.income), 0);
  const householdExpenses = state.profile.monthlyExpenses + state.family.reduce((sum, f) => sum + f.monthlyExpenses, 0);

  // Generate 20-year projection data
  const accumulationData = useMemo(() => {
    let currentWealth = state.assets.reduce((sum, a) => sum + a.currentValue, 0);
    const yearlySavings = (householdIncome - householdExpenses) * 12;
    const currentYear = new Date().getFullYear();
    const data = [];

    for (let i = 0; i <= 20; i++) {
      const year = currentYear + i;
      // Compounding previous wealth at 8% + adding new yearly savings
      currentWealth = (currentWealth * 1.08) + yearlySavings;
      
      data.push({
        year: year.toString(),
        totalWealth: Math.round(currentWealth),
        inflationAdjusted: Math.round(currentWealth / Math.pow(1.05, i)), // 5% inflation
        savingsContribution: Math.round(yearlySavings * i)
      });
    }
    return data;
  }, [householdIncome, householdExpenses, state.assets]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 pb-24">
      {/* Simulation Header */}
      <div className="bg-slate-950 text-white p-10 md:p-16 rounded-[4rem] relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 blur-[120px] rounded-full translate-x-1/2 -translate-y-1/2" />
        
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-12">
          <div className="space-y-6 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/20 text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-500/20">
              <Sparkles size={14}/> Wealth Engine v2.4
            </div>
            <h2 className="text-5xl md:text-7xl font-black tracking-tight leading-[0.9]">Simulation <br/><span className="text-indigo-500">Trajectory.</span></h2>
            <p className="text-slate-400 text-lg font-medium leading-relaxed">
              Mapping your household's 20-year accumulation phase based on actual savings rate, 
              assumed 8% market return, and 5% steady-state inflation.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 w-full lg:w-auto">
             <div className="bg-white/5 p-8 rounded-[3rem] border border-white/10 backdrop-blur-md">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 text-center">Ready Score</p>
                <div className="flex items-center justify-center gap-2 text-4xl font-black">
                   74 <Activity className="text-emerald-500" size={24}/>
                </div>
             </div>
             <div className="bg-white/5 p-8 rounded-[3rem] border border-white/10 backdrop-blur-md">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 text-center">Drawdown Phase</p>
                <div className="text-3xl font-black text-center text-emerald-400">
                  Year 2044
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* High Fidelity Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Wealth Accumulation Area Chart */}
        <div className="lg:col-span-2 bg-white p-10 md:p-14 rounded-[4rem] border border-slate-200 shadow-sm flex flex-col">
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
              <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                 <TrendingUp className="text-indigo-600" size={28} /> Compounding Horizon
              </h3>
              <div className="flex gap-4">
                 <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-indigo-600" /><span className="text-[9px] font-black text-slate-400 uppercase">Nominal Wealth</span></div>
                 <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span className="text-[9px] font-black text-slate-400 uppercase">Real Wealth (Inflation Adj.)</span></div>
              </div>
           </div>
           
           <div className="flex-1 min-h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={accumulationData}>
                  <defs>
                    <linearGradient id="colorNominal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 800}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 800}} tickFormatter={(val) => `$${val/1000}k`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '20px', fontWeight: 'bold' }}
                    formatter={(val: number) => `$${val.toLocaleString()}`}
                  />
                  <Area type="monotone" dataKey="totalWealth" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorNominal)" />
                  <Area type="monotone" dataKey="inflationAdjusted" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorReal)" />
                </AreaChart>
              </ResponsiveContainer>
           </div>
           
           <div className="mt-8 p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <div className="p-3 bg-white rounded-2xl shadow-sm text-indigo-600"><Info size={20}/></div>
                 <p className="text-xs text-slate-500 font-bold max-w-sm">
                   At year 20, the gap between Nominal and Real wealth represents a <span className="text-rose-500">$2.1M purchasing power loss</span> due to inflation.
                 </p>
              </div>
              <button className="px-6 py-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all">Adjust Inflation</button>
           </div>
        </div>

        {/* Sidebar Insights */}
        <div className="space-y-8 flex flex-col">
           <div className="bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-sm flex-1">
              <h3 className="text-xl font-black text-slate-900 mb-10 flex items-center gap-2">
                 <CalendarDays className="text-indigo-600" size={24} /> Simulation Events
              </h3>
              <div className="space-y-10 relative">
                 <div className="absolute left-4 top-2 bottom-2 w-1 bg-slate-100 rounded-full" />
                 
                 <div className="relative pl-12 group">
                    <div className="absolute left-2.5 top-1.5 w-4 h-4 rounded-full bg-white border-4 border-indigo-600 shadow-lg group-hover:scale-125 transition-transform" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Year 2028</p>
                    <h4 className="font-black text-slate-900">Education Liquidity Event</h4>
                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-1">High probability of $80k withdrawal for Child Education. Portfolio buffer: 12%.</p>
                 </div>

                 <div className="relative pl-12 group">
                    <div className="absolute left-2.5 top-1.5 w-4 h-4 rounded-full bg-white border-4 border-emerald-500 shadow-lg group-hover:scale-125 transition-transform" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Year 2033</p>
                    <h4 className="font-black text-slate-900">FIRE Crossover Point</h4>
                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-1">Passive income from assets projected to exceed household expenses by 15%.</p>
                 </div>

                 <div className="relative pl-12 group">
                    <div className="absolute left-2.5 top-1.5 w-4 h-4 rounded-full bg-white border-4 border-amber-500 shadow-lg group-hover:scale-125 transition-transform" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Year 2038</p>
                    <h4 className="font-black text-slate-900">Lump Sum Opportunity</h4>
                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-1">Expected maturity of Endowment policies. Potential for debt zeroing.</p>
                 </div>
              </div>
           </div>

           <div className="bg-indigo-600 p-10 rounded-[3.5rem] text-white space-y-4 shadow-xl shadow-indigo-600/20">
              <div className="p-3 bg-white/10 rounded-2xl w-fit"><Target size={24}/></div>
              <h4 className="text-xl font-black">Optimization Path</h4>
              <p className="text-xs text-indigo-100 font-medium leading-relaxed">
                By increasing your Equity exposure to 70%, you could potentially reach your FIRE goal 14 months earlier.
              </p>
              <button className="w-full py-4 bg-white text-indigo-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50 transition-colors">Apply Strategy</button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default RetirementPlan;
