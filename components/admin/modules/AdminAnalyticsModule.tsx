import React from 'react';
import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import type { AdminAnalyticsSnapshot } from '../../../services/admin/types';
import SafeResponsiveContainer from '../../common/SafeResponsiveContainer';
import { AppButton, SectionHeader, SurfaceCard } from '../../common/ui';

interface AnalyticsGrowthSnapshot {
  current: {
    newUsers: number;
    txnCount: number;
    revenue: number;
    avgDau: number;
  };
  previous: {
    newUsers: number;
    txnCount: number;
    revenue: number;
    avgDau: number;
  };
  deltas: {
    newUsersPct: number | null;
    txnCountPct: number | null;
    revenuePct: number | null;
    dauPct: number | null;
  };
  efficiency: {
    revenuePerTxn: number;
    revenuePerDailyActive: number;
  };
}

interface AdminAnalyticsModuleProps {
  analyticsDays: number;
  setAnalyticsDays: (value: number) => void;
  analytics: AdminAnalyticsSnapshot | null;
  analyticsGrowth: AnalyticsGrowthSnapshot | null;
  loadAnalytics: () => void;
  toneClass: (tone: 'up' | 'down' | 'flat') => string;
  toneFromDelta: (value: number | null) => 'up' | 'down' | 'flat';
  formatDeltaPct: (value: number | null) => string;
  formatNumber: (value: number) => string;
  formatCurrency: (value: number) => string;
}

const AdminAnalyticsModule: React.FC<AdminAnalyticsModuleProps> = ({
  analyticsDays,
  setAnalyticsDays,
  analytics,
  analyticsGrowth,
  loadAnalytics,
  toneClass,
  toneFromDelta,
  formatDeltaPct,
  formatNumber,
  formatCurrency,
}) => {
  const actionQueue: Array<{
    label: string;
    value: string;
    tone: 'up' | 'down' | 'flat';
    detail: string;
    action: string;
  }> = [
    {
      label: 'Revenue Momentum (30d)',
      value: formatDeltaPct(analyticsGrowth?.deltas.revenuePct ?? null),
      tone:
        analyticsGrowth?.deltas.revenuePct == null
          ? 'flat'
          : analyticsGrowth.deltas.revenuePct < -10
            ? 'down'
            : analyticsGrowth.deltas.revenuePct < 0
              ? 'flat'
              : 'up',
      detail: analyticsGrowth
        ? `${formatCurrency(analyticsGrowth.current.revenue)} vs ${formatCurrency(analyticsGrowth.previous.revenue)}`
        : 'No baseline yet',
      action:
        (analyticsGrowth?.deltas.revenuePct ?? 0) < 0
          ? 'Review paywall conversion and failed payment recovery.'
          : 'Sustain conversion quality and monitor next 7-day trend.',
    },
    {
      label: 'Acquisition Momentum (30d)',
      value: formatDeltaPct(analyticsGrowth?.deltas.newUsersPct ?? null),
      tone: toneFromDelta(analyticsGrowth?.deltas.newUsersPct ?? null),
      detail: analyticsGrowth
        ? `${formatNumber(analyticsGrowth.current.newUsers)} vs ${formatNumber(analyticsGrowth.previous.newUsers)} new users`
        : 'No baseline yet',
      action:
        (analyticsGrowth?.deltas.newUsersPct ?? 0) < 0
          ? 'Prioritize landing-to-signup funnel fixes this week.'
          : 'Scale top channels while keeping CAC guardrails.',
    },
    {
      label: 'Engagement Momentum (Avg DAU)',
      value: formatDeltaPct(analyticsGrowth?.deltas.dauPct ?? null),
      tone: toneFromDelta(analyticsGrowth?.deltas.dauPct ?? null),
      detail: analyticsGrowth
        ? `${formatNumber(Math.round(analyticsGrowth.current.avgDau))} vs ${formatNumber(Math.round(analyticsGrowth.previous.avgDau))}`
        : 'No baseline yet',
      action:
        (analyticsGrowth?.deltas.dauPct ?? 0) < 0
          ? 'Ship activation nudges and bring users back to core flows.'
          : 'Push retention campaigns for high-value cohorts.',
    },
    {
      label: 'Revenue Quality (INR / txn)',
      value: formatCurrency(analyticsGrowth?.efficiency.revenuePerTxn || 0),
      tone:
        (analyticsGrowth?.efficiency.revenuePerTxn || 0) < 50
          ? 'down'
          : (analyticsGrowth?.efficiency.revenuePerTxn || 0) < 100
            ? 'flat'
            : 'up',
      detail: `${formatCurrency(analyticsGrowth?.efficiency.revenuePerDailyActive || 0)} per avg daily active user`,
      action:
        (analyticsGrowth?.efficiency.revenuePerTxn || 0) < 100
          ? 'Inspect coupon impact and discount leakage.'
          : 'Revenue per transaction is healthy.',
    },
  ];

  return (
    <div className="space-y-5">
      <SurfaceCard variant="elevated" padding="none" className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Window</label>
            <select
              value={analyticsDays}
              onChange={(event) => setAnalyticsDays(Number(event.target.value || 365))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-600"
            >
              <option value={30}>30 Days</option>
              <option value={60}>60 Days</option>
              <option value={90}>90 Days</option>
              <option value={180}>180 Days</option>
              <option value={365}>365 Days</option>
            </select>
            <AppButton tone="primary" size="md" onClick={loadAnalytics}>
              Refresh Analytics
            </AppButton>
          </div>
          <p className="text-xs font-semibold text-slate-500">Growth deltas compare latest 30 days vs previous 30 days.</p>
        </div>
      </SurfaceCard>

      <SurfaceCard variant="elevated" padding="none" className="p-5">
        <SectionHeader
          title="Actionable KPI Priorities"
          description="Primary decisions first. Use these signals to decide what to fix now."
        />
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-4">
          {actionQueue.map((item) => (
            <div key={item.label} className={`rounded-2xl border p-3 ${toneClass(item.tone)}`}>
              <p className="text-[10px] font-black uppercase tracking-[0.14em]">{item.label}</p>
              <p className="mt-2 text-xl font-black">{item.value}</p>
              <p className="mt-1.5 text-xs font-semibold opacity-90">{item.detail}</p>
              <p className="mt-2 text-xs font-black opacity-95">{item.action}</p>
            </div>
          ))}
        </div>
      </SurfaceCard>

      <SectionHeader
        title="Context Metrics"
        description="Supporting numbers for deeper diagnosis after action priorities are reviewed."
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <SurfaceCard variant="elevated" padding="none" className="p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">New Users</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{formatNumber(analytics?.totals.newUsers || 0)}</p>
        </SurfaceCard>
        <SurfaceCard variant="elevated" padding="none" className="p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Transactions</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{formatNumber(analytics?.totals.txnCount || 0)}</p>
        </SurfaceCard>
        <SurfaceCard variant="elevated" padding="none" className="p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Volume</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{formatCurrency(analytics?.totals.txnAmount || 0)}</p>
        </SurfaceCard>
        <SurfaceCard variant="elevated" padding="none" className="p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Revenue</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{formatCurrency(analytics?.totals.revenue || 0)}</p>
        </SurfaceCard>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <div className={`rounded-3xl border p-4 ${toneClass(toneFromDelta(analyticsGrowth?.deltas.newUsersPct ?? null))}`}>
          <p className="text-[10px] font-black uppercase tracking-widest">Acquisition Delta</p>
          <p className="mt-2 text-2xl font-black">{formatDeltaPct(analyticsGrowth?.deltas.newUsersPct ?? null)}</p>
          <p className="mt-2 text-xs font-semibold opacity-90">
            {analyticsGrowth
              ? `${formatNumber(analyticsGrowth.current.newUsers)} vs ${formatNumber(analyticsGrowth.previous.newUsers)} users`
              : 'No baseline yet'}
          </p>
        </div>
        <div className={`rounded-3xl border p-4 ${toneClass(toneFromDelta(analyticsGrowth?.deltas.revenuePct ?? null))}`}>
          <p className="text-[10px] font-black uppercase tracking-widest">Revenue Delta</p>
          <p className="mt-2 text-2xl font-black">{formatDeltaPct(analyticsGrowth?.deltas.revenuePct ?? null)}</p>
          <p className="mt-2 text-xs font-semibold opacity-90">
            {analyticsGrowth
              ? `${formatCurrency(analyticsGrowth.current.revenue)} vs ${formatCurrency(analyticsGrowth.previous.revenue)}`
              : 'No baseline yet'}
          </p>
        </div>
        <div className={`rounded-3xl border p-4 ${toneClass(toneFromDelta(analyticsGrowth?.deltas.dauPct ?? null))}`}>
          <p className="text-[10px] font-black uppercase tracking-widest">Avg DAU Delta</p>
          <p className="mt-2 text-2xl font-black">{formatDeltaPct(analyticsGrowth?.deltas.dauPct ?? null)}</p>
          <p className="mt-2 text-xs font-semibold opacity-90">
            {analyticsGrowth
              ? `${formatNumber(Math.round(analyticsGrowth.current.avgDau))} vs ${formatNumber(Math.round(analyticsGrowth.previous.avgDau))}`
              : 'No baseline yet'}
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
          <p className="text-[10px] font-black uppercase tracking-widest">Revenue Efficiency</p>
          <p className="mt-2 text-xl font-black">{formatCurrency(analyticsGrowth?.efficiency.revenuePerTxn || 0)} / txn</p>
          <p className="mt-2 text-xs font-semibold">
            {formatCurrency(analyticsGrowth?.efficiency.revenuePerDailyActive || 0)} per avg daily active user
          </p>
        </div>
      </div>

      <SurfaceCard variant="elevated" padding="none" className="p-5">
        <SectionHeader title="Trend Context (Drill-down)" />
        <div className="h-80 w-full mt-4">
          <SafeResponsiveContainer>
            <LineChart data={analytics?.series || []} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="newUsers" stroke="#0d9488" strokeWidth={2.3} dot={false} name="New Users" />
              <Line type="monotone" dataKey="txnCount" stroke="#f43f5e" strokeWidth={2.3} dot={false} name="Transactions" />
              <Line type="monotone" dataKey="dau" stroke="#6366f1" strokeWidth={2.2} dot={false} name="DAU" />
              <Line type="monotone" dataKey="revenue" stroke="#eab308" strokeWidth={2.2} dot={false} name="Revenue" />
            </LineChart>
          </SafeResponsiveContainer>
        </div>
      </SurfaceCard>
    </div>
  );
};

export default AdminAnalyticsModule;
