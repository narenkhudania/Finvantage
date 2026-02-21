
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Bell, Menu, UserCircle, LogOut, ChevronDown, 
  User, Search, Zap, Activity, Shield,
  ArrowRight, ArrowUpRight, ChevronRight, Settings
} from 'lucide-react';
import { FinanceState, View } from '../types';
import { getJourneyProgress } from '../lib/journey';

interface HeaderProps {
  onMenuClick: () => void;
  title: string;
  state: FinanceState;
  setView: (view: View) => void;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, title, state, setView, onLogout }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = state.notifications?.filter(n => !n.read).length || 0;
  const { completionPct, nextStep } = useMemo(() => getJourneyProgress(state), [state]);
  const hideJourney = title === 'dashboard';
  const commandDetailViews = new Set<View>([
    'risk-profile',
    'insurance',
    'tax-estate',
    'action-plan',
    'monthly-savings',
  ]);
  const showBack = commandDetailViews.has(title as View);

  return (
    <header className="min-h-[80px] md:h-24 bg-white/75 backdrop-blur-xl border-b border-white/60 shadow-sm sticky top-0 z-[50] px-4 sm:px-6 md:px-12 py-3 md:py-0 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0">
      <div className="flex items-start gap-3 md:gap-4 w-full md:w-auto">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2.5 bg-slate-50 hover:bg-teal-50 hover:text-teal-600 rounded-xl transition-all"
        >
          <Menu size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-black text-slate-900 capitalize tracking-tight leading-none font-display">
            {title.replace('-', ' ')}
          </h1>
          {showBack && (
            <button
              onClick={() => setView('dashboard')}
              className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition"
            >
              <ArrowRight size={12} className="rotate-180" /> Back to Command Center
            </button>
          )}
          {!hideJourney && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Journey Active</p>
            </div>
          )}
          {!hideJourney && completionPct < 100 && (
            <>
              <div className="hidden md:flex items-center gap-3 mt-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Journey {completionPct}%</span>
                <div className="w-28 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-600 transition-all" style={{ width: `${completionPct}%` }} />
                </div>
                {nextStep && (
                  <button
                    onClick={() => setView(nextStep.view)}
                    className="text-[9px] font-black uppercase tracking-widest text-teal-600 hover:text-teal-700 transition-colors"
                  >
                    Next: {nextStep.label}
                  </button>
                )}
              </div>
              <div className="md:hidden mt-3 w-full rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <span>Journey {completionPct}%</span>
                  {nextStep && (
                    <button
                      onClick={() => setView(nextStep.view)}
                      className="text-[10px] font-black uppercase tracking-widest text-teal-600"
                    >
                      Next: {nextStep.label}
                    </button>
                  )}
                </div>
                <div className="mt-2 w-full h-2 bg-white rounded-full overflow-hidden border border-slate-100">
                  <div className="h-full bg-teal-600 transition-all" style={{ width: `${completionPct}%` }} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto justify-end">
        <button 
          onClick={() => setView('notifications')}
          className="p-3 bg-slate-50 text-slate-400 hover:bg-teal-50 hover:text-teal-600 rounded-2xl relative transition-all group"
        >
          <Bell size={20} className="group-hover:rotate-12 transition-transform" />
          {unreadCount > 0 && (
             <span className="absolute top-2.5 right-2.5 w-4 h-4 bg-rose-500 text-white rounded-full border-2 border-white flex items-center justify-center text-[8px] font-black">
               {unreadCount}
             </span>
          )}
        </button>

        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-4 p-1 pl-4 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-slate-100 transition-all group"
          >
            <div className="hidden md:block text-right">
              <p className="text-xs font-black text-slate-900 tracking-tight leading-none">{state.profile.firstName || 'Primary User'}</p>
              <p className="text-[8px] font-black text-teal-500 uppercase tracking-widest mt-1">Terminal Active</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-lg overflow-hidden transition-transform group-hover:scale-105">
               <User size={20} />
            </div>
            <ChevronDown size={14} className={`text-slate-400 transition-transform duration-300 mr-2 ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-3 w-64 bg-white rounded-3xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
              <div className="p-2 space-y-1">
                <div className="p-4 bg-slate-50 rounded-2xl mb-1">
                   <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Session Data Node</p>
                   <p className="text-[10px] font-bold text-slate-600 truncate">{state.profile.email || 'Local Terminal'}</p>
                </div>
                <button onClick={() => { setView('settings'); setIsDropdownOpen(false); }} className="w-full flex items-center justify-between px-4 py-3 text-slate-600 hover:bg-teal-50 hover:text-teal-600 rounded-xl transition-all group">
                  <div className="flex items-center gap-3">
                     <Settings size={18} />
                     <span className="text-[10px] font-black uppercase tracking-widest">Configuration</span>
                  </div>
                  <ChevronRight size={14} className="opacity-30" />
                </button>
                <div className="my-1 border-t border-slate-50 mx-2" />
                <button 
                  onClick={() => { onLogout(); setIsDropdownOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                >
                  <LogOut size={18} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Terminate Access</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
