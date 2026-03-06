import React, { useMemo, useState } from 'react';
import {
  User,
  Shield,
  Gift,
  MapPin,
  LogOut,
  Copy,
  CheckCircle2,
  Sparkles,
  Trash2,
  Download,
  ChevronDown,
  ChevronUp,
  Clock3,
  ExternalLink,
  AlertTriangle,
  SlidersHorizontal,
  CalendarRange,
  Layers,
  Plus,
} from 'lucide-react';
import { DiscountBucket, FinanceState, IncomeSource, View } from '../types';
import { getLifeExpectancyYear, getRetirementYear } from '../lib/financeMath';
import {
  getBillingHistory,
  getBillingSnapshot,
  type BillingHistoryResponse,
  type BillingSnapshot,
} from '../services/billingService';

interface SettingsProps {
  state: FinanceState;
  updateState: (data: Partial<FinanceState>) => void;
  onLogout: () => void;
  setView?: (view: View) => void;
  mode?: 'settings' | 'data-trust';
  initialTab?: 'profile' | 'planning' | 'rewards';
  hideTabBar?: boolean;
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

const REWARD_EVENT_META: Array<{ eventType: string; label: string }> = [
  { eventType: 'daily_login', label: 'Daily Login' },
  { eventType: 'profile_completion', label: 'Profile Completion' },
  { eventType: 'risk_profile_completed', label: 'Risk Profile Completed' },
  { eventType: 'goal_added', label: 'Goal Added' },
  { eventType: 'report_generated', label: 'Report Generated' },
  { eventType: 'subscription_payment_success', label: 'Subscription Payment Success' },
];

const REWARD_EVENT_POINT_FALLBACK: Record<string, number> = {
  daily_login: 10,
  profile_completion: 20,
  risk_profile_completed: 10,
  goal_added: 20,
  report_generated: 10,
  subscription_payment_success: 30,
};

const MILESTONE_SEGMENT_CLASSES = [
  'bg-teal-500',
  'bg-cyan-500',
  'bg-emerald-500',
  'bg-sky-500',
  'bg-teal-600',
  'bg-slate-700',
];

const toTitleCase = (value: string) =>
  String(value || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatReferralStatusWithEta = (status: string | null | undefined) => {
  const normalized = String(status || '').trim().toLowerCase();
  if (!normalized) return 'Not Linked';
  if (normalized === 'fraud_hold') return 'Under Manual Review (ETA 24-48 hours)';
  if (normalized === 'applied_pending_first_paid') return 'Applied (Rewards Unlock After First Paid Subscription)';
  return toTitleCase(normalized);
};

const Settings: React.FC<SettingsProps> = ({
  state,
  updateState,
  onLogout,
  setView,
  mode = 'settings',
  initialTab = 'profile',
  hideTabBar = false,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'planning' | 'rewards'>(initialTab);
  const [copied, setCopied] = useState(false);
  const [copiedReferralCode, setCopiedReferralCode] = useState(false);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [rewardsError, setRewardsError] = useState('');
  const [rewardsSnapshot, setRewardsSnapshot] = useState<BillingSnapshot | null>(null);
  const [rewardsHistory, setRewardsHistory] = useState<BillingHistoryResponse | null>(null);
  const [animateMilestoneBars, setAnimateMilestoneBars] = useState(false);
  const [expandedDataRow, setExpandedDataRow] = useState<string | null>(null);
  const [showSecurityDetails, setShowSecurityDetails] = useState(false);
  const [showPermissionDashboard, setShowPermissionDashboard] = useState(false);
  const [lastViewedAt] = useState(() => new Date().toISOString());

  React.useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const retirementYear = getRetirementYear(state.profile.dob, state.profile.retirementAge);
  const lifeExpectancyYear = getLifeExpectancyYear(state.profile.dob, state.profile.lifeExpectancy);
  const currentYear = new Date().getFullYear();
  const retirementOffset = retirementYear ? retirementYear - currentYear : 30;
  const yearsToRetirement = retirementYear ? Math.max(0, retirementYear - currentYear) : null;
  const yearsInRetirement = retirementYear && lifeExpectancyYear ? Math.max(0, lifeExpectancyYear - retirementYear) : null;
  const hasName = Boolean((state.profile.firstName || '').trim() && (state.profile.lastName || '').trim());
  const hasDob = Boolean((state.profile.dob || '').trim());
  const hasLocation = Boolean(
    (state.profile.country || '').trim()
    && (state.profile.state || '').trim()
    && (state.profile.city || '').trim()
    && (state.profile.pincode || '').trim()
  );
  const profileSignalCount = [hasName, hasDob, hasLocation].filter(Boolean).length;

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

  const parseNumberInput = (value: string, fallback = 0) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const parseIntegerInput = (value: string, fallback = 0) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const formatBucketBoundary = (type: DiscountBucket['startType'] | DiscountBucket['endType'], offset?: number) => {
    if (type === 'Infinity') return '∞';
    const safeOffset = Number.isFinite(Number(offset)) ? Number(offset) : 0;
    if (type === 'Retirement') {
      const sign = safeOffset > 0 ? '+' : safeOffset < 0 ? '' : '';
      return `Retirement ${sign}${safeOffset}`.trim();
    }
    return `Year ${safeOffset}`;
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
  const bucketCoverageLabel = useMemo(() => {
    if (!discountSettings.buckets.length) return 'No coverage yet';
    const ranges = discountSettings.buckets.map((bucket) => resolveBucketOffsets(bucket));
    const minStart = Math.min(...ranges.map((range) => range.start));
    const maxEnd = ranges.some((range) => range.end === Infinity)
      ? Infinity
      : Math.max(...ranges.map((range) => range.end));
    return `${minStart}Y -> ${maxEnd === Infinity ? 'Infinity' : `${maxEnd}Y`}`;
  }, [discountSettings.buckets]);

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
  const openProfileSettings = () => {
    if (mode === 'data-trust' && setView) {
      setView('profile');
      return;
    }
    setActiveTab('profile');
  };

  const permissionRows = [
    {
      id: 'location-permission',
      title: 'Location insights',
      status: hasLocationData ? 'Connected' : 'Not connected',
      description: 'Improves region-specific assumptions and relevance.',
      connected: hasLocationData,
      onDisconnect: removeLocationData,
      onConnect: openProfileSettings,
    },
    {
      id: 'income-permission',
      title: 'Income context personalization',
      status: isIncomeContextShared ? 'Connected' : 'Not connected',
      description: 'Improves recommendation tuning for salaried vs business context.',
      connected: isIncomeContextShared,
      onDisconnect: removeIncomeContext,
      onConnect: openProfileSettings,
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

  const rewardsSummary = useMemo(() => {
    const fromSnapshot = new Map<string, { pointsPerEvent: number; earnedPoints: number; completed: boolean }>();
    (rewardsSnapshot?.points?.earnedEvents || []).forEach((row) => {
      fromSnapshot.set(String(row.eventType || ''), {
        pointsPerEvent: Number(row.pointsPerEvent || 0),
        earnedPoints: Number(row.earnedPoints || 0),
        completed: Boolean(row.completed),
      });
    });

    const fromHistory = (rewardsHistory?.pointsLedger || []).reduce<Record<string, number>>((acc, row) => {
      const key = String(row.eventType || '');
      if (!REWARD_EVENT_META.some((item) => item.eventType === key)) return acc;
      const points = Number(row.points || 0);
      if (points <= 0) return acc;
      acc[key] = (acc[key] || 0) + points;
      return acc;
    }, {});

    return REWARD_EVENT_META.map((item) => {
      const snapshotRow = fromSnapshot.get(item.eventType);
      const earnedPoints = Math.max(
        Number(snapshotRow?.earnedPoints || 0),
        Number(fromHistory[item.eventType] || 0),
      );
      return {
        ...item,
        pointsPerEvent: Number(snapshotRow?.pointsPerEvent || 0),
        earnedPoints,
        completed: Boolean(snapshotRow?.completed) || earnedPoints > 0,
      };
    });
  }, [rewardsHistory?.pointsLedger, rewardsSnapshot?.points?.earnedEvents]);

  const recentRewardActivity = useMemo(
    () => (rewardsHistory?.pointsLedger || []).slice(0, 8),
    [rewardsHistory?.pointsLedger],
  );

  const milestoneProgressRows = useMemo(() => {
    return REWARD_EVENT_META.map((item) => {
      const matched = rewardsSummary.find((row) => row.eventType === item.eventType);
      const points = Math.max(
        0,
        Math.trunc(Number(matched?.pointsPerEvent || REWARD_EVENT_POINT_FALLBACK[item.eventType] || 0))
      );
      const earnedTotal = Math.max(0, Number(matched?.earnedPoints || 0));
      const progressRatio = points > 0 ? Math.min(1, earnedTotal / points) : 0;
      const completed = progressRatio >= 1;
      return {
        ...item,
        points,
        completed,
        earnedTotal,
        progressRatio,
      };
    });
  }, [rewardsSummary]);

  const milestoneTotalPoints = useMemo(
    () => milestoneProgressRows.reduce((sum, item) => sum + Math.max(0, Number(item.points || 0)), 0),
    [milestoneProgressRows],
  );

  const milestoneEarnedPoints = useMemo(
    () => milestoneProgressRows.reduce((sum, row) => sum + row.earnedTotal, 0),
    [milestoneProgressRows],
  );
  const rewardsBalance = Number(rewardsSnapshot?.points?.balance || 0);
  const rewardsCompletedCount = milestoneProgressRows.filter((row) => row.completed).length;
  const rewardsInviteCap = Number((rewardsSnapshot?.referral as any)?.monthlyInviteCap || 100);
  const referralSummary = rewardsSnapshot?.referral?.summary;
  const referrerSummary = referralSummary?.asReferrer || {
    total: 0,
    rewarded: 0,
    fraudHold: 0,
    reversed: 0,
    pending: 0,
    uniqueReferredUsers: 0,
  };
  const referredSummary = referralSummary?.asReferred || {
    status: null,
    referralCode: null,
    referrerUserId: null,
  };
  const referralPointsEarned = rewardsSnapshot?.referral?.pointsEarned || {
    asReferrer: 0,
    asReferred: 0,
    total: 0,
  };
  const referredByName = rewardsSnapshot?.referral?.referredByLabel || null;
  const referredByIdentifier = rewardsSnapshot?.referral?.referredByIdentifier
    || rewardsSnapshot?.referral?.referredByIdentifierMasked
    || rewardsSnapshot?.referral?.referredByUserId
    || null;
  const referredByDisplay = referredByName || referredByIdentifier || 'Not linked';
  const referredStatusLabel = formatReferralStatusWithEta(
    String(rewardsSnapshot?.referral?.referredStatus || referredSummary.status || 'not linked')
  );
  const referralRecentActivity = useMemo(() => {
    const fromSnapshot = Array.isArray(rewardsSnapshot?.referral?.recentEvents)
      ? rewardsSnapshot.referral.recentEvents
      : [];
    if (fromSnapshot.length > 0) {
      return fromSnapshot.slice(0, 8);
    }
    const fromHistory = Array.isArray(rewardsHistory?.referralEvents)
      ? rewardsHistory.referralEvents
      : [];
    return fromHistory.slice(0, 8).map((row) => ({
      id: String(row.id || ''),
      role: row.role || 'referred',
      referralCode: String(row.referralCode || ''),
      status: String(row.status || ''),
      counterpartUserId: row.counterpartUserId || null,
      counterpartLabel: row.counterpartLabel || null,
      counterpartIdentifier: row.counterpartIdentifier || null,
      counterpartIdentifierMasked: row.counterpartIdentifierMasked || null,
      createdAt: String(row.createdAt || new Date().toISOString()),
      metadata: (row.metadata && typeof row.metadata === 'object') ? row.metadata : {},
    }));
  }, [rewardsHistory?.referralEvents, rewardsSnapshot?.referral?.recentEvents]);
  const rewardsActivePlanLabel = useMemo(() => {
    const sub = rewardsSnapshot?.subscription;
    if (!sub || sub.status !== 'active') return 'Not Active';
    const matchedPlan = rewardsSnapshot?.plans?.find((plan) => plan.planCode === sub.planCode);
    const months = Number(matchedPlan?.billingMonths || 0);
    if (months === 1) return 'Monthly';
    if (months > 1) return `${months} Months`;
    return sub.billingCycle || 'Active';
  }, [rewardsSnapshot?.plans, rewardsSnapshot?.subscription]);
  const rewardsLifetimeEarnings = useMemo(
    () => (rewardsHistory?.pointsLedger || []).reduce((sum, row) => sum + Math.max(0, Number(row.points || 0)), 0),
    [rewardsHistory?.pointsLedger],
  );

  const loadRewards = async () => {
    try {
      setRewardsLoading(true);
      setRewardsError('');
      const [snapshot, history] = await Promise.all([getBillingSnapshot(), getBillingHistory()]);
      setRewardsSnapshot(snapshot);
      setRewardsHistory(history);
    } catch (err) {
      setRewardsError((err as Error).message || 'Could not load rewards data.');
    } finally {
      setRewardsLoading(false);
    }
  };

  React.useEffect(() => {
    if (mode !== 'settings') return;
    if (activeTab !== 'rewards') return;
    if (rewardsLoading) return;
    void loadRewards();
  }, [activeTab, mode]);

  React.useEffect(() => {
    if (mode !== 'settings' || activeTab !== 'rewards') return;
    if (!rewardsSnapshot && !rewardsHistory) return;
    setAnimateMilestoneBars(false);
    const timer = window.setTimeout(() => setAnimateMilestoneBars(true), 90);
    return () => window.clearTimeout(timer);
  }, [activeTab, mode, rewardsHistory, rewardsSnapshot]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-24">
      {mode === 'settings' && !hideTabBar && (
        <div className="-mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-slate-50/95 border-y border-slate-200/70">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1.5 bg-white rounded-2xl border border-slate-200 w-full max-w-5xl mx-auto">
            <button onClick={() => setActiveTab('profile')} className={`px-4 md:px-6 py-3 rounded-xl text-sm font-semibold tracking-wide transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'profile' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}><User size={14}/> Profile</button>
            <button onClick={() => setActiveTab('rewards')} className={`px-4 md:px-6 py-3 rounded-xl text-sm font-semibold tracking-wide transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'rewards' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}><Gift size={14}/> Referral &amp; Rewards</button>
            <button onClick={() => setActiveTab('planning')} className={`px-4 md:px-6 py-3 rounded-xl text-sm font-semibold tracking-wide transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'planning' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}><Shield size={14}/> Planning Engine</button>
          </div>
        </div>
      )}

      {mode === 'data-trust' && (
        <div className="max-w-5xl mx-auto">
          <div className="rounded-[2rem] border border-teal-100 bg-white p-5 md:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-wide text-teal-600">Data and Trust</p>
              <h2 className="mt-1 text-2xl md:text-3xl font-black text-slate-900">Data Transparency Center</h2>
              <p className="mt-1 text-xs font-semibold text-slate-600">Dedicated page for permissions, controls, and transparency.</p>
            </div>
            <button
              onClick={() => (setView ? setView('profile') : undefined)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold tracking-wide text-slate-700 hover:border-teal-300 hover:text-teal-700"
            >
              Back to Profile
            </button>
          </div>
        </div>
      )}

      {mode === 'settings' && activeTab === 'profile' && (
        <div className="max-w-6xl mx-auto space-y-6 animate-in slide-in-from-bottom-6">
          <section className="relative overflow-hidden rounded-[2rem] border border-teal-100 bg-gradient-to-br from-teal-50 via-white to-cyan-50 p-5 md:p-7">
            <div className="pointer-events-none absolute -top-12 -right-16 h-40 w-40 rounded-full bg-teal-100/70 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-14 -left-10 h-36 w-36 rounded-full bg-cyan-100/60 blur-2xl" />
            <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-teal-700">Profile</p>
                <h3 className="mt-1 text-2xl md:text-3xl font-black tracking-tight text-slate-900">Personal Control Center</h3>
                <p className="mt-1 text-sm font-semibold text-slate-600">Update identity, location, and planning horizon used across every module.</p>
              </div>
              <div className="w-full max-w-sm rounded-2xl border border-white/80 bg-white/85 px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black tracking-wide text-slate-700">Profile Completion</p>
                  <p className="text-xl font-black text-slate-900">{onboardingCompletion}%</p>
                </div>
                <div className="mt-2 h-2.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-500"
                    style={{ width: `${Math.max(0, Math.min(100, onboardingCompletion))}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] font-semibold text-slate-600">Core signals complete: {profileSignalCount}/3</p>
              </div>
            </div>
            <div className="relative mt-5 grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="rounded-xl border border-white/80 bg-white/85 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-slate-500">Retirement Year</p>
                <p className="mt-0.5 text-base font-black text-slate-900">{retirementYear ?? '—'}</p>
              </div>
              <div className="rounded-xl border border-white/80 bg-white/85 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-slate-500">Life Expectancy Year</p>
                <p className="mt-0.5 text-base font-black text-slate-900">{lifeExpectancyYear ?? '—'}</p>
              </div>
              <div className="rounded-xl border border-white/80 bg-white/85 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-slate-500">Years to Retirement</p>
                <p className="mt-0.5 text-base font-black text-emerald-700">{yearsToRetirement ?? '—'}</p>
              </div>
              <div className="rounded-xl border border-white/80 bg-white/85 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-slate-500">Post-Retirement Horizon</p>
                <p className="mt-0.5 text-base font-black text-teal-700">{yearsInRetirement ?? '—'} yrs</p>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 md:p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-teal-100 bg-teal-50 text-teal-600">
                  <User size={16} />
                </span>
                <div>
                  <p className="text-sm font-black text-slate-900">Identity Details</p>
                  <p className="text-xs font-semibold text-slate-500">Used for personalization and records.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">First Name</span>
                  <input
                    type="text"
                    value={state.profile.firstName}
                    onChange={e => updateProfile({ firstName: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-teal-300 focus:bg-white focus:ring-2 focus:ring-teal-100"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Last Name</span>
                  <input
                    type="text"
                    value={state.profile.lastName || ''}
                    onChange={e => updateProfile({ lastName: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-teal-300 focus:bg-white focus:ring-2 focus:ring-teal-100"
                  />
                </label>
              </div>
              <label className="space-y-1.5 block">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Date of Birth</span>
                <input
                  type="date"
                  value={state.profile.dob || ''}
                  onChange={e => updateProfile({ dob: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-teal-300 focus:bg-white focus:ring-2 focus:ring-teal-100"
                />
              </label>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 md:p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-100 bg-cyan-50 text-cyan-600">
                  <MapPin size={16} />
                </span>
                <div>
                  <p className="text-sm font-black text-slate-900">Location and Context</p>
                  <p className="text-xs font-semibold text-slate-500">Used for planning assumptions and tax context.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Country</span>
                  <input
                    type="text"
                    value={state.profile.country || ''}
                    onChange={e => updateProfile({ country: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-teal-300 focus:bg-white focus:ring-2 focus:ring-teal-100"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">State</span>
                  <input
                    type="text"
                    value={state.profile.state || ''}
                    onChange={e => updateProfile({ state: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-teal-300 focus:bg-white focus:ring-2 focus:ring-teal-100"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">City</span>
                  <input
                    type="text"
                    value={state.profile.city || ''}
                    onChange={e => updateProfile({ city: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-teal-300 focus:bg-white focus:ring-2 focus:ring-teal-100"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Pincode</span>
                  <input
                    type="text"
                    value={state.profile.pincode || ''}
                    onChange={e => updateProfile({ pincode: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-teal-300 focus:bg-white focus:ring-2 focus:ring-teal-100"
                  />
                </label>
              </div>
              <label className="space-y-1.5 block">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Income Source</span>
                <select
                  value={normalizedIncomeSource}
                  onChange={e => updateProfile({ incomeSource: e.target.value as IncomeSource })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-teal-300 focus:bg-white focus:ring-2 focus:ring-teal-100"
                >
                  <option value="salaried">Salaried</option>
                  <option value="business">Business</option>
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 md:p-6 shadow-sm space-y-5">
            <div>
              <p className="text-sm font-black text-slate-900">Planning Horizon Controls</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Adjust retirement and life expectancy to instantly update timeline math.</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Retirement Age</label>
                  <span className="text-2xl font-black text-emerald-700">{state.profile.retirementAge}</span>
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
                  className="w-full h-1.5 bg-emerald-200 rounded-full appearance-none accent-emerald-600 cursor-pointer"
                />
                <p className="mt-2 text-[11px] font-semibold text-emerald-800">Retirement Year: {retirementYear ?? '—'}</p>
              </div>

              <div className="rounded-2xl border border-teal-100 bg-teal-50/50 p-5">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-teal-700">Life Expectancy</label>
                  <span className="text-2xl font-black text-teal-700">{state.profile.lifeExpectancy}</span>
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
                  className="w-full h-1.5 bg-teal-200 rounded-full appearance-none accent-teal-600 cursor-pointer"
                />
                <p className="mt-2 text-[11px] font-semibold text-teal-800">Life Expectancy Year: {lifeExpectancyYear ?? '—'}</p>
              </div>
            </div>
          </section>

          <div className="bg-rose-50 p-6 md:p-8 rounded-[2rem] border border-rose-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h4 className="text-lg font-black text-rose-900">Session Termination</h4>
              <p className="text-sm font-medium text-rose-700">Logout will end your current session.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="/settings/billing"
                className="px-8 py-4 bg-white text-slate-700 border border-slate-200 rounded-2xl text-sm font-semibold tracking-wide hover:bg-slate-50 transition-all inline-flex items-center justify-center gap-2"
              >
                Billing Management
              </a>
              <button onClick={onLogout} className="px-8 py-4 bg-rose-600 text-white rounded-2xl text-sm font-semibold tracking-wide hover:bg-rose-700 transition-all flex items-center justify-center gap-2">
                <LogOut size={14} /> Terminate Access
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === 'settings' && activeTab === 'rewards' && (
        <div className="max-w-6xl mx-auto space-y-6 animate-in slide-in-from-bottom-6">
          <div className="relative overflow-hidden bg-white p-4 md:p-7 rounded-[2rem] border border-slate-200 shadow-sm space-y-5">
            <div className="pointer-events-none absolute -top-14 -right-16 h-40 w-40 rounded-full bg-teal-100/70 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-14 -left-10 h-36 w-36 rounded-full bg-cyan-100/60 blur-2xl" />
            {rewardsError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
                {rewardsError}
              </div>
            )}

            {rewardsLoading && !rewardsSnapshot ? (
              <section className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-6 md:px-7 md:py-7">
                <p className="text-sm font-semibold text-slate-600">Loading rewards...</p>
              </section>
            ) : (
              <>
                <section className="relative rounded-[1.75rem] border border-teal-100 bg-gradient-to-br from-teal-50 via-white to-cyan-50 px-5 py-6 md:px-7 md:py-7">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                    <div className="flex items-center gap-5">
                      <div className="h-16 w-16 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600">
                        <Sparkles size={28} />
                      </div>
                      <div>
                        <h3 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">Rewards Hub</h3>
                        <p className="mt-1 text-sm font-semibold text-slate-600">
                          Track referral lifecycle, points milestones, and plan benefits in one place.
                        </p>
                        <p className="mt-2 text-xs font-semibold text-slate-500">
                          Completed Milestones: {rewardsCompletedCount}/{rewardsSummary.length}
                        </p>
                      </div>
                    </div>

                    <div className="self-start md:self-auto rounded-2xl border border-teal-200 bg-teal-50 px-6 py-5 min-w-[170px] text-center">
                      <p className="text-xs font-bold tracking-wide text-teal-700">Total Points</p>
                      <p className="mt-1 text-4xl font-black text-slate-900">{rewardsBalance}</p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="rounded-xl border border-white/80 bg-white/85 px-3 py-2.5">
                      <p className="text-[11px] font-semibold text-slate-500">Lifetime Earned</p>
                      <p className="mt-0.5 text-lg font-black text-slate-900">{rewardsLifetimeEarnings}</p>
                    </div>
                    <div className="rounded-xl border border-white/80 bg-white/85 px-3 py-2.5">
                      <p className="text-[11px] font-semibold text-slate-500">Total Referrals</p>
                      <p className="mt-0.5 text-lg font-black text-slate-900">{referrerSummary.total}</p>
                    </div>
                    <div className="rounded-xl border border-white/80 bg-white/85 px-3 py-2.5">
                      <p className="text-[11px] font-semibold text-slate-500">Rewarded</p>
                      <p className="mt-0.5 text-lg font-black text-emerald-700">{referrerSummary.rewarded}</p>
                    </div>
                    <div className="rounded-xl border border-white/80 bg-white/85 px-3 py-2.5">
                      <p className="text-[11px] font-semibold text-slate-500">Your Status</p>
                      <p className="mt-0.5 text-sm font-black text-slate-900 truncate">{referredStatusLabel}</p>
                    </div>
                  </div>
                </section>

                <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 md:p-7 min-h-[220px] flex flex-col">
                    <p className="text-xs font-bold tracking-wide text-slate-500">Your Referral Code</p>
                    <div className="mt-2 flex items-center gap-3">
                      <p className="text-2xl md:text-3xl font-black tracking-[0.04em] text-teal-600 break-all">
                        {rewardsSnapshot?.referral?.myCode || '—'}
                      </p>
                      <button
                        onClick={async () => {
                          const code = rewardsSnapshot?.referral?.myCode || '';
                          if (!code) return;
                          try {
                            await navigator.clipboard.writeText(code);
                            setCopiedReferralCode(true);
                            window.setTimeout(() => setCopiedReferralCode(false), 1200);
                          } catch {
                            // clipboard access is best effort
                          }
                        }}
                        disabled={!rewardsSnapshot?.referral?.myCode}
                        className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 disabled:opacity-50"
                        aria-label="Copy referral code"
                      >
                        {copiedReferralCode ? <CheckCircle2 size={16} className="text-emerald-600" /> : <Copy size={16} />}
                      </button>
                    </div>
                    <p className="mt-4 text-sm leading-relaxed font-semibold text-slate-600">
                      Share this code with your friends. On first paid subscription, you get
                      {' '}
                      <span className="font-black text-teal-600">
                        {rewardsSnapshot?.referral?.referralReward?.referrer || 0} points
                      </span>
                      {' '}and they get
                      {' '}
                      <span className="font-black text-teal-600">
                        {rewardsSnapshot?.referral?.referralReward?.referred || 0} points.
                      </span>
                    </p>
                    <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Who referred you</p>
                      <p className="mt-1 text-sm font-black text-slate-900">{referredByDisplay}</p>
                      {referredByName && referredByIdentifier && referredByIdentifier !== referredByName && (
                        <p className="mt-1 text-[11px] font-semibold text-slate-600">{referredByIdentifier}</p>
                      )}
                      <p className="mt-1 text-[11px] font-semibold text-slate-600">
                        Status: {referredStatusLabel}
                        {rewardsSnapshot?.referral?.referredByCode ? ` • Code: ${rewardsSnapshot.referral.referredByCode}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-7 min-h-[220px] flex flex-col">
                    <p className="text-xs font-bold tracking-wide text-slate-500">Subscription Status</p>
                    <p className="mt-3 text-xl md:text-2xl font-black text-slate-900">
                      Active Plan: {rewardsActivePlanLabel}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-600">
                      Expires: {rewardsSnapshot?.subscription?.endAt ? new Date(rewardsSnapshot.subscription.endAt).toLocaleDateString() : '—'}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-600">
                      Status: {toTitleCase(rewardsSnapshot?.subscription?.status || 'inactive')}
                    </p>
                    <button
                      onClick={() => (setView ? setView('billing-manage') : undefined)}
                      className="mt-auto inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-5 py-2.5 text-xs font-bold text-teal-700 hover:bg-teal-100"
                    >
                      Manage Billing <ExternalLink size={12} />
                    </button>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 md:p-7">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-2xl font-black tracking-tight text-slate-900">Referral Lifecycle</h4>
                      <p className="mt-1 text-sm font-semibold text-slate-600">Track who referred who, reward status, and credited points.</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 w-fit">
                      Invite cap: {rewardsInviteCap}/month
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-[11px] font-semibold tracking-wide text-slate-500">Your Referral Code</p>
                      <p className="mt-1 text-sm font-black text-slate-900">{rewardsSnapshot?.referral?.myCode || '—'}</p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-600">
                        Referred by: {referredByDisplay}
                      </p>
                      {referredByName && referredByIdentifier && referredByIdentifier !== referredByName && (
                        <p className="mt-1 text-[11px] font-semibold text-slate-600">
                          {referredByIdentifier}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] font-semibold text-slate-600">
                        Status: {referredStatusLabel}
                        {rewardsSnapshot?.referral?.referredByCode ? ` • Code: ${rewardsSnapshot.referral.referredByCode}` : ''}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-[11px] font-semibold tracking-wide text-slate-500">Referral Rewards</p>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                          <p className="text-[10px] font-bold text-emerald-700">As Referrer</p>
                          <p className="text-sm font-black text-emerald-800">+{referralPointsEarned.asReferrer}</p>
                        </div>
                        <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2">
                          <p className="text-[10px] font-bold text-sky-700">As Referred</p>
                          <p className="text-sm font-black text-sky-800">+{referralPointsEarned.asReferred}</p>
                        </div>
                        <div className="rounded-lg border border-teal-100 bg-teal-50 px-3 py-2">
                          <p className="text-[10px] font-bold text-teal-700">Total</p>
                          <p className="text-sm font-black text-teal-800">+{referralPointsEarned.total}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <p className="text-[10px] font-bold text-slate-500">Invites</p>
                      <p className="text-base font-black text-slate-900">{referrerSummary.total}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <p className="text-[10px] font-bold text-slate-500">Rewarded</p>
                      <p className="text-base font-black text-emerald-700">{referrerSummary.rewarded}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <p className="text-[10px] font-bold text-slate-500">Fraud Hold</p>
                      <p className="text-base font-black text-amber-700">{referrerSummary.fraudHold}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <p className="text-[10px] font-bold text-slate-500">Reversed</p>
                      <p className="text-base font-black text-rose-700">{referrerSummary.reversed}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <p className="text-[10px] font-bold text-slate-500">Unique Users</p>
                      <p className="text-base font-black text-slate-900">{referrerSummary.uniqueReferredUsers}</p>
                    </div>
                  </div>

                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="min-w-full text-left">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Role</th>
                          <th className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Counterparty</th>
                          <th className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Date</th>
                          <th className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {referralRecentActivity.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-3 py-6 text-center text-sm font-semibold text-slate-500">
                              No referral activity yet.
                            </td>
                          </tr>
                        ) : (
                          referralRecentActivity.map((event) => (
                            <tr key={`rewards-referral-${event.id}`} className="border-t border-slate-200">
                              <td className="px-3 py-2 text-xs font-black text-slate-700 uppercase tracking-wide">
                                {event.role === 'referrer' ? 'You Referred' : 'Referred You'}
                              </td>
                              <td className="px-3 py-2 text-xs font-semibold text-slate-700">
                                <div className="space-y-0.5">
                                  <p>{event.counterpartLabel || event.counterpartIdentifier || event.counterpartIdentifierMasked || event.counterpartUserId || 'Unknown'}</p>
                                  {event.counterpartLabel && event.counterpartIdentifier && event.counterpartIdentifier !== event.counterpartLabel && (
                                    <p className="text-[11px] font-medium text-slate-500">{event.counterpartIdentifier}</p>
                                  )}
                                  <p className="text-[11px] font-medium text-slate-500">Code: {event.referralCode || '—'}</p>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-xs font-semibold text-slate-700">
                                {new Date(event.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-3 py-2 text-xs font-black text-slate-600">
                                {formatReferralStatusWithEta(String(event.status || 'unknown'))}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 md:p-7">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h4 className="text-2xl font-black tracking-tight text-slate-900">Points Earned by Milestone</h4>
                      <p className="mt-1 text-xs font-semibold text-slate-600">Milestone completion progress and points unlocked.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-700 w-fit">
                        Earned {milestoneEarnedPoints} pts
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 w-fit">
                        Configured {milestoneTotalPoints} pts
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="h-4 rounded-full bg-slate-200 overflow-hidden flex">
                      {milestoneProgressRows.map((row, index) => (
                        <div
                          key={row.eventType}
                          className="relative h-full"
                          style={{ width: `${(row.points / Math.max(1, milestoneTotalPoints)) * 100}%` }}
                        >
                          <div
                            className={`h-full transition-all duration-700 ease-out ${MILESTONE_SEGMENT_CLASSES[index % MILESTONE_SEGMENT_CLASSES.length]} ${row.completed ? 'opacity-100' : 'opacity-30'}`}
                            style={{
                              width: animateMilestoneBars ? `${Math.max(0, Math.min(100, row.progressRatio * 100))}%` : '0%',
                              transitionDelay: `${index * 110}ms`,
                            }}
                          />
                          {index < milestoneProgressRows.length - 1 && (
                            <span className="absolute top-0 right-0 h-full w-px bg-white/70" />
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {milestoneProgressRows.map((row, index) => (
                        <div key={row.eventType} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`h-2.5 w-2.5 rounded-full ${MILESTONE_SEGMENT_CLASSES[index % MILESTONE_SEGMENT_CLASSES.length]}`} />
                            <div className="min-w-0">
                              <p className="text-xs font-black text-slate-800 truncate">{row.label}</p>
                              {row.earnedTotal > row.points && (
                                <p className="text-[10px] font-semibold text-slate-500">
                                  Lifetime earned: {row.earnedTotal} pts
                                </p>
                              )}
                              <p className="text-[10px] font-semibold text-slate-500">
                                Configured per completion: {row.points} pts
                              </p>
                            </div>
                          </div>
                          <p className={`text-[11px] font-black whitespace-nowrap ${row.earnedTotal > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                            {row.earnedTotal}/{row.points} pts
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 md:p-7">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <h4 className="text-2xl font-black tracking-tight text-slate-900">Points History</h4>
                    <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-700 w-fit">
                      Lifetime Earnings {rewardsLifetimeEarnings}
                    </span>
                  </div>

                  <div className="mt-5 rounded-[1.6rem] border border-slate-200 bg-white overflow-hidden">
                    <div className="grid grid-cols-[1.2fr_0.8fr_0.5fr] gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold text-slate-500">Event</p>
                      <p className="text-xs font-semibold text-slate-500">Date</p>
                      <p className="text-xs font-semibold text-slate-500 text-right">Points</p>
                    </div>

                    {recentRewardActivity.length === 0 ? (
                      <div className="px-4 py-6 text-sm font-semibold text-slate-600">No points activity yet.</div>
                    ) : (
                      <div className="divide-y divide-slate-200">
                        {recentRewardActivity.map((item) => {
                          const points = Number(item.points || 0);
                          const label = REWARD_EVENT_META.find((row) => row.eventType === item.eventType)?.label || item.eventType;
                          return (
                            <div key={item.id} className="grid grid-cols-[1.2fr_0.8fr_0.5fr] gap-2 items-center px-4 py-4">
                              <div className="flex items-center gap-3">
                                <span className="h-9 w-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-500">
                                  <Sparkles size={14} />
                                </span>
                                <p className="text-sm font-black tracking-wide text-slate-900">{label}</p>
                              </div>
                              <p className="text-sm font-semibold text-slate-600">{new Date(item.createdAt).toLocaleDateString()}</p>
                              <p className={`text-sm font-black text-right ${points >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                {points >= 0 ? '+' : ''}{points}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      )}

      {mode === 'settings' && activeTab === 'planning' && (
        <div className="max-w-6xl mx-auto space-y-6 animate-in slide-in-from-bottom-6">
          <div className="relative overflow-hidden bg-white p-4 md:p-7 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
            <div className="pointer-events-none absolute -top-14 -right-16 h-40 w-40 rounded-full bg-teal-100/70 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-14 -left-10 h-36 w-36 rounded-full bg-cyan-100/60 blur-2xl" />
            <section className="relative rounded-[1.75rem] border border-teal-100 bg-gradient-to-br from-teal-50 via-white to-cyan-50 p-5 md:p-6">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-teal-700">Planning Engine</p>
                  <h3 className="mt-1 text-2xl md:text-3xl font-black tracking-tight text-slate-900">Planner Assumptions and Bucket Logic</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-600">Set return and inflation assumptions, then model their behavior across each timeline phase.</p>
                </div>
                <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-black tracking-wide ${
                  bucketError ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}>
                  <Sparkles size={14} />
                  {bucketError ? 'Bucket health needs attention' : 'Bucket health is valid'}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-2">
                <div className="rounded-xl border border-white/80 bg-white/85 p-3">
                  <p className="text-[11px] font-semibold text-slate-500">Buckets</p>
                  <p className="mt-1 text-xl font-black text-slate-900">{discountSettings.buckets.length}</p>
                </div>
                <div className="rounded-xl border border-white/80 bg-white/85 p-3">
                  <p className="text-[11px] font-semibold text-slate-500">Coverage</p>
                  <p className="mt-1 text-sm font-black text-slate-900">{bucketCoverageLabel}</p>
                </div>
                <div className="rounded-xl border border-white/80 bg-white/85 p-3">
                  <p className="text-[11px] font-semibold text-slate-500">Discount Mode</p>
                  <p className="mt-1 text-sm font-black text-slate-900">{discountSettings.useBuckets ? 'Bucketed' : 'Single Default'}</p>
                </div>
                <div className="rounded-xl border border-white/80 bg-white/85 p-3">
                  <p className="text-[11px] font-semibold text-slate-500">Inflation Mode</p>
                  <p className="mt-1 text-sm font-black text-slate-900">{discountSettings.useBucketInflation ? 'Bucketed' : 'Single Default'}</p>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 text-[11px] font-black tracking-wide text-slate-600">
                      <SlidersHorizontal size={14} />
                      Discount Curve
                    </div>
                    <p className="text-sm font-semibold text-slate-600">
                      Toggle between one default rate and timeline-based discount assumptions.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={discountSettings.useBuckets}
                    onClick={() => updateDiscountSettings({ useBuckets: !discountSettings.useBuckets })}
                    className={`relative inline-flex h-8 w-14 shrink-0 rounded-full transition-colors ${
                      discountSettings.useBuckets ? 'bg-teal-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${
                        discountSettings.useBuckets ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <label className="text-[11px] font-semibold text-slate-500">Default Discount Rate</label>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={30}
                      step={0.1}
                      value={discountSettings.defaultDiscountRate}
                      onChange={(e) => updateDiscountSettings({ defaultDiscountRate: parseNumberInput(e.target.value, 0) })}
                      className="w-28 rounded-xl border border-slate-200 px-3 py-2 text-sm font-black text-slate-900 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
                    />
                    <span className="text-xs font-black text-slate-500">%</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 text-[11px] font-black tracking-wide text-slate-600">
                      <Layers size={14} />
                      Inflation Curve
                    </div>
                    <p className="text-sm font-semibold text-slate-600">
                      Apply bucket-level inflation where long-term costs diverge from today.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={discountSettings.useBucketInflation}
                    onClick={() => updateDiscountSettings({ useBucketInflation: !discountSettings.useBucketInflation })}
                    className={`relative inline-flex h-8 w-14 shrink-0 rounded-full transition-colors ${
                      discountSettings.useBucketInflation ? 'bg-teal-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${
                        discountSettings.useBucketInflation ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <label className="text-[11px] font-semibold text-slate-500">Default Inflation Rate</label>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={30}
                      step={0.1}
                      value={discountSettings.defaultInflationRate}
                      onChange={(e) => updateDiscountSettings({ defaultInflationRate: parseNumberInput(e.target.value, 0) })}
                      className="w-28 rounded-xl border border-slate-200 px-3 py-2 text-sm font-black text-slate-900 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
                    />
                    <span className="text-xs font-black text-slate-500">%</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="inline-flex items-center gap-2 text-lg font-black text-slate-900">
                  <CalendarRange size={18} />
                  Bucket Templates
                </h4>
                <p className="text-xs font-semibold text-slate-500">Apply a starter preset, then fine-tune in editor</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => applyTemplate('starter')}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-teal-300 hover:bg-teal-50/40"
                >
                  <p className="text-sm font-black text-slate-900">Starter</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Simple near/mid/long assumptions.</p>
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate('balanced')}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-teal-300 hover:bg-teal-50/40"
                >
                  <p className="text-sm font-black text-slate-900">Balanced</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Pre and post-retirement split assumptions.</p>
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate('growth')}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-teal-300 hover:bg-teal-50/40"
                >
                  <p className="text-sm font-black text-slate-900">Growth</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Higher long-horizon return assumptions.</p>
                </button>
              </div>
            </section>

            {bucketError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
                <p className="inline-flex items-center gap-2 text-sm font-black text-rose-700">
                  <AlertTriangle size={16} />
                  {bucketError}
                </p>
              </div>
            )}

            <section className="space-y-4 rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4 md:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h4 className="text-xl font-black text-slate-900">Bucket Editor</h4>
                  <p className="text-xs font-semibold text-slate-500 mt-1">Define boundaries, rates, and inflation for each horizon block.</p>
                </div>
                <button
                  type="button"
                  onClick={addBucket}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black tracking-wide text-white transition hover:bg-teal-600"
                >
                  <Plus size={14} />
                  Add Bucket
                </button>
              </div>

              {discountSettings.buckets.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-semibold text-slate-500">Coverage Preview</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {discountSettings.buckets.map((bucket) => {
                      const { start, end } = resolveBucketOffsets(bucket);
                      return (
                        <div key={`chip-${bucket.id}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                          <p className="text-xs font-black text-slate-800">{bucket.name}</p>
                          <p className="text-[11px] font-semibold text-slate-500">
                            {start}Y → {end === Infinity ? '∞' : `${end}Y`}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {discountSettings.buckets.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm font-semibold text-slate-600">
                  No buckets configured yet. Add your first bucket to start timeline-based assumptions.
                </div>
              ) : (
                <div className="space-y-3">
                  {discountSettings.buckets.map((bucket, index) => {
                    const { start, end } = resolveBucketOffsets(bucket);
                    return (
                      <div key={bucket.id} className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-black text-slate-500">Bucket {index + 1}</p>
                            <p className="mt-1 text-sm font-black text-slate-900">
                              Coverage: {start}Y to {end === Infinity ? '∞' : `${end}Y`}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeBucket(index)}
                            className="inline-flex items-center gap-2 self-start rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 transition hover:bg-rose-100"
                          >
                            <Trash2 size={14} />
                            Remove
                          </button>
                        </div>

                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                          <div className="space-y-2">
                            <label className="text-[11px] font-semibold text-slate-500">Bucket Name</label>
                            <input
                              type="text"
                              value={bucket.name}
                              onChange={(e) => updateBucket(index, { name: e.target.value })}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-900 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
                              placeholder="Eg. Early Career"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-[11px] font-semibold text-slate-500">Start Boundary</label>
                            <div className="grid grid-cols-[1fr_90px] gap-2">
                              <select
                                value={bucket.startType}
                                onChange={(e) => updateBucket(index, { startType: e.target.value as DiscountBucket['startType'] })}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
                              >
                                <option value="Offset">Offset</option>
                                <option value="Retirement">Retirement</option>
                              </select>
                              <input
                                type="number"
                                value={bucket.startOffset}
                                onChange={(e) => updateBucket(index, { startOffset: parseIntegerInput(e.target.value, 0) })}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-900 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
                              />
                            </div>
                            <p className="text-[11px] font-semibold text-slate-500">
                              {formatBucketBoundary(bucket.startType, bucket.startOffset)}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[11px] font-semibold text-slate-500">End Boundary</label>
                            <div className="grid grid-cols-[1fr_90px] gap-2">
                              <select
                                value={bucket.endType}
                                onChange={(e) => updateBucket(index, { endType: e.target.value as DiscountBucket['endType'] })}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
                              >
                                <option value="Offset">Offset</option>
                                <option value="Retirement">Retirement</option>
                                <option value="Infinity">Infinity</option>
                              </select>
                              {bucket.endType !== 'Infinity' ? (
                                <input
                                  type="number"
                                  value={bucket.endOffset ?? 0}
                                  onChange={(e) => updateBucket(index, { endOffset: parseIntegerInput(e.target.value, 0) })}
                                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-900 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
                                />
                              ) : (
                                <div className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm font-black text-slate-500">
                                  ∞
                                </div>
                              )}
                            </div>
                            <p className="text-[11px] font-semibold text-slate-500">
                              {formatBucketBoundary(bucket.endType, bucket.endOffset)}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[11px] font-semibold text-slate-500">Discount Rate</label>
                            <div className="relative">
                              <input
                                type="number"
                                step={0.1}
                                value={bucket.discountRate ?? ''}
                                onChange={(e) => updateBucket(index, { discountRate: parseNumberInput(e.target.value, discountSettings.defaultDiscountRate) })}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-8 text-sm font-bold text-slate-900 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500">%</span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[11px] font-semibold text-slate-500">Inflation Rate</label>
                            <div className="relative">
                              <input
                                type="number"
                                step={0.1}
                                value={bucket.inflationRate ?? ''}
                                onChange={(e) => updateBucket(index, { inflationRate: parseNumberInput(e.target.value, discountSettings.defaultInflationRate) })}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-8 text-sm font-bold text-slate-900 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500">%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {mode === 'data-trust' && (
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

      {mode === 'settings' && (
        <footer className="max-w-5xl mx-auto rounded-[2rem] border border-slate-200 bg-white p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Data and Trust Page</p>
            <p className="text-xs font-semibold text-slate-600 mt-1">
              Data transparency and permission controls now live on a dedicated URL.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => (setView ? setView('data-trust') : undefined)}
              className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-teal-700"
            >
              Open Data and Trust
            </button>
            <a
              href="/data-and-trust"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-700"
            >
              /data-and-trust
            </a>
          </div>
        </footer>
      )}
    </div>
  );
};

export default Settings;
