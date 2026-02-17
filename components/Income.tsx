
import React, { useState, useMemo } from 'react';
import { FinanceState, DetailedIncome, FamilyMember } from '../types';
import { 
  Calculator, User, Briefcase, TrendingUp, Coins, Home, Sparkles, 
  ChevronRight, Users, ArrowUpRight, Plus, Info, Wallet, Landmark,
  LineChart, CheckCircle2
} from 'lucide-react';

interface IncomeProps {
  state: FinanceState;
  updateState: (data: Partial<FinanceState>) => void;
}

const Income: React.FC<IncomeProps> = ({ state, updateState }) => {
  const [selectedId, setSelectedId] = useState<'self' | string>('self');

  const members = useMemo(() => [
    { id: 'self', name: state.profile.firstName || 'Primary', relation: 'Self', income: state.profile.income },
    ...state.family.map(f => ({ id: f.id, name: f.name, relation: f.relation, income: f.income }))
  ], [state.profile, state.family]);

  const currentMember = useMemo(() => 
    members.find(m => m.id === selectedId) || members[0]
  , [members, selectedId]);

  const updateIncomeField = (field: keyof DetailedIncome, value: number) => {
    if (selectedId === 'self') {
      updateState({
        profile: {
          ...state.profile,
          income: { ...state.profile.income, [field]: value }
        }
      });
    } else {
      updateState({
        family: state.family.map(f => 
          f.id === selectedId 
            ? { ...f, income: { ...f.income, [field]: value } }
            : f
        )
      });
    }
  };

  const totalIncome = useMemo(() => {
    const i = currentMember.income;
    return (i.salary || 0) + (i.bonus || 0) + (i.reimbursements || 0) + 
           (i.business || 0) + (i.rental || 0) + (i.investment || 0);
  }, [currentMember.income]);

  // Project 5-year growth for current member
  const projectedIncome = useMemo(() => {
    const growth = (currentMember.income.expectedIncrease || 0) / 100;
    return Math.round(totalIncome * Math.pow(1 + growth, 5));
  }, [totalIncome, currentMember.income.expectedIncrease]);

  const IncomeInput = ({ label, icon: Icon, value, field, description }: any) => (
    <div className="group bg-white p-6 rounded-[2.5rem] border border-slate-200 hover:border-indigo-400 transition-all shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-50 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white rounded-2xl transition-all">
            <Icon size={18} />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{label}</label>
            <p className="text-[9px] font-medium text-slate-400 mt-0.5">{description}</p>
          </div>
        </div>
      </div>
      <div className="relative">
        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-300 font-black text-2xl">$</span>
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
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      
      {/* Member Selection Ribbon */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Household Earner Selection</h3>
          <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
            <Users size={12}/> {members.length} Members Active
          </div>
        </div>
        
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
          {members.map(member => (
            <button
              key={member.id}
              onClick={() => setSelectedId(member.id)}
              className={`relative flex-shrink-0 w-48 p-6 rounded-[2.5rem] border-2 transition-all text-left overflow-hidden group ${
                selectedId === member.id 
                  ? 'bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-900/20' 
                  : 'bg-white border-slate-200 text-slate-900 hover:border-indigo-300'
              }`}
            >
              {selectedId === member.id && (
                <div className="absolute top-4 right-4 text-indigo-400 animate-pulse">
                  <CheckCircle2 size={16} />
                </div>
              )}
              <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${selectedId === member.id ? 'text-slate-500' : 'text-slate-400'}`}>
                {member.relation}
              </p>
              <h4 className="text-lg font-black tracking-tight">{member.name}</h4>
              <div className="mt-4 flex items-center justify-between">
                <span className={`text-[10px] font-bold ${selectedId === member.id ? 'text-indigo-400' : 'text-indigo-600'}`}>
                  ${((member.income.salary || 0) + (member.income.bonus || 0) + (member.income.investment || 0)).toLocaleString()}
                </span>
                <ChevronRight size={14} className={selectedId === member.id ? 'text-white' : 'text-slate-200'} />
              </div>
            </button>
          ))}

          {/* Prompt to add more family members */}
          <button 
            onClick={() => {/* In App.tsx renderView should handle this if view state is lifted */ window.location.hash = '#family'}} 
            className="flex-shrink-0 w-48 p-6 rounded-[2.5rem] border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center gap-2 group hover:bg-indigo-50 hover:border-indigo-200 transition-all"
          >
            <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 group-hover:border-indigo-200 transition-all">
              <Plus size={20} />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Add Member</span>
          </button>
        </div>
      </div>

      {/* Main Context Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Income Details Form */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center justify-between bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Briefcase size={120} />
             </div>
             <div>
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-2">Income Stream Analysis</p>
                <h2 className="text-3xl font-black text-slate-900">{currentMember.name}'s Benefits</h2>
                <p className="text-sm font-medium text-slate-500 max-w-sm mt-2">Adjust monthly inflows and expected annual hikes to project wealth trajectory.</p>
             </div>
             <div className="text-right hidden sm:block">
                <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-emerald-100 mb-2">
                   Active Inflow
                </div>
                <p className="text-3xl font-black text-slate-900">${totalIncome.toLocaleString()}</p>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-4">Core Earnings</h4>
              <IncomeInput label="Base Salary" icon={Briefcase} value={currentMember.income.salary} field="salary" description="Net take-home after tax" />
              <IncomeInput label="Regular Bonus" icon={Sparkles} value={currentMember.income.bonus} field="bonus" description="Performance/annual payouts" />
              <IncomeInput label="Reimbursements" icon={Coins} value={currentMember.income.reimbursements} field="reimbursements" description="Travel, medical, telephone" />
            </div>
            <div className="space-y-6">
              <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-4">Secondary Flows</h4>
              <IncomeInput label="Business Inflow" icon={Calculator} value={currentMember.income.business} field="business" description="Side ventures or consulting" />
              <IncomeInput label="Rental Yield" icon={Home} value={currentMember.income.rental} field="rental" description="Real estate passive income" />
              <IncomeInput label="Dividends/Interests" icon={TrendingUp} value={currentMember.income.investment} field="investment" description="Yield from assets" />
            </div>
          </div>
        </div>

        {/* Sidebar Projections */}
        <div className="space-y-8">
          
          {/* Growth Lab */}
          <div className="bg-white p-10 rounded-[3.5rem] border border-slate-200 shadow-sm flex flex-col space-y-8">
             <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                   <TrendingUp className="text-indigo-600" size={20} /> Career Growth
                </h3>
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><LineChart size={18}/></div>
             </div>
             
             <div className="space-y-6">
                <div className="flex justify-between items-center">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expected Increase</span>
                   <span className="text-2xl font-black text-indigo-600">{currentMember.income.expectedIncrease}%</span>
                </div>
                <input 
                   type="range" min="0" max="40" step="1"
                   value={currentMember.income.expectedIncrease}
                   onChange={(e) => updateIncomeField('expectedIncrease', parseInt(e.target.value))}
                   className="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex justify-between text-[8px] font-black text-slate-300 uppercase tracking-tighter">
                   <span>Conservative</span>
                   <span>Moderate</span>
                   <span>Aggressive</span>
                </div>
             </div>

             <div className="pt-8 border-t border-slate-50 space-y-6">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">5-Year Projected Inflow</p>
                  <div className="flex items-baseline gap-2">
                    <h4 className="text-3xl font-black text-slate-900">${projectedIncome.toLocaleString()}</h4>
                    <span className="text-[10px] font-black text-emerald-500 flex items-center gap-0.5">
                      <ArrowUpRight size={12}/> {totalIncome > 0 ? Math.round((projectedIncome/totalIncome - 1) * 100) : 0}%
                    </span>
                  </div>
                </div>
                <div className="p-4 bg-slate-950 rounded-[2rem] text-white">
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Strategy Tip</p>
                   <p className="text-[10px] font-medium leading-relaxed text-slate-400 italic">
                     "Allocating 50% of your annual {currentMember.income.expectedIncrease}% raise to Equity will shave 18 months off your retirement goal."
                   </p>
                </div>
             </div>
          </div>

          {/* Combined Household Summary */}
          <div className="bg-indigo-600 p-10 rounded-[3.5rem] text-white space-y-6 relative overflow-hidden group shadow-2xl shadow-indigo-600/30">
             <div className="absolute bottom-0 right-0 w-48 h-48 bg-white/10 blur-[80px] rounded-full translate-x-1/2 translate-y-1/2 group-hover:scale-110 transition-transform duration-1000" />
             <div className="p-3 bg-white/20 rounded-2xl w-fit"><Wallet size={24}/></div>
             <div>
                <p className="text-[10px] font-black text-indigo-200 uppercase tracking-[0.2em] mb-1">Combined Monthly Household</p>
                <h3 className="text-4xl font-black">
                  ${(state.family.reduce((acc, f) => {
                    const i = f.income;
                    return acc + (i.salary || 0) + (i.bonus || 0) + (i.reimbursements || 0) + (i.business || 0) + (i.rental || 0) + (i.investment || 0);
                  }, 0) + 
                  ((state.profile.income.salary || 0) + (state.profile.income.bonus || 0) + (state.profile.income.reimbursements || 0) + (state.profile.income.business || 0) + (state.profile.income.rental || 0) + (state.profile.income.investment || 0))).toLocaleString()}
                </h3>
             </div>
             <button onClick={() => {/* Lifted state usually needed to set dashboard, assuming App handles hash/state */ window.location.hash = '#dashboard'}} className="w-full py-4 bg-white text-indigo-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center justify-center gap-2">
                View Cash Flow Radar <ChevronRight size={14} />
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Income;
