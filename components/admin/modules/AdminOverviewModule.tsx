import React from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART_COLORS } from '../../../lib/designTokens';
import type { AdminOverviewReport } from '../../../services/admin/types';
import SafeResponsiveContainer from '../../common/SafeResponsiveContainer';
import { SectionHeader, SurfaceCard } from '../../common/ui';

type GrowthTone = 'up' | 'down' | 'flat';

export interface AdminOverviewKpi {
  label: string;
  value: string;
  helper: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export interface GrowthTrackingCard {
  label: string;
  value: string;
  helper: string;
  tone: GrowthTone;
}

interface AdminOverviewModuleProps {
  overview: AdminOverviewReport | null;
  overviewKpis: AdminOverviewKpi[];
  growthTrackingCards: GrowthTrackingCard[];
  toneClass: (tone: GrowthTone) => string;
  formatCurrency: (value: number) => string;
  formatNumber: (value: number) => string;
  formatDate: (value?: string | null) => string;
  renderPill: (value: string) => React.ReactNode;
}

const AdminOverviewModule: React.FC<AdminOverviewModuleProps> = ({
  overview,
  overviewKpis,
  growthTrackingCards,
  toneClass,
  formatCurrency,
  formatNumber,
  formatDate,
  renderPill,
}) => {
  if (!overview) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {overviewKpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <SurfaceCard key={kpi.label} variant="elevated" padding="none" className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{kpi.label}</p>
                  <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{kpi.value}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-500">{kpi.helper}</p>
                </div>
                <div className="rounded-2xl border border-teal-100 bg-teal-50 p-2.5">
                  <Icon size={18} className="text-teal-700" />
                </div>
              </div>
            </SurfaceCard>
          );
        })}
      </div>

      <SurfaceCard variant="elevated" padding="none" className="p-5">
        <SectionHeader
          title="Essential Growth Tracking"
          action={
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Acquisition • Activation • Engagement • Monetization
            </span>
          }
        />
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {growthTrackingCards.map((metric) => (
            <div key={metric.label} className={`rounded-2xl border p-3 ${toneClass(metric.tone)}`}>
              <p className="text-[10px] font-black uppercase tracking-[0.14em]">{metric.label}</p>
              <p className="mt-2 text-xl font-black">{metric.value}</p>
              <p className="mt-1.5 text-xs font-semibold opacity-90">{metric.helper}</p>
            </div>
          ))}
          {!growthTrackingCards.length && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-500 md:col-span-2 xl:col-span-3">
              Growth signals will appear after analytics and usage data are refreshed.
            </div>
          )}
        </div>
      </SurfaceCard>

      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[1.3fr_0.9fr]">
        <SurfaceCard variant="elevated" padding="none" className="p-5">
          <SectionHeader
            title="Growth & Activity (180 days)"
            action={<span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Revenue, DAU, New Users</span>}
          />
          <div className="mt-4 h-72 w-full">
            <SafeResponsiveContainer>
              <LineChart data={overview.trends} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#0d9488" strokeWidth={2.3} dot={false} name="Revenue" />
                <Line yAxisId="right" type="monotone" dataKey="dau" stroke="#f43f5e" strokeWidth={2.3} dot={false} name="DAU" />
                <Line yAxisId="right" type="monotone" dataKey="newUsers" stroke="#6366f1" strokeWidth={2.2} dot={false} name="New Users" />
              </LineChart>
            </SafeResponsiveContainer>
          </div>
        </SurfaceCard>

        <div className="space-y-5">
          <SurfaceCard variant="elevated" padding="none" className="p-5">
            <SectionHeader title="Payments Status Mix" />
            <div className="mt-3 h-56">
              <SafeResponsiveContainer>
                <BarChart data={overview.distributions.paymentStatus} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis dataKey="key" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0d9488" radius={[6, 6, 0, 0]} />
                </BarChart>
              </SafeResponsiveContainer>
            </div>
          </SurfaceCard>

          <SurfaceCard variant="elevated" padding="none" className="p-5">
            <SectionHeader title="KYC + Fraud Distribution" />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="h-44">
                <SafeResponsiveContainer>
                  <PieChart>
                    <Pie data={overview.distributions.kycStatus} dataKey="count" nameKey="key" outerRadius={60} innerRadius={34}>
                      {overview.distributions.kycStatus.map((entry, idx) => (
                        <Cell key={`kyc-${entry.key}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </SafeResponsiveContainer>
                <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-500">KYC</p>
              </div>
              <div className="h-44">
                <SafeResponsiveContainer>
                  <PieChart>
                    <Pie data={overview.distributions.fraudSeverity} dataKey="count" nameKey="key" outerRadius={60} innerRadius={34}>
                      {overview.distributions.fraudSeverity.map((entry, idx) => (
                        <Cell key={`fraud-${entry.key}`} fill={CHART_COLORS[(idx + 3) % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </SafeResponsiveContainer>
                <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-500">Fraud</p>
              </div>
            </div>
          </SurfaceCard>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[1.35fr_0.9fr]">
        <SurfaceCard variant="elevated" padding="none" className="p-5">
          <SectionHeader
            title="Top Households by Net Worth"
            action={<span className="text-xs font-black uppercase tracking-wider text-slate-500">{overview.topCustomers.length} customers</span>}
          />
          <div className="mt-4 admin-table-wrap">
            <table className="admin-table">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Customer</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Assets</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Liabilities</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Net Worth</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Goals</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {overview.topCustomers.map((row) => (
                  <tr key={row.userId} className="border-t border-slate-100">
                    <td className="px-3 py-3">
                      <p className="text-sm font-black text-slate-800">{row.name}</p>
                      <p className="text-xs text-slate-500">{row.email}</p>
                    </td>
                    <td className="px-3 py-3 text-xs font-semibold text-slate-600">{formatCurrency(row.totalAssets)}</td>
                    <td className="px-3 py-3 text-xs font-semibold text-slate-600">{formatCurrency(row.totalLiabilities)}</td>
                    <td className="px-3 py-3 text-sm font-black text-teal-700">{formatCurrency(row.netWorth)}</td>
                    <td className="px-3 py-3 text-xs font-semibold text-slate-600">{formatNumber(row.goalCount)}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{formatDate(row.lastActivityAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceCard>

        <SurfaceCard variant="elevated" padding="none" className="p-5">
          <SectionHeader title="Operational Alerts" />
          <div className="mt-4 space-y-2.5">
            {overview.alerts.map((alert, idx) => (
              <div key={`${alert.title}-${idx}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-black text-slate-800">{alert.title}</p>
                  {renderPill(alert.severity)}
                </div>
                <p className="mt-1.5 text-xs text-slate-600">{alert.detail}</p>
                <p className="mt-2 text-xs font-black text-slate-700">{alert.metric}</p>
              </div>
            ))}

            {!overview.alerts.length && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
                No critical alerts right now.
              </div>
            )}
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
};

export default AdminOverviewModule;
