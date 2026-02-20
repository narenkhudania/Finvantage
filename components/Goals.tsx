
import React, { useState, useMemo } from 'react';
import { 
  Target, Calendar, Plus, Trash2, Home, Car, GraduationCap, Heart, 
  Rocket, Coffee, Sparkles, ChevronRight, Zap, Plane, 
  Map, Building, Baby, Gift, Scroll, ListTree, Calculator, 
  ArrowLeft, RefreshCw, Hammer, ShoppingCart, Clock, CheckCircle2,
  TrendingUp, AlertCircle, ArrowUpRight, ArrowRight, Edit3, Eye,
  Info, DollarSign, User, Wallet, Percent, LayoutGrid, Layers,
  BarChart3, Settings2
} from 'lucide-react';
import { Goal, GoalType, FinanceState, RelativeDate, RelativeDateType, ResourceBucket, ExpenseItem } from '../types';
import { parseNumber } from '../lib/validation';

const GOAL_ICONS: Record<GoalType, any> = {
  'Retirement': Coffee,
  'Child Education': GraduationCap,
  'Child Marriage': Heart,
  'Vacation': Plane,
  'Car': Car,
  'Land / Home': Home,
  'Commercial': Building,
  'Home Renovation': Hammer,
  'Holiday Home': Map,
  'Corpus for Start-up': Rocket,
  'Charity / Philanthropy': Gift,
  'Child-birth Expenses': Baby,
  'Big Purchases': ShoppingCart,
  'Estate for Children': Scroll,
  'Others': Target
};

const Goals: React.FC<{ state: FinanceState, updateState: (data: Partial<FinanceState>) => void }> = ({ state, updateState }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [step, setStep] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formWarning, setFormWarning] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  
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

  const initialNewGoal: Partial<Goal> = {
    type: 'Retirement',
    description: '',
    priority: state.goals.length + 1,
    resourceBuckets: ['Equity & MF', 'Cashflow Surplus'],
    isRecurring: false,
    frequency: 'Yearly',
    startDate: { type: 'Age', value: 60 },
    endDate: { type: 'Age', value: 60 },
    targetAmountToday: 0,
    inflationRate: 6,
    currentAmount: 0,
  };

  const [newGoal, setNewGoal] = useState<Partial<Goal>>(initialNewGoal);

  const handleOpenAdd = () => {
    setEditingId(null);
    setNewGoal({...initialNewGoal, priority: state.goals.length + 1});
    setStep(1);
    setShowAdd(true);
  };

  const handleEdit = (goal: Goal) => {
    setEditingId(goal.id);
    setNewGoal(goal);
    setStep(1);
    setShowAdd(true);
  };

  const handleSave = () => {
    setFormError(null);
    setFormWarning(null);

    const description = (newGoal.description || '').trim();
    const targetAmount = parseNumber(newGoal.targetAmountToday || 0, 0);
    const currentAmount = parseNumber(newGoal.currentAmount || 0, 0);
    const inflationRate = parseNumber(newGoal.inflationRate || 0, 0);
    const resourceBuckets = newGoal.resourceBuckets || [];
    const startDate = newGoal.startDate;
    const endDate = newGoal.endDate;

    if (description.length < 2) {
      setFormError('Description is required.');
      return;
    }
    if (targetAmount <= 0) {
      setFormError('Target amount must be greater than 0.');
      return;
    }
    if (currentAmount < 0) {
      setFormError('Current amount cannot be negative.');
      return;
    }
    if (inflationRate < 0 || inflationRate > 15) {
      setFormError('Inflation rate must be between 0% and 15%.');
      return;
    }
    if (!startDate || !endDate) {
      setFormError('Start and end dates are required.');
      return;
    }
    const startYear = resolveYear(startDate);
    const endYear = resolveYear(endDate);
    if (startYear > endYear) {
      setFormError('Start date must be before end date.');
      return;
    }
    if (newGoal.isRecurring && !newGoal.frequency) {
      setFormError('Frequency is required for recurring goals.');
      return;
    }
    if (resourceBuckets.length === 0) {
      setFormError('Select at least one resource bucket.');
      return;
    }
    if (currentAmount > targetAmount) {
      setFormWarning('Current amount exceeds target. Please confirm.');
      setNotice('Goal saved with current amount above target. Consider adjusting.');
      setTimeout(() => setNotice(null), 4000);
    }

    const sanitizedGoal = {
      ...newGoal,
      description,
      targetAmountToday: targetAmount,
      currentAmount: Math.max(0, currentAmount),
      inflationRate,
    } as Goal;

    if (editingId) {
      updateState({ goals: state.goals.map(g => g.id === editingId ? { ...sanitizedGoal, id: editingId } as Goal : g) });
    } else {
      const goal = { ...sanitizedGoal, id: Math.random().toString(36).substr(2, 9) } as Goal;
      updateState({ goals: [...state.goals, goal] });
    }
    setShowAdd(false);
    setEditingId(null);
  };

  const removeGoal = (id: string) => {
    updateState({ goals: state.goals.filter(g => g.id !== id) });
  };

  const RelativeDateInput = ({ label, value, onChange }: { label: string, value: RelativeDate, onChange: (v: RelativeDate) => void }) => {
    const types: RelativeDateType[] = ['Year', 'Age', 'Retirement', 'LifeExpectancy'];
    
    // Preset offsets for +/- 5 years requirement
    const presets = [-5, -2, 0, 2, 5];

    return (
      <div className="space-y-4 p-6 bg-slate-50 border border-slate-200 rounded-[2rem] hover:border-teal-300 transition-all shadow-sm">
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block px-1 text-left">{label}</label>
        <div className="space-y-4">
          <div className="flex p-1 bg-slate-200/50 rounded-2xl overflow-x-auto no-scrollbar gap-1">
            {types.map(t => (
              <button 
                key={t} 
                type="button" 
                onClick={() => onChange({ ...value, type: t })} 
                className={`flex-1 min-w-[80px] py-2.5 text-[9px] font-black uppercase tracking-tight rounded-xl transition-all ${value.type === t ? 'bg-white text-teal-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t}
              </button>
            ))}
          </div>
          
          {(value.type === 'Retirement' || value.type === 'LifeExpectancy') && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {presets.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onChange({ ...value, value: p })}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black border transition-all ${value.value === p ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-400 border-slate-100'}`}
                >
                  {p === 0 ? 'Exact' : (p > 0 ? `+${p}y` : `${p}y`)}
                </button>
              ))}
            </div>
          )}

          <div className="relative">
             <input 
               type="number" 
               value={value.value} 
               onChange={(e) => onChange({ ...value, value: parseInt(e.target.value) || 0 })} 
               className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-2xl font-black outline-none focus:ring-4 focus:ring-teal-600/5 focus:border-teal-600 shadow-sm" 
               placeholder="n" 
             />
             <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 font-bold text-[9px] uppercase tracking-widest pointer-events-none">
               {value.type === 'Year' ? 'Year Value' : 'Value/Offset'}
             </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 pb-24">
      {notice && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-2xl px-6 py-3 text-[10px] font-black uppercase tracking-widest">
          {notice}
        </div>
      )}
      {/* Strategic Header */}
      <div className="surface-dark p-12 md:p-20 rounded-[5rem] text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-teal-600/10 blur-[150px] rounded-full translate-x-1/4 -translate-y-1/4" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-12">
          <div className="space-y-6 text-left">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-teal-500/10 text-teal-300 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-teal-500/20">
              <Target size={14}/> Goal Intelligence
            </div>
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.85]">Strategic <br/><span className="text-teal-500">Missions.</span></h2>
            <p className="text-slate-400 text-lg font-medium max-w-lg leading-relaxed">
              Consolidated life targets for <span className="text-white font-bold">{state.profile.firstName || 'User'}</span> with actuarial precision.
            </p>
          </div>
          <button 
            onClick={() => (showAdd ? setShowAdd(false) : handleOpenAdd())}
            className="px-12 py-8 bg-teal-600 hover:bg-teal-50 text-white hover:text-teal-600 rounded-[2.5rem] transition-all flex items-center gap-4 font-black uppercase text-sm tracking-[0.25em] shadow-2xl active:scale-95 shrink-0"
          >
            <Plus size={22} /> {showAdd ? 'Close Form' : 'New Milestone'}
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-white rounded-[2.5rem] md:rounded-[5rem] w-full shadow-2xl ring-1 ring-slate-200/70 overflow-hidden animate-in slide-in-from-top-3 duration-300 border border-white/20">
          <div className="p-6 sm:p-10 md:p-12 border-b border-slate-50 flex justify-between items-center bg-white/90">
             <div className="text-left">
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">{editingId ? 'Mission Calibration' : 'Mission Configurator'}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">Step {step} of 3</p>
             </div>
             <button onClick={() => setShowAdd(false)} className="p-4 bg-slate-50 hover:bg-rose-50 hover:text-rose-500 rounded-3xl text-slate-400 transition-all"><Plus size={32} className="rotate-45" /></button>
          </div>

          <div className="p-6 sm:p-10 md:p-12 space-y-12 bg-white/70">
             {formError && (
               <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-bold">
                 {formError}
               </div>
             )}
             {formWarning && (
               <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs font-bold">
                 {formWarning}
               </div>
             )}
             {step === 1 && (
               <div className="space-y-12 animate-in fade-in duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                     <div className="space-y-4 text-left">
                        <label className="text-[12px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2"><LayoutGrid size={18} className="text-teal-600"/> Goal Topology</label>
                        <select value={newGoal.type} onChange={e => setNewGoal({...newGoal, type: e.target.value as GoalType})} className="w-full bg-white border border-slate-200 rounded-[2rem] px-8 py-6 text-xl font-black outline-none focus:ring-8 focus:ring-teal-600/5 focus:border-teal-600 shadow-sm">
                           {Object.keys(GOAL_ICONS).map(type => <option key={type}>{type}</option>)}
                        </select>
                     </div>
                     <div className="space-y-4 text-left">
                        <label className="text-[12px] font-black text-slate-900 uppercase tracking-widest">Priority Rank</label>
                        <div className="relative">
                          <input type="number" min="1" max="20" value={newGoal.priority} onChange={e => setNewGoal({...newGoal, priority: parseInt(e.target.value)})} className="w-full bg-white border border-slate-200 rounded-[2rem] px-8 py-5 text-4xl font-black outline-none focus:ring-8 focus:ring-teal-600/5 shadow-sm" />
                          <div className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-300 font-bold text-xs uppercase tracking-widest">Rank</div>
                        </div>
                     </div>
                  </div>

                  <div className="space-y-4 text-left">
                     <label className="text-[12px] font-black text-slate-900 uppercase tracking-widest">Mission Handle</label>
                     <input type="text" value={newGoal.description} onChange={e => setNewGoal({...newGoal, description: e.target.value})} className="w-full bg-white border border-slate-200 rounded-[2.5rem] px-10 py-7 text-2xl font-black outline-none focus:ring-8 focus:ring-teal-600/5 shadow-sm" placeholder="e.g. World Tour 2030" />
                  </div>

                  <div className="p-8 bg-white rounded-[3rem] border border-slate-200 space-y-8">
                     <div className="flex items-center justify-between">
                        <div className="text-left space-y-1">
                           <h4 className="text-xl font-black text-slate-900 italic">Is this a Recurring Milestone?</h4>
                           <p className="text-xs font-medium text-slate-400">Mark true for recurring life events like annual vacations or vehicle upgrades.</p>
                        </div>
                        <button onClick={() => setNewGoal({...newGoal, isRecurring: !newGoal.isRecurring})} className={`w-20 h-10 rounded-full transition-all relative ${newGoal.isRecurring ? 'bg-teal-600' : 'bg-slate-200'}`}>
                           <div className={`absolute top-1 w-8 h-8 rounded-full bg-white transition-all shadow-md ${newGoal.isRecurring ? 'left-11' : 'left-1'}`} />
                        </button>
                     </div>
                     {newGoal.isRecurring && (
                        <div className="space-y-4 animate-in slide-in-from-top-4 text-left">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Milestone Frequency Strategy</label>
                           <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              {['Monthly', 'Yearly', 'Every 2-5 Years', 'Every 2-15 Years'].map(f => (
                                <button
                                  key={f}
                                  type="button"
                                  onClick={() => setNewGoal({...newGoal, frequency: f as any})}
                                  className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-tight border transition-all ${newGoal.frequency === f ? 'bg-teal-600 text-white border-teal-600 shadow-lg' : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-teal-200'}`}
                                >
                                  {f}
                                </button>
                              ))}
                           </div>
                        </div>
                     )}
                  </div>
                  
                  <button onClick={() => setStep(2)} className="w-full py-8 bg-slate-900 text-white rounded-[3rem] font-black uppercase tracking-[0.3em] hover:bg-teal-600 transition-all flex items-center justify-center gap-4 shadow-xl">Temporal Alignment <ChevronRight size={20}/></button>
               </div>
             )}

             {step === 2 && (
               <div className="space-y-12 animate-in fade-in duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                     <RelativeDateInput label="Temporal Origin (Start)" value={newGoal.startDate!} onChange={v => setNewGoal({...newGoal, startDate: v})} />
                     <RelativeDateInput label="Milestone Horizon (End)" value={newGoal.endDate!} onChange={v => setNewGoal({...newGoal, endDate: v})} />
                  </div>
                  
                  <div className="p-8 bg-teal-600 rounded-[3rem] text-white flex flex-col sm:flex-row items-center justify-between gap-6">
                     <div className="text-left space-y-1 flex-1">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Inflation Index</p>
                        <p className="text-xs font-bold leading-relaxed">Standard India rate for life missions is 6%. Adjust based on category inflation.</p>
                     </div>
                     <div className="flex items-center gap-6 shrink-0">
                        <input type="range" min="0" max="15" step="0.5" value={newGoal.inflationRate} onChange={e => setNewGoal({...newGoal, inflationRate: parseFloat(e.target.value)})} className="w-48 h-1.5 bg-teal-400 rounded-full appearance-none accent-white" />
                        <span className="text-4xl font-black min-w-[70px]">{newGoal.inflationRate}%</span>
                     </div>
                  </div>
                  <button onClick={() => setStep(3)} className="w-full py-8 bg-slate-900 text-white rounded-[3rem] font-black uppercase tracking-[0.3em] hover:bg-teal-600 transition-all flex items-center justify-center gap-4 shadow-xl">Actuarial Calibration <ChevronRight size={20}/></button>
               </div>
             )}

             {step === 3 && (
               <div className="space-y-12 animate-in fade-in duration-500">
                  <div className="surface-dark p-16 rounded-[4rem] text-white space-y-10 relative overflow-hidden shadow-2xl">
                     <div className="absolute top-0 right-0 w-96 h-96 bg-teal-600/10 blur-[150px] rounded-full translate-x-1/2 -translate-y-1/2" />
                     <div className="relative z-10 text-left">
                        <p className="text-[12px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Capital Requirement (Today's Cost)</p>
                        <div className="flex items-center gap-6">
                           <span className="text-4xl md:text-7xl font-black tracking-tighter text-teal-500">₹</span>
                           <input 
                              type="number" 
                              value={newGoal.targetAmountToday || ''} 
                              onChange={e => setNewGoal({...newGoal, targetAmountToday: parseFloat(e.target.value)})} 
                              className="w-full bg-transparent text-4xl md:text-7xl font-black outline-none focus:text-teal-400 placeholder:text-white/10" 
                              placeholder="0.00"
                           />
                        </div>
                     </div>
                  </div>

                  <div className="space-y-6 p-10 bg-white rounded-[3.5rem] border border-slate-200 shadow-sm text-left">
                     <label className="text-[12px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2"><Wallet size={18} className="text-emerald-500"/> Current Funded Amount</label>
                     <input 
                        type="number" 
                        value={newGoal.currentAmount || ''} 
                        onChange={e => setNewGoal({...newGoal, currentAmount: parseFloat(e.target.value)})} 
                        className="w-full bg-slate-50 border border-slate-200 rounded-[2rem] px-8 py-6 text-2xl font-black outline-none focus:ring-8 focus:ring-emerald-600/5 shadow-inner" 
                        placeholder="₹ 0" 
                     />
                  </div>

                  <button onClick={handleSave} className="w-full py-10 bg-teal-600 text-white rounded-[4rem] font-black uppercase tracking-[0.4em] text-xl hover:bg-teal-500 transition-all shadow-2xl flex items-center justify-center gap-6">
                     {editingId ? 'Update Strategic Mission' : 'Deploy Strategic Mission'} <Rocket size={32}/>
                  </button>
               </div>
             )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {state.goals.length === 0 ? (
          <div className="lg:col-span-2 py-32 bg-white rounded-[5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-6 opacity-60">
             <div className="p-8 bg-slate-50 rounded-[3rem] text-slate-300 shadow-inner"><Target size={64} /></div>
             <div><h4 className="font-black text-slate-900 uppercase text-sm tracking-widest">No Active Missions</h4><p className="text-slate-400 font-medium">Define your goals to enable wealth trajectory tracking.</p></div>
          </div>
        ) : (
          state.goals.sort((a,b) => a.priority - b.priority).map((goal) => {
            const Icon = GOAL_ICONS[goal.type] || Target;
            const startYear = resolveYear(goal.startDate);
            const yearsToStart = Math.max(0, startYear - currentYear);
            
            // Calc Inflation Adjusted Target (FV)
            const targetFV = goal.targetAmountToday * Math.pow(1 + (goal.inflationRate / 100), yearsToStart);
            const progressPct = targetFV > 0 ? Math.min(100, (goal.currentAmount / targetFV) * 100) : 0;

            return (
              <div key={goal.id} className="bg-white p-10 md:p-12 rounded-[4.5rem] border border-slate-200 shadow-sm hover:border-teal-400 transition-all flex flex-col gap-8 relative overflow-hidden group">
                 <div className="flex gap-8 items-start mt-4 text-left">
                    <div className={`w-20 h-20 bg-slate-50 text-teal-600 rounded-[2rem] flex items-center justify-center shrink-0 shadow-sm group-hover:bg-teal-600 group-hover:text-white transition-all`}>
                       <Icon size={32}/>
                    </div>
                    <div className="flex-1 space-y-2">
                       <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-teal-600 uppercase tracking-widest px-3 py-1 bg-teal-50 rounded-full">{goal.type}</span>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Priority Rank #{goal.priority}</span>
                       </div>
                       <h4 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">{goal.description || goal.type}</h4>
                       <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Horizon: {startYear} ({yearsToStart}y remaining)</p>
                    </div>
                 </div>

                 {/* Progress Bar with Projections */}
                 <div className="space-y-4">
                    <div className="flex justify-between items-end">
                       <div className="text-left">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Funding Pct (FV)</p>
                          <h5 className="text-2xl font-black text-slate-900">{progressPct.toFixed(1)}%</h5>
                       </div>
                       <div className="text-right">
                          <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest mb-1">FV Target</p>
                          <h5 className="text-lg font-black text-teal-600">₹{Math.round(targetFV).toLocaleString()}</h5>
                       </div>
                    </div>
                    <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                       <div className="h-full bg-teal-600 transition-all duration-1000 ease-out" style={{ width: `${progressPct}%` }} />
                    </div>
                    <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest">
                       <span>Saved: ₹{goal.currentAmount.toLocaleString()}</span>
                       <span>Today's Value: ₹{goal.targetAmountToday.toLocaleString()}</span>
                    </div>
                 </div>

                 <div className="flex gap-3 justify-end mt-4 pt-4 border-t border-slate-50">
                    <button onClick={() => handleEdit(goal)} className="p-4 bg-teal-50 text-teal-600 rounded-2xl hover:bg-teal-600 hover:text-white transition-all shadow-sm flex items-center gap-2 font-black uppercase text-[10px] tracking-widest">
                       <Edit3 size={16}/> Edit Calibration
                    </button>
                    <button onClick={() => removeGoal(goal.id)} className="p-4 bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white transition-all shadow-sm">
                       <Trash2 size={16}/>
                    </button>
                 </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};

export default Goals;
