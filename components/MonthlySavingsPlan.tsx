
import React, { useMemo, useState } from 'react';
import { 
  Wallet, TrendingUp, Landmark, ShieldCheck, 
  ArrowRight, PieChart, Calculator, Activity,
  ArrowDownToLine, Zap, CheckCircle2, ChevronRight, AlertCircle,
  BarChartHorizontal, LayoutGrid, Search, MoreHorizontal
} from 'lucide-react';
import { FinanceState } from '../types';
import { formatCurrency } from '../lib/currency';

const MonthlySavingsPlan: React.FC<{ state: FinanceState }> = ({ state }) => {
  const [activeView, setActiveView] = useState<'matrix' | 'ledger'>('matrix');

  const breakdown = useMemo(() => {
    const monthlyIncome = (state.profile.income.salary || 0) + (state.profile.income.investment || 0);
    const survival = state.profile.monthlyExpenses || 0;
    const servicing = state.loans.reduce((acc, l) => acc + (l.emi || 0), 0);
    const success = (15000) + (70000); // NPS + Portfolio SIP mock

    return {
      income: monthlyIncome,
      survival,
      servicing,
      success,
      totalOutflow: survival + servicing + success,
      netCash: monthlyIncome - (survival + servicing + success)
    };
  }, [state]);

  const silos = [
    { label: 'Survival Silo', desc: 'Lifestyle & Burn', val: breakdown.survival, color: 'teal', icon: Wallet, meta: 'Baseline Needs' },
    { label: 'Servicing Silo', desc: 'Debt & Interest', val: breakdown.servicing, color: 'rose', icon: Landmark, meta: 'Fixed Obligations' },
    { label: 'Success Silo', desc: 'Growth Capital', val: breakdown.success, color: 'emerald', icon: TrendingUp, meta: 'Compounding Pool' },
  ];

  const unmappedCash = Math.max(0, breakdown.netCash);

  const currencyCountry = state.profile.country;

  return (
    <div className="space-y-10 animate-in fade-in duration-1000 pb-24">
      {/* Dynamic Console Header */}
      <div className="surface-dark p-10 md:p-16 rounded-[4rem] md:rounded-[5rem] text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-teal-600/10 blur-[150px] rounded-full translate-x-1/4 -translate-y-1/4" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-end md:items-center gap-12">
          <div className="space-y-6 text-left">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-teal-500/10 text-teal-300 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-teal-500/20">
              <LayoutGrid size={14}/> Partition Console
            </div>
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.85]">Cash <br/><span className="text-teal-500">Matrix.</span></h2>
            <p className="text-slate-400 text-lg font-medium max-w-lg leading-relaxed">
              Auditing the distribution of <span className="text-white font-bold">{formatCurrency(breakdown.income, currencyCountry)}</span> monthly inflow across strategic silos.
            </p>
          </div>
          
          <div className="flex flex-col gap-4 w-full md:w-auto">
            <div className="bg-white/5 border border-white/10 p-10 rounded-[3rem] backdrop-blur-xl flex flex-col items-center gap-3 shadow-inner w-full md:min-w-[320px]">
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Global Inflow Node</p>
               <h4 className="text-4xl md:text-5xl font-black text-white tracking-tighter">{formatCurrency(breakdown.income, currencyCountry)}</h4>
               <div className="flex p-1 bg-white/5 rounded-2xl w-full mt-4">
                  <button onClick={() => setActiveView('matrix')} className={`flex-1 py-3 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeView === 'matrix' ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>Matrix</button>
                  <button onClick={() => setActiveView('ledger')} className={`flex-1 py-3 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeView === 'ledger' ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>Ledger</button>
               </div>
            </div>
          </div>
        </div>
      </div>

      {activeView === 'matrix' ? (
        <div className="space-y-12">
          {/* Silo Modules */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {silos.map((silo, idx) => (
              <div key={idx} className="bg-white p-10 rounded-[4rem] border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-teal-400 transition-all min-h-[450px] relative overflow-hidden">
                <div className={`absolute top-0 right-0 w-32 h-32 bg-${silo.color}-500/5 blur-[40px] rounded-full translate-x-1/2 -translate-y-1/2 group-hover:scale-150 transition-transform duration-1000`} />
                
                <div className="relative z-10 space-y-10">
                  <div className="flex justify-between items-start">
                    <div className={`w-16 h-16 bg-${silo.color}-50 text-${silo.color}-600 rounded-[1.75rem] flex items-center justify-center shadow-inner group-hover:bg-${silo.color}-600 group-hover:text-white transition-all duration-500`}>
                      <silo.icon size={28} />
                    </div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full">{silo.meta}</span>
                  </div>
                  
                  <div className="space-y-3 text-left">
                    <h3 className="text-2xl font-black text-slate-900 leading-none">{silo.label}</h3>
                    <p className="text-sm font-medium text-slate-400">{silo.desc}</p>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="flex justify-between items-end">
                       <span className="text-[10px] font-black text-slate-500 uppercase">Monthly Flow</span>
                       <span className="text-2xl font-black text-slate-900">{formatCurrency(silo.val, currencyCountry)}</span>
                    </div>
                    <div className="w-full h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100 shadow-inner p-0.5">
                       <div className={`h-full bg-${silo.color}-600 rounded-full transition-all duration-1000`} style={{ width: `${(silo.val / (breakdown.income || 1)) * 100}%` }} />
                    </div>
                    <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                       <span>Ratio: {((silo.val / (breakdown.income || 1)) * 100).toFixed(1)}%</span>
                       <span className={`text-${silo.color}-600`}>Health: Nominal</span>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-slate-50 flex items-center justify-between group/btn relative z-10">
                   <button className="text-[10px] font-black text-teal-600 uppercase tracking-widest flex items-center gap-2">Adjust Allocation <ChevronRight size={12} className="group-hover/btn:translate-x-1 transition-transform" /></button>
                   <MoreHorizontal size={16} className="text-slate-300" />
                </div>
              </div>
            ))}
          </div>

          {/* Leakage Audit Node */}
          <div className="surface-dark p-12 rounded-[5rem] text-white flex flex-col lg:flex-row items-center justify-between gap-12 relative overflow-hidden shadow-2xl">
             <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_30%,_rgba(99,102,241,0.05),_transparent)] pointer-events-none" />
             <div className="flex items-center gap-10 relative z-10 text-left">
                <div className="p-6 bg-white/5 rounded-[2.5rem] border border-white/10 text-teal-400 shadow-inner shrink-0"><Activity size={40}/></div>
                <div className="space-y-4">
                   <h4 className="text-3xl font-black tracking-tight flex items-center gap-3">Partition Leakage Audit</h4>
                   <p className="text-slate-400 text-lg font-medium max-w-xl leading-relaxed">
                      Your current partition has <span className={`font-bold ${unmappedCash > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(unmappedCash, currencyCountry)}</span> of unmapped monthly cashflow.
                   </p>
                </div>
             </div>
             <div className="bg-white/5 p-8 rounded-[3rem] border border-white/10 flex flex-col items-center gap-2 w-full md:min-w-[280px] relative z-10">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Leakage Index</p>
                <h5 className="text-4xl font-black text-emerald-400">{Math.round((unmappedCash / breakdown.income) * 100)}%</h5>
                <button className="mt-4 px-8 py-3 bg-teal-600 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-teal-500 transition-all">Direct to Success Silo</button>
             </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[4rem] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-500">
           <div className="p-12 border-b border-slate-50 flex flex-col md:flex-row justify-between items-center bg-slate-50/50 gap-6">
              <div className="text-left">
                 <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Global Ledger Reconciliation</h3>
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">FY 2024-25 Distribution Hub</p>
              </div>
              <div className="relative w-full md:w-80">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                 <input type="text" placeholder="Filter ledger nodes..." className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-6 py-4 text-xs font-bold outline-none focus:border-teal-600" />
              </div>
           </div>

           <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left min-w-[720px]">
                 <thead>
                    <tr className="bg-white">
                       <th className="px-12 py-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Partition Node</th>
                       <th className="px-6 py-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Target (Plan)</th>
                       <th className="px-6 py-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actual (Spend)</th>
                       <th className="px-12 py-8 text-[11px] font-black text-teal-600 uppercase tracking-[0.2em] text-right">Variance Delta</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {[
                      { name: 'Core Living & Rent', budget: breakdown.survival, actual: 0, status: 'Active' },
                      { name: 'EMI Servicing (SKODA + HOME)', budget: breakdown.servicing, actual: 0, status: 'Fixed' },
                      { name: 'NPS Tier-1 Allocation', budget: 15000, actual: 0, status: 'Automated' },
                      { name: 'Direct Equity SIP Pool', budget: 70000, actual: 0, status: 'Automated' },
                      { name: 'Emerging Cash Buffer', budget: unmappedCash, actual: 0, status: 'Floating' },
                    ].map((row, i) => (
                       <tr key={i} className="hover:bg-teal-50/30 transition-all group">
                          <td className="px-12 py-6">
                             <div className="flex items-center gap-4">
                                <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                                <div className="text-left">
                                  <p className="text-sm font-black text-slate-900">{row.name}</p>
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{row.status}</span>
                                </div>
                             </div>
                          </td>
                          <td className="px-6 py-6 text-sm font-bold text-slate-500 text-right">{formatCurrency(row.budget, currencyCountry)}</td>
                          <td className="px-6 py-6 text-sm font-bold text-slate-500 text-right">{formatCurrency(row.actual, currencyCountry)}</td>
                          <td className={`px-12 py-6 text-sm font-black text-right ${row.budget > 0 ? 'text-rose-500' : 'text-slate-900'}`}>{formatCurrency(row.budget, currencyCountry)}</td>
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

export default MonthlySavingsPlan;
