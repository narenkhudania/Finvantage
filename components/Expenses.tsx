
import React from 'react';
import { FinanceState, ExpenseItem } from '../types';
import { ShoppingCart, Home, Car, HeartPulse, Zap, Smartphone, Utensils, Plane, GraduationCap, ShieldCheck, Wallet, ChevronRight } from 'lucide-react';

interface ExpensesProps {
  state: FinanceState;
  updateState: (data: Partial<FinanceState>) => void;
}

const CATEGORIES = [
  { name: 'Food & Grocery', icon: ShoppingCart },
  { name: 'House Rent / Maintenance', icon: Home },
  { name: 'Conveyance & Fuel', icon: Car },
  { name: 'Healthcare & Medicines', icon: HeartPulse },
  { name: 'Electricity & Utilities', icon: Zap },
  { name: 'Communications', icon: Smartphone },
  { name: 'Household Operations', icon: Utensils },
  { name: 'Lifestyle & Shopping', icon: ShoppingCart },
  { name: 'Dining & Entertainment', icon: Utensils },
  { name: 'Travel & Vacations', icon: Plane },
  { name: 'Education Expenses', icon: GraduationCap },
  { name: 'Pure Insurance Premiums', icon: ShieldCheck },
];

const Expenses: React.FC<ExpensesProps> = ({ state, updateState }) => {
  const handleAmountChange = (categoryName: string, amount: number) => {
    const existing = state.detailedExpenses.find(e => e.category === categoryName);
    let newExpenses;
    if (existing) {
      newExpenses = state.detailedExpenses.map(e => e.category === categoryName ? { ...e, amount } : e);
    } else {
      newExpenses = [...state.detailedExpenses, { category: categoryName, amount, inflationRate: 6, tenure: 10 }];
    }
    updateState({ detailedExpenses: newExpenses });
  };

  const totalOutflow = state.detailedExpenses.reduce((sum, e) => sum + e.amount, 0);
  
  const calculateTotalIncome = () => {
    const s = state.profile.income;
    const self = (s.salary || 0) + (s.bonus || 0) + (s.reimbursements || 0) + (s.business || 0) + (s.rental || 0) + (s.investment || 0);
    const family = state.family.reduce((sum, f) => {
      const i = f.income;
      return sum + (i.salary || 0) + (i.bonus || 0) + (i.reimbursements || 0) + (i.business || 0) + (i.rental || 0) + (i.investment || 0);
    }, 0);
    return self + family;
  };

  const totalIncome = calculateTotalIncome();
  const surplus = totalIncome - totalOutflow;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
      <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1">
          <h3 className="text-2xl font-black text-slate-900">Step 3: Monthly Outflows</h3>
          <p className="text-sm font-medium text-slate-500">Break down your household burn rate across fixed and variable costs.</p>
        </div>
        <div className="flex gap-4">
           <div className="bg-rose-50 px-6 py-4 rounded-3xl border border-rose-100 text-center">
              <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Total Outflow</p>
              <p className="text-xl font-black text-rose-600">${totalOutflow.toLocaleString()}</p>
           </div>
           <div className="bg-emerald-50 px-6 py-4 rounded-3xl border border-emerald-100 text-center">
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Monthly Surplus</p>
              <p className="text-xl font-black text-emerald-600">${surplus.toLocaleString()}</p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {CATEGORIES.map((cat) => {
          const expense = state.detailedExpenses.find(e => e.category === cat.name);
          return (
            <div key={cat.name} className="bg-white p-6 rounded-[2rem] border border-slate-100 hover:border-indigo-300 transition-all group">
              <div className="flex items-center gap-3 mb-6">
                 <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <cat.icon size={20} />
                 </div>
                 <h4 className="text-xs font-black text-slate-900">{cat.name}</h4>
              </div>
              <div className="relative">
                <span className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-300 font-black text-lg">$</span>
                <input 
                  type="number"
                  placeholder="0"
                  value={expense?.amount || ''}
                  onChange={(e) => handleAmountChange(cat.name, parseFloat(e.target.value) || 0)}
                  className="w-full bg-transparent pl-6 py-2 text-xl font-black text-slate-900 outline-none border-b-2 border-slate-50 focus:border-indigo-600 transition-all"
                />
              </div>
              <div className="mt-4 flex items-center justify-between">
                 <span className="text-[10px] font-black text-slate-400 uppercase">Inflation: 6%</span>
                 <button className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Adjust</button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-950 p-10 rounded-[3rem] text-white flex items-center justify-between">
         <div className="space-y-2">
            <h4 className="text-2xl font-black">Net Cash Flow Positioning</h4>
            <p className="text-slate-400 font-medium">Your surplus represents {Math.round((surplus/totalIncome)*100)}% of your gross monthly inflow.</p>
         </div>
         <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${surplus > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}>
               <Wallet size={24} />
            </div>
            <button className="px-8 py-4 bg-indigo-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all">Analyze with AI</button>
         </div>
      </div>
    </div>
  );
};

export default Expenses;
