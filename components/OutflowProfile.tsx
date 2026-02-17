
import React, { useState, useMemo } from 'react';
import { 
  Receipt, ShoppingCart, Users, Activity, Sparkles, Briefcase, 
  HeartPulse, Home, Zap, CreditCard, ArrowDownRight, ShieldCheck,
  Edit3, LayoutGrid, AlertCircle, TrendingDown, ChevronRight, Plus
} from 'lucide-react';
import { FinanceState, ExpenseItem } from '../types';

interface OutflowProfileProps {
  state: FinanceState;
  updateState: (data: Partial<FinanceState>) => void;
}

const EXPENSE_CATEGORIES = [
  { name: 'Household/Grocery/Maid', icon: ShoppingCart },
  { name: 'Parents Support', icon: Users },
  { name: 'Travel/Fuel', icon: Activity },
  { name: 'Festival/Gathering', icon: Sparkles },
  { name: 'Education', icon: Briefcase },
  { name: 'Gift/Charity', icon: HeartPulse },
  { name: 'Maintenance/Repair/Tax', icon: Home },
  { name: 'Medical Expenses', icon: Activity },
  { name: 'Utility Bills', icon: Zap },
  { name: 'Shopping/Dining', icon: ShoppingCart },
  { name: 'Personal Care/Gym', icon: Activity },
] as const;

const OutflowProfile: React.FC<OutflowProfileProps> = ({ state, updateState }) => {
  const [editingCategory, setEditingCategory] = useState<string | null>(null);

  const handleExpenseChange = (categoryName: string, amount: number) => {
    const existing = state.detailedExpenses.find(e => e.category === categoryName);
    let newExpenses;
    if (existing) {
      newExpenses = state.detailedExpenses.map(e => e.category === categoryName ? { ...e, amount } : e);
    } else {
      newExpenses = [...state.detailedExpenses, { category: categoryName, amount, inflationRate: 6, tenure: 34 }];
    }
    updateState({ detailedExpenses: newExpenses });
  };

  const totalMonthlyExpenses = state.detailedExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalMonthlyDebt = state.loans.reduce((sum, l) => sum + l.emi, 0);
  const totalMonthlyOutflow = totalMonthlyExpenses + totalMonthlyDebt;

  return (
    <div className="space-y-8 md:space-y-12 animate-in fade-in duration-700 pb-24">
      {/* Header Strategy */}
      <div className="bg-[#0b0f1a] p-8 md:p-16 rounded-[2.5rem] md:rounded-[5rem] text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-rose-600/10 blur-[120px] rounded-full translate-x-1/4 -translate-y-1/4" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8 md:gap-12">
          <div className="space-y-4 md:space-y-6 text-left">
            <div className="inline-flex items-center gap-2 md:gap-3 px-3 md:px-4 py-1.5 md:py-2 bg-rose-500/10 text-rose-300 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] border border-rose-500/20">
              <ArrowDownRight size={14}/> Burn Matrix Audit
            </div>
            <h2 className="text-3xl md:text-7xl font-black tracking-tighter leading-tight md:leading-[0.85]">Outflow <br/><span className="text-rose-500">Profile.</span></h2>
          </div>
          
          <div className="bg-white/5 border border-white/10 p-8 md:p-12 rounded-[2rem] md:rounded-[4rem] backdrop-blur-xl flex flex-col items-center gap-2 shadow-inner min-w-[300px]">
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Monthly Burn Rate</p>
             <h4 className="text-4xl md:text-6xl font-black tracking-tighter text-rose-400">₹{totalMonthlyOutflow.toLocaleString()}</h4>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-10">
        <div className="lg:col-span-2 space-y-8">
           <div className="bg-white p-8 md:p-14 rounded-[3.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-center mb-10 md:mb-14">
                 <div>
                    <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight text-left">Lifestyle Categories</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 text-left">Operational Spend Nodes</p>
                 </div>
                 <div className="bg-rose-50 text-rose-600 px-4 py-2 rounded-2xl text-[10px] font-black uppercase border border-rose-100">Audit Status: Active</div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {EXPENSE_CATEGORIES.map((cat) => {
                    const expense = state.detailedExpenses.find(e => e.category === cat.name);
                    const isEditing = editingCategory === cat.name;
                    return (
                       <div key={cat.name} className={`p-6 rounded-[2.5rem] border-2 transition-all flex items-center gap-4 group ${isEditing ? 'bg-indigo-50 border-indigo-600 shadow-lg' : 'bg-slate-50 border-slate-100 hover:border-indigo-300'}`}>
                          <div className={`p-3 md:p-4 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all ${isEditing ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400'}`}>
                             <cat.icon size={20}/>
                          </div>
                          <div className="flex-1 min-w-0">
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate text-left">{cat.name}</p>
                             <div className="relative">
                                <span className={`absolute left-0 top-1/2 -translate-y-1/2 font-black text-lg ${isEditing ? 'text-indigo-600' : 'text-slate-300'}`}>₹</span>
                                <input 
                                   type="number" 
                                   value={expense?.amount || ''} 
                                   onFocus={() => setEditingCategory(cat.name)}
                                   onBlur={() => setEditingCategory(null)}
                                   onChange={e => handleExpenseChange(cat.name, parseFloat(e.target.value) || 0)}
                                   className="w-full bg-transparent pl-5 font-black text-xl outline-none"
                                   placeholder="0"
                                />
                             </div>
                          </div>
                          <button onClick={() => setEditingCategory(isEditing ? null : cat.name)} className={`p-2 transition-colors ${isEditing ? 'text-indigo-600' : 'text-slate-300 hover:text-indigo-600'}`}><Edit3 size={16}/></button>
                       </div>
                    );
                 })}
              </div>
           </div>
        </div>

        <div className="space-y-8 md:space-y-10">
           {/* Debt Servicing Silo */}
           <div className="bg-slate-950 p-10 rounded-[4rem] text-white space-y-10 relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 p-4 opacity-5"><CreditCard size={120}/></div>
              <div className="space-y-2 relative z-10 text-left">
                 <h3 className="text-2xl font-black leading-none">Servicing Silo</h3>
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Monthly EMI Logistics</p>
              </div>
              
              <div className="space-y-4 relative z-10 max-h-[350px] overflow-y-auto no-scrollbar pr-2">
                 {state.loans.map(loan => (
                    <div key={loan.id} className="flex justify-between items-center p-5 bg-white/5 border border-white/10 rounded-3xl group hover:bg-white/10 transition-all">
                       <div className="min-w-0 text-left">
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest truncate">{loan.type}</p>
                          <p className="text-sm font-black truncate">{loan.source}</p>
                       </div>
                       <p className="text-xl font-black text-rose-400">₹{loan.emi.toLocaleString()}</p>
                    </div>
                 ))}
                 {state.loans.length === 0 && (
                   <div className="p-8 border-2 border-dashed border-white/10 rounded-3xl text-center">
                      <ShieldCheck size={32} className="text-white/20 mx-auto mb-4"/>
                      <p className="text-xs text-white/40 font-bold uppercase tracking-widest">No Active Liabilities</p>
                   </div>
                 )}
              </div>

              <div className="pt-8 border-t border-white/5 relative z-10 flex justify-between items-center">
                 <p className="text-[10px] font-black uppercase text-slate-500">Global EMI Aggregation</p>
                 <p className="text-2xl font-black text-rose-500">₹{totalMonthlyDebt.toLocaleString()}</p>
              </div>
           </div>

           {/* Inflow Context Node */}
           <div className="bg-white p-8 md:p-10 rounded-[3.5rem] border border-slate-200 shadow-sm space-y-8">
              <div className="flex items-center gap-6">
                 <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl shadow-inner"><ShieldCheck size={28}/></div>
                 <div className="text-left">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inflow Buffer</p>
                    <h4 className="text-lg font-black text-slate-900">₹{((state.profile.income.salary || 0) - totalMonthlyOutflow).toLocaleString()} Surplus</h4>
                 </div>
              </div>
              <div className="space-y-4">
                 <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase"><span>Consumption Ratio</span><span>{Math.round((totalMonthlyOutflow / (state.profile.income.salary || 1)) * 100)}%</span></div>
                 <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 transition-all duration-1000" style={{ width: `${Math.min(100, (totalMonthlyOutflow / (state.profile.income.salary || 1)) * 100)}%` }} />
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default OutflowProfile;
