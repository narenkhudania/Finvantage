import React from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import type { AdminUsageReport } from '../../../services/admin/types';
import SafeResponsiveContainer from '../../common/SafeResponsiveContainer';
import { AppButton, SurfaceCard } from '../../common/ui';

interface UsageGrowthSnapshot {
  onboardingUsers: number;
  goalUsers: number;
  assetUsers: number;
  liabilityUsers: number;
  riskUsers: number;
  activationRatePct: number | null;
  assetAdoptionRatePct: number | null;
  liabilityAdoptionRatePct: number | null;
  riskCompletionRatePct: number | null;
  eventsMomentumPct: number | null;
  activeUsersMomentumPct: number | null;
  actionsPerUser: number;
  powerUserConcentrationPct: number;
  currentEvents7d: number;
  previousEvents7d: number;
  currentAvgUsers7d: number;
  previousAvgUsers7d: number;
}

interface AdminUsageModuleProps {
  usageDays: number;
  setUsageDays: (value: number) => void;
  usageReport: AdminUsageReport | null;
  usageGrowth: UsageGrowthSnapshot | null;
  loadUsage: () => void;
  toneClass: (tone: 'up' | 'down' | 'flat') => string;
  toneFromDelta: (value: number | null) => 'up' | 'down' | 'flat';
  formatDeltaPct: (value: number | null) => string;
  formatNumber: (value: number) => string;
  formatDate: (value?: string | null) => string;
  round: (value: number, precision?: number) => number;
}

const AdminUsageModule: React.FC<AdminUsageModuleProps> = ({
  usageDays,
  setUsageDays,
  usageReport,
  usageGrowth,
  loadUsage,
  toneClass,
  toneFromDelta,
  formatDeltaPct,
  formatNumber,
  formatDate,
  round,
}) => {
  return (
    <div className="space-y-5">
      <SurfaceCard variant="elevated" padding="none" className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Window</label>
            <select
              value={usageDays}
              onChange={(event) => setUsageDays(Number(event.target.value || 30))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-600"
            >
              <option value={7}>7 Days</option>
              <option value={30}>30 Days</option>
              <option value={60}>60 Days</option>
              <option value={90}>90 Days</option>
              <option value={180}>180 Days</option>
              <option value={365}>365 Days</option>
            </select>
            <AppButton tone="primary" size="md" onClick={loadUsage}>
              Refresh Usage
            </AppButton>
          </div>
          <p className="text-xs font-semibold text-slate-500">Last refreshed: {formatDate(usageReport?.generatedAt)}</p>
        </div>
      </SurfaceCard>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <SurfaceCard variant="elevated" padding="none" className="p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Events</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{formatNumber(usageReport?.totals.totalEvents || 0)}</p>
        </SurfaceCard>
        <SurfaceCard variant="elevated" padding="none" className="p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Unique Users</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{formatNumber(usageReport?.totals.uniqueUsers || 0)}</p>
        </SurfaceCard>
        <SurfaceCard variant="elevated" padding="none" className="p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Avg Events / User</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{(usageReport?.totals.avgEventsPerUser || 0).toFixed(2)}</p>
        </SurfaceCard>
        <SurfaceCard variant="elevated" padding="none" className="p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Goal + Asset Actions</p>
          <p className="mt-2 text-2xl font-black text-slate-900">
            {formatNumber((usageReport?.totals.goalCreates || 0) + (usageReport?.totals.assetAdds || 0))}
          </p>
        </SurfaceCard>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <div className={`rounded-3xl border p-4 ${
          usageGrowth?.activationRatePct == null
            ? toneClass('flat')
            : usageGrowth.activationRatePct >= 35
            ? toneClass('up')
            : usageGrowth.activationRatePct < 20
            ? toneClass('down')
            : toneClass('flat')
        }`}>
          <p className="text-[10px] font-black uppercase tracking-widest">Activation Rate</p>
          <p className="mt-2 text-2xl font-black">
            {usageGrowth?.activationRatePct == null ? 'N/A' : `${round(usageGrowth.activationRatePct, 1).toFixed(1)}%`}
          </p>
          <p className="mt-2 text-xs font-semibold opacity-90">
            {usageGrowth
              ? `${formatNumber(usageGrowth.goalUsers)} goal creators from ${formatNumber(usageGrowth.onboardingUsers)} onboarded users`
              : 'No activation baseline yet'}
          </p>
        </div>
        <div className={`rounded-3xl border p-4 ${
          usageGrowth?.assetAdoptionRatePct == null
            ? toneClass('flat')
            : usageGrowth.assetAdoptionRatePct >= 25
            ? toneClass('up')
            : usageGrowth.assetAdoptionRatePct < 10
            ? toneClass('down')
            : toneClass('flat')
        }`}>
          <p className="text-[10px] font-black uppercase tracking-widest">Asset Adoption</p>
          <p className="mt-2 text-2xl font-black">
            {usageGrowth?.assetAdoptionRatePct == null ? 'N/A' : `${round(usageGrowth.assetAdoptionRatePct, 1).toFixed(1)}%`}
          </p>
          <p className="mt-2 text-xs font-semibold opacity-90">
            {usageGrowth ? `${formatNumber(usageGrowth.assetUsers)} users added assets` : 'No adoption baseline yet'}
          </p>
        </div>
        <div className={`rounded-3xl border p-4 ${toneClass(toneFromDelta(usageGrowth?.activeUsersMomentumPct ?? null))}`}>
          <p className="text-[10px] font-black uppercase tracking-widest">Weekly Active Trend</p>
          <p className="mt-2 text-2xl font-black">{formatDeltaPct(usageGrowth?.activeUsersMomentumPct ?? null)}</p>
          <p className="mt-2 text-xs font-semibold opacity-90">
            {usageGrowth
              ? `${round(usageGrowth.currentAvgUsers7d, 1).toFixed(1)} avg users/day vs ${round(usageGrowth.previousAvgUsers7d, 1).toFixed(1)}`
              : 'Need two weeks of trend data'}
          </p>
        </div>
        <div className={`rounded-3xl border p-4 ${
          usageGrowth
            ? usageGrowth.powerUserConcentrationPct <= 35
              ? toneClass('up')
              : usageGrowth.powerUserConcentrationPct >= 60
              ? toneClass('down')
              : toneClass('flat')
            : toneClass('flat')
        }`}>
          <p className="text-[10px] font-black uppercase tracking-widest">Power User Concentration</p>
          <p className="mt-2 text-2xl font-black">
            {usageGrowth ? `${round(usageGrowth.powerUserConcentrationPct, 1).toFixed(1)}%` : 'N/A'}
          </p>
          <p className="mt-2 text-xs font-semibold opacity-90">Event share generated by the top 5 active users</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[1.2fr_0.8fr]">
        <SurfaceCard variant="elevated" padding="none" className="p-5">
          <h3 className="mb-4 text-lg font-black tracking-tight text-slate-900">Daily Feature Activity</h3>
          <div className="h-80 w-full">
            <SafeResponsiveContainer>
              <LineChart data={usageReport?.trends || []} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="events" stroke="#0d9488" strokeWidth={2.4} dot={false} name="Events" />
                <Line yAxisId="right" type="monotone" dataKey="users" stroke="#6366f1" strokeWidth={2.2} dot={false} name="Active Users" />
              </LineChart>
            </SafeResponsiveContainer>
          </div>
        </SurfaceCard>

        <SurfaceCard variant="elevated" padding="none" className="p-5">
          <h3 className="text-lg font-black tracking-tight text-slate-900">Goal Funnel Signals</h3>
          <div className="mt-4 space-y-2.5">
            {(usageReport?.funnel || []).map((row) => (
              <div key={row.step} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs font-black uppercase tracking-widest text-slate-600">{row.step}</p>
                <p className="mt-1 text-xl font-black text-slate-900">{formatNumber(row.users)}</p>
              </div>
            ))}
            {!(usageReport?.funnel || []).length && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm font-semibold text-slate-500">
                No funnel events captured yet.
              </div>
            )}
          </div>
        </SurfaceCard>
      </div>

      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[1fr_1fr]">
        <SurfaceCard variant="elevated" padding="none" className="p-5">
          <h3 className="mb-3 text-lg font-black tracking-tight text-slate-900">Top Features Used</h3>
          <div className="h-72 w-full">
            <SafeResponsiveContainer>
              <BarChart data={(usageReport?.topEvents || []).slice(0, 10)} margin={{ top: 10, right: 12, left: -8, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="eventName" tick={{ fontSize: 9, fill: '#64748b' }} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip />
                <Bar dataKey="events" fill="#0d9488" radius={[6, 6, 0, 0]} />
              </BarChart>
            </SafeResponsiveContainer>
          </div>
        </SurfaceCard>

        <SurfaceCard variant="elevated" padding="none" className="p-5">
          <h3 className="mb-3 text-lg font-black tracking-tight text-slate-900">Module Opens (View-level)</h3>
          <div className="max-h-72 space-y-2 overflow-auto pr-1">
            {(usageReport?.moduleUsage || []).map((row) => (
              <div key={row.module} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-slate-800">{row.module}</p>
                  <p className="text-xs font-semibold text-slate-500">{row.avgPerUser.toFixed(2)} / user</p>
                </div>
                <p className="mt-1 text-xs font-semibold text-slate-600">
                  {formatNumber(row.opens)} opens • {formatNumber(row.users)} users
                </p>
              </div>
            ))}
            {!(usageReport?.moduleUsage || []).length && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm font-semibold text-slate-500">
                Module activity will appear once events are captured.
              </div>
            )}
          </div>
        </SurfaceCard>
      </div>

      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[1fr_1fr]">
        <SurfaceCard variant="elevated" padding="none" className="p-5">
          <h3 className="mb-3 text-lg font-black tracking-tight text-slate-900">Power Users</h3>
          <div className="overflow-auto">
            <table className="min-w-[620px] lg:min-w-[640px] w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['User', 'Events', 'Top Action', 'Last Seen'].map((header) => (
                    <th key={header} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(usageReport?.powerUsers || []).map((row) => (
                  <tr key={row.userId} className="border-t border-slate-100">
                    <td className="px-3 py-3">
                      <p className="text-sm font-black text-slate-800">{row.name || row.email}</p>
                      <p className="text-xs text-slate-500">{row.email}</p>
                    </td>
                    <td className="px-3 py-3 text-xs font-semibold text-slate-700">{formatNumber(row.events)}</td>
                    <td className="px-3 py-3 text-xs font-semibold text-slate-700">{row.topEvent || '-'}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{formatDate(row.lastEventAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceCard>

        <SurfaceCard variant="elevated" padding="none" className="p-5">
          <h3 className="mb-3 text-lg font-black tracking-tight text-slate-900">Recent Customer Events</h3>
          <div className="max-h-80 space-y-2 overflow-auto pr-1">
            {(usageReport?.recentActivity || []).map((row, idx) => (
              <div key={`${row.eventTime}-${idx}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-black text-slate-800">{row.eventName}</p>
                    <p className="text-xs text-slate-500">{row.email || row.userId || 'Unknown user'}</p>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{formatDate(row.eventTime)}</span>
                </div>
              </div>
            ))}
            {!(usageReport?.recentActivity || []).length && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm font-semibold text-slate-500">
                No events yet.
              </div>
            )}
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
};

export default AdminUsageModule;
