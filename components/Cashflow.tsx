
import React, { useMemo } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Legend, Cell, LineChart, Line 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Activity, Sparkles, 
  ArrowUpRight, ArrowDownRight, Info, Calendar,
  Wallet, Landmark, PieChart, Zap, BarChart3, User
} from 'lucide-react';
import { FinanceState, DetailedIncome, Goal, RelativeDate } from '../types';
import { formatCurrency } from '../lib/currency';

interface CashflowProps {
  state: FinanceState;
}

const Cashflow: React.FC<CashflowProps> = ({ state }) => {
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

  const calculateTotalMemberIncome = (income: DetailedIncome) => {
    return (income.salary || 0) + (income.bonus || 0) + (income.reimbursements || 0) + 
           (income.business || 0) + (income.rental || 0) + (income.investment || 0);
  };

  const projectionData = useMemo(() => {
    const data = [];
    let cumulativeSurplus = 0;

    const baseInflow = calculateTotalMemberIncome(state.profile.income) + 
                      state.family.reduce((sum, f) => sum + calculateTotalMemberIncome(f.income), 0);
    
    const baseLiving = state.detailedExpenses.reduce((sum, e) => sum + e.amount, 0) || state.profile.monthlyExpenses;
    const baseDebt = state.loans.reduce((sum, l) => sum + l.emi, 0);
    // Assuming portfolio SIPs are part of committed investments
    const committedInvestments = 85000; // Mock committed value for visualization

    for (let i = 0; i <= 35; i++) {
      const year = currentYear + i;
      const growthFactor = Math.pow(1.06, i); 
      
      const yearlyInflow = baseInflow * 12 * growthFactor;
      const yearlyLiving = baseLiving * 12 * growthFactor;
      const yearlyDebt = baseDebt * 12; 
      const yearlyCommitted = committedInvestments * 12 * growthFactor;
      
      const activeGoals = state.goals.filter(g => {
        const sYear = resolveYear(g.startDate);
        const eYear = resolveYear(g.endDate);
        return year >= sYear && year <= eYear;
      });

      const goalRequirement = activeGoals.reduce((sum, g) => {
        const inflationAdjustedGoal = g.targetAmountToday * Math.pow(1 + (g.inflationRate / 100), i);
        if (g.isRecurring) {
          const sDate = resolveYear(g.startDate);
          const eDate = resolveYear(g.endDate);
          const duration = Math.max(1, eDate - sDate + 1);
          return sum + (inflationAdjustedGoal / duration);
        } else {
          return year === resolveYear(g.endDate) ? sum + inflationAdjustedGoal : sum;
        }
      }, 0);

      const totalOutflow = yearlyLiving + yearlyDebt + goalRequirement;
      const netSurplus = yearlyInflow - totalOutflow;
      cumulativeSurplus += netSurplus;

      data.push({
        year,
        inflow: Math.round(yearlyInflow),
        living: Math.round(yearlyLiving),
        debt: Math.round(yearlyDebt),
        committed: Math.round(yearlyCommitted),
        goalRequirement: Math.round(goalRequirement),
        totalOutflow: Math.round(totalOutflow),
        surplus: Math.round(netSurplus),
        cumulative: Math.round(cumulativeSurplus),
        age: (birthYear ? year - birthYear : 30 + i)
      });
    }
    return data;
  }, [state, currentYear, birthYear]);

  // Specific charts for primary user
  const personalData = useMemo(() => {
    const s = state.profile.income;
    const personalInflow = calculateTotalMemberIncome(s);
    const personalExpenses = state.profile.monthlyExpenses;
    const personalSurplus = personalInflow - personalExpenses;

    return {
      bar: [
        { name: 'Monthly Inflow', value: personalInflow, fill: '#0f766e' },
        { name: 'Monthly Expense', value: personalExpenses, fill: '#f43f5e' }
      ],
      netFlowHistory: [
        { month: 'Sep', flow: personalSurplus * 0.9 },
        { month: 'Oct', flow: personalSurplus * 1.1 },
        { month: 'Nov', flow: personalSurplus * 0.95 },
        { month: 'Dec', flow: personalSurplus * 1.05 },
        { month: 'Jan', flow: personalSurplus * 0.8 },
        { month: 'Feb', flow: personalSurplus }
      ]
    };
  }, [state.profile]);

  const currencyCountry = state.profile.country;

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000 pb-24">
      
      {/* Strategic Header */}
      <div className="surface-dark p-12 md:p-20 rounded-[5rem] text-white relative overflow-hidden shadow-2xl shadow-teal-900/30">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-teal-600/10 blur-[150px] rounded-full translate-x-1/4 -translate-y-1/4" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-12">
          <div className="space-y-6 text-left">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-teal-500/10 text-teal-300 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-teal-500/20">
              <Activity size={14}/> Wealth Radar Engine
            </div>
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.85]">Strategic <br/><span className="text-teal-500">Flows.</span></h2>
          </div>
          <div className="bg-white/5 border border-white/10 p-10 rounded-[4rem] backdrop-blur-xl flex items-center gap-8 shadow-inner">
             <div className="p-5 bg-teal-600 rounded-[2rem] shadow-xl">
                <BarChart3 size={40} className="text-white"/>
             </div>
             <div className="text-left">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Peak Surplus Capacity</p>
                <h4 className="text-4xl font-black text-white">{formatCurrency(Math.max(...projectionData.map(d => d.surplus)), currencyCountry)}</h4>
             </div>
          </div>
        </div>
      </div>

      {/* Outflow Breakdown (Stacked Bar) */}
      <div className="bg-white p-12 rounded-[5rem] border border-slate-200 shadow-sm flex flex-col">
         <div className="flex justify-between items-center mb-16">
            <div className="text-left">
               <h3 className="text-3xl font-black text-slate-900 tracking-tight italic">Outflow Breakdown.</h3>
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Living vs. Debt vs. Committments</p>
            </div>
            <div className="flex gap-6 items-center">
               <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-200"/><span className="text-[10px] font-black text-slate-400 uppercase">Living</span></div>
               <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-rose-500"/><span className="text-[10px] font-black text-slate-400 uppercase">Debt</span></div>
               <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-teal-500"/><span className="text-[10px] font-black text-slate-400 uppercase">Investments</span></div>
            </div>
         </div>

         <div className="flex-1 min-h-[450px]">
            <ResponsiveContainer width="100%" height="100%">
               <BarChart data={projectionData.slice(0, 15)}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}}
                    tickFormatter={(val) => formatCurrency(val, currencyCountry, { notation: 'compact', maximumFractionDigits: 1 })}
                  />
                  <Tooltip 
                     cursor={{fill: '#f8fafc'}}
                     contentStyle={{ borderRadius: '32px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '24px', fontWeight: 'bold' }}
                     formatter={(val: number) => formatCurrency(val, currencyCountry)}
                   />
                  <Bar dataKey="living" stackId="a" fill="#e2e8f0" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="debt" stackId="a" fill="#f43f5e" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="committed" stackId="a" fill="#0f766e" radius={[10, 10, 0, 0]} />
               </BarChart>
            </ResponsiveContainer>
         </div>
      </div>

      {/* Primary User Charts (Ravindra Khudania) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
         <div className="bg-white p-12 rounded-[5rem] border border-slate-200 shadow-sm flex flex-col">
            <div className="flex justify-between items-start mb-12">
               <div className="text-left space-y-1">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight italic">Personal Node Performance.</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ravindra's Monthly Metrics</p>
               </div>
               <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><User size={20}/></div>
            </div>
            <div className="flex-1 min-h-[300px]">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={personalData.bar} layout="vertical" margin={{ left: 20 }}>
                     <XAxis type="number" hide />
                     <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 900}} />
                     <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontWeight: 'bold' }} />
                     <Bar dataKey="value" radius={[0, 16, 16, 0]} barSize={40} />
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>

         <div className="bg-white p-12 rounded-[5rem] border border-slate-200 shadow-sm flex flex-col">
            <div className="flex justify-between items-start mb-12">
               <div className="text-left space-y-1">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight italic">Personal Net Surplus.</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">6-Month Net Trajectory</p>
               </div>
               <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl"><Activity size={20}/></div>
            </div>
            <div className="flex-1 min-h-[300px]">
               <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={personalData.netFlowHistory}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 900}} />
                     <YAxis hide />
                     <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', fontWeight: 'bold' }} />
                     <Line type="monotone" dataKey="flow" stroke="#0f766e" strokeWidth={5} dot={{ r: 6, fill: '#0f766e', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 10, strokeWidth: 0 }} />
                  </LineChart>
               </ResponsiveContainer>
            </div>
         </div>
      </div>

      {/* Projection Area Chart */}
      <div className="bg-white p-12 rounded-[5rem] border border-slate-200 shadow-sm flex flex-col">
         <div className="flex justify-between items-center mb-10">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight text-left">Aggregated Net Annual Surplus</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Growth Forecast: 6% CAGR</p>
         </div>
         <div className="flex-1 min-h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={projectionData}>
                  <defs>
                     <linearGradient id="colorSurplus" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                     </linearGradient>
                  </defs>
                  <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 800}} />
                  <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', fontWeight: 'bold' }} formatter={(val: number) => formatCurrency(val, currencyCountry)} />
                  <Area type="monotone" dataKey="surplus" stroke="#10b981" strokeWidth={5} fillOpacity={1} fill="url(#colorSurplus)" />
               </AreaChart>
            </ResponsiveContainer>
         </div>
      </div>
    </div>
  );
};

export default Cashflow;
