
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bell, ChevronDown, ChevronRight, LogOut, Menu, Settings, Sparkles, User } from 'lucide-react';
import { FinanceState, View } from '../types';
import { getJourneyProgress } from '../lib/journey';
import { TYPOGRAPHY_CLASS } from '../lib/designTokens';
import { AppButton, StatusPill, cx } from './common/ui';

interface HeaderProps {
  onMenuClick: () => void;
  title: string;
  state: FinanceState;
  setView: (view: View) => void;
  onLogout: () => void;
  isTerminalOnline: boolean;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, title, state, setView, onLogout, isTerminalOnline }) => {
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
  const showBack = !['dashboard', 'email'].includes(title.toLowerCase());
  const showJourneyActive = completionPct === 100 && isTerminalOnline;
  const showJourneyPending = completionPct < 100;
  const pageTitle = title.replace(/-/g, ' ');
  const journeyTone = showJourneyActive ? 'success' : showJourneyPending ? 'warning' : 'danger';
  const journeyLabel = showJourneyActive ? 'Journey Active' : showJourneyPending ? `Setup ${completionPct}%` : 'Terminal Sync Needed';

  return (
    <header className="min-h-[84px] border-b border-slate-200 bg-white/85 px-4 py-3 shadow-sm backdrop-blur-xl sm:px-6 md:px-10 sticky top-0 z-[50]">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-start gap-3 md:gap-4 w-full md:w-auto">
          <AppButton
            tone="ghost"
            size="sm"
            onClick={onMenuClick}
            className="lg:hidden !rounded-xl !p-2.5 text-slate-600"
            aria-label="Open menu"
            leadingIcon={<Menu size={20} />}
          />

          {showBack && (
            <AppButton
              tone="secondary"
              size="md"
              onClick={() => setView('dashboard')}
              className="mt-0.5"
              leadingIcon={<ArrowLeft size={13} />}
            >
              Back
            </AppButton>
          )}

          <div className="min-w-0">
            <h1 className={cx(TYPOGRAPHY_CLASS.titleLg, 'leading-none capitalize text-slate-900')}>
              {pageTitle}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusPill tone={journeyTone} icon={<Sparkles size={11} />}>
                {journeyLabel}
              </StatusPill>

              {showJourneyPending && nextStep && (
                <AppButton
                  tone="primary"
                  size="sm"
                  onClick={() => setView(nextStep.view)}
                  className="!rounded-full"
                >
                  Next: {nextStep.label}
                </AppButton>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 md:gap-5 w-full md:w-auto">
          <div className="relative">
            <AppButton
              tone="ghost"
              size="sm"
              onClick={() => setView('notifications')}
              className="group !rounded-2xl !p-3 text-slate-500 hover:!bg-teal-50 hover:text-teal-600"
              aria-label="Open notifications"
              leadingIcon={<Bell size={20} className="transition-transform group-hover:rotate-12" />}
            />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-rose-500 text-[8px] font-black text-white">
                {unreadCount}
              </span>
            )}
          </div>

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-100 p-1 pl-3 transition-all hover:bg-slate-200"
            >
              <div className="hidden text-right md:block">
                <p className="text-xs font-black leading-none tracking-tight text-slate-900">{state.profile.firstName || 'Primary User'}</p>
                <p className="mt-1 text-[8px] font-black uppercase tracking-widest text-slate-500">Profile</p>
              </div>
              <div className="h-10 w-10 overflow-hidden rounded-xl bg-slate-900 text-white shadow transition-transform group-hover:scale-105 flex items-center justify-center">
                <User size={20} />
              </div>
              <ChevronDown size={14} className={`mr-2 text-slate-400 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDropdownOpen && (
              <div className="animate-in fade-in zoom-in-95 absolute right-0 mt-3 w-64 origin-top-right overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] duration-200">
                <div className="space-y-1 p-2">
                  <div className="mb-1 rounded-2xl bg-slate-50 p-4">
                    <p className="mb-1 text-[8px] font-black uppercase tracking-widest text-slate-400">Session Data Node</p>
                    <p className="truncate text-[10px] font-bold text-slate-600">{state.profile.email || 'Local Terminal'}</p>
                  </div>
                  <AppButton
                    tone="ghost"
                    size="md"
                    onClick={() => { setView('settings'); setIsDropdownOpen(false); }}
                    className="w-full !justify-between !rounded-xl !px-4 !py-3 !text-slate-600 hover:!bg-teal-50 hover:!text-teal-600"
                    leadingIcon={
                      <span className="inline-flex items-center gap-3">
                        <Settings size={18} />
                        <span>Configuration</span>
                      </span>
                    }
                    trailingIcon={<ChevronRight size={14} className="opacity-30" />}
                  />
                  <div className="my-1 mx-2 border-t border-slate-50" />
                  <AppButton
                    tone="danger"
                    size="md"
                    onClick={() => { onLogout(); setIsDropdownOpen(false); }}
                    className="w-full !justify-start !rounded-xl !px-4 !py-3"
                    leadingIcon={<LogOut size={18} />}
                  >
                    Terminate Access
                  </AppButton>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
