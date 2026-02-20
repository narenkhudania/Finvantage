
import React, { useState, useMemo } from 'react';
import { 
  Calculator, Briefcase, TrendingUp, Home, ChevronRight, 
  Users, ArrowUpRight, Wallet, Landmark, LineChart, 
  CheckCircle2, Plus, Coins, Sparkles, User, Edit3, PieChart
} from 'lucide-react';
import { FinanceState, DetailedIncome } from '../types';
import { clampNumber, parseNumber } from '../lib/validation';

interface InflowProfileProps {
  state: FinanceState;
  updateState: (data: Partial<FinanceState>) => void;
}

const InflowProfile: React.FC<InflowProfileProps> = ({ state, updateState }) => {
  const [editingId, setEditingId] = useState<'self' | string | null>(null);

  const members = useMemo(() => [
    { id: 'self', name: state.profile.firstName || 'Primary Member', relation: 'Self', income: state.profile.income },
    ...state.family.map(f => ({ id: f.id, name: f.name, relation: f.relation, income: f.income }))
  ], [state.profile, state.family]);

  const totalHouseholdInflow = useMemo(() => {
    return members.reduce((acc, m) => {
      const i = m.income;
      return acc + (i.salary || 0) + (i.bonus || 0) + (i.reimbursements || 0) + 
             (i.business || 0) + (i.rental || 0) + (i.investment || 0);
    }, 0);
  }, [members]);

  const updateIncomeField = (id: string, field: keyof DetailedIncome, value: number) => {
    const sanitized = Math.max(0, parseNumber(value, 0));
    const finalValue =
      field === 'expectedIncrease'
        ? clampNumber(sanitized, 0, 25)
        : sanitized;
    if (id === 'self') {
      updateState({
        profile: { ...state.profile, income: { ...state.profile.income, [field]: finalValue } }
      });
    } else {
      updateState({
        family: state.family.map(f => f.id === id ? { ...f, income: { ...f.income, [field]: finalValue } } : f)
      });
    }
  };

  const IncomeForm = ({ member }: { member: any }) => (
    <div className="bg-slate-50 p-8 md:p-12 rounded-[3.5rem] border border-slate-200 animate-in slide-in-from-top-6 duration-500 space-y-10">
      <div className="flex justify-between items-center">
         <h3 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-3"><Edit3 className="text-teal-600"/> Calibrate: {member.name}</h3>
         <button onClick={() => setEditingId(null)} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">Close Form</button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
        <div className="space-y-8">
           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Operational Core</h4>
           {[
             { label: 'Monthly Net Salary', field: 'salary' as keyof DetailedIncome, icon: Briefcase },
             { label: 'Annual Bonus', field: 'bonus' as keyof DetailedIncome, icon: Sparkles },
             { label: 'Reimbursements', field: 'reimbursements' as keyof DetailedIncome, icon: Coins }
           ].map(item => (
             <div key={item.field} className="space-y-2">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-2">{item.label}</label>
                <div className="relative group">
                   <item.icon className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-teal-600 transition-colors" size={18}/>
                   <input 
                    type="number" 
                    value={member.income[item.field] || ''} 
                    onChange={e => updateIncomeField(member.id, item.field, parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 rounded-2xl px-14 py-4 font-black text-xl outline-none focus:border-teal-600 transition-all shadow-sm"
                    placeholder="0"
                   />
                </div>
             </div>
           ))}
        </div>
        <div className="space-y-8">
           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Passive & Secondary</h4>
           {[
             { label: 'Rental Income', field: 'rental' as keyof DetailedIncome, icon: Home },
             { label: 'Dividends', field: 'investment' as keyof DetailedIncome, icon: TrendingUp },
             { label: 'Side Business', field: 'business' as keyof DetailedIncome, icon: Calculator }
           ].map(item => (
             <div key={item.field} className="space-y-2">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-2">{item.label}</label>
                <div className="relative group">
                   <item.icon className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-teal-600 transition-colors" size={18}/>
                   <input 
                    type="number" 
                    value={member.income[item.field] || ''} 
                    onChange={e => updateIncomeField(member.id, item.field, parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 rounded-2xl px-14 py-4 font-black text-xl outline-none focus:border-teal-600 transition-all shadow-sm"
                    placeholder="0"
                   />
                </div>
             </div>
           ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 md:space-y-12 animate-in fade-in duration-700 pb-24">
      {/* Visual Header */}
      <div className="surface-dark p-8 md:p-16 rounded-[2.5rem] md:rounded-[5rem] text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-600/10 blur-[120px] rounded-full translate-x-1/4 -translate-y-1/4" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8 md:gap-12">
          <div className="space-y-4 md:space-y-6 text-left">
            <div className="inline-flex items-center gap-2 md:gap-3 px-3 md:px-4 py-1.5 md:py-2 bg-teal-500/10 text-teal-300 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] border border-teal-500/20">
              <TrendingUp size={14}/> Household Liquidity
            </div>
            <h2 className="text-3xl md:text-7xl font-black tracking-tighter leading-tight md:leading-[0.85]">Household <br/><span className="text-teal-500">Inflows.</span></h2>
          </div>
          <div className="bg-white/5 border border-white/10 p-8 md:p-12 rounded-[2rem] md:rounded-[4rem] backdrop-blur-xl flex flex-col items-center gap-2 shadow-inner w-full md:min-w-[300px]">
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Aggregated Monthly</p>
             <h4 className="text-4xl md:text-6xl font-black tracking-tighter text-emerald-400">₹{totalHouseholdInflow.toLocaleString()}</h4>
          </div>
        </div>
      </div>

      {/* Member Contribution Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
           <div className="bg-white rounded-[2.5rem] md:rounded-[4rem] border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-8 md:px-12 py-8 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                 <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Node Contributions</h3>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{members.length} Active Earners</p>
              </div>
              <div className="overflow-x-auto no-scrollbar">
                 <table className="w-full text-left min-w-[720px]">
                    <thead>
                       <tr className="bg-white">
                          <th className="px-8 md:px-12 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Earner Name</th>
                          <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Relation</th>
                          <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Inflow (₹)</th>
                          <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Share</th>
                          <th className="px-8 md:px-12 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {members.map(m => {
                          const mTotal = (m.income.salary || 0) + (m.income.bonus || 0) + (m.income.reimbursements || 0) + (m.income.business || 0) + (m.income.rental || 0) + (m.income.investment || 0);
                          const share = (mTotal / (totalHouseholdInflow || 1)) * 100;
                          return (
                             <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-8 md:px-12 py-6">
                                   <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400"><User size={20}/></div>
                                      <span className="text-sm font-black text-slate-900">{m.name}</span>
                                   </div>
                                </td>
                                <td className="px-6 py-6 text-[10px] font-bold text-slate-500 uppercase">{m.relation}</td>
                                <td className="px-6 py-6 text-sm font-black text-slate-900 text-right">₹{mTotal.toLocaleString()}</td>
                                <td className="px-6 py-6 text-center">
                                   <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 text-teal-600 rounded-full text-[10px] font-black border border-teal-100">{share.toFixed(1)}%</div>
                                </td>
                                <td className="px-8 md:px-12 py-6 text-right">
                                   <button onClick={() => setEditingId(m.id)} className="p-2.5 bg-slate-100 text-slate-400 hover:bg-teal-600 hover:text-white rounded-xl transition-all shadow-sm"><Edit3 size={16}/></button>
                                </td>
                             </tr>
                          );
                       })}
                    </tbody>
                 </table>
              </div>
           </div>
           
           {editingId && <IncomeForm member={members.find(m => m.id === editingId)} />}
        </div>

        <div className="space-y-8">
           <div className="surface-dark p-10 rounded-[3.5rem] text-white space-y-10 relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-teal-600/10 blur-[80px] rounded-full translate-x-1/2 -translate-y-1/2" />
              <div className="space-y-2 relative z-10">
                 <h3 className="text-2xl font-black tracking-tight">Diversification Pool.</h3>
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Inflow Concentration Audit</p>
              </div>
              
              <div className="space-y-6 relative z-10">
                 {[
                   { label: 'Active Salary', val: members.reduce((s, m) => s + (m.income.salary || 0), 0), color: '#0f766e' },
                   { label: 'Passive Yields', val: members.reduce((s, m) => s + (m.income.rental || 0) + (m.income.investment || 0), 0), color: '#10b981' },
                   { label: 'Side/Business', val: members.reduce((s, m) => s + (m.income.business || 0), 0), color: '#f59e0b' }
                 ].map((pool, i) => (
                    <div key={i} className="space-y-2">
                       <div className="flex justify-between items-end">
                          <span className="text-[10px] font-black uppercase text-slate-400">{pool.label}</span>
                          <span className="text-sm font-black">₹{pool.val.toLocaleString()}</span>
                       </div>
                       <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full transition-all duration-1000" style={{ width: `${(pool.val / (totalHouseholdInflow || 1)) * 100}%`, backgroundColor: pool.color }} />
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default InflowProfile;
