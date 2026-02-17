
import React from 'react';
import { 
  Bell, CheckCircle2, AlertCircle, Info, TrendingUp, 
  Zap, ArrowRight, Trash2, ShieldCheck, Clock
} from 'lucide-react';
import { FinanceState, Notification } from '../types';

const Notifications: React.FC<{ state: FinanceState, updateState: (data: Partial<FinanceState>) => void }> = ({ state, updateState }) => {
  const notifications = state.notifications || [];

  const markAllRead = () => {
    updateState({ notifications: notifications.map(n => ({ ...n, read: true })) });
  };

  const clearAll = () => {
    updateState({ notifications: [] });
  };

  const removeOne = (id: string) => {
    updateState({ notifications: notifications.filter(n => n.id !== id) });
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-1000 pb-24">
      {/* Strategic Header */}
      <div className="bg-[#0b0f1a] p-12 md:p-16 rounded-[5rem] text-white relative overflow-hidden shadow-2xl shadow-indigo-900/30">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 blur-[120px] rounded-full translate-x-1/4 -translate-y-1/4" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-12">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-indigo-500/10 text-indigo-300 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-indigo-500/20">
              <Bell size={14}/> Tactical Alert Hub
            </div>
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.85]">Alert <br/><span className="text-indigo-500">Center.</span></h2>
            <p className="text-slate-400 text-lg font-medium max-w-lg leading-relaxed">
              Real-time synchronization of household financial anomalies and strategy updates.
            </p>
          </div>
          <div className="flex gap-4">
             <button onClick={markAllRead} className="px-8 py-4 bg-white/5 border border-white/10 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">Mark All Seen</button>
             <button onClick={clearAll} className="px-8 py-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-[2rem] text-[10px] font-black uppercase tracking-widest hover:bg-rose-500/20 transition-all">Clear Logs</button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        {notifications.length === 0 ? (
          <div className="py-32 bg-white rounded-[5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-6 opacity-60">
             <div className="p-8 bg-slate-50 rounded-[3rem] text-slate-300 shadow-inner"><Bell size={64} /></div>
             <div><h4 className="font-black text-slate-900 uppercase text-sm tracking-widest">No New Alerts</h4><p className="text-slate-400 font-medium">All financial streams are operating within nominal parameters.</p></div>
          </div>
        ) : (
          notifications.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((note) => (
            <div key={note.id} className={`bg-white p-8 md:p-10 rounded-[3.5rem] border border-slate-200 shadow-sm relative overflow-hidden group transition-all hover:border-indigo-400 flex flex-col md:flex-row items-center gap-8 ${note.read ? 'opacity-80' : ''}`}>
               {!note.read && <div className="absolute top-8 left-8 w-3 h-3 bg-indigo-600 rounded-full shadow-[0_0_15px_rgba(79,70,229,0.5)] animate-pulse" />}
               
               <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center shrink-0 shadow-lg transition-all ${
                 note.type === 'critical' ? 'bg-rose-50 text-rose-600' :
                 note.type === 'strategy' ? 'bg-indigo-50 text-indigo-600' :
                 'bg-emerald-50 text-emerald-600'
               }`}>
                  {note.type === 'critical' ? <AlertCircle size={28}/> : note.type === 'strategy' ? <Zap size={28}/> : <ShieldCheck size={28}/>}
               </div>

               <div className="flex-1 text-center md:text-left space-y-1">
                  <div className="flex flex-col md:flex-row md:items-center gap-2">
                     <h4 className="text-xl font-black text-slate-900 tracking-tight">{note.title}</h4>
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><Clock size={10}/> {new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-500 leading-relaxed">{note.message}</p>
               </div>

               <div className="flex items-center gap-3">
                  <button className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center gap-2">Explore Move <ArrowRight size={14}/></button>
                  <button onClick={() => removeOne(note.id)} className="p-3 bg-slate-50 text-slate-300 hover:text-rose-500 rounded-xl transition-all"><Trash2 size={16}/></button>
               </div>
            </div>
          ))
        )}
      </div>

      {notifications.length > 0 && (
        <div className="max-w-4xl mx-auto p-10 bg-slate-950 rounded-[4rem] text-white flex items-center justify-between shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 blur-[60px] rounded-full" />
           <div className="flex items-center gap-6 relative z-10">
              <div className="p-4 bg-white/5 rounded-2xl text-emerald-400 shadow-inner"><TrendingUp size={24}/></div>
              <div>
                 <h4 className="text-lg font-black tracking-tight">Strategy Execution Engine</h4>
                 <p className="text-xs text-slate-400 font-medium">Auto-generating new moves based on 14 data variables.</p>
              </div>
           </div>
           <button className="px-8 py-4 bg-indigo-600 rounded-[2rem] text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20 relative z-10">Run Global Audit</button>
        </div>
      )}
    </div>
  );
};

export default Notifications;
