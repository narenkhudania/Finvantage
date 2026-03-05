
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, ChevronDown, ChevronRight, CreditCard, Gift, LifeBuoy, LogOut, Menu, Search, Settings, User } from 'lucide-react';
import { FinanceState, View } from '../types';
import { getJourneyProgress } from '../lib/journey';
import { TYPOGRAPHY_CLASS } from '../lib/designTokens';
import { AppButton, cx } from './common/ui';

interface HeaderProps {
  onMenuClick: () => void;
  title: string;
  state: FinanceState;
  setView: (view: View) => void;
  onLogout: () => void;
  isTerminalOnline: boolean;
  referralCode?: string | null;
  pointsBalance?: number;
  pointsFrozen?: boolean;
  onAskQuery?: (query: string) => void;
}

type AskSuggestion = {
  label: string;
  hint: string;
};

const ASK_SUGGESTIONS: AskSuggestion[] = [
  { label: 'Should I prepay my home loan or invest more monthly?', hint: 'Compare loan prepayment vs long-term return path.' },
  { label: 'If I get a one-time bonus, how much should go to goals?', hint: 'Split between emergency buffer, debt, and target goals.' },
  { label: 'What happens if spouse income pauses for 3 years?', hint: 'Stress test retirement and goal funding impact.' },
  { label: 'Can I retire 5 years earlier with current savings?', hint: 'Assess gap and monthly uplift required.' },
  { label: 'How much SIP increase is needed to fully fund my goals?', hint: 'Translate goal shortfall to monthly contribution.' },
  { label: 'Is my current insurance cover sufficient for liabilities?', hint: 'Check term and health deficit against risk exposure.' },
  { label: 'What is my safe monthly spend limit right now?', hint: 'Estimate spending guardrail from present cashflow.' },
];

const Header: React.FC<HeaderProps> = ({
  onMenuClick,
  title,
  state,
  setView,
  onLogout,
  isTerminalOnline,
  pointsBalance = 0,
  pointsFrozen = false,
  onAskQuery,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [askQuery, setAskQuery] = useState('');
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const askRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (askRef.current && !askRef.current.contains(event.target as Node)) {
        setIsSuggestionOpen(false);
        setActiveSuggestionIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = state.notifications?.filter(n => !n.read).length || 0;
  const normalizedPoints = Math.max(0, Math.floor(Number(pointsBalance) || 0));
  const { completionPct, nextStep } = useMemo(() => getJourneyProgress(state), [state]);
  const showJourneyPending = completionPct < 100;
  const normalizedTitle = title.toLowerCase();
  const isPricingView = normalizedTitle === 'pricing';
  const isBillingManageView = normalizedTitle === 'billing-manage' || normalizedTitle === 'billing manage';
  const pageTitle = isPricingView
    ? 'Subscription Plans'
    : isBillingManageView
      ? 'Subscription Management'
      : title.replace(/-/g, ' ');
  const sectionLabel = isPricingView ? 'Pricing' : isBillingManageView ? 'Billing' : 'App';
  const userName = state.profile.firstName?.trim() || 'Primary User';
  const userInitial = userName.charAt(0).toUpperCase();
  const normalizedAskQuery = askQuery.trim().toLowerCase();

  const filteredSuggestions = useMemo(() => {
    if (!normalizedAskQuery) return [];
    return ASK_SUGGESTIONS
      .filter((item) => {
        const haystack = `${item.label} ${item.hint}`.toLowerCase();
        return haystack.includes(normalizedAskQuery);
      })
      .slice(0, 6);
  }, [normalizedAskQuery]);

  const runAskQuery = (rawQuery: string) => {
    const query = rawQuery.trim();
    setIsSuggestionOpen(false);
    setActiveSuggestionIndex(-1);
    if (!query) {
      setView('ai-advisor');
      return;
    }
    if (onAskQuery) {
      onAskQuery(query);
    } else {
      setView('ai-advisor');
    }
    setAskQuery('');
  };

  const submitAskQuery = (event: React.FormEvent) => {
    event.preventDefault();
    if (isSuggestionOpen && activeSuggestionIndex >= 0 && filteredSuggestions[activeSuggestionIndex]) {
      runAskQuery(filteredSuggestions[activeSuggestionIndex].label);
      return;
    }
    runAskQuery(askQuery);
  };

  const handleAskInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!filteredSuggestions.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsSuggestionOpen(true);
      setActiveSuggestionIndex((prev) => Math.min(prev + 1, filteredSuggestions.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIsSuggestionOpen(true);
      setActiveSuggestionIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (event.key === 'Escape') {
      setIsSuggestionOpen(false);
      setActiveSuggestionIndex(-1);
      return;
    }
    if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
      event.preventDefault();
      runAskQuery(filteredSuggestions[activeSuggestionIndex].label);
    }
  };

  return (
    <header className="app-topbar sticky top-0 z-[50] border-b border-slate-200/80 bg-white/92 shadow-[0_16px_40px_-30px_rgba(2,6,23,0.55)] backdrop-blur-xl">
      <div className="app-topbar-frame px-3 py-2 sm:px-4 md:px-6 md:py-2 lg:px-8">
        <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 md:gap-3">
          <div className="min-w-0 flex items-center gap-2.5 md:gap-3">
            <AppButton
              tone="ghost"
              size="sm"
              onClick={onMenuClick}
              className="lg:hidden !rounded-xl !p-2 text-slate-600"
              aria-label="Open menu"
              leadingIcon={<Menu size={19} />}
            />

            <div className="min-w-0">
              <p className="hidden text-[9px] font-black uppercase tracking-[0.22em] text-slate-400 md:block">{sectionLabel}</p>
              <h1 className={cx(TYPOGRAPHY_CLASS.titleLg, 'truncate capitalize leading-none text-slate-900')}>
                {pageTitle}
              </h1>
            </div>
          </div>

          <form onSubmit={submitAskQuery} className="order-3 col-span-2 mt-1.5 min-w-0 w-full max-w-none md:hidden">
            <div ref={askRef} className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={askQuery}
                onChange={(event) => {
                  const next = event.target.value;
                  setAskQuery(next);
                  setActiveSuggestionIndex(-1);
                  setIsSuggestionOpen(Boolean(next.trim()));
                }}
                onFocus={() => {
                  if (askQuery.trim()) setIsSuggestionOpen(true);
                }}
                onKeyDown={handleAskInputKeyDown}
                placeholder="Ask anything about your plan and open AI Advisor"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-20 text-sm font-semibold text-slate-700 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-100 md:pr-24"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg border border-teal-200 bg-teal-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-teal-700 transition hover:bg-teal-100 md:px-3"
              >
                <span className="hidden md:inline">Ask AI</span>
                <span className="md:hidden">Ask</span>
              </button>

              {isSuggestionOpen && (
                <div className="absolute z-[90] mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_50px_-28px_rgba(15,23,42,0.45)]">
                  {filteredSuggestions.length > 0 ? (
                    <div className="max-h-72 overflow-y-auto no-scrollbar py-1">
                      {filteredSuggestions.map((suggestion, idx) => (
                        <button
                          key={suggestion.label}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => runAskQuery(suggestion.label)}
                          className={`w-full px-3 py-2.5 text-left transition ${
                            idx === activeSuggestionIndex ? 'bg-teal-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <p className="text-xs font-black text-slate-900">{suggestion.label}</p>
                          <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{suggestion.hint}</p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-2.5">
                      <p className="text-xs font-semibold text-slate-500">No direct suggestion found. Press Ask to open chat with this query.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </form>

          <div className="flex items-center gap-2 md:gap-2.5">
            <button
              onClick={() => setView('settings')}
              className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 transition md:h-10 md:rounded-2xl md:px-3 ${
                pointsFrozen
                  ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
              aria-label="Open rewards and points"
            >
              <Gift size={14} />
              <span className="text-[10px] font-black uppercase tracking-[0.14em]">{normalizedPoints} pts</span>
            </button>

            <button
              onClick={() => setView('notifications')}
              className="group relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-600 md:h-10 md:w-10"
              aria-label="Open notifications"
            >
              <Bell size={17} className="transition-transform group-hover:rotate-12" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1 text-[9px] font-black text-white">
                  {Math.min(unreadCount, 99)}
                </span>
              )}
            </button>

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="group flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 transition-all hover:border-slate-300 hover:bg-slate-100 md:h-10 md:gap-2.5 md:rounded-2xl md:px-3"
                aria-haspopup="menu"
                aria-expanded={isDropdownOpen}
              >
                <div className="hidden min-w-0 text-right md:block">
                  <p className="truncate text-xs font-black leading-none tracking-tight text-slate-900">{userName}</p>
                  <p className="mt-1 text-[8px] font-black uppercase tracking-[0.16em] text-slate-500">Profile</p>
                </div>
                <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-lg bg-slate-900 text-white shadow-sm md:h-7 md:w-7">
                  <span className="text-xs font-black md:hidden">{userInitial}</span>
                  <User size={14} className="hidden md:block" />
                </div>
                <ChevronDown size={14} className={`text-slate-400 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDropdownOpen && (
                <div className="animate-in fade-in zoom-in-95 absolute right-0 mt-2.5 w-64 origin-top-right overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] duration-200">
                  <div className="space-y-1 p-2">
                    <div className="mb-1 rounded-2xl bg-slate-50 p-4">
                      <p className="mb-1 text-[8px] font-black uppercase tracking-widest text-slate-400">Account Email</p>
                      <p className="truncate text-[10px] font-bold text-slate-600">{state.profile.email || 'Local Session'}</p>
                    </div>
                    <AppButton
                      tone="ghost"
                      size="md"
                      onClick={() => { setView('settings'); setIsDropdownOpen(false); }}
                      className="w-full !justify-between !rounded-xl !px-4 !py-3 !text-slate-600 hover:!bg-teal-50 hover:!text-teal-600"
                      leadingIcon={
                        <span className="inline-flex items-center gap-3">
                          <Settings size={18} />
                          <span>Settings</span>
                        </span>
                      }
                      trailingIcon={<ChevronRight size={14} className="opacity-30" />}
                    />
                    <AppButton
                      tone="ghost"
                      size="md"
                      onClick={() => {
                        setView('billing-manage');
                        setIsDropdownOpen(false);
                      }}
                      className="w-full !justify-between !rounded-xl !px-4 !py-3 !text-slate-600 hover:!bg-teal-50 hover:!text-teal-600"
                      leadingIcon={
                        <span className="inline-flex items-center gap-3">
                          <CreditCard size={18} />
                          <span>Billing Manage</span>
                        </span>
                      }
                      trailingIcon={<ChevronRight size={14} className="opacity-30" />}
                    />
                    <AppButton
                      tone="ghost"
                      size="md"
                      onClick={() => { setView('support'); setIsDropdownOpen(false); }}
                      className="w-full !justify-between !rounded-xl !px-4 !py-3 !text-slate-600 hover:!bg-teal-50 hover:!text-teal-600"
                      leadingIcon={
                        <span className="inline-flex items-center gap-3">
                          <LifeBuoy size={18} />
                          <span>Support Desk</span>
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

        {showJourneyPending && nextStep && (
          <div className="mt-1.5 md:mt-2">
            <button
              onClick={() => setView(nextStep.view)}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-teal-700 transition hover:bg-teal-100"
            >
              <span className="truncate">Next: {nextStep.label}</span>
              <ChevronRight size={12} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
