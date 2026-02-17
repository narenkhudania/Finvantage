
import React, { useState } from 'react';
import { 
  User, Shield, Database, LogOut, Save, RefreshCw, 
  ChevronRight, ArrowUpRight, Zap, Calculator, 
  Trash2, FileJson, Copy, CheckCircle2, Settings as SettingsIcon,
  Layout
} from 'lucide-react';
import { FinanceState } from '../types';

interface SettingsProps {
  state: FinanceState;
  updateState: (data: Partial<FinanceState>) => void;
  onLogout: () => void;
}

const Settings: React.FC<SettingsProps> = ({ state, updateState, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'system' | 'datalab'>('profile');
  const [copied, setCopied] = useState(false);

  const copyData = () => {
    navigator.clipboard.writeText(JSON.stringify(state, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-1000 pb-24">
      {/* Strategic Header */}
      <div className="bg-[#0b0f1a] p-12 md:p-16 rounded-[5rem] text-white relative overflow-hidden shadow-2xl shadow-indigo-900/30">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 blur-[120px] rounded-full translate-x-1/4 -translate-y-1/4" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-indigo-500/10 text-indigo-300 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-indigo-500/20 mb-6">
            <SettingsIcon size={14}/> Environment Configuration
          </div>
          <h2 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.85]">System <br/><span className="text-indigo-500">Settings.</span></h2>
        </div>
      </div>

      <div className="flex p-1.5 bg-white rounded-[2.5rem] border border-slate-200 w-fit mx-auto shadow-sm sticky top-28 z-40">
        <button onClick={() => setActiveTab('profile')} className={`px-8 py-3.5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'profile' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-900'}`}><User size={14}/> Profile</button>
        <button onClick={() => setActiveTab('system')} className={`px-8 py-3.5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'system' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-900'}`}><Shield size={14}/> System</button>
        <button onClick={() => setActiveTab('datalab')} className={`px-8 py-3.5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'datalab' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-900'}`}><Database size={14}/> Data Lab</button>
      </div>

      {activeTab === 'profile' && (
        <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-6">
           <div className="bg-white p-12 rounded-[4rem] border border-slate-200 shadow-sm space-y-10">
              <div className="flex items-center gap-6">
                 <div className="w-20 h-20 bg-slate-900 rounded-[2rem] flex items-center justify-center text-white shadow-xl shadow-slate-900/20"><User size={40}/></div>
                 <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">{state.profile.firstName} {state.profile.lastName}</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{state.profile.email} • {state.profile.city}</p>
                 </div>
              </div>
              
              <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-50">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identity Display</label>
                    <input type="text" value={state.profile.firstName} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold" disabled />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Location Context</label>
                    <input type="text" value={state.profile.city} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold" disabled />
                 </div>
              </div>
           </div>
           
           <div className="bg-rose-50 p-12 rounded-[4rem] border border-rose-100 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="space-y-2">
                 <h4 className="text-xl font-black text-rose-900">Session Termination</h4>
                 <p className="text-sm font-medium text-rose-700 leading-relaxed max-w-md">Logging out will clear the current browser session and reset the local encryption state.</p>
              </div>
              <button onClick={onLogout} className="px-10 py-5 bg-rose-600 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all flex items-center gap-2 shadow-xl shadow-rose-600/20"><LogOut size={16}/> Terminate Access</button>
           </div>
        </div>
      )}

      {activeTab === 'datalab' && (
        <div className="max-w-5xl mx-auto space-y-8 animate-in slide-in-from-bottom-6">
           <div className="bg-white p-12 rounded-[4rem] border border-slate-200 shadow-sm space-y-8">
              <div className="flex justify-between items-center">
                 <div className="flex items-center gap-4">
                    <div className="p-4 bg-indigo-50 text-indigo-600 rounded-[1.5rem]"><FileJson size={24}/></div>
                    <h3 className="text-2xl font-black text-slate-900">Master State Inspector</h3>
                 </div>
                 <div className="flex gap-3">
                    <button onClick={copyData} className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-600 transition-all">
                       {copied ? <CheckCircle2 size={14}/> : <Copy size={14}/>} {copied ? 'State Copied' : 'Copy JSON'}
                    </button>
                 </div>
              </div>
              <div className="bg-slate-950 rounded-[3rem] p-8 text-emerald-400 font-mono text-[11px] overflow-auto max-h-[500px] border border-white/5 no-scrollbar shadow-inner">
                 <pre>{JSON.stringify(state, null, 2)}</pre>
              </div>
              <div className="flex items-center gap-4 p-8 bg-amber-50 rounded-[3rem] border border-amber-100">
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
           <div className="bg-white p-12 rounded-[4rem] border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-8">
              {[
                { title: 'Cloud Synchronization', icon: RefreshCw, status: 'Active', desc: 'Sync state across multi-terminal nodes.' },
                { title: 'Encryption Standard', icon: Shield, status: 'AES-256', desc: 'Local-only data residency enabled.' },
                { title: 'Tax Jurisdiction', icon: Calculator, status: 'India', desc: 'Sourcing tax rules from FY 2024-25.' },
                { title: 'Terminal Sound', icon: Zap, status: 'Disabled', desc: 'Auditory feedback for AI generation.' },
              ].map((sys, i) => (
                <div key={i} className="p-8 bg-slate-50 rounded-[3rem] border border-slate-100 group hover:border-indigo-400 transition-all flex flex-col justify-between h-56">
                   <div className="flex justify-between items-start">
                      <div className="p-4 bg-white rounded-2xl text-slate-400 group-hover:text-indigo-600 transition-colors shadow-sm"><sys.icon size={20}/></div>
                      <span className="px-3 py-1 bg-white border border-slate-200 rounded-full text-[9px] font-black uppercase tracking-widest text-slate-500">{sys.status}</span>
                   </div>
                   <div>
                      <h4 className="text-lg font-black text-slate-900">{sys.title}</h4>
                      <p className="text-xs font-bold text-slate-400 mt-1">{sys.desc}</p>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
