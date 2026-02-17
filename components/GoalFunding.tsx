
import React, { useMemo, useState } from 'react';
import { 
  TrendingUp, TrendingDown, Target, Landmark, 
  ArrowUpRight, ArrowDownRight, Calendar, Calculator,
  ChevronRight, ChevronDown, CheckCircle2, AlertCircle,
  PieChart, Activity, Wallet, Info, Search, ShieldCheck,
  Zap, ArrowRight, DollarSign, ListOrdered, BarChartHorizontal
} from 'lucide-react';
import { FinanceState, Goal, RelativeDate } from '../types';

const GoalFunding: React.FC<{ state: FinanceState }> = ({ state }) => {
  const [activeTab, setActiveTab] = useState<'audit' | 'timeline'>('audit');

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

  const auditData = useMemo(() => {
    const s = state.profile.income;
    const netSalaryPa = (s.salary || 0) * 12;
    const dividendPa = (s.investment || 0) * 12;
    const totalInflowPa = netSalaryPa + dividendPa;
    const livingExpensesPa = (state.profile.monthlyExpenses || 0) * 12;
    const govtSchemesPa = 180000;
    const portfolioPa = 840000;
    const totalCommittedPa = govtSchemesPa + portfolioPa;
    const carLoanPa = state.loans.find(l => l.type === 'Car Loan')?.emi ? (state.loans.find(l => l.type === 'Car Loan')!.emi * 12) : 240000;
    const homeLoanPa = state.loans.find(l => l.type === 'Home Loan')?.emi ? (state.loans.find(l => l.type === 'Home Loan')!.emi * 12) : 840000;
    const totalRepaymentsPa = carLoanPa + homeLoanPa;
    const totalOutflowPa = livingExpensesPa + totalCommittedPa + totalRepaymentsPa;
    const netCashFlowPa = totalInflowPa - totalOutflowPa;

    return {
      incomes: [
        { label: "Net Salary Income", value: netSalaryPa },
        { label: "Dividend Income", value: dividendPa }
      ],
      totalInflowPa,
      expenses: [{ label: "Living Expenses", value: livingExpensesPa }],
      totalExpensesPa: livingExpensesPa,
      savings: [
        { label: "NPS & EPF", value: govtSchemesPa },
        { label: "Portfolio (Eq/MF)", value: portfolioPa }
      ],
      totalSavingsPa: totalCommittedPa,
      repayments: [
        { label: "Vehicle Loans", value: carLoanPa },
        { label: "Housing Loans", value: homeLoanPa }
      ],
      totalRepaymentsPa,
      totalOutflowPa,
      netCashFlowPa
    };
  }, [state]);

  const simulationData = useMemo(() => {
    const years = [];
    const projectionSpan = 36;
    const baseInflow = auditData.totalInflowPa;
    const baseLiving = auditData.totalExpensesPa;
    const baseSavings = auditData.totalSavingsPa;
    const baseRepayments = auditData.totalRepaymentsPa;

    for (let i = 1; i <= projectionSpan; i++) {
      const year = currentYear + i;
      const age = birthYear ? year - birthYear : 30 + i;
      const growthFactor = Math.pow(1.06, i - 1);
      const yearlyInflow = baseInflow * growthFactor;
      const yearlyLiving = baseLiving * growthFactor;
      const yearlySavings = baseSavings * growthFactor;
      const yearlyRepayments = baseRepayments;
      const netSurplus = yearlyInflow - yearlyLiving - yearlySavings - yearlyRepayments;

      const totalGoalReq = state.goals.filter(g => {
        const s = resolveYear(g.startDate);
        const e = resolveYear(g.endDate);
        return year >= s && year <= e;
      }).reduce((sum, g) => {
        const inflationAdjusted = g.targetAmountToday * Math.pow(1 + (g.inflationRate / 100), i);
        return sum + (g.isRecurring ? inflationAdjusted / (resolveYear(g.endDate) - resolveYear(g.startDate) + 1) : (year === resolveYear(g.endDate) ? inflationAdjusted : 0));
      }, 0);

      years.push({ year, age, inflow: yearlyInflow, living: yearlyLiving, savings: yearlySavings, repayments: yearlyRepayments, surplus: netSurplus, goalReq: totalGoalReq });
    }
    return years;
  }, [state, auditData, currentYear, birthYear]);

  return (
    <div className="space-y-8 md:space-y-12 animate-in fade-in duration-1000 pb-24">
      {/* Strategic Header */}
      <div className="bg-[#0b0f1a] p-8 md:p-16 rounded-[2.5rem] md:rounded-[5rem] text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 blur-[120px] rounded-full translate-x-1/4 -translate-y-1/4" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8 md:gap-12">
          <div className="space-y-4 md:space-y-6">
            <div className="inline-flex items-center gap-2 md:gap-3 px-3 md:px-4 py-1.5 md:py-2 bg-indigo-500/10 text-indigo-300 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] border border-indigo-500/20">
              <Zap size={14}/> Household Liquidity Engine
            </div>
            <h2 className="text-3xl md:text-7xl font-black tracking-tighter leading-tight md:leading-[0.85]">Cashflow <br/><span className="text-indigo-500">Radar.</span></h2>
            <p className="text-slate-400 text-sm md:text-lg font-medium max-w-lg leading-relaxed">
              Consolidated audit of annual inflows versus committed outflows and lifestyle burn.
            </p>
          </div>
          
          <div className="flex flex-col gap-4 w-full md:w-auto">
            <div className={`bg-white/5 border border-white/10 p-8 md:p-10 rounded-[2rem] md:rounded-[4rem] backdrop-blur-xl flex flex-col items-center gap-2 md:gap-3 shadow-inner md:min-w-[320px] w-full`}>
               <p className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest">Net Annual Cash Flow</p>
               <h4 className={`text-3xl md:text-5xl font-black tracking-tighter ${auditData.netCashFlowPa >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                  ₹{Math.abs(auditData.netCashFlowPa).toLocaleString()}
               </h4>
               <div className={`flex items-center gap-2 mt-1 md:mt-2 text-[9px] md:text-[10px] font-bold uppercase tracking-widest px-3 md:px-4 py-1 md:py-1.5 rounded-full border ${auditData.netCashFlowPa >= 0 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20'}`}>
                  {auditData.netCashFlowPa >= 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                  {auditData.netCashFlowPa >= 0 ? 'Surplus Capacity' : 'Deficit Detected'}
               </div>
            </div>
            <div className="flex p-1 bg-white/5 border border-white/10 rounded-2xl w-full">
               <button onClick={() => setActiveTab('audit')} className={`flex-1 py-3 px-4 md:px-8 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'audit' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:text-white'}`}>Audit</button>
               <button onClick={() => setActiveTab('timeline')} className={`flex-1 py-3 px-4 md:px-8 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'timeline' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:text-white'}`}>Timeline</button>
            </div>
          </div>
        </div>
      </div>

      {activeTab === 'audit' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-10 animate-in slide-in-from-bottom-6 duration-700">
           <div className="space-y-6 md:space-y-8">
              <div className="bg-white p-8 md:p-10 rounded-[2.5rem] md:rounded-[4rem] border border-slate-200 shadow-sm">
                 <div className="flex items-center justify-between mb-6 md:mb-8 border-b border-slate-50 pb-4 md:pb-6">
                    <div className="flex items-center gap-3 md:gap-4">
                       <div className="p-2.5 md:p-3 bg-indigo-50 text-indigo-600 rounded-xl md:rounded-2xl"><Calculator size={20}/></div>
                       <h3 className="text-lg md:text-xl font-black text-slate-900">Incomes</h3>
                    </div>
                    <p className="text-xs md:text-sm font-black text-slate-900">₹{auditData.totalInflowPa.toLocaleString()}</p>
                 </div>
                 <div className="space-y-4">
                    {auditData.incomes.map((inc, i) => (
                       <div key={i} className="flex justify-between items-center py-1 md:py-2">
                          <span className="text-xs md:text-sm font-bold text-slate-500">{inc.label}</span>
                          <span className="text-xs md:text-sm font-black text-slate-900">₹{inc.value.toLocaleString()}</span>
                       </div>
                    ))}
                 </div>
              </div>

              <div className="bg-white p-8 md:p-10 rounded-[2.5rem] md:rounded-[4rem] border border-slate-200 shadow-sm">
                 <div className="flex items-center justify-between mb-6 md:mb-8 border-b border-slate-50 pb-4 md:pb-6">
                    <div className="flex items-center gap-3 md:gap-4">
                       <div className="p-2.5 md:p-3 bg-rose-50 text-rose-500 rounded-xl md:rounded-2xl"><Activity size={20}/></div>
                       <h3 className="text-lg md:text-xl font-black text-slate-900">Expenses</h3>
                    </div>
                    <p className="text-xs md:text-sm font-black text-rose-600">₹{auditData.totalExpensesPa.toLocaleString()}</p>
                 </div>
                 <div className="space-y-4">
                    {auditData.expenses.map((exp, i) => (
                       <div key={i} className="flex justify-between items-center py-1 md:py-2">
                          <span className="text-xs md:text-sm font-bold text-slate-500">{exp.label}</span>
                          <span className="text-xs md:text-sm font-black text-slate-900">₹{exp.value.toLocaleString()}</span>
                       </div>
                    ))}
                 </div>
              </div>
           </div>

           <div className="space-y-6 md:space-y-8">
              <div className="bg-white p-8 md:p-10 rounded-[2.5rem] md:rounded-[4rem] border border-slate-200 shadow-sm">
                 <div className="flex items-center justify-between mb-6 md:mb-8 border-b border-slate-50 pb-4 md:pb-6">
                    <div className="flex items-center gap-3 md:gap-4">
                       <div className="p-2.5 md:p-3 bg-indigo-50 text-indigo-600 rounded-xl md:rounded-2xl"><Landmark size={20}/></div>
                       <h3 className="text-lg md:text-xl font-black text-slate-900">Repayments</h3>
                    </div>
                    <p className="text-xs md:text-sm font-black text-slate-900">₹{auditData.totalRepaymentsPa.toLocaleString()}</p>
                 </div>
                 <div className="space-y-4">
                    {auditData.repayments.map((rep, i) => (
                       <div key={i} className="flex justify-between items-center py-1 md:py-2">
                          <span className="text-[11px] md:text-sm font-bold text-slate-500 leading-tight flex-1 mr-4">{rep.label}</span>
                          <span className="text-[11px] md:text-sm font-black text-slate-900 shrink-0">₹{rep.value.toLocaleString()}</span>
                       </div>
                    ))}
                 </div>
              </div>

              <div className="bg-slate-950 p-8 md:p-12 rounded-[2.5rem] md:rounded-[5rem] text-white space-y-6 md:space-y-10 relative overflow-hidden shadow-2xl">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[80px] rounded-full translate-x-1/2 -translate-y-1/2" />
                 <h4 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3 relative z-10"><BarChartHorizontal className="text-indigo-500" size={24}/> Audit Node</h4>
                 <div className="pt-4 space-y-4 relative z-10">
                    <p className="text-slate-400 text-sm md:text-base font-medium leading-relaxed">
                       Net position: <span className={auditData.netCashFlowPa >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>₹{auditData.netCashFlowPa.toLocaleString()} p.a.</span>
                    </p>
                    {auditData.netCashFlowPa < 0 && (
                       <div className="p-4 md:p-6 bg-rose-500/10 border border-rose-500/20 rounded-[1.5rem] md:rounded-[2.5rem] flex items-start gap-3 md:gap-4">
                          <AlertCircle className="text-rose-500 shrink-0" size={18} md:size={20}/>
                          <p className="text-[11px] md:text-xs font-bold text-rose-200 italic leading-relaxed">Strategy Alert: Deficit of ₹70k detected. Adjust Portfolio targets or living spend.</p>
                       </div>
                    )}
                 </div>
              </div>
           </div>
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] md:rounded-[5rem] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-500">
           <div className="p-8 md:p-12 border-b border-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Timeline Projections</h3>
              <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100"><p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Growth: 6% p.a.</p></div>
           </div>
           
           <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left min-w-[700px]">
                 <thead>
                    <tr className="bg-slate-50/50">
                       <th className="px-8 md:px-10 py-6 md:py-8 text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-widest">Year (Age)</th>
                       <th className="px-4 md:px-8 py-6 md:py-8 text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-widest text-right">Inflow (₹)</th>
                       <th className="px-4 md:px-8 py-6 md:py-8 text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-widest text-right">Outflows (₹)</th>
                       <th className="px-8 md:px-10 py-6 md:py-8 text-[10px] md:text-[11px] font-black text-indigo-600 uppercase tracking-widest text-right">Net Capacity</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {simulationData.map((row, idx) => (
                       <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                          <td className="px-8 md:px-10 py-4 md:py-6">
                             <div className="flex items-center gap-2 md:gap-3">
                                <span className="text-xs md:text-sm font-black text-slate-900">{row.year}</span>
                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[8px] md:text-[9px] font-black uppercase tracking-tighter">Age {row.age}</span>
                             </div>
                          </td>
                          <td className="px-4 md:px-8 py-4 md:py-6 text-right text-xs font-black text-slate-900">₹{Math.round(row.inflow).toLocaleString()}</td>
                          <td className="px-4 md:px-8 py-4 md:py-6 text-right text-xs font-bold text-slate-500">₹{Math.round(row.living + row.savings + row.repayments).toLocaleString()}</td>
                          <td className={`px-8 md:px-10 py-4 md:py-6 text-right text-xs md:text-sm font-black ${row.surplus >= 0 ? 'text-emerald-500' : 'text-rose-600'}`}>
                             {row.surplus >= 0 ? '+' : ''}₹{Math.round(row.surplus).toLocaleString()}
                          </td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      )}
    </div>
  );
};

export default GoalFunding;
