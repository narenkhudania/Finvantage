
import React, { useState, useMemo } from 'react';
import { 
  Calculator, User, Briefcase, TrendingUp, Coins, Home, Sparkles, 
  ChevronRight, Users, ArrowUpRight, Plus, Info, Wallet, Landmark,
  LineChart, CheckCircle2, ShoppingCart, Activity, ArrowDownRight, 
  Receipt, CreditCard, ShieldCheck, Zap, HeartPulse
} from 'lucide-react';
import { FinanceState, DetailedIncome, FamilyMember, ExpenseItem } from '../types';

interface CashflowProfileProps {
  state: FinanceState;
  updateState: (data: Partial<FinanceState>) => void;
}

const EXPENSE_CATEGORIES = [
  { name: 'Household/Grocery/Maid', icon: ShoppingCart },
  { name: 'Parents Support', icon: Users },
  { name: 'Travel/Fuel', icon: Activity },
  { name: 'Festival/Gathering', icon: Sparkles },
  { name: 'Education', icon: Briefcase },
  // Fix: HeartPulse was referenced here but not imported in the original file
  { name: 'Gift/Charity', icon: HeartPulse },
  { name: 'Maintenance/Repair/Tax', icon: Home },
  { name: 'Medical Expenses', icon: Activity },
  { name: 'Utility Bills', icon: Zap },
  { name: 'Shopping/Dining', icon: ShoppingCart },
  { name: 'Personal Care/Gym', icon: Activity },
].map(c => c as any); // Type safety helper for icons

const CashflowProfile: React.FC<CashflowProfileProps> = ({ state, updateState }) => {
  const [activeTab, setActiveTab] = useState<'inflow' | 'outflow'>('inflow');
  const [selectedMemberId, setSelectedMemberId] = useState<'self' | string>('self');

  const members = useMemo(() => [
    { id: 'self', name: state.profile.firstName || 'Primary', relation: 'Self', income: state.profile.income },
    ...state.family.map(f => ({ id: f.id, name: f.name, relation: f.relation, income: f.income }))
  ], [state.profile, state.family]);

  const currentMember = useMemo(() => 
    members.find(m => m.id === selectedMemberId) || members[0]
  , [members, selectedMemberId]);

  const updateIncomeField = (field: keyof DetailedIncome, value: number) => {
    if (selectedMemberId === 'self') {
      updateState({
        profile: {
          ...state.profile,
          income: { ...state.profile.income, [field]: value }
        }
      });
    } else {
      updateState({
        family: state.family.map(f => 
          f.id === selectedMemberId 
            ? { ...f, income: { ...f.income, [field]: value } }
            : f
        )
      });
    }
  };

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

  const totalMonthlyIncome = useMemo(() => {
    return members.reduce((acc, m) => {
      const i = m.income;
      return acc + (i.salary || 0) + (i.bonus || 0) + (i.reimbursements || 0) + 
             (i.business || 0) + (i.rental || 0) + (i.investment || 0);
    }, 0);
  }, [members]);

  const totalMonthlyExpenses = state.detailedExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalMonthlyDebt = state.loans.reduce((sum, l) => sum + l.emi, 0);
  const totalMonthlyOutflow = totalMonthlyExpenses + totalMonthlyDebt;

  const IncomeInput = ({ label, icon: Icon, value, field, description }: any) => (
    <div className="group bg-white p-6 rounded-[2.5rem] border border-slate-200 hover:border-indigo-400 transition-all shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-50 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white rounded-2xl transition-all">
            <Icon size={18} />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{label}</label>
          </div>
        </div>
      </div>
      <div className="relative">
        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-300 font-black text-2xl">₹</span>
        <input 
          type="number"
          value={value || ''}
          placeholder="0"
          onChange={(e) => updateIncomeField(field, parseFloat(e.target.value) || 0)}
          className="w-full bg-transparent pl-8 py-2 text-2xl font-black text-slate-900 outline-none placeholder:text-slate-100"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-24">
      {/* Strategic Header */}
      <div className="bg-[#0b0f1a] p-12 md:p-16 rounded-[4rem] text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 blur-[120px] rounded-full translate-x-1/4 -translate-y-1/4" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-12">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-indigo-500/10 text-indigo-300 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-indigo-500/20">
              <Calculator size={14}/> Node Configuration
            </div>
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.85]">Cashflow <br/><span className="text-indigo-500">Profile.</span></h2>
            <p className="text-slate-400 text-lg font-medium max-w-lg leading-relaxed">
              Consolidated node for configuring all <span className="text-white">Household Inflows</span> and <span className="text-white">Burn Rates</span>.
            </p>
          </div>
          
          <div className="flex flex-col gap-6">
            <div className="bg-white/5 border border-white/10 p-10 rounded-[4rem] backdrop-blur-xl flex flex-col items-center gap-3 shadow-inner min-w-[320px]">
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Monthly Net Surplus</p>
               <h4 className={`text-4xl md:text-5xl font-black tracking-tighter ${(totalMonthlyIncome - totalMonthlyOutflow) >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                  ₹{(totalMonthlyIncome - totalMonthlyOutflow).toLocaleString()}
               </h4>
               <div className={`flex items-center gap-2 mt-2 text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full border ${(totalMonthlyIncome - totalMonthlyOutflow) >= 0 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20'}`}>
                  {(totalMonthlyIncome - totalMonthlyOutflow) >= 0 ? <TrendingUp size={12}/> : <ArrowDownRight size={12}/>}
                  {(totalMonthlyIncome - totalMonthlyOutflow) >= 0 ? 'Positive Liquidity' : 'Deficit Node'}
               </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex p-2 bg-white rounded-[2.5rem] border border-slate-200 w-fit mx-auto shadow-sm">
        <button onClick={() => setActiveTab('inflow')} className={`px-10 py-4 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'inflow' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-900'}`}><TrendingUp size={14}/> Inflow Profile</button>
        <button onClick={() => setActiveTab('outflow')} className={`px-10 py-4 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'outflow' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-900'}`}><ArrowDownRight size={14}/> Outflow Profile</button>
      </div>

      {activeTab === 'inflow' ? (
        <div className="space-y-10 animate-in slide-in-from-left-4 duration-500">
           <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {members.map(member => (
              <button
                key={member.id}
                onClick={() => setSelectedMemberId(member.id)}
                className={`relative flex-shrink-0 w-48 p-6 rounded-[2.5rem] border-2 transition-all text-left group ${
                  selectedMemberId === member.id 
                    ? 'bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-900/20' 
                    : 'bg-white border-slate-200 text-slate-900 hover:border-indigo-300'
                }`}
              >
                <p className={`text-[9px] font-black uppercase mb-1 ${selectedMemberId === member.id ? 'text-slate-500' : 'text-slate-400'}`}>{member.relation}</p>
                <h4 className="text-lg font-black tracking-tight">{member.name}</h4>
                <p className={`text-[10px] font-bold mt-4 ${selectedMemberId === member.id ? 'text-indigo-400' : 'text-indigo-600'}`}>
                  ₹{((member.income.salary || 0) + (member.income.bonus || 0)).toLocaleString()}
                </p>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <IncomeInput label="Monthly Base Salary" icon={Briefcase} value={currentMember.income.salary} field="salary" />
            <IncomeInput label="Rental Income" icon={Home} value={currentMember.income.rental} field="rental" />
            <IncomeInput label="Dividend/Investment Yield" icon={TrendingUp} value={currentMember.income.investment} field="investment" />
            <IncomeInput label="Business Inflow" icon={Calculator} value={currentMember.income.business} field="business" />
          </div>
        </div>
      ) : (
        <div className="space-y-12 animate-in slide-in-from-right-4 duration-500">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Category Expenses */}
              <div className="lg:col-span-2 space-y-8">
                 <div className="bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-sm">
                    <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3"><Receipt size={24} className="text-indigo-600"/> Lifestyle Burn Rate</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       {EXPENSE_CATEGORIES.map((cat: any) => (
                          <div key={cat.name} className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100 flex items-center gap-4 group hover:bg-white hover:border-indigo-300 transition-all">
                             <div className="p-3 bg-white text-slate-400 rounded-2xl group-hover:text-indigo-600 transition-all"><cat.icon size={18}/></div>
                             <div className="flex-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{cat.name}</p>
                                <div className="relative">
                                   <span className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-300 font-bold">₹</span>
                                   <input 
                                      type="number" 
                                      value={state.detailedExpenses.find(e => e.category === cat.name)?.amount || ''} 
                                      onChange={e => handleExpenseChange(cat.name, parseFloat(e.target.value) || 0)}
                                      className="w-full bg-transparent pl-4 font-black text-lg outline-none"
                                      placeholder="0"
                                   />
                                </div>
                             </div>
                          </div>
                       ))}
                    </div>
                 </div>
              </div>

              {/* Obligations Sidebar */}
              <div className="space-y-8">
                 <div className="bg-slate-950 p-10 rounded-[4rem] text-white space-y-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5"><CreditCard size={120}/></div>
                    <div className="space-y-2 relative z-10">
                       <h3 className="text-2xl font-black">Debt Obligations</h3>
                       <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Monthly EMI Servicing</p>
                    </div>
                    
                    <div className="space-y-4 relative z-10">
                       {state.loans.map(loan => (
                          <div key={loan.id} className="flex justify-between items-center p-5 bg-white/5 border border-white/10 rounded-3xl">
                             <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">{loan.type}</p>
                                <p className="text-sm font-black">{loan.source}</p>
                             </div>
                             <p className="text-lg font-black text-rose-400">₹{loan.emi.toLocaleString()}</p>
                          </div>
                       ))}
                       {state.loans.length === 0 && <p className="text-xs text-slate-500 italic">No active loan obligations detected.</p>}
                    </div>

                    <div className="pt-8 border-t border-white/5 relative z-10 flex justify-between items-center">
                       <p className="text-[10px] font-black uppercase text-slate-500">Total Obligation</p>
                       <p className="text-2xl font-black text-rose-500">₹{totalMonthlyDebt.toLocaleString()}</p>
                    </div>
                 </div>

                 <div className="bg-white p-8 rounded-[3.5rem] border border-slate-200 shadow-sm flex items-center gap-6">
                    <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl"><ShieldCheck size={24}/></div>
                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Efficiency Audit</p>
                       <h4 className="text-lg font-black text-slate-900">{Math.round((totalMonthlyDebt / totalMonthlyIncome) * 100)}% Debt Load</h4>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default CashflowProfile;
