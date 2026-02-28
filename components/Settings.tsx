import React, { useMemo, useState } from 'react';
import {
  User,
  Shield,
  Database,
  LogOut,
  Copy,
  CheckCircle2,
  Settings as SettingsIcon,
  Sparkles,
  Trash2,
  Download,
  ChevronDown,
  ChevronUp,
  Clock3,
} from 'lucide-react';
import { DiscountBucket, FinanceState, IncomeSource } from '../types';
import { getLifeExpectancyYear, getRetirementYear } from '../lib/financeMath';

interface SettingsProps {
  state: FinanceState;
  updateState: (data: Partial<FinanceState>) => void;
  onLogout: () => void;
}

const buildBucket = (partial: Partial<DiscountBucket>, id: string): DiscountBucket => ({
  id,
  name: partial.name || 'Bucket',
  startType: partial.startType || 'Offset',
  startOffset: partial.startOffset ?? 0,
  endType: partial.endType || 'Offset',
  endOffset: partial.endOffset,
  discountRate: partial.discountRate ?? 10.15,
  inflationRate: partial.inflationRate ?? 6,
});

const BUCKET_TEMPLATES: Record<'starter' | 'balanced' | 'growth', DiscountBucket[]> = {
  starter: [
    buildBucket({ name: 'Near Term', startType: 'Offset', startOffset: 0, endType: 'Offset', endOffset: 3, discountRate: 8.5, inflationRate: 5.5 }, 'template-starter-1'),
    buildBucket({ name: 'Mid Term', startType: 'Offset', startOffset: 4, endType: 'Offset', endOffset: 10, discountRate: 9.5, inflationRate: 6 }, 'template-starter-2'),
    buildBucket({ name: 'Long Term', startType: 'Offset', startOffset: 11, endType: 'Infinity', discountRate: 10.2, inflationRate: 6.2 }, 'template-starter-3'),
  ],
  balanced: [
    buildBucket({ name: 'Short-Term', startType: 'Offset', startOffset: 0, endType: 'Offset', endOffset: 3, discountRate: 8, inflationRate: 6 }, 'template-balanced-1'),
    buildBucket({ name: 'Medium-Term', startType: 'Offset', startOffset: 4, endType: 'Offset', endOffset: 8, discountRate: 9.5, inflationRate: 6 }, 'template-balanced-2'),
    buildBucket({ name: 'Pre-Retirement', startType: 'Offset', startOffset: 9, endType: 'Retirement', endOffset: 0, discountRate: 10.5, inflationRate: 6 }, 'template-balanced-3'),
    buildBucket({ name: 'Post-Retirement', startType: 'Retirement', startOffset: 1, endType: 'Infinity', discountRate: 8.2, inflationRate: 5 }, 'template-balanced-4'),
  ],
  growth: [
    buildBucket({ name: 'Accumulation 1', startType: 'Offset', startOffset: 0, endType: 'Offset', endOffset: 5, discountRate: 10, inflationRate: 6 }, 'template-growth-1'),
    buildBucket({ name: 'Accumulation 2', startType: 'Offset', startOffset: 6, endType: 'Retirement', endOffset: 0, discountRate: 11.8, inflationRate: 6 }, 'template-growth-2'),
    buildBucket({ name: 'Post-Retirement', startType: 'Retirement', startOffset: 1, endType: 'Infinity', discountRate: 8.8, inflationRate: 5.2 }, 'template-growth-3'),
  ],
};

const Settings: React.FC<SettingsProps> = ({ state, updateState, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'planning' | 'datalab'>('profile');
  const [copied, setCopied] = useState(false);
  const [expandedDataRow, setExpandedDataRow] = useState<string | null>(null);
  const [showSecurityDetails, setShowSecurityDetails] = useState(false);
  const [showPermissionDashboard, setShowPermissionDashboard] = useState(false);
  const [lastViewedAt] = useState(() => new Date().toISOString());

  const retirementYear = getRetirementYear(state.profile.dob, state.profile.retirementAge);
  const lifeExpectancyYear = getLifeExpectancyYear(state.profile.dob, state.profile.lifeExpectancy);
  const currentYear = new Date().getFullYear();
  const retirementOffset = retirementYear ? retirementYear - currentYear : 30;

  const discountSettings = state.discountSettings;
  const normalizedIncomeSource: IncomeSource = state.profile.incomeSource === 'business' ? 'business' : 'salaried';

  const updateProfile = (patch: Partial<FinanceState['profile']>) => {
    updateState({
      profile: {
        ...state.profile,
        ...patch,
      },
    });
  };

  const resolveBucketOffsets = (bucket: DiscountBucket) => {
    const start = bucket.startType === 'Retirement'
      ? retirementOffset + bucket.startOffset
      : bucket.startOffset;

    let end = Infinity;
    if (bucket.endType === 'Offset') end = bucket.endOffset ?? start;
    if (bucket.endType === 'Retirement') end = retirementOffset + (bucket.endOffset ?? 0);

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
      if (end < start) return 'Bucket end year cannot be before start year.';
      if (end === Infinity && i !== ordered.length - 1) return 'Infinity bucket must be the last bucket.';
      if (end === Infinity) return null;
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

  const applyTemplate = (key: keyof typeof BUCKET_TEMPLATES) => {
    const templateBuckets = BUCKET_TEMPLATES[key].map((bucket, idx) => ({
      ...bucket,
      id: `bucket-${key}-${Date.now()}-${idx}`,
    }));
    updateDiscountSettings({
      useBuckets: true,
      useBucketInflation: true,
      buckets: templateBuckets,
    });
  };

  const copyData = async () => {
    await navigator.clipboard.writeText(JSON.stringify(state, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadData = () => {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'finvantage-data-export.json';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const removeLocationData = () => {
    updateProfile({ pincode: '', city: '', state: '' });
  };

  const removeIncomeContext = () => {
    updateProfile({ incomeSource: 'salaried' as IncomeSource });
  };

  const disconnectOptionalData = () => {
    removeLocationData();
    removeIncomeContext();
  };

  const deleteOptionalData = () => {
    const confirmed = window.confirm('Delete optional data now? You can add it again anytime.');
    if (!confirmed) return;
    disconnectOptionalData();
  };

  const readableDate = useMemo(
    () => new Date(lastViewedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    [lastViewedAt],
  );

  const hasLocationData = useMemo(
    () => Boolean((state.profile.pincode || '').trim() || (state.profile.city || '').trim() || (state.profile.state || '').trim()),
    [state.profile.pincode, state.profile.city, state.profile.state],
  );

  const isIncomeContextShared = normalizedIncomeSource === 'business';

  const permissionRows = [
    {
      id: 'location-permission',
      title: 'Location insights',
      status: hasLocationData ? 'Connected' : 'Not connected',
      description: 'Improves region-specific assumptions and relevance.',
      connected: hasLocationData,
      onDisconnect: removeLocationData,
      onConnect: () => setActiveTab('profile'),
    },
    {
      id: 'income-permission',
      title: 'Income context personalization',
      status: isIncomeContextShared ? 'Connected' : 'Not connected',
      description: 'Improves recommendation tuning for salaried vs business context.',
      connected: isIncomeContextShared,
      onDisconnect: removeIncomeContext,
      onConnect: () => setActiveTab('profile'),
    },
  ];

  const dataInventory = useMemo(() => {
    const locationValue = [state.profile.city, state.profile.state, state.profile.country, state.profile.pincode]
      .map(value => (value || '').trim())
      .filter(Boolean)
      .join(', ');

    return [
      {
        id: 'dob',
        label: 'Date of birth',
        value: state.profile.dob || 'Not shared',
        summary: 'Used to generate age-accurate planning timelines.',
        collected: 'Date of birth.',
        why: 'Needed to build your age-based planning timeline.',
        improves: 'Improves accuracy for retirement runway and goal timing.',
        notDone: 'Never sold and never used for ad targeting.',
        storage: 'Stored securely in your profile.',
        required: true,
        canDelete: false,
        onDelete: undefined as (() => void) | undefined,
      },
      {
        id: 'timeline',
        label: 'Planning ages',
        value: `Retirement ${state.profile.retirementAge} / Life expectancy ${state.profile.lifeExpectancy}`,
        summary: 'Used to estimate how long your plan needs to fund.',
        collected: 'Retirement age and life expectancy.',
        why: 'Needed to project your long-term financial horizon.',
        improves: 'Improves long-range projections and milestone accuracy.',
        notDone: 'Never sold and never shared for advertising.',
        storage: 'Stored securely in your profile.',
        required: true,
        canDelete: false,
        onDelete: undefined as (() => void) | undefined,
      },
      {
        id: 'location',
        label: 'Location',
        value: locationValue || 'Not shared',
        summary: 'Optional data for local relevance and faster setup.',
        collected: 'Country, state, city, and postal code.',
        why: 'Optional: improves region-specific assumptions and service availability.',
        improves: 'Improves recommendation relevance and reduces manual corrections.',
        notDone: 'Never sold and never used for ad targeting.',
        storage: 'Stored only if you choose to share.',
        required: false,
        canDelete: true,
        onDelete: removeLocationData,
      },
      {
        id: 'incomeSource',
        label: 'Income source',
        value: normalizedIncomeSource || 'Not shared',
        summary: 'Optional context to tailor recommendations.',
        collected: 'Salaried or business income profile.',
        why: 'Optional: helps tailor planning recommendations.',
        improves: 'Improves baseline assumptions in projections and action plans.',
        notDone: 'Never sold and never used for ad targeting.',
        storage: 'Stored securely in your profile.',
        required: false,
        canDelete: true,
        onDelete: removeIncomeContext,
      },
    ];
  }, [state.profile, normalizedIncomeSource]);

  const onboardingCompletion = useMemo(() => {
    const checks = [
      (state.profile.firstName || '').trim().length > 0,
      (state.profile.dob || '').trim().length > 0,
      (state.profile.city || '').trim().length > 0,
      (state.profile.country || '').trim().length > 0,
      state.profile.retirementAge > 0,
      state.profile.lifeExpectancy > state.profile.retirementAge,
    ];
    const complete = checks.filter(Boolean).length;
    return Math.round((complete / checks.length) * 100);
  }, [state.profile]);

  return (
    <div className="space-y-12 animate-in fade-in duration-700 pb-24">
      <div className="surface-dark p-8 md:p-14 rounded-[3rem] text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-600/10 blur-[120px] rounded-full translate-x-1/4 -translate-y-1/4" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-teal-500/10 text-teal-300 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-teal-500/20 mb-6">
            <SettingsIcon size={14} /> Configuration Terminal
          </div>
          <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">Profile + Planning Engine</h2>
          <p className="text-sm md:text-base text-slate-300 font-medium mt-4 max-w-3xl">
            Update onboarding profile fields anytime and control planning assumptions with bucket templates and validation.
          </p>
        </div>
      </div>

      <div className="flex p-1.5 bg-white rounded-[2.5rem] border border-slate-200 w-full md:w-fit mx-auto shadow-sm sticky top-20 md:top-28 z-40 overflow-x-auto no-scrollbar">
        <button onClick={() => setActiveTab('profile')} className={`flex-1 md:flex-none px-4 md:px-8 py-3.5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'profile' ? 'bg-teal-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-900'}`}><User size={14}/> Profile</button>
        <button onClick={() => setActiveTab('planning')} className={`flex-1 md:flex-none px-4 md:px-8 py-3.5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'planning' ? 'bg-teal-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-900'}`}><Shield size={14}/> Planning Engine</button>
        <button onClick={() => setActiveTab('datalab')} className={`flex-1 md:flex-none px-4 md:px-8 py-3.5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'datalab' ? 'bg-teal-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-900'}`}><Database size={14}/> Data &amp; Trust</button>
      </div>

      {activeTab === 'profile' && (
        <div className="max-w-5xl mx-auto space-y-8 animate-in slide-in-from-bottom-6">
          <div className="bg-white p-8 md:p-12 rounded-[3rem] border border-slate-200 shadow-sm space-y-8">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h3 className="text-2xl font-black text-slate-900">Onboarding Profile Editor</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">These values directly update planning logic and timelines.</p>
              </div>
              <div className="px-4 py-2 rounded-2xl bg-teal-50 border border-teal-100 text-right">
                <p className="text-[9px] font-black uppercase tracking-widest text-teal-600">Profile completeness</p>
                <p className="text-xl font-black text-slate-900">{onboardingCompletion}%</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">First Name</label>
                <input type="text" value={state.profile.firstName} onChange={e => updateProfile({ firstName: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Name</label>
                <input type="text" value={state.profile.lastName || ''} onChange={e => updateProfile({ lastName: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date of Birth</label>
                <input type="date" value={state.profile.dob || ''} onChange={e => updateProfile({ dob: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Country</label>
                <input type="text" value={state.profile.country || ''} onChange={e => updateProfile({ country: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">City</label>
                <input type="text" value={state.profile.city || ''} onChange={e => updateProfile({ city: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">State</label>
                <input type="text" value={state.profile.state || ''} onChange={e => updateProfile({ state: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pincode</label>
                <input type="text" value={state.profile.pincode || ''} onChange={e => updateProfile({ pincode: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Income Source</label>
                <select value={normalizedIncomeSource} onChange={e => updateProfile({ incomeSource: e.target.value as IncomeSource })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none">
                  <option value="salaried">Salaried</option>
                  <option value="business">Business</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Retirement Age</label>
                  <span className="text-xl font-black text-emerald-600">{state.profile.retirementAge}</span>
                </div>
                <input
                  type="range"
                  min={35}
                  max={80}
                  step={1}
                  value={state.profile.retirementAge}
                  onChange={e => {
                    const retirementAge = Number.parseInt(e.target.value, 10) || 60;
                    const lifeExpectancy = Math.max(retirementAge + 1, state.profile.lifeExpectancy);
                    updateProfile({ retirementAge, lifeExpectancy });
                  }}
                  className="w-full h-1.5 bg-slate-200 rounded-full appearance-none accent-emerald-500 cursor-pointer"
                />
                <p className="text-[10px] font-bold text-slate-500 mt-2">Retirement year: {retirementYear ?? '—'}</p>
              </div>

              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Life Expectancy Age</label>
                  <span className="text-xl font-black text-teal-600">{state.profile.lifeExpectancy}</span>
                </div>
                <input
                  type="range"
                  min={Math.max(60, state.profile.retirementAge + 1)}
                  max={100}
                  step={1}
                  value={state.profile.lifeExpectancy}
                  onChange={e => {
                    const lifeExpectancy = Number.parseInt(e.target.value, 10) || 85;
                    updateProfile({ lifeExpectancy: Math.max(state.profile.retirementAge + 1, lifeExpectancy) });
                  }}
                  className="w-full h-1.5 bg-slate-200 rounded-full appearance-none accent-teal-600 cursor-pointer"
                />
                <p className="text-[10px] font-bold text-slate-500 mt-2">Life expectancy year: {lifeExpectancyYear ?? '—'}</p>
              </div>
            </div>
          </div>

          <div className="bg-rose-50 p-6 md:p-10 rounded-[3rem] border border-rose-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h4 className="text-lg font-black text-rose-900">Session Termination</h4>
              <p className="text-sm font-medium text-rose-700">Logout will end the current terminal session.</p>
            </div>
            <button onClick={onLogout} className="px-8 py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all flex items-center justify-center gap-2">
              <LogOut size={14} /> Terminate Access
            </button>
          </div>
        </div>
      )}

      {activeTab === 'planning' && (
        <div className="max-w-5xl mx-auto space-y-8 animate-in slide-in-from-bottom-6">
          <div className="bg-white p-8 md:p-10 rounded-[3rem] border border-slate-200 shadow-sm space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <h3 className="text-2xl font-black text-slate-900">Planner Assumptions</h3>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-1">Controls goal inflation, discounting, and long-horizon projections.</p>
              </div>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl border text-xs font-black uppercase tracking-widest ${bucketError ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                <Sparkles size={14} />
                {bucketError ? 'Bucket Health: Needs Fix' : 'Bucket Health: Valid'}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Use Bucketed Discount Rates</p>
                    <p className="text-xs text-slate-400 font-medium">Apply horizon-specific return assumptions.</p>
                  </div>
                  <button type="button" onClick={() => updateDiscountSettings({ useBuckets: !discountSettings.useBuckets })} className={`w-16 h-9 rounded-full transition-all relative ${discountSettings.useBuckets ? 'bg-teal-600' : 'bg-slate-200'}`}>
                    <div className={`absolute top-1 w-7 h-7 rounded-full bg-white transition-all shadow-md ${discountSettings.useBuckets ? 'left-8' : 'left-1'}`} />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <input type="number" min={0} max={30} step={0.1} value={discountSettings.defaultDiscountRate} onChange={e => updateDiscountSettings({ defaultDiscountRate: parseFloat(e.target.value) || 0 })} className="w-28 px-3 py-2 rounded-xl border border-slate-200 text-sm font-black outline-none" />
                  <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Default Discount %</span>
                </div>
              </div>

              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Use Bucketed Inflation</p>
                    <p className="text-xs text-slate-400 font-medium">Set different inflation assumptions by horizon.</p>
                  </div>
                  <button type="button" onClick={() => updateDiscountSettings({ useBucketInflation: !discountSettings.useBucketInflation })} className={`w-16 h-9 rounded-full transition-all relative ${discountSettings.useBucketInflation ? 'bg-teal-600' : 'bg-slate-200'}`}>
                    <div className={`absolute top-1 w-7 h-7 rounded-full bg-white transition-all shadow-md ${discountSettings.useBucketInflation ? 'left-8' : 'left-1'}`} />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <input type="number" min={0} max={30} step={0.1} value={discountSettings.defaultInflationRate} onChange={e => updateDiscountSettings({ defaultInflationRate: parseFloat(e.target.value) || 0 })} className="w-28 px-3 py-2 rounded-xl border border-slate-200 text-sm font-black outline-none" />
                  <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Default Inflation %</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Bucket Templates</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button onClick={() => applyTemplate('starter')} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:border-teal-300 text-left transition-all">
                  <p className="text-xs font-black text-slate-900">Starter</p>
                  <p className="text-[10px] font-semibold text-slate-500 mt-1">Simple early/mid/long assumptions.</p>
                </button>
                <button onClick={() => applyTemplate('balanced')} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:border-teal-300 text-left transition-all">
                  <p className="text-xs font-black text-slate-900">Balanced</p>
                  <p className="text-[10px] font-semibold text-slate-500 mt-1">Pre and post-retirement split.</p>
                </button>
                <button onClick={() => applyTemplate('growth')} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:border-teal-300 text-left transition-all">
                  <p className="text-xs font-black text-slate-900">Growth</p>
                  <p className="text-[10px] font-semibold text-slate-500 mt-1">Higher long-horizon return assumptions.</p>
                </button>
              </div>
            </div>

            {bucketError && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-rose-600">
                {bucketError}
              </div>
            )}

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-lg font-black text-slate-900">Bucket Editor</h4>
                <button onClick={addBucket} className="px-5 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-teal-600 transition-all">+ Add Bucket</button>
              </div>

              {discountSettings.buckets.map((bucket, index) => (
                <div key={bucket.id} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end p-5 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bucket Name</label>
                    <input type="text" value={bucket.name} onChange={e => updateBucket(index, { name: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Start</label>
                    <div className="flex gap-2">
                      <select value={bucket.startType} onChange={e => updateBucket(index, { startType: e.target.value as DiscountBucket['startType'] })} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest">
                        <option value="Offset">Offset</option>
                        <option value="Retirement">Retirement</option>
                      </select>
                      <input type="number" value={bucket.startOffset} onChange={e => updateBucket(index, { startOffset: parseInt(e.target.value, 10) || 0 })} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold outline-none" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">End</label>
                    <div className="flex gap-2">
                      <select value={bucket.endType} onChange={e => updateBucket(index, { endType: e.target.value as DiscountBucket['endType'] })} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest">
                        <option value="Offset">Offset</option>
                        <option value="Retirement">Retirement</option>
                        <option value="Infinity">∞</option>
                      </select>
                      {bucket.endType !== 'Infinity' && (
                        <input type="number" value={bucket.endOffset ?? 0} onChange={e => updateBucket(index, { endOffset: parseInt(e.target.value, 10) || 0 })} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold outline-none" />
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Discount %</label>
                    <input type="number" step={0.1} value={bucket.discountRate ?? ''} onChange={e => updateBucket(index, { discountRate: parseFloat(e.target.value) })} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Inflation %</label>
                    <div className="flex gap-2">
                      <input type="number" step={0.1} value={bucket.inflationRate ?? ''} onChange={e => updateBucket(index, { inflationRate: parseFloat(e.target.value) })} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold outline-none" />
                      <button onClick={() => removeBucket(index)} className="p-3 bg-rose-50 text-rose-500 rounded-xl">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'datalab' && (
        <div className="max-w-5xl mx-auto space-y-8 animate-in slide-in-from-bottom-6">
          <div className="bg-white p-6 md:p-10 rounded-[3rem] border border-slate-200 shadow-sm space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-900">Data Transparency Center</h3>
                <p className="text-sm font-semibold text-slate-600 max-w-2xl">
                  We understand sharing information is a big decision. You can skip optional data, review why we ask, and revoke access anytime.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={downloadData} className="px-5 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-teal-600 transition-all">
                  <Download size={14} /> Download Data
                </button>
                <button onClick={copyData} className="px-5 py-3 bg-white text-slate-700 border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:border-teal-300 hover:text-teal-700 transition-all">
                  {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy JSON'}
                </button>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-teal-100 bg-teal-50 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] font-black uppercase tracking-widest text-teal-700">
                <div className="flex flex-wrap items-center gap-3">
                  <span>Your data is encrypted end-to-end</span>
                  <span className="text-teal-300">•</span>
                  <span>Industry-standard security practices</span>
                  <span className="text-teal-300">•</span>
                  <span>We never sell your data</span>
                  <span className="text-teal-300">•</span>
                  <span className="inline-flex items-center gap-1"><Clock3 size={12} /> Last accessed {readableDate}</span>
                </div>
                <button
                  onClick={() => setShowSecurityDetails(prev => !prev)}
                  className="text-teal-700 hover:text-teal-900 transition-colors"
                >
                  {showSecurityDetails ? 'Show less' : 'Learn more'}
                </button>
              </div>
              {showSecurityDetails && (
                <p className="text-xs font-semibold text-slate-700">
                  We encrypt data in transit and at rest, restrict access by role, and maintain secure storage and monitoring controls.
                </p>
              )}
            </div>

            <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">You&apos;re always in control</p>
                <p className="text-sm font-semibold text-slate-700 mt-1">Disconnect optional data in one click, delete it in two clicks, or manage each permission below.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={disconnectOptionalData}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-teal-600 transition-all"
                >
                  Disconnect Anytime
                </button>
                <button
                  onClick={deleteOptionalData}
                  className="px-4 py-2 bg-white border border-rose-200 text-rose-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 transition-all"
                >
                  Delete Optional Data
                </button>
                <button
                  onClick={() => setShowPermissionDashboard(prev => !prev)}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-teal-300 hover:text-teal-700 transition-all"
                >
                  {showPermissionDashboard ? 'Hide Permissions' : 'Manage Permissions'}
                </button>
              </div>

              {showPermissionDashboard && (
                <div className="space-y-3">
                  {permissionRows.map(row => (
                    <div key={row.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-slate-500">{row.title}</p>
                        <p className="text-sm font-bold text-slate-900 mt-1">{row.status}</p>
                        <p className="text-xs text-slate-600 font-semibold mt-1">{row.description}</p>
                      </div>
                      {row.connected ? (
                        <button
                          onClick={row.onDisconnect}
                          className="px-4 py-2 bg-white border border-rose-200 text-rose-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 transition-all"
                        >
                          Disconnect
                        </button>
                      ) : (
                        <button
                          onClick={row.onConnect}
                          className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-teal-300 hover:text-teal-700 transition-all"
                        >
                          Add in Profile
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              {dataInventory.map(item => (
                <div key={item.id} className="border border-slate-200 rounded-2xl p-5 bg-slate-50 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{item.label}</p>
                      <p className="text-sm font-bold text-slate-900">{item.value}</p>
                      <p className="text-xs text-slate-600 font-semibold">{item.summary}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${item.required ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {item.required ? 'Required' : 'Optional'}
                      </span>
                      {item.canDelete && item.onDelete && (
                        <button
                          onClick={item.onDelete}
                          className="px-3 py-2 bg-white border border-rose-200 text-rose-700 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-50 transition-all"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => setExpandedDataRow(prev => prev === item.id ? null : item.id)}
                    className="w-full text-left px-4 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 flex items-center justify-between"
                  >
                    <span>Why we ask</span>
                    <span className="inline-flex items-center gap-1">
                      {expandedDataRow === item.id ? 'Show less' : 'Learn more'}
                      {expandedDataRow === item.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </span>
                  </button>

                  {expandedDataRow === item.id && (
                    <div className="p-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 space-y-2">
                      <p><span className="font-black text-slate-900">What we collect:</span> {item.collected}</p>
                      <p><span className="font-black text-slate-900">Why we need it:</span> {item.why}</p>
                      <p><span className="font-black text-slate-900">How it improves your experience:</span> {item.improves}</p>
                      <p><span className="font-black text-slate-900">What we do not do:</span> {item.notDone}</p>
                      <p><span className="font-black text-slate-900">Storage:</span> {item.storage}</p>
                      <p><span className="font-black text-slate-900">Last accessed date:</span> {readableDate}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-white">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">Control statement</p>
              <p className="text-sm font-semibold text-slate-700 mt-1">Skip-for-now stays penalty-free. Required fields remain only to keep core planning features working.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
