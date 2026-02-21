
import React, { useState } from 'react';
import { 
  User, Shield, Database, LogOut, Save, RefreshCw, 
  ChevronRight, ArrowUpRight, Zap, Calculator, 
  Trash2, FileJson, Copy, CheckCircle2, Settings as SettingsIcon,
  Layout
} from 'lucide-react';
import { DiscountBucket, FinanceState } from '../types';
import { getRetirementYear, getLifeExpectancyYear } from '../lib/financeMath';

interface SettingsProps {
  state: FinanceState;
  updateState: (data: Partial<FinanceState>) => void;
  onLogout: () => void;
}

const Settings: React.FC<SettingsProps> = ({ state, updateState, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'system' | 'datalab'>('profile');
  const [copied, setCopied] = useState(false);
  const retirementYear = getRetirementYear(state.profile.dob, state.profile.retirementAge);
  const lifeExpectancyYear = getLifeExpectancyYear(state.profile.dob, state.profile.lifeExpectancy);
  const currentYear = new Date().getFullYear();
  const retirementOffset = retirementYear ? retirementYear - currentYear : 30;

  const discountSettings = state.discountSettings;

  const resolveBucketOffsets = (bucket: DiscountBucket) => {
    const start = bucket.startType === 'Retirement'
      ? retirementOffset + bucket.startOffset
      : bucket.startOffset;
    let end = Infinity;
    if (bucket.endType === 'Offset') {
      end = bucket.endOffset ?? start;
    } else if (bucket.endType === 'Retirement') {
      end = retirementOffset + (bucket.endOffset ?? 0);
    }
    return { start, end };
  };

  const validateBuckets = (buckets: DiscountBucket[]) => {
    if (!buckets.length) return 'Add at least one bucket.';
    const ordered = [...buckets].sort((a, b) => {
      const aStart = resolveBucketOffsets(a).start;
      const bStart = resolveBucketOffsets(b).start;
      return aStart - bStart;
    });
    let expectedStart = 0;
    for (let i = 0; i < ordered.length; i++) {
      const { start, end } = resolveBucketOffsets(ordered[i]);
      if (start !== expectedStart) {
        return `Bucket coverage must start at year ${expectedStart} without gaps.`;
      }
      if (end < start) {
        return 'Bucket end year cannot be before start year.';
      }
      if (end === Infinity) {
        if (i !== ordered.length - 1) {
          return 'Infinity bucket must be the last bucket.';
        }
        return null;
      }
      expectedStart = end + 1;
    }
    return null;
  };

  const bucketError = validateBuckets(discountSettings.buckets);

  const updateDiscountSettings = (patch: Partial<typeof discountSettings>) => {
    updateState({
      discountSettings: {
        ...discountSettings,
        ...patch,
      },
    });
  };

  const updateBucket = (index: number, patch: Partial<DiscountBucket>) => {
    const buckets = [...discountSettings.buckets];
    buckets[index] = { ...buckets[index], ...patch };
    updateDiscountSettings({ buckets });
  };

  const removeBucket = (index: number) => {
    const buckets = discountSettings.buckets.filter((_, i) => i !== index);
    updateDiscountSettings({ buckets });
  };

  const addBucket = () => {
    const buckets = [
      ...discountSettings.buckets,
      {
        id: `bucket-${Date.now()}`,
        name: 'New Bucket',
        startType: 'Offset',
        startOffset: 0,
        endType: 'Offset',
        endOffset: 0,
        discountRate: discountSettings.defaultDiscountRate,
        inflationRate: discountSettings.defaultInflationRate,
      } as DiscountBucket,
    ];
    updateDiscountSettings({ buckets });
  };

  const copyData = () => {
    navigator.clipboard.writeText(JSON.stringify(state, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-1000 pb-24">
      {/* Strategic Header */}
      <div className="surface-dark p-8 md:p-16 rounded-[5rem] text-white relative overflow-hidden shadow-2xl shadow-teal-900/30">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-600/10 blur-[120px] rounded-full translate-x-1/4 -translate-y-1/4" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-teal-500/10 text-teal-300 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-teal-500/20 mb-6">
            <SettingsIcon size={14}/> Environment Configuration
          </div>
          <h2 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.85]">System <br/><span className="text-teal-500">Settings.</span></h2>
        </div>
      </div>

      <div className="flex p-1.5 bg-white rounded-[2.5rem] border border-slate-200 w-full md:w-fit mx-auto shadow-sm sticky top-20 md:top-28 z-40 overflow-x-auto no-scrollbar">
        <button onClick={() => setActiveTab('profile')} className={`flex-1 md:flex-none px-4 md:px-8 py-3.5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'profile' ? 'bg-teal-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-900'}`}><User size={14}/> Profile</button>
        <button onClick={() => setActiveTab('system')} className={`flex-1 md:flex-none px-4 md:px-8 py-3.5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'system' ? 'bg-teal-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-900'}`}><Shield size={14}/> System</button>
        <button onClick={() => setActiveTab('datalab')} className={`flex-1 md:flex-none px-4 md:px-8 py-3.5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'datalab' ? 'bg-teal-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-900'}`}><Database size={14}/> Data Lab</button>
      </div>

      {activeTab === 'profile' && (
        <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-6">
           <div className="bg-white p-6 md:p-12 rounded-[4rem] border border-slate-200 shadow-sm space-y-10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                 <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-900 rounded-[2rem] flex items-center justify-center text-white shadow-xl shadow-slate-900/20"><User size={32} className="md:w-10 md:h-10"/></div>
                 <div className="text-left">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">{state.profile.firstName} {state.profile.lastName}</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{state.profile.email} • {state.profile.city}</p>
                 </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 pt-8 border-t border-slate-50">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identity Display</label>
                    <input type="text" value={state.profile.firstName} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold" disabled />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Location Context</label>
                    <input type="text" value={state.profile.city} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold" disabled />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Retirement Year</label>
                    <input type="text" value={retirementYear ?? '—'} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold" disabled />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Life Expectancy Year</label>
                    <input type="text" value={lifeExpectancyYear ?? '—'} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold" disabled />
                 </div>
              </div>
           </div>
           
           <div className="bg-rose-50 p-6 md:p-12 rounded-[4rem] border border-rose-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
              <div className="space-y-2">
                 <h4 className="text-xl font-black text-rose-900">Session Termination</h4>
                 <p className="text-sm font-medium text-rose-700 leading-relaxed max-w-md">Logging out will clear the current browser session and reset the local encryption state.</p>
              </div>
              <button onClick={onLogout} className="w-full sm:w-auto px-10 py-5 bg-rose-600 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-rose-600/20"><LogOut size={16}/> Terminate Access</button>
           </div>
        </div>
      )}

      {activeTab === 'datalab' && (
        <div className="max-w-5xl mx-auto space-y-8 animate-in slide-in-from-bottom-6">
           <div className="bg-white p-6 md:p-12 rounded-[4rem] border border-slate-200 shadow-sm space-y-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                 <div className="flex items-center gap-4">
                    <div className="p-4 bg-teal-50 text-teal-600 rounded-[1.5rem]"><FileJson size={24}/></div>
                    <h3 className="text-2xl font-black text-slate-900">Master State Inspector</h3>
                 </div>
                 <div className="flex gap-3 w-full sm:w-auto">
                    <button onClick={copyData} className="w-full sm:w-auto px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-teal-600 transition-all">
                       {copied ? <CheckCircle2 size={14}/> : <Copy size={14}/>} {copied ? 'State Copied' : 'Copy JSON'}
                    </button>
                 </div>
              </div>
              <div className="surface-dark rounded-[3rem] p-6 md:p-8 text-emerald-400 font-mono text-[10px] md:text-[11px] overflow-auto max-h-[500px] border border-white/5 no-scrollbar shadow-inner">
                 <pre>{JSON.stringify(state, null, 2)}</pre>
              </div>
              <div className="flex items-start gap-4 p-6 md:p-8 bg-amber-50 rounded-[3rem] border border-amber-100">
                 <Zap size={24} className="text-amber-500 shrink-0"/>
                 <p className="text-xs font-bold text-amber-900 italic leading-relaxed">
                   "This is the raw internal state of your financial dashboard. You can copy this data to migrate your profile to another device or for local backup purposes."
                 </p>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'system' && (
        <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-6">
           <div className="bg-white p-6 md:p-12 rounded-[4rem] border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
              {[
                { title: 'Cloud Synchronization', icon: RefreshCw, status: 'Active', desc: 'Sync state across multi-terminal nodes.' },
                { title: 'Encryption Standard', icon: Shield, status: 'AES-256', desc: 'Local-only data residency enabled.' },
                { title: 'Tax Jurisdiction', icon: Calculator, status: 'India', desc: 'Sourcing tax rules from FY 2024-25.' },
                { title: 'Terminal Sound', icon: Zap, status: 'Disabled', desc: 'Auditory feedback for AI generation.' },
              ].map((sys, i) => (
                <div key={i} className="p-6 md:p-8 bg-slate-50 rounded-[3rem] border border-slate-100 group hover:border-teal-400 transition-all flex flex-col justify-between min-h-[180px] md:h-56">
                   <div className="flex justify-between items-start">
                      <div className="p-4 bg-white rounded-2xl text-slate-400 group-hover:text-teal-600 transition-colors shadow-sm"><sys.icon size={20}/></div>
                      <span className="px-3 py-1 bg-white border border-slate-200 rounded-full text-[9px] font-black uppercase tracking-widest text-slate-500">{sys.status}</span>
                   </div>
                   <div>
                      <h4 className="text-lg font-black text-slate-900">{sys.title}</h4>
                      <p className="text-xs font-bold text-slate-400 mt-1">{sys.desc}</p>
                   </div>
                </div>
              ))}
           </div>

           <div className="bg-white p-6 md:p-12 rounded-[4rem] border border-slate-200 shadow-sm space-y-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                 <div className="flex items-center gap-4">
                    <div className="p-4 bg-teal-50 text-teal-600 rounded-[1.5rem]"><Layout size={24}/></div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-900">Bucketing Strategy</h3>
                      <p className="text-xs font-bold text-slate-400 mt-1">Define discount and inflation buckets for present value calculations.</p>
                    </div>
                 </div>
                 <button onClick={addBucket} className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-teal-600 transition-all">
                   + Add Bucket
                 </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 bg-slate-50 rounded-[2.5rem] border border-slate-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Use Bucketed Discount Rates</p>
                      <p className="text-xs text-slate-400 font-medium">Toggle to apply bucket-specific discounting.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateDiscountSettings({ useBuckets: !discountSettings.useBuckets })}
                      className={`w-16 h-9 rounded-full transition-all relative ${discountSettings.useBuckets ? 'bg-teal-600' : 'bg-slate-200'}`}
                    >
                      <div className={`absolute top-1 w-7 h-7 rounded-full bg-white transition-all shadow-md ${discountSettings.useBuckets ? 'left-8' : 'left-1'}`} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={0}
                      max={30}
                      step={0.1}
                      value={discountSettings.defaultDiscountRate}
                      onChange={e => updateDiscountSettings({ defaultDiscountRate: parseFloat(e.target.value) || 0 })}
                      className="w-28 px-3 py-2 rounded-xl border border-slate-200 text-sm font-black outline-none"
                    />
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Default Discount %</span>
                  </div>
                </div>

                <div className="p-5 bg-slate-50 rounded-[2.5rem] border border-slate-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Bucketed Inflation</p>
                      <p className="text-xs text-slate-400 font-medium">Apply bucket-specific inflation assumptions.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateDiscountSettings({ useBucketInflation: !discountSettings.useBucketInflation })}
                      className={`w-16 h-9 rounded-full transition-all relative ${discountSettings.useBucketInflation ? 'bg-teal-600' : 'bg-slate-200'}`}
                    >
                      <div className={`absolute top-1 w-7 h-7 rounded-full bg-white transition-all shadow-md ${discountSettings.useBucketInflation ? 'left-8' : 'left-1'}`} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={0}
                      max={30}
                      step={0.1}
                      value={discountSettings.defaultInflationRate}
                      onChange={e => updateDiscountSettings({ defaultInflationRate: parseFloat(e.target.value) || 0 })}
                      className="w-28 px-3 py-2 rounded-xl border border-slate-200 text-sm font-black outline-none"
                    />
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Default Inflation %</span>
                  </div>
                </div>
              </div>

              {bucketError && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-rose-600">
                  {bucketError}
                </div>
              )}

              <div className="space-y-4">
                {discountSettings.buckets.map((bucket, index) => (
                  <div key={bucket.id} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end p-5 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bucket Name</label>
                      <input
                        type="text"
                        value={bucket.name}
                        onChange={e => updateBucket(index, { name: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Start</label>
                      <div className="flex gap-2">
                        <select
                          value={bucket.startType}
                          onChange={e => updateBucket(index, { startType: e.target.value as DiscountBucket['startType'] })}
                          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest"
                        >
                          <option value="Offset">Offset</option>
                          <option value="Retirement">Retirement</option>
                        </select>
                        <input
                          type="number"
                          value={bucket.startOffset}
                          onChange={e => updateBucket(index, { startOffset: parseInt(e.target.value) || 0 })}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold outline-none"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">End</label>
                      <div className="flex gap-2">
                        <select
                          value={bucket.endType}
                          onChange={e => updateBucket(index, { endType: e.target.value as DiscountBucket['endType'] })}
                          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest"
                        >
                          <option value="Offset">Offset</option>
                          <option value="Retirement">Retirement</option>
                          <option value="Infinity">∞</option>
                        </select>
                        {bucket.endType !== 'Infinity' && (
                          <input
                            type="number"
                            value={bucket.endOffset ?? 0}
                            onChange={e => updateBucket(index, { endOffset: parseInt(e.target.value) || 0 })}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold outline-none"
                          />
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Discount %</label>
                      <input
                        type="number"
                        step={0.1}
                        value={bucket.discountRate ?? ''}
                        onChange={e => updateBucket(index, { discountRate: parseFloat(e.target.value) })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Inflation %</label>
                      <input
                        type="number"
                        step={0.1}
                        value={bucket.inflationRate ?? ''}
                        onChange={e => updateBucket(index, { inflationRate: parseFloat(e.target.value) })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold outline-none"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button onClick={() => removeBucket(index)} className="p-3 bg-rose-50 text-rose-500 rounded-xl">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
