import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Clock3,
  FileText,
  HelpCircle,
  LifeBuoy,
  Lock,
  Mail,
  Map,
  Scale,
  ShieldCheck,
  Ticket,
  UserCircle2,
} from 'lucide-react';
import { applySeoMeta } from '../../services/seoMeta';
import { supabase } from '../../services/supabase';
import type { FinanceState } from '../../types';
import SupportCenter from '../SupportCenter';

type StaticPageKey = 'faq' | 'privacy' | 'terms' | 'legal' | 'sitemap' | 'about';

interface SiteShellProps {
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const LAST_UPDATED = 'February 28, 2026';

const NAV_LINKS = [
  { label: 'Support', href: '/support' },
  { label: 'Contact us', href: '/contact-us' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Privacy', href: '/privacy-policy' },
  { label: 'Terms', href: '/terms-and-condition' },
  { label: 'Legal', href: '/legal' },
  { label: 'Site Map', href: '/site-map' },
  { label: 'About', href: '/about' },
  { label: 'Blog', href: '/blog' },
];

const createSupportState = (): FinanceState => ({
  isRegistered: true,
  onboardingStep: 0,
  profile: {
    firstName: '',
    lastName: '',
    dob: '',
    mobile: '',
    email: '',
    lifeExpectancy: 85,
    retirementAge: 60,
    pincode: '',
    city: '',
    state: '',
    country: 'India',
    incomeSource: 'salaried',
    income: {
      salary: 0,
      bonus: 0,
      reimbursements: 0,
      business: 0,
      rental: 0,
      investment: 0,
      pension: 0,
      expectedIncrease: 6,
    },
    monthlyExpenses: 0,
  },
  family: [],
  detailedExpenses: [],
  cashflows: [],
  investmentCommitments: [],
  assets: [],
  loans: [],
  insurance: [],
  insuranceAnalysis: {
    inflation: 6,
    termInsuranceAmount: 0,
    healthInsuranceAmount: 0,
    liabilityCovers: {},
    goalCovers: {},
    assetCovers: { financial: 50, personal: 0, inheritance: 100 },
    inheritanceValue: 0,
  },
  goals: [],
  discountSettings: {
    useBuckets: false,
    defaultDiscountRate: 10.15,
    useBucketInflation: false,
    defaultInflationRate: 6,
    buckets: [],
  },
  estate: { hasWill: false, nominationsUpdated: false },
  transactions: [],
  notifications: [],
});

const SiteShell: React.FC<SiteShellProps> = ({ eyebrow, title, description, icon, children }) => (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30 px-4 py-8 md:px-8 md:py-10">
    <div className="mx-auto max-w-6xl">
      <header className="rounded-[2rem] border border-teal-100 bg-white/90 p-6 shadow-[0_25px_45px_-35px_rgba(13,148,136,0.55)] md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-600">{eyebrow}</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 md:text-5xl">{title}</h1>
            <p className="mt-3 text-sm font-semibold text-slate-600 md:text-base">{description}</p>
          </div>
          <div className="rounded-2xl border border-teal-100 bg-teal-50 p-3 text-teal-700">{icon}</div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600 transition hover:border-teal-200 hover:text-teal-700"
            >
              {link.label}
            </a>
          ))}
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-teal-700 transition hover:bg-teal-100"
          >
            Open App <ArrowRight size={12} />
          </a>
        </div>
      </header>

      <main className="mt-6 space-y-4">{children}</main>
    </div>
  </div>
);

const SectionCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 md:p-6">
    <h2 className="text-lg font-black tracking-tight text-slate-900 md:text-xl">{title}</h2>
    <div className="mt-3 space-y-2 text-sm font-semibold leading-6 text-slate-600">{children}</div>
  </section>
);

export const SupportDeskPage: React.FC = () => {
  const [supportState, setSupportState] = useState<FinanceState>(() => createSupportState());
  const [authLoading, setAuthLoading] = useState(true);
  const [isSignedIn, setIsSignedIn] = useState(false);

  const updateState = useCallback((data: Partial<FinanceState>) => {
    setSupportState((prev) => ({ ...prev, ...data }));
  }, []);

  useEffect(() => {
    applySeoMeta({
      title: 'Support Desk and Contact Us | FinVantage',
      description: 'Raise complaints, track ticket status, and contact FinVantage support operations.',
      canonicalUrl: `${window.location.origin}/support`,
      type: 'website',
      robots: 'index,follow',
      keywords: ['finvantage support', 'contact us', 'complaint desk', 'customer support'],
    });
  }, []);

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setIsSignedIn(Boolean(data.session));
      setAuthLoading(false);
    };

    void loadSession();

    const { data: auth } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(Boolean(session));
      setAuthLoading(false);
    });

    return () => {
      active = false;
      auth.subscription.unsubscribe();
    };
  }, []);

  return (
    <SiteShell
      eyebrow="Support Desk"
      title="Support Desk and Contact us"
      description="Use our complaint desk for service issues and contact support channels for quick resolution."
      icon={<LifeBuoy size={22} />}
    >
      <section className="relative overflow-hidden rounded-[1.75rem] border border-teal-100 bg-gradient-to-br from-teal-50 via-white to-cyan-50 p-5 md:p-6">
        <div className="pointer-events-none absolute -top-12 -right-10 h-36 w-36 rounded-full bg-teal-100/70 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-8 h-32 w-32 rounded-full bg-cyan-100/60 blur-2xl" />

        <div className="relative grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-teal-700">
              <Ticket size={12} /> Support Intake
            </div>
            <h2 className="mt-3 text-2xl md:text-3xl font-black tracking-tight text-slate-900">Fast Complaint Resolution Workflow</h2>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              Raise a ticket, monitor SLA status, and receive updates as support operations process your request.
            </p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/80 bg-white/85 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-slate-500">Primary Channel</p>
                <p className="mt-0.5 text-sm font-black text-slate-900">In-app Complaint Desk</p>
              </div>
              <div className="rounded-xl border border-white/80 bg-white/85 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-slate-500">Response Target</p>
                <p className="mt-0.5 text-sm font-black text-slate-900">Within 1 Business Day</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <div className="rounded-xl border border-white/80 bg-white/85 p-3">
              <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                <Mail size={12} /> Email
              </p>
              <p className="mt-1 text-sm font-black text-slate-900">support@finvantage.app</p>
              <p className="mt-1 text-xs font-semibold text-slate-600">Best for account, billing, and issue follow-up.</p>
            </div>
            <div className="rounded-xl border border-white/80 bg-white/85 p-3">
              <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                <Clock3 size={12} /> Operations Window
              </p>
              <p className="mt-1 text-sm font-black text-slate-900">Monday to Saturday, 09:00-19:00 IST</p>
              <p className="mt-1 text-xs font-semibold text-slate-600">Tickets can be filed anytime from this page.</p>
            </div>
            <div className="rounded-xl border border-white/80 bg-white/85 p-3">
              <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                <ShieldCheck size={12} /> Privacy
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-600">All complaint details stay linked to your authenticated account.</p>
            </div>
          </div>
        </div>
      </section>

      {!authLoading && !isSignedIn && (
        <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
          Sign in to submit and track complaint tickets from this page.
          {' '}
          <a href="/" className="font-black underline underline-offset-2">Open App</a>
          {' '}to continue.
        </div>
      )}

      {authLoading && (
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-500">
          Checking session...
        </div>
      )}

      {isSignedIn && <SupportCenter state={supportState} updateState={updateState} />}
    </SiteShell>
  );
};

export const StaticInfoPage: React.FC<{ page: StaticPageKey }> = ({ page }) => {
  const pageMeta = useMemo(() => {
    const canonicalBase = window.location.origin;

    const data: Record<StaticPageKey, { title: string; description: string; canonical: string }> = {
      faq: {
        title: 'FAQ | FinVantage',
        description: 'Frequently asked questions about planning, privacy, support, and product usage in FinVantage.',
        canonical: `${canonicalBase}/faq`,
      },
      privacy: {
        title: 'Privacy Policy | FinVantage',
        description: 'How FinVantage collects, uses, secures, and retains personal and financial data.',
        canonical: `${canonicalBase}/privacy-policy`,
      },
      terms: {
        title: 'Terms and Condition | FinVantage',
        description: 'Terms that govern use of the FinVantage application, services, and website.',
        canonical: `${canonicalBase}/terms-and-condition`,
      },
      legal: {
        title: 'Legal | FinVantage',
        description: 'Legal notices, rights, compliance commitments, and reporting process for FinVantage.',
        canonical: `${canonicalBase}/legal`,
      },
      sitemap: {
        title: 'Site Map | FinVantage',
        description: 'Structured list of FinVantage pages for navigation and discovery.',
        canonical: `${canonicalBase}/site-map`,
      },
      about: {
        title: 'About | FinVantage',
        description: 'Learn about FinVantage mission, product principles, and team values.',
        canonical: `${canonicalBase}/about`,
      },
    };

    return data[page];
  }, [page]);

  useEffect(() => {
    applySeoMeta({
      title: pageMeta.title,
      description: pageMeta.description,
      canonicalUrl: pageMeta.canonical,
      type: 'website',
      robots: 'index,follow',
    });
  }, [pageMeta]);

  if (page === 'faq') {
    return (
      <SiteShell
        eyebrow="FAQ"
        title="Frequently Asked Questions"
        description="Clear answers for onboarding, planning modules, account privacy, and support operations."
        icon={<HelpCircle size={22} />}
      >
        <SectionCard title="Product & Access">
          <p><strong>Is FinVantage free?</strong> FinVantage runs on paid subscription plans. Current pricing is available on the pricing page and may be updated by admin.</p>
          <p><strong>Do I need to be an expert?</strong> No. The app is structured to guide decisions with visual modules and prompts.</p>
          <p><strong>Can I use it for family planning?</strong> Yes. You can add dependents and include multiple income/expense streams.</p>
        </SectionCard>
        <SectionCard title="Data & Security">
          <p><strong>Is my financial data private?</strong> Your records are linked to your account and protected with authenticated access control.</p>
          <p><strong>Do you sell personal data?</strong> No. FinVantage does not sell personal data to third parties.</p>
          <p><strong>Can I request data deletion?</strong> Yes. Use support to request account data export or deletion workflow.</p>
        </SectionCard>
        <SectionCard title="Planning & Accuracy">
          <p><strong>Is this investment advice?</strong> No. FinVantage provides decision-support tools and educational guidance.</p>
          <p><strong>How should I validate recommendations?</strong> Use outputs as planning references and consult a licensed advisor for final decisions.</p>
          <p><strong>Can I stress test scenarios?</strong> Yes. Scenario, cashflow, risk, and goal modules are designed for comparative planning.</p>
        </SectionCard>
        <SectionCard title="Support & Tickets">
          <p><strong>How do I raise a complaint?</strong> Go to
            {' '}
            <a href="/support" className="font-black text-teal-700 underline underline-offset-2">Support Desk</a>
            {' '}
            and submit the complaint form.
          </p>
          <p><strong>How do I track status?</strong> Every complaint gets a ticket number and status progression in your tracker view.</p>
          <p><strong>How do I contact the team?</strong> Email
            {' '}
            <a href="mailto:support@finvantage.app" className="font-black text-teal-700 underline underline-offset-2">support@finvantage.app</a>
            .
          </p>
        </SectionCard>
      </SiteShell>
    );
  }

  if (page === 'privacy') {
    return (
      <SiteShell
        eyebrow="Privacy Policy"
        title="Privacy Policy"
        description="This policy explains what data we process, why we process it, and how we protect it."
        icon={<Lock size={22} />}
      >
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
          Last Updated: {LAST_UPDATED}
        </div>
        <SectionCard title="1. Information We Collect">
          <p>We collect account identity data, profile details, financial planning inputs, and support communications you provide.</p>
          <p>We may collect technical usage telemetry needed for reliability, diagnostics, fraud prevention, and platform security.</p>
        </SectionCard>
        <SectionCard title="2. How We Use Data">
          <p>Data is used to deliver planning features, store your preferences, generate calculations, improve product performance, and provide support responses.</p>
          <p>We may use aggregated and de-identified data for analytics and product improvements.</p>
        </SectionCard>
        <SectionCard title="3. Data Sharing">
          <p>We do not sell personal data. We share data only with service providers necessary for infrastructure, authentication, analytics, and support operations.</p>
          <p>When required by law, regulation, or legal process, disclosures may be made to competent authorities.</p>
        </SectionCard>
        <SectionCard title="4. Data Security">
          <p>We apply reasonable administrative, technical, and organizational controls to protect your data from unauthorized access, disclosure, or loss.</p>
          <p>No internet system is fully risk-free, and users should also protect account credentials and devices.</p>
        </SectionCard>
        <SectionCard title="5. Retention and Deletion">
          <p>We retain account data as long as needed to operate services, comply with legal obligations, and resolve disputes.</p>
          <p>Deletion requests can be submitted through Support Desk and are processed per legal and operational requirements.</p>
        </SectionCard>
        <SectionCard title="6. Your Rights">
          <p>You may request access, correction, export, or deletion of personal data where applicable under law.</p>
          <p>For privacy requests, contact
            {' '}
            <a href="mailto:privacy@finvantage.app" className="font-black text-teal-700 underline underline-offset-2">privacy@finvantage.app</a>
            .
          </p>
        </SectionCard>
      </SiteShell>
    );
  }

  if (page === 'terms') {
    return (
      <SiteShell
        eyebrow="Terms and Condition"
        title="Terms and Condition"
        description="These terms govern your access to and use of FinVantage applications and related services."
        icon={<FileText size={22} />}
      >
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
          Effective Date: {LAST_UPDATED}
        </div>
        <SectionCard title="1. Acceptance of Terms">
          <p>By accessing FinVantage, you agree to these terms and all applicable laws. If you do not agree, discontinue use.</p>
        </SectionCard>
        <SectionCard title="2. Service Scope">
          <p>FinVantage provides financial planning tools, workflows, and educational guidance for household decision support.</p>
          <p>The service does not constitute legal, tax, accounting, brokerage, or investment advisory services.</p>
        </SectionCard>
        <SectionCard title="3. User Responsibilities">
          <p>You are responsible for accuracy of submitted data, account credential security, and lawful use of the platform.</p>
          <p>You must not misuse services, interfere with system integrity, or attempt unauthorized access.</p>
        </SectionCard>
        <SectionCard title="4. Intellectual Property">
          <p>Platform software, content, trademarks, and design elements are protected by intellectual property laws.</p>
          <p>You may not copy, reverse-engineer, distribute, or create derivative works beyond permitted usage.</p>
        </SectionCard>
        <SectionCard title="5. Limitations and Liability">
          <p>Service is provided on an as-is and as-available basis. We do not guarantee uninterrupted operation or error-free outcomes.</p>
          <p>To the maximum extent allowed by law, liability is limited for indirect, incidental, and consequential losses.</p>
        </SectionCard>
        <SectionCard title="6. Suspension and Termination">
          <p>Accounts may be suspended or terminated for policy violation, abuse, fraud risk, legal obligation, or security reasons.</p>
          <p>For questions, contact
            {' '}
            <a href="mailto:legal@finvantage.app" className="font-black text-teal-700 underline underline-offset-2">legal@finvantage.app</a>
            .
          </p>
        </SectionCard>
      </SiteShell>
    );
  }

  if (page === 'legal') {
    return (
      <SiteShell
        eyebrow="Legal"
        title="Legal Information"
        description="Notices, rights, limitations, and process channels for regulatory and legal communication."
        icon={<Scale size={22} />}
      >
        <SectionCard title="Notice and Compliance">
          <p>FinVantage operates digital planning software and maintains process controls for security, access management, and complaint handling.</p>
          <p>Regulatory and policy updates may be made periodically. The latest version is always published on this page.</p>
        </SectionCard>
        <SectionCard title="Financial Disclaimer">
          <p>Content and calculations are informational and educational. They are not a substitute for licensed professional advice.</p>
          <p>Decisions based on projections involve assumptions, market risks, and user-provided data quality.</p>
        </SectionCard>
        <SectionCard title="Copyright and IP Claims">
          <p>If you believe content infringes intellectual property rights, contact
            {' '}
            <a href="mailto:legal@finvantage.app" className="font-black text-teal-700 underline underline-offset-2">legal@finvantage.app</a>
            {' '}
            with sufficient claim details.
          </p>
          <p>Verified requests are reviewed and addressed according to applicable law and platform policy.</p>
        </SectionCard>
        <SectionCard title="Support and Escalation">
          <p>Operational complaints should be raised through
            {' '}
            <a href="/support" className="font-black text-teal-700 underline underline-offset-2">Support Desk</a>
            {' '}
            for ticket tracking and auditability.
          </p>
          <p>Policy or legal escalations can be submitted to
            {' '}
            <a href="mailto:legal@finvantage.app" className="font-black text-teal-700 underline underline-offset-2">legal@finvantage.app</a>
            .
          </p>
        </SectionCard>
      </SiteShell>
    );
  }

  if (page === 'sitemap') {
    return (
      <SiteShell
        eyebrow="Site Map"
        title="Site Map"
        description="Browse all major FinVantage public pages and key in-app destinations."
        icon={<Map size={22} />}
      >
        <SectionCard title="Public Pages">
          <p><a href="/" className="font-black text-teal-700 underline underline-offset-2">Home</a> - Product landing and app entry.</p>
          <p><a href="/support" className="font-black text-teal-700 underline underline-offset-2">Support Desk and Contact us</a> - Complaint registration and support contacts.</p>
          <p><a href="/faq" className="font-black text-teal-700 underline underline-offset-2">FAQ</a> - Common product, privacy, and support questions.</p>
          <p><a href="/privacy-policy" className="font-black text-teal-700 underline underline-offset-2">Privacy Policy</a> - Data handling and user rights.</p>
          <p><a href="/terms-and-condition" className="font-black text-teal-700 underline underline-offset-2">Terms and Condition</a> - Service usage terms.</p>
          <p><a href="/legal" className="font-black text-teal-700 underline underline-offset-2">Legal</a> - Legal notices and escalation channels.</p>
          <p><a href="/about" className="font-black text-teal-700 underline underline-offset-2">About</a> - Mission and product principles.</p>
          <p><a href="/blog" className="font-black text-teal-700 underline underline-offset-2">Blog</a> - Financial planning articles and guides.</p>
        </SectionCard>
        <SectionCard title="In-App Modules (After Sign-in)">
          <p>Dashboard, Family, Inflow Profile, Outflow Profile, Insurance, Assets, Liabilities, Risk Profile, Goals, Goal Summary, Cashflow, Investment Plan, Action Plan, Monthly Savings, Tax & Estate, Projections, AI Advisor, Notifications, Settings, and Support.</p>
        </SectionCard>
      </SiteShell>
    );
  }

  return (
    <SiteShell
      eyebrow="About"
      title="About FinVantage"
      description="FinVantage is a strategy-grade financial planning platform built for household decision clarity."
      icon={<UserCircle2 size={22} />}
    >
      <SectionCard title="What We Build">
        <p>FinVantage combines cashflow, liabilities, goals, risk profiling, and long-horizon projections into one planning workspace.</p>
        <p>Our objective is to help users shift from spreadsheet chaos to structured financial decision systems.</p>
      </SectionCard>
      <SectionCard title="Our Principles">
        <p><strong>Clarity First:</strong> every module should convert complexity into actionable next steps.</p>
        <p><strong>User Control:</strong> users own their data, assumptions, and planning decisions.</p>
        <p><strong>Practical Intelligence:</strong> planning outputs must be understandable, auditable, and execution-ready.</p>
      </SectionCard>
      <SectionCard title="Who It Is For">
        <p>Households, professionals, founders, and families planning for retirement, education, major purchases, insurance, and wealth accumulation.</p>
      </SectionCard>
      <SectionCard title="Contact">
        <p className="inline-flex items-center gap-2"><Mail size={14} className="text-teal-700" /> support@finvantage.app</p>
        <p className="inline-flex items-center gap-2"><ShieldCheck size={14} className="text-teal-700" /> Privacy and legal inquiries: privacy@finvantage.app, legal@finvantage.app</p>
      </SectionCard>
    </SiteShell>
  );
};
