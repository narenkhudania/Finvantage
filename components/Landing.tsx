import React, { useEffect, useMemo, useState } from 'react';
import { formatCurrency, getCurrencySymbol } from '../lib/currency';
import {
  getBillingPlanBadge,
  getBillingPlanCycleLabel,
  getBillingPlanFallbackName,
  getBillingPlanPricingSnapshot,
} from '../lib/billingPlanDisplay';
import { applySeoMeta } from '../services/seoMeta';
import { getCachedBillingPlans, getPublicBillingPlans, type BillingPlan } from '../services/billingService';
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
  Home,
  GraduationCap,
  Plane,
  Car,
} from 'lucide-react';

interface LandingProps {
  onStart: () => void;
}

const Landing: React.FC<LandingProps> = ({ onStart }) => {
  const currencySymbol = getCurrencySymbol();
  const withCurrency = (text: string) => text.replaceAll('₹', currencySymbol);
  const formatMoney = (value: number) => `${currencySymbol}${Math.round(value).toLocaleString()}`;
  const formatPricingMoney = (value: number) => formatCurrency(value, 'India');
  const [activeScenario, setActiveScenario] = useState<'home' | 'education' | 'travel' | 'car'>('home');
  const [riskIndex, setRiskIndex] = useState(3);
  const [goalOffset, setGoalOffset] = useState(6);
  const [cashflowMode, setCashflowMode] = useState<'income' | 'surplus'>('income');
  const [emergencyMonths, setEmergencyMonths] = useState(7);
  const [lifestyleCut, setLifestyleCut] = useState(12);
  const [landingPlans, setLandingPlans] = useState<BillingPlan[]>(() => getCachedBillingPlans()?.plans || []);
  const [plansLoadedFromServer, setPlansLoadedFromServer] = useState<boolean>(() => {
    const cached = getCachedBillingPlans();
    return Boolean(cached?.plans?.length);
  });
  const navLinks = [
    { href: '#features', label: 'Features' },
    { href: '#method', label: 'Method' },
    { href: '#proof', label: 'Proof' },
    { href: '#pricing', label: 'Pricing' },
    { href: '#security', label: 'Security' },
    { href: '#faq', label: 'FAQ' },
  ];
  const planSource = useMemo(() => {
    if (plansLoadedFromServer && landingPlans.length > 0) return landingPlans;
    if (landingPlans.length > 0) return landingPlans;
    return [];
  }, [landingPlans, plansLoadedFromServer]);
  const sortedLandingPlans = useMemo(
    () => [...planSource].sort((a, b) => Number(a.billingMonths || 1) - Number(b.billingMonths || 1)),
    [planSource]
  );
  const landingMonthlyPlanAmount = useMemo(() => {
    const monthly = sortedLandingPlans.find((plan) => Number(plan.billingMonths || 0) === 1);
    return Number(monthly?.amountInr || 0);
  }, [sortedLandingPlans]);
  const monthlyLandingAmount = useMemo(() => {
    if (!sortedLandingPlans.length) return 0;
    const effectiveMonthly = sortedLandingPlans
      .map((plan) => getBillingPlanPricingSnapshot(plan, 0).effectivePerMonth)
      .filter((value) => Number.isFinite(value) && value > 0);
    if (!effectiveMonthly.length) return 0;
    return Math.min(...effectiveMonthly);
  }, [sortedLandingPlans]);
  const pricingPlans = sortedLandingPlans.map((plan) => {
    const pricing = getBillingPlanPricingSnapshot(plan, landingMonthlyPlanAmount);
    const months = pricing.months;
    return {
      key: plan.planCode,
      name: String(plan.displayName || getBillingPlanFallbackName(months)),
      amount: formatPricingMoney(pricing.amountInr),
      cycle: getBillingPlanCycleLabel(months),
      badge: getBillingPlanBadge(plan, 'landing'),
      highlight: months === 6,
      discount: pricing.discountPct,
    };
  });
  const trustSignals = [
    { label: 'Encrypted Profile Data', value: 'AES + RLS' },
    { label: 'Live Goal Health Updates', value: 'Continuous' },
    { label: 'Paywall Access Governance', value: 'Policy-Based' },
    { label: 'Guided Planning Setup', value: '< 10 min' },
  ];

  const scenarioMap = {
    home: {
      title: 'Home Purchase Timing',
      headline: 'Buy in 2026 vs 2029',
      impact: 'Net worth +12% with delayed purchase',
      delta: withCurrency('₹18,40,000'),
      bars: [28, 36, 42, 55, 62, 70],
    },
    education: {
      title: 'Education Funding',
      headline: 'School + UG cost curve',
      impact: 'Monthly SIP needed to stay funded',
      delta: withCurrency('₹42,000'),
      bars: [20, 30, 46, 58, 66, 74],
    },
    travel: {
      title: 'Lifestyle & Travel',
      headline: 'Annual travel budget test',
      impact: 'Retirement impact stays within guardrails',
      delta: withCurrency('₹6,50,000'),
      bars: [18, 26, 34, 48, 54, 61],
    },
    car: {
      title: 'Major Purchases',
      headline: 'Car upgrade in 2030',
      impact: 'Goal buffer remains above threshold',
      delta: withCurrency('₹9,20,000'),
      bars: [22, 31, 40, 47, 58, 65],
    },
  };

  const riskPresets = [
    { label: 'Conservative', alloc: { equity: 20, debt: 55, gold: 15, liquid: 10 } },
    { label: 'Moderate', alloc: { equity: 35, debt: 45, gold: 12, liquid: 8 } },
    { label: 'Balanced', alloc: { equity: 50, debt: 35, gold: 10, liquid: 5 } },
    { label: 'Aggressive', alloc: { equity: 65, debt: 25, gold: 7, liquid: 3 } },
    { label: 'Very Aggressive', alloc: { equity: 75, debt: 18, gold: 5, liquid: 2 } },
  ];
  const activeRisk = riskPresets[Math.min(riskPresets.length - 1, Math.max(0, riskIndex))];
  const baseYear = new Date().getFullYear();
  const goalBase = 500000;
  const goalInflation = 6;
  const goalYear = baseYear + goalOffset;
  const goalValue = goalBase * Math.pow(1 + goalInflation / 100, goalOffset);
  const cashflowSeries = cashflowMode === 'income'
    ? [68, 72, 78, 84, 88, 92, 96]
    : [22, 26, 31, 35, 30, 34, 38];
  const emergencyCoveragePct = Math.min(100, Math.round((emergencyMonths / 12) * 100));
  const monthlyLifestyleSpend = 25000;
  const annualRecovered = Math.round((monthlyLifestyleSpend * (lifestyleCut / 100)) * 12);
  const fiveYearRecoveryValue = Math.round(annualRecovered * ((Math.pow(1.1, 5) - 1) / 0.1));

  useEffect(() => {
    const canonical = `${window.location.origin}/`;
    applySeoMeta({
      title: 'FinVantage | Financial Planning, Goals, Risk Profiling & Wealth Dashboard',
      description:
        'Plan goals, track assets and liabilities, assess risk profile, and build long-term wealth decisions with FinVantage financial command center.',
      canonicalUrl: canonical,
      type: 'website',
      keywords: [
        'financial planning app',
        'goal based investing',
        'risk profile assessment',
        'retirement planning',
        'wealth management india',
        'personal finance dashboard',
      ],
      robots: 'index,follow',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'FinVantage',
        url: canonical,
        description:
          'Financial planning and investment decision platform for households and long-term wealth goals.',
        potentialAction: {
          '@type': 'SearchAction',
          target: `${window.location.origin}/blog?query={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
    });
  }, []);

  useEffect(() => {
    let active = true;
    const loadPlans = async () => {
      try {
        const payload = await getPublicBillingPlans();
        if (!active) return;
        setLandingPlans(payload.plans);
        setPlansLoadedFromServer(true);
      } catch {
        // Keep fallback plans when API is unavailable.
      }
    };
    void loadPlans();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void getPublicBillingPlans()
        .then((payload) => {
          setLandingPlans(payload.plans);
          setPlansLoadedFromServer(true);
        })
        .catch(() => {
          // keep current plans when refresh fails
        });
    }, 90_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen text-slate-900 overflow-x-hidden">
      <nav className="fixed top-0 w-full bg-white/78 backdrop-blur-2xl z-[60] border-b border-white/60">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 md:h-24 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-teal-600 p-2 md:p-2.5 rounded-xl md:rounded-2xl shadow-[0_0_25px_rgba(13,148,136,0.35)]">
              <TrendingUp className="text-white w-5 h-5 md:w-6 md:h-6" />
            </div>
            <span className="text-xl md:text-2xl font-black tracking-tighter text-slate-900 italic font-display">FinVantage<span className="text-teal-600">.</span></span>
          </div>
          <div className="hidden lg:flex items-center gap-6 text-[10px] font-black uppercase tracking-[0.32em] text-slate-500">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="hover:text-slate-900 transition">{link.label}</a>
            ))}
          </div>
          <button
            onClick={onStart}
            className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 md:px-6 md:py-3 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] hover:bg-teal-600 transition whitespace-nowrap"
          >
            Start <ArrowRight size={14} />
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-24 md:pt-28 pb-10 md:pb-14 px-4 md:px-8 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[160%] md:w-[140%] h-[600px] md:h-[800px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-100/40 via-transparent to-transparent -z-10" />

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 md:gap-3 px-4 md:px-5 py-2 md:py-2.5 bg-teal-600 text-white rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] shadow-xl shadow-teal-600/20">
              <Sparkles size={14} className="animate-pulse" /> Strategy-Grade Planning
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-8xl font-black text-slate-950 leading-[1.05] tracking-tight font-display">
              Design your
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-teal-400"> wealth journey</span>
              <br />like a pro.
            </h1>
            <p className="text-base md:text-2xl text-slate-500 max-w-2xl leading-relaxed font-medium">
              FinVantage turns complex finances into a visual command center—cashflow health, risk alignment, and goal funding in one continuous system with paid subscription access.
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
                Start Planning <ArrowRight size={16} />
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
              <span className="flex items-center gap-2"><Sparkles size={12} /> Starter from {monthlyLandingAmount > 0 ? `${formatPricingMoney(monthlyLandingAmount)}/month` : 'plans unavailable'}</span>
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

      <section className="px-4 md:px-8 pb-10 md:pb-14">
        <div className="max-w-7xl mx-auto rounded-[2rem] border border-slate-200 bg-white/75 backdrop-blur-xl p-4 md:p-6 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
            {trustSignals.map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                <p className="mt-2 text-sm font-black text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Proof */}
      <section id="proof" className="py-10 md:py-14 px-6 md:px-8">
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

          <div className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-4 text-[10px] font-black uppercase tracking-[0.35em] text-slate-400">
            {['Advisors', 'Founders', 'Families', 'Professionals', 'Planners'].map((label) => (
              <div key={label} className="bg-white/60 border border-slate-100 rounded-full py-3 text-center">{label}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-10 md:py-14 px-6 md:px-8 bg-slate-50/60">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-end justify-between mb-8 gap-6">
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
              { title: 'Goal Funding Engine', desc: 'Prioritized goals with inflation‑aware funding logic and clear next‑goal timelines.', icon: Target },
              { title: 'Risk + Allocation', desc: 'Risk DNA mapped to allocation guardrails and drift signals.', icon: ShieldCheck },
              { title: 'Insurance Shield', desc: 'Coverage gaps computed from liabilities, goals, and income needs in one view.', icon: Shield },
              { title: 'Investment Map', desc: 'Current vs recommended allocation with actionable rebalance prompts.', icon: BarChart3 },
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

      {/* Real-life Outcomes */}
      <section className="py-10 md:py-14 px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-end justify-between mb-8 gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-3 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-emerald-100 mb-6">
                <Target size={14} /> Real-Life Results
              </div>
              <h2 className="text-4xl md:text-6xl font-black text-slate-900 leading-tight">Built for the decisions you actually make.</h2>
              <p className="text-lg text-slate-500 mt-4">Practical planning tools that reduce uncertainty and show the financial trade‑offs clearly.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              { title: 'Home Purchase Timing', desc: 'Compare buy vs. wait with real inflation, EMI, and surplus impact.', icon: Home },
              { title: 'Education Funding', desc: 'Calculate the true cost of schooling and higher studies with inflation.', icon: GraduationCap },
              { title: 'Major Purchases', desc: 'Plan car upgrades or big expenses without derailing retirement.', icon: Car },
              { title: 'Lifestyle & Travel', desc: 'Set recurring travel budgets and see long‑term impact.', icon: Plane },
            ].map((item) => (
              <div key={item.title} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl w-fit"><item.icon size={22} /></div>
                <h3 className="text-xl font-black text-slate-900 mt-5">{item.title}</h3>
                <p className="text-sm text-slate-500 mt-3">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Infographics */}
      <section className="py-10 md:py-14 px-6 md:px-8 bg-slate-50/60">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-indigo-100 mb-6">
              <LineChart size={14} /> Interactive Insights
            </div>
            <h2 className="text-4xl md:text-6xl font-black text-slate-900 leading-tight">Explore scenarios in seconds.</h2>
            <p className="text-lg text-slate-500 mt-4">Toggle real‑world decisions and instantly see cashflow and net‑worth impact.</p>

            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { id: 'home', label: 'Home', icon: Home },
                { id: 'education', label: 'Education', icon: GraduationCap },
                { id: 'travel', label: 'Travel', icon: Plane },
                { id: 'car', label: 'Car', icon: Car },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveScenario(item.id as keyof typeof scenarioMap)}
                  className={`p-3 rounded-2xl border text-xs font-black uppercase tracking-widest transition ${
                    activeScenario === item.id
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-500 border-slate-200 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <item.icon size={16} />
                    {item.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-[3rem] p-8 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Scenario</p>
                <h3 className="text-2xl font-black text-slate-900">{scenarioMap[activeScenario].title}</h3>
              </div>
              <div className="px-3 py-1 rounded-full bg-teal-50 text-teal-600 text-[10px] font-black uppercase tracking-widest">
                {scenarioMap[activeScenario].headline}
              </div>
            </div>

            <div className="mt-6 p-5 rounded-2xl bg-slate-900 text-white">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Impact</p>
              <div className="text-xl font-black mt-2">{scenarioMap[activeScenario].impact}</div>
              <div className="text-sm font-black text-teal-300 mt-2">Delta: {scenarioMap[activeScenario].delta}</div>
            </div>

            <div className="mt-6">
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 mb-3">Net Worth Trajectory</p>
              <div className="flex items-end gap-2">
                {scenarioMap[activeScenario].bars.map((v, idx) => (
                  <div key={idx} className="flex-1 bg-teal-500/15 rounded-xl h-24 relative overflow-hidden">
                    <div className="absolute bottom-0 left-0 right-0 bg-teal-600" style={{ height: `${v}%` }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Risk Slider */}
      <section className="py-10 md:py-14 px-6 md:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-rose-50 text-rose-600 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-rose-100 mb-6">
              <ShieldCheck size={14} /> Risk Allocation
            </div>
            <h2 className="text-4xl md:text-6xl font-black text-slate-900 leading-tight">Tune your risk, watch allocation shift.</h2>
            <p className="text-lg text-slate-500 mt-4">Move the slider to see recommended asset allocation by risk appetite.</p>
            <div className="mt-8">
              <input
                type="range"
                min={0}
                max={riskPresets.length - 1}
                value={riskIndex}
                onChange={(e) => setRiskIndex(Number(e.target.value))}
                className="w-full h-2 rounded-full bg-slate-100 accent-teal-600"
              />
              <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mt-3">
                {riskPresets.map((item) => (
                  <span key={item.label} className={item.label === activeRisk.label ? 'text-slate-900' : ''}>{item.label}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[3rem] p-8 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Recommendation</p>
                <h3 className="text-2xl font-black text-slate-900">{activeRisk.label}</h3>
              </div>
              <div className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                Allocation Mix
              </div>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Equity', value: activeRisk.alloc.equity },
                { label: 'Debt', value: activeRisk.alloc.debt },
                { label: 'Gold', value: activeRisk.alloc.gold },
                { label: 'Liquid', value: activeRisk.alloc.liquid },
              ].map((row) => (
                <div key={row.label}>
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                    <span>{row.label}</span>
                    <span className="text-slate-900">{row.value}%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-teal-600" style={{ width: `${row.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Method */}
      <section id="method" className="py-10 md:py-14 px-6 md:px-8">
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

      {/* Interactive Games */}
      <section className="py-10 md:py-14 px-6 md:px-8 bg-slate-50/60">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-end justify-between mb-8 gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-3 px-4 py-2 bg-teal-50 text-teal-600 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-teal-100 mb-6">
                <Sparkles size={14} /> Interactive Games
              </div>
              <h2 className="text-4xl md:text-6xl font-black text-slate-900 leading-tight">Play strategy games, see outcomes instantly.</h2>
              <p className="text-lg text-slate-500 mt-4">Purpose-built decision games for planning, not generic loan math.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
            {/* Goal Timeline Game */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Goal</p>
                  <h3 className="text-xl font-black text-slate-900">Timeline Scrubber</h3>
                </div>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-2xl"><Target size={18} /></div>
              </div>
              <p className="text-sm text-slate-500">Base goal {formatMoney(goalBase)} with {goalInflation}% inflation.</p>
              <div className="mt-6">
                <div className="flex justify-between text-xs font-black uppercase tracking-widest text-slate-400">
                  <span>Target Year</span>
                  <span className="text-slate-900">{goalYear}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={25}
                  step={1}
                  value={goalOffset}
                  onChange={(e) => setGoalOffset(Number(e.target.value))}
                  className="w-full h-2 rounded-full bg-slate-100 accent-emerald-600 mt-2"
                />
              </div>
              <div className="mt-6 p-4 rounded-2xl bg-emerald-50">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-600">Inflated Value</p>
                <p className="text-2xl font-black text-slate-900 mt-2">{formatMoney(goalValue)}</p>
              </div>
            </div>

            {/* Cashflow Toggle Game */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Cashflow</p>
                  <h3 className="text-xl font-black text-slate-900">Projection Toggle</h3>
                </div>
                <div className="p-2 bg-rose-50 text-rose-600 rounded-2xl"><Activity size={18} /></div>
              </div>
              <div className="flex gap-2 mb-4">
                {['income', 'surplus'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setCashflowMode(mode as 'income' | 'surplus')}
                    className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition ${
                      cashflowMode === mode ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200'
                    }`}
                  >
                    {mode === 'income' ? 'Income' : 'Surplus'}
                  </button>
                ))}
              </div>
              <div className="flex items-end gap-2 h-28">
                {cashflowSeries.map((v, idx) => (
                  <div key={idx} className="flex-1 bg-teal-500/15 rounded-xl h-full relative overflow-hidden">
                    <div className="absolute bottom-0 left-0 right-0 bg-teal-600" style={{ height: `${v}%` }} />
                  </div>
                ))}
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mt-4">
                {cashflowMode === 'income' ? 'Projected income lift' : 'Projected surplus buffer'}
              </p>
            </div>

            {/* Emergency Buffer Game */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Safety</p>
                  <h3 className="text-xl font-black text-slate-900">Emergency Buffer Sprint</h3>
                </div>
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-2xl"><ShieldCheck size={18} /></div>
              </div>
              <p className="text-sm text-slate-500">Slide to test how many months of expenses your reserve can absorb.</p>
              <div className="mt-6">
                <div className="flex justify-between text-xs font-black uppercase tracking-widest text-slate-400">
                  <span>Runway</span>
                  <span className="text-slate-900">{emergencyMonths} months</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={18}
                  step={1}
                  value={emergencyMonths}
                  onChange={(e) => setEmergencyMonths(Number(e.target.value))}
                  className="w-full h-2 rounded-full bg-slate-100 accent-indigo-600 mt-2"
                />
              </div>
              <div className="mt-6 p-4 rounded-2xl bg-indigo-50">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600">Coverage Score</p>
                <p className="text-2xl font-black text-slate-900 mt-2">{emergencyCoveragePct}%</p>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mt-2">
                  {emergencyMonths >= 12 ? 'Strong buffer' : emergencyMonths >= 6 ? 'Stable buffer' : 'Needs reinforcement'}
                </p>
              </div>
            </div>

            {/* Lifestyle Challenge Game */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Habits</p>
                  <h3 className="text-xl font-black text-slate-900">Lifestyle Swap Challenge</h3>
                </div>
                <div className="p-2 bg-amber-50 text-amber-600 rounded-2xl"><Sparkles size={18} /></div>
              </div>
              <p className="text-sm text-slate-500">Cut discretionary spend and reroute it to long-term compounding.</p>
              <div className="mt-6">
                <div className="flex justify-between text-xs font-black uppercase tracking-widest text-slate-400">
                  <span>Cut Level</span>
                  <span className="text-slate-900">{lifestyleCut}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={35}
                  step={1}
                  value={lifestyleCut}
                  onChange={(e) => setLifestyleCut(Number(e.target.value))}
                  className="w-full h-2 rounded-full bg-slate-100 accent-amber-600 mt-2"
                />
              </div>
              <div className="mt-6 p-4 rounded-2xl bg-amber-50">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-600">Recovered Value</p>
                <p className="text-lg font-black text-slate-900 mt-2">Annual: {formatMoney(annualRecovered)}</p>
                <p className="text-sm font-black text-slate-700 mt-1">5Y Potential: {formatMoney(fiveYearRecoveryValue)}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="py-10 md:py-14 px-6 md:px-8 bg-slate-50/60">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-end justify-between mb-8 gap-6">
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

      {/* Pricing */}
      <section id="pricing" className="py-10 md:py-14 px-4 md:px-8">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Pricing</p>
          <h2 className="text-4xl md:text-6xl font-black text-slate-900 mt-3">Starter access from {monthlyLandingAmount > 0 ? `${formatPricingMoney(monthlyLandingAmount)}/month` : 'active plans'}.</h2>
          <p className="text-lg text-slate-500 mt-4">Choose monthly or bundled plans. Existing migrated users receive a one-time 30-day trial.</p>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            {pricingPlans.length === 0 && (
              <div className="md:col-span-2 rounded-[2rem] border border-amber-200 bg-amber-50 px-6 py-5 text-sm font-semibold text-amber-800">
                No active plans are currently configured.
              </div>
            )}
            {pricingPlans.map((plan) => (
              <div
                key={plan.key}
                className={`rounded-[2rem] border p-6 md:p-7 shadow-sm transition ${
                  plan.highlight
                    ? 'border-teal-300 bg-gradient-to-br from-teal-50 to-white'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Plan</p>
                    <h3 className="text-2xl font-black text-slate-900">{plan.name}</h3>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                    plan.highlight ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {plan.badge}
                  </span>
                </div>
                <div className="mt-6">
                  <p className="text-3xl font-black text-slate-900">{plan.amount}</p>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 mt-1">{plan.cycle}</p>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 mt-2">
                    {plan.discount != null && plan.discount > 0 ? `${plan.discount.toFixed(0)}% discount` : 'No bundle discount'}
                  </p>
                </div>
                <div className="mt-6 space-y-2 text-sm text-slate-600">
                  <p className="flex items-center gap-2"><CheckCircle2 size={14} className="text-teal-600" /> Full planning engine access</p>
                  <p className="flex items-center gap-2"><CheckCircle2 size={14} className="text-teal-600" /> Goal, risk, insurance, and dashboard modules</p>
                  <p className="flex items-center gap-2"><CheckCircle2 size={14} className="text-teal-600" /> Auto-renew with cancel-at-period-end control</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">Billing Note</p>
            <p className="text-sm font-semibold text-amber-800 mt-1">Localized prices are shown by country. Checkout is currently billed in INR.</p>
          </div>
          <button
            onClick={onStart}
            className="mt-8 bg-teal-600 text-white px-8 py-5 rounded-[1.5rem] font-black uppercase tracking-widest hover:bg-teal-700 transition inline-flex items-center justify-center gap-3"
          >
            Start Planning <ArrowRight size={16} />
          </button>
          <div className="mt-4">
            <a href="/pricing" className="text-sm font-black text-slate-700 underline underline-offset-2 hover:text-teal-700">
              View detailed billing screen
            </a>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-10 md:py-14 px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
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
      <section id="faq" className="py-10 md:py-14 px-6 md:px-8 bg-slate-50/60">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
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
      <section className="py-10 md:py-14 px-6 md:px-8">
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

      <footer className="border-t border-slate-200 bg-white/90 px-6 py-10 md:px-8 md:py-12 pb-24 md:pb-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
            Copyright © {baseYear} FinVantage. All Rights Reserved.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold text-slate-600 md:text-sm">
            <a href="/support" className="transition hover:text-slate-900">Support Desk and Contact us</a>
            <a href="/faq" className="transition hover:text-slate-900">FAQ</a>
            <a href="/privacy-policy" className="transition hover:text-slate-900">Privacy Policy</a>
            <a href="/terms-and-condition" className="transition hover:text-slate-900">Terms and Condition</a>
            <a href="/legal" className="transition hover:text-slate-900">Legal</a>
            <a href="/site-map" className="transition hover:text-slate-900">Site Map</a>
            <a href="/about" className="transition hover:text-slate-900">About</a>
            <a href="/blog" className="transition hover:text-slate-900">Blog</a>
          </div>
        </div>
      </footer>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
        <button
          onClick={onStart}
          className="w-full bg-slate-900 text-white px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2"
        >
          Start Planning <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default Landing;
