import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  BrainCircuit,
  Clock,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  User,
  Wallet,
} from 'lucide-react';
import { getFinancialAdvice } from '../services/geminiService';
import { formatCurrency } from '../lib/currency';
import { monthlyIncomeFromDetailed } from '../lib/incomeMath';
import { FinanceState } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIAdvisorProps {
  state: FinanceState;
  launchPrompt?: {
    id: number;
    query: string;
  } | null;
}

type PromptPreset = {
  label: string;
  helper: string;
  query: string;
  icon: React.ComponentType<{ size?: number }>;
};

const PROMPT_PRESETS: PromptPreset[] = [
  {
    label: 'Loan vs Investing',
    helper: 'Prepay or invest monthly',
    query: 'Should I prepay my home loan or invest the same amount monthly? Compare impact on retirement corpus.',
    icon: TrendingUp,
  },
  {
    label: 'Bonus Allocation',
    helper: 'Use one-time bonus smartly',
    query: 'If I receive a one-time bonus, how should I allocate it across debt, emergency fund, and goals?',
    icon: Wallet,
  },
  {
    label: 'Income Pause',
    helper: 'Stress test spouse income pause',
    query: 'What happens to our retirement and goal funding if spouse income stops for 3 years?',
    icon: Clock,
  },
  {
    label: 'Risk Alignment',
    helper: 'Check portfolio fit',
    query: 'Based on my profile and goals, is my current risk posture aligned to long-term plan outcomes?',
    icon: ShieldCheck,
  },
];

const AIAdvisor: React.FC<AIAdvisorProps> = ({ state, launchPrompt = null }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'Your AI financial assistant is ready. Ask me plan-specific questions and I will answer using your current financial data.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activePreset, setActivePreset] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastLaunchPromptIdRef = useRef<number | null>(null);
  const pendingLaunchQueryRef = useRef<string | null>(null);

  const profileCountry = state.profile.country || 'India';
  const monthlyIncome = monthlyIncomeFromDetailed(state.profile.income);
  const householdExpense = useMemo(() => {
    const selfExpense = Number(state.profile.monthlyExpenses || 0);
    const familyExpense = state.family.reduce((sum, member) => sum + Number(member.monthlyExpenses || 0), 0);
    return selfExpense + familyExpense;
  }, [state.family, state.profile.monthlyExpenses]);
  const netWorth = useMemo(() => {
    const assets = state.assets.reduce((sum, asset) => sum + Number(asset.currentValue || 0), 0);
    const liabilities = state.loans.reduce((sum, loan) => sum + Number(loan.outstandingAmount || 0), 0);
    return assets - liabilities;
  }, [state.assets, state.loans]);
  const monthlySurplus = monthlyIncome - householdExpense;
  const riskLevel = state.riskProfile?.level || 'Pending';

  const summaryCards = [
    {
      label: 'Net Worth',
      value: formatCurrency(netWorth, profileCountry),
      hint: 'Assets - liabilities',
      tone: 'text-slate-900',
    },
    {
      label: 'Monthly Surplus',
      value: formatCurrency(monthlySurplus, profileCountry),
      hint: `${formatCurrency(monthlyIncome, profileCountry)} income vs ${formatCurrency(householdExpense, profileCountry)} expense`,
      tone: monthlySurplus >= 0 ? 'text-emerald-700' : 'text-rose-700',
    },
    {
      label: 'Active Goals',
      value: `${state.goals.length}`,
      hint: 'Active goals in plan',
      tone: 'text-slate-900',
    },
    {
      label: 'Risk Mode',
      value: riskLevel,
      hint: state.riskProfile ? 'Profile complete' : 'Complete risk profile for allocation guidance',
      tone: 'text-slate-900',
    },
  ];

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  const handleSend = async (customInput?: string) => {
    const messageToSend = customInput ?? input;
    if (!messageToSend.trim() || isLoading) return;

    const userMessage = messageToSend.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await getFinancialAdvice(state, userMessage);
      setMessages((prev) => [...prev, { role: 'assistant', content: response }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'I could not process that right now. Please retry in a few seconds.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!launchPrompt?.id) return;
    if (launchPrompt.id === lastLaunchPromptIdRef.current) return;
    lastLaunchPromptIdRef.current = launchPrompt.id;
    const query = launchPrompt.query?.trim();
    if (!query) return;

    if (isLoading) {
      pendingLaunchQueryRef.current = query;
      return;
    }
    void handleSend(query);
  }, [launchPrompt, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isLoading) return;
    const queued = pendingLaunchQueryRef.current;
    if (!queued) return;
    pendingLaunchQueryRef.current = null;
    void handleSend(queued);
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4 pb-24">
      <section className="rounded-[1.6rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="surface-dark px-4 py-4 md:px-6 md:py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-teal-600 p-2.5 text-white shadow-[0_12px_30px_-14px_rgba(13,148,136,0.7)]">
                <Bot size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-300">AI Financial Advisor</p>
                <h2 className="text-xl font-black text-white md:text-2xl">Household Intelligence</h2>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">
              <Sparkles size={12} className="text-teal-300" />
              Live Plan-Aware Assistant
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-slate-100 px-4 py-4 md:px-6">
          {summaryCards.map((card) => (
            <article key={card.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{card.label}</p>
              <p className={`mt-1 text-base font-black ${card.tone} md:text-lg`}>{card.value}</p>
              <p className="mt-1 text-[11px] font-semibold text-slate-500">{card.hint}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="order-2 xl:order-1 rounded-[1.6rem] border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <BrainCircuit size={16} className="text-teal-600" />
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-700">Quick Simulations</p>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            Start with guided prompts, then continue with follow-up questions in the chat thread.
          </p>
          <div className="mt-4 space-y-2.5">
            {PROMPT_PRESETS.map((preset, index) => {
              const Icon = preset.icon;
              const selected = activePreset === index;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setActivePreset(index);
                    void handleSend(preset.query);
                  }}
                  disabled={isLoading}
                  className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                    selected
                      ? 'border-teal-300 bg-teal-50'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  } disabled:opacity-60`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`rounded-xl p-1.5 ${selected ? 'bg-white text-teal-700' : 'bg-slate-100 text-slate-600'}`}>
                      <Icon size={14} />
                    </div>
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-800">{preset.label}</p>
                  </div>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">{preset.helper}</p>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() =>
              setMessages([
                {
                  role: 'assistant',
                  content:
                    'Conversation reset. Ask me any plan-specific scenario and I will run it against your current data.',
                },
              ])
            }
            disabled={isLoading}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <Trash2 size={12} /> Reset Conversation
          </button>
        </aside>

        <article className="order-1 xl:order-2 rounded-[1.6rem] border border-slate-200 bg-white shadow-sm overflow-hidden flex min-h-[560px] flex-col">
          <div className="border-b border-slate-100 px-4 py-3 md:px-6 md:py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Conversation</p>
                <p className="text-sm font-semibold text-slate-600">Plan-aware responses only. No generic templates.</p>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                <Target size={11} />
                Goal Linked
              </div>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-5 px-4 py-4 md:px-6 md:py-6 no-scrollbar">
            {messages.map((msg, index) => (
              <div key={`${msg.role}-${index}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[94%] md:max-w-[82%] flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div
                    className={`h-9 w-9 shrink-0 rounded-xl border flex items-center justify-center ${
                      msg.role === 'assistant'
                        ? 'border-teal-100 bg-teal-50 text-teal-700'
                        : 'border-slate-800 bg-slate-900 text-white'
                    }`}
                  >
                    {msg.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}
                  </div>
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'assistant'
                        ? 'border border-slate-200 bg-slate-50 text-slate-800'
                        : 'bg-teal-600 text-white shadow-[0_14px_24px_-18px_rgba(13,148,136,0.9)]'
                    }`}
                  >
                    {msg.content.split('\n').map((line, lineIndex) => (
                      <p key={lineIndex} className={lineIndex > 0 ? 'mt-2.5' : ''}>
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[82%] flex gap-2.5">
                  <div className="h-9 w-9 shrink-0 rounded-xl border border-teal-100 bg-teal-50 text-teal-700 flex items-center justify-center">
                    <Loader2 size={16} className="animate-spin" />
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    Reviewing your household plan and running scenario logic...
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 md:px-6 md:py-4">
            <div className="flex flex-wrap gap-2 pb-3">
              {PROMPT_PRESETS.map((preset) => (
                <button
                  key={`chip-${preset.label}`}
                  type="button"
                  onClick={() => void handleSend(preset.query)}
                  disabled={isLoading}
                  className="rounded-full border border-teal-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-teal-700 transition hover:bg-teal-50 disabled:opacity-60"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Ask a plan question: loan prepay, SIP increase, retirement timing, risk shift..."
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-4 pr-14 text-sm font-semibold text-slate-700 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={!input.trim() || isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-teal-600 p-2.5 text-white transition hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400"
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
};

export default AIAdvisor;
