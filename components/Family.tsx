
import React, { useState } from 'react';
import { Plus, Users, Trash2, Heart, User, CheckCircle2, ArrowRight } from 'lucide-react';
import { FamilyMember, FinanceState, Relation, DetailedIncome } from '../types';

interface FamilyProps {
  state: FinanceState;
  updateState: (data: Partial<FinanceState>) => void;
  setView: (view: any) => void;
}

const Family: React.FC<FamilyProps> = ({ state, updateState, setView }) => {
  const [showAdd, setShowAdd] = useState(false);
  
  const initialIncome: DetailedIncome = {
    salary: 0,
    bonus: 0,
    reimbursements: 0,
    business: 0,
    rental: 0,
    investment: 0,
    expectedIncrease: 5
  };

  const [newMember, setNewMember] = useState<Omit<FamilyMember, 'id'>>({
    name: '',
    relation: 'Spouse',
    age: 30,
    isDependent: true,
    income: { ...initialIncome },
    monthlyExpenses: 0
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const member: FamilyMember = { ...newMember, id: Math.random().toString(36).substr(2, 9) };
    updateState({ family: [...state.family, member] });
    setShowAdd(false);
    setNewMember({ name: '', relation: 'Spouse', age: 30, isDependent: true, income: { ...initialIncome }, monthlyExpenses: 0 });
  };

  const removeMember = (id: string) => {
    updateState({ family: state.family.filter(m => m.id !== id) });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="space-y-4">
          <h3 className="text-2xl font-black text-slate-900">Step 1: Family Profile</h3>
          <p className="text-slate-500 font-medium max-w-lg">Define who lives in your household. This is required before we can map out individual income streams and benefits.</p>
          <div className="flex gap-4">
             <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1.5 rounded-full">
               <Users size={14}/> {state.family.length} Added
             </div>
             {state.family.length > 0 && (
               <button 
                onClick={() => setView('income')}
                className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1.5 rounded-full hover:bg-emerald-100 transition-colors"
               >
                 Go to Income Mapping <ArrowRight size={14}/>
               </button>
             )}
          </div>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="px-10 py-6 bg-slate-900 text-white rounded-[2rem] hover:bg-slate-800 transition-all flex items-center gap-3 font-black uppercase text-sm tracking-widest shadow-2xl shadow-slate-900/20"
        >
          <Plus size={20} /> Add Member
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border-2 border-indigo-100 shadow-sm relative overflow-hidden h-48 flex flex-col justify-center">
          <div className="absolute top-0 right-0 p-2 bg-indigo-600 text-[8px] font-black text-white rounded-bl-xl uppercase tracking-widest">Primary</div>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
              <User size={28} />
            </div>
            <div>
              <h4 className="font-black text-slate-900 text-lg">{state.profile.firstName} (Self)</h4>
              <p className="text-xs font-bold text-slate-400">Head of Household</p>
            </div>
          </div>
        </div>

        {state.family.map((member) => (
          <div key={member.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm group hover:border-indigo-300 transition-all h-48 flex flex-col justify-center">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                  <Users size={28} />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-lg">{member.name}</h4>
                  <p className="text-xs font-bold text-slate-400">{member.relation} • Age {member.age}</p>
                </div>
              </div>
              <button 
                onClick={() => removeMember(member.id)}
                className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
            <div className="mt-4 flex justify-start">
               <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${member.isDependent ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                 {member.isDependent ? 'Dependent' : 'Independent'}
               </span>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3.5rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-10 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900">Add Household Member</h3>
              <button onClick={() => setShowAdd(false)} className="p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-900 transition-colors">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-10 space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                <input required type="text" value={newMember.name} onChange={e => setNewMember({...newMember, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold outline-none" placeholder="e.g. Jane Smith" />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Relation</label>
                  <select value={newMember.relation} onChange={e => setNewMember({...newMember, relation: e.target.value as Relation})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold outline-none">
                    <option>Spouse</option>
                    <option>Child</option>
                    <option>Parent</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Age</label>
                  <input required type="number" value={newMember.age} onChange={e => setNewMember({...newMember, age: parseInt(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold outline-none" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button type="button" onClick={() => setNewMember({...newMember, isDependent: !newMember.isDependent})} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${newMember.isDependent ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                  {newMember.isDependent ? 'Dependent' : 'Independent'}
                </button>
              </div>
              <button type="submit" className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black text-lg shadow-xl shadow-slate-900/10">Add to Profile</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Family;
