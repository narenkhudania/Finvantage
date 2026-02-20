import React from 'react';
import { getCurrencySymbol } from '../lib/currency';
import {
  TrendingUp,
  ShieldCheck,
  Target,
  ArrowRight,
  CheckCircle2,
  Calculator,
  Lock,
  Wallet,
  ChevronRight,
  Sparkles,
  BarChart3,
  Cpu,
  Database,
  Activity,
  Shield,
  Users,
  FileJson,
  Layers,
  LineChart,
  ClipboardCheck,
} from 'lucide-react';

interface LandingProps {
  onStart: () => void;
}

const Landing: React.FC<LandingProps> = ({ onStart }) => {
  const currencySymbol = getCurrencySymbol();
  const withCurrency = (text: string) => text.replaceAll('₹', currencySymbol);

  return (
    <div className="min-h-screen text-slate-900 overflow-x-hidden">
      <nav className="fixed top-0 w-full bg-white/75 backdrop-blur-2xl z-[60] border-b border-white/60">
        <div className="max-w-7xl mx-auto px-6 md:px-8 h-20 md:h-24 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-teal-600 p-2 md:p-2.5 rounded-xl md:rounded-2xl shadow-[0_0_25px_rgba(13,148,136,0.35)]">
              <TrendingUp className="text-white w-5 h-5 md:w-6 md:h-6" />
            </div>
            <span className="text-xl md:text-2xl font-black tracking-tighter text-slate-900 italic font-display">FinVantage<span className="text-teal-600">.</span></span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-[10px] font-black uppercase tracking-[0.35em] text-slate-500">
            <a href="#features" className="hover:text-slate-900 transition">Features</a>
            <a href="#method" className="hover:text-slate-900 transition">Method</a>
            <a href="#proof" className="hover:text-slate-900 transition">Proof</a>
            <a href="#security" className="hover:text-slate-900 transition">Security</a>
            <a href="#faq" className="hover:text-slate-900 transition">FAQ</a>
          </div>
          <button
            onClick={onStart}
            className="hidden md:flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.3em] hover:bg-teal-600 transition"
          >
            Start Planning <ArrowRight size={14} />
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 md:pt-48 pb-20 md:pb-28 px-6 md:px-8 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[160%] md:w-[140%] h-[600px] md:h-[800px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-100/40 via-transparent to-transparent -z-10" />

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 md:gap-3 px-4 md:px-5 py-2 md:py-2.5 bg-teal-600 text-white rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] shadow-xl shadow-teal-600/20">
              <Sparkles size={14} className="animate-pulse" /> Strategy-Grade Planning
            </div>
            <h1 className="text-5xl md:text-8xl font-black text-slate-950 leading-[1.05] tracking-tight font-display">
              Design your
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-teal-400"> wealth journey</span>
              <br />like a pro.
            </h1>
            <p className="text-lg md:text-2xl text-slate-500 max-w-2xl leading-relaxed font-medium">
              FinVantage turns complex finances into a visual command center—cashflow health, risk alignment, and goal funding in one continuous system.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { icon: Target, label: 'Goal Funding Map', text: 'Align every rupee to priorities with time‑based funding logic.' },
                { icon: ShieldCheck, label: 'Risk & Insurance', text: 'Match protection and allocation to your risk DNA.' },
                { icon: Wallet, label: 'Cashflow Control', text: 'Track surplus, debt load, and savings rate in one view.' },
                { icon: LineChart, label: 'Lifetime Projections', text: 'Run retirement‑to‑legacy simulations instantly.' },
              ].map((item) => (
                <div key={item.label} className="flex gap-3 p-4 bg-white/80 border border-slate-200 rounded-2xl shadow-sm">
                  <div className="p-2 bg-teal-50 text-teal-600 rounded-xl"><item.icon size={18} /></div>
                  <div>
                    <p className="text-xs font-black text-slate-900 uppercase tracking-widest">{item.label}</p>
                    <p className="text-xs text-slate-500 mt-1">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={onStart}
                className="bg-teal-600 text-white px-10 py-6 rounded-[1.5rem] font-black text-base uppercase tracking-widest hover:bg-teal-700 transition-all shadow-[0_20px_60px_-15px_rgba(13,148,136,0.45)] flex items-center justify-center gap-3"
              >
                Start Free Planning <ArrowRight size={16} />
              </button>
              <a
                href="#features"
                className="px-10 py-6 rounded-[1.5rem] font-black text-base uppercase tracking-widest bg-white border border-slate-200 text-slate-700 hover:bg-slate-900 hover:text-white transition flex items-center justify-center gap-3"
              >
                See the System <ChevronRight size={16} />
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
              <span className="flex items-center gap-2"><CheckCircle2 size={12} /> No credit card</span>
              <span className="flex items-center gap-2"><Lock size={12} /> Privacy‑first</span>
              <span className="flex items-center gap-2"><FileJson size={12} /> Structured data</span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-teal-200/40 blur-[80px] rounded-full" />
            <div className="glass-card rounded-[3rem] p-8 md:p-10 shadow-2xl border border-white/60">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Command Center</p>
                  <h3 className="text-2xl font-black text-slate-900">Live Plan Preview</h3>
                </div>
                <div className="p-2 bg-teal-50 text-teal-600 rounded-2xl"><Activity size={18} /></div>
              </div>

              <div className="space-y-6">
                <div className="p-5 rounded-2xl bg-slate-900 text-white">
                  <div className="flex justify-between text-[10px] uppercase tracking-[0.3em] text-slate-400">
                    <span>Net Worth</span>
                    <span>Projected</span>
                  </div>
                  <div className="text-2xl font-black mt-2">{withCurrency('₹4.86 Cr')}</div>
                  <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full w-3/4 bg-teal-500" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Savings Rate', value: '32%' },
                    { label: 'Debt Load', value: '14%' },
                    { label: 'Goal Funding', value: '68%' },
                    { label: 'Risk Fit', value: 'Aggressive' },
                  ].map((item) => (
                    <div key={item.label} className="p-4 rounded-2xl bg-white border border-slate-200">
                      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">{item.label}</p>
                      <p className="text-lg font-black text-slate-900 mt-2">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">Cashflow Pulse</p>
                    <span className="text-xs font-black text-teal-600">Surplus</span>
                  </div>
                  <div className="flex items-end gap-2">
                    {[35, 52, 41, 65, 58, 72].map((v, idx) => (
                      <div key={idx} className="flex-1 bg-teal-500/20 rounded-xl h-20 relative overflow-hidden">
                        <div className="absolute bottom-0 left-0 right-0 bg-teal-600" style={{ height: `${v}%` }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Proof */}
      <section id="proof" className="py-20 md:py-28 px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { label: 'Modules Unified', value: '12+' },
              { label: 'Planning Horizons', value: 'Lifetime' },
              { label: 'Decision Nodes', value: 'Assets · Goals · Risk' },
            ].map((item) => (
              <div key={item.label} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{item.label}</p>
                <p className="text-2xl font-black text-slate-900 mt-3">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 grid grid-cols-2 md:grid-cols-5 gap-4 text-[10px] font-black uppercase tracking-[0.35em] text-slate-400">
            {['Advisors', 'Founders', 'Families', 'Professionals', 'Planners'].map((label) => (
              <div key={label} className="bg-white/60 border border-slate-100 rounded-full py-3 text-center">{label}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 md:py-32 px-6 md:px-8 bg-slate-50/60">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-end justify-between mb-12 gap-8">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-3 px-4 py-2 bg-teal-50 text-teal-600 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-teal-100 mb-6">
                <Layers size={14} /> Core Modules
              </div>
              <h2 className="text-4xl md:text-7xl font-black text-slate-900 mb-6 tracking-tight leading-none">Every financial
                <span className="text-teal-600"> signal in one system.</span>
              </h2>
              <p className="text-slate-500 text-lg md:text-2xl font-medium leading-relaxed">Built around real financial workflows: collect, model, stress‑test, and act.</p>
            </div>
            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm hidden md:block">
              <Activity size={28} className="text-teal-600 animate-pulse" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { title: 'Cashflow Intelligence', desc: 'Monthly surplus, debt load, and savings rate mapped to real timelines.', icon: Wallet },
              { title: 'Goal Funding Engine', desc: 'Prioritized goals with inflation‑aware funding logic.', icon: Target },
              { title: 'Risk + Allocation', desc: 'Risk DNA mapped to allocation guardrails and drift signals.', icon: ShieldCheck },
              { title: 'Insurance Shield', desc: 'Coverage gaps computed from liabilities, goals, and income needs.', icon: Shield },
              { title: 'Investment Map', desc: 'Current vs recommended allocation with rebalancing prompts.', icon: BarChart3 },
              { title: 'Estate & Tax Node', desc: 'Prepare key estate flags and compliance indicators.', icon: ClipboardCheck },
            ].map((item) => (
              <div key={item.title} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition">
                <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl w-fit"><item.icon size={22} /></div>
                <h3 className="text-xl font-black text-slate-900 mt-5">{item.title}</h3>
                <p className="text-sm text-slate-500 mt-3">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Method */}
      <section id="method" className="py-24 md:py-32 px-6 md:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-amber-100 mb-6">
              <Cpu size={14} /> Method
            </div>
            <h2 className="text-4xl md:text-6xl font-black text-slate-900 leading-tight">A clear method
              <span className="text-amber-600"> from input to action.</span>
            </h2>
            <p className="text-lg text-slate-500 mt-6">Capture the data once, then run every decision through a consistent financial logic engine.</p>
            <div className="mt-8 space-y-4">
              {[
                { title: 'Capture', text: 'Household, income, expenses, assets, liabilities, goals.' },
                { title: 'Model', text: 'Inflation, risk return, retirement horizon, funding priorities.' },
                { title: 'Act', text: 'Rebalance, cover gaps, invest surplus, and stay ahead of drift.' },
              ].map((step, idx) => (
                <div key={step.title} className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-black">0{idx + 1}</div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">{step.title}</h4>
                    <p className="text-sm text-slate-500">{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-[3rem] p-8 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Scenario Grid</p>
                <h3 className="text-xl font-black text-slate-900">Decision Simulator</h3>
              </div>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-2xl"><Calculator size={18} /></div>
            </div>
            <div className="mt-8 space-y-4">
              {[
                { label: 'Retirement at 55', value: 'On track', color: 'bg-emerald-500' },
                { label: 'Goal Funding 68%', value: 'Needs action', color: 'bg-amber-500' },
                { label: 'Insurance Gap', value: '₹1.4 Cr', color: 'bg-rose-500' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">{item.label}</span>
                  <span className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${item.color}`} /> {withCurrency(item.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="py-24 md:py-32 px-6 md:px-8 bg-slate-50/60">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-end justify-between mb-12 gap-8">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-3 px-4 py-2 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-slate-200 mb-6">
                <Lock size={14} /> Security
              </div>
              <h2 className="text-4xl md:text-6xl font-black text-slate-900">Built for privacy
                <span className="text-slate-500"> and control.</span>
              </h2>
              <p className="text-lg text-slate-500 mt-6">Your plan stays in your account with optional cloud sync. You decide what to share and when.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: 'Local‑First Experience', desc: 'Work offline and sync when ready.', icon: Database },
              { title: 'Granular Permissions', desc: 'Only you control household visibility.', icon: Users },
              { title: 'Structured Data', desc: 'Consistent JSON for analytics and audits.', icon: FileJson },
            ].map((item) => (
              <div key={item.title} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <div className="p-3 bg-slate-100 text-slate-600 rounded-2xl w-fit"><item.icon size={20} /></div>
                <h3 className="text-lg font-black text-slate-900 mt-5">{item.title}</h3>
                <p className="text-sm text-slate-500 mt-3">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 md:py-32 px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-12">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Stories</p>
              <h2 className="text-4xl md:text-6xl font-black text-slate-900">Built for real decisions.</h2>
            </div>
            <div className="hidden md:block text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Verified Users</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                quote: 'We finally have one place that connects cashflow, assets, and goals without spreadsheets.',
                name: 'Aarav S.',
                role: 'Founder, SaaS',
              },
              {
                quote: 'The goal funding view made our retirement choices obvious. It’s the first time we felt in control.',
                name: 'Neha P.',
                role: 'Consultant',
              },
              {
                quote: 'Risk and insurance gaps were clear in minutes. The visuals are extremely effective.',
                name: 'Rohit M.',
                role: 'Finance Lead',
              },
            ].map((item) => (
              <div key={item.name} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <p className="text-sm text-slate-600">“{item.quote}”</p>
                <div className="mt-6">
                  <p className="text-sm font-black text-slate-900">{item.name}</p>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{item.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 md:py-32 px-6 md:px-8 bg-slate-50/60">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">FAQ</p>
            <h2 className="text-4xl md:text-6xl font-black text-slate-900">Common questions.</h2>
          </div>
          <div className="space-y-6">
            {[
              {
                q: 'Is my data private?',
                a: 'Yes. Your plan is stored in your account and only synced when you’re signed in. You control what you enter and update.',
              },
              {
                q: 'Can I use this with multiple family members?',
                a: 'Yes. Add dependents and household members, then map incomes, expenses, assets, and goals per person.',
              },
              {
                q: 'Does this replace a financial advisor?',
                a: 'FinVantage gives you the strategy view and numbers. You can still consult advisors, but this keeps the plan in your control.',
              },
              {
                q: 'Is this only for India?',
                a: 'No. Currency and locale adapt to your selected country, so the planning visuals stay consistent globally.',
              },
            ].map((item) => (
              <div key={item.q} className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200">
                <h3 className="text-sm font-black text-slate-900">{item.q}</h3>
                <p className="text-sm text-slate-500 mt-3">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28 px-6 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="surface-dark rounded-[3rem] p-10 md:p-16 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-teal-500/20 blur-[140px] rounded-full" />
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-teal-300">Ready</p>
                <h2 className="text-4xl md:text-6xl font-black leading-tight">Start your
                  <span className="text-teal-400"> command center</span> today.</h2>
                <p className="text-sm md:text-lg text-slate-300 mt-4">Set up your household, build the plan, and track your financial journey with clarity.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-start lg:justify-end">
                <button
                  onClick={onStart}
                  className="bg-teal-500 text-white px-8 py-5 rounded-[1.5rem] font-black uppercase tracking-widest hover:bg-teal-600 transition flex items-center justify-center gap-3"
                >
                  Launch Planning <ArrowRight size={16} />
                </button>
                <a
                  href="#features"
                  className="border border-white/30 px-8 py-5 rounded-[1.5rem] font-black uppercase tracking-widest text-white/80 hover:text-white hover:border-white transition flex items-center justify-center gap-3"
                >
                  See Modules <ChevronRight size={16} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;
