import React from 'react';
import type { AdminPayment, AdminSubscription } from '../../../services/admin/types';
import { SectionHeader, SurfaceCard } from '../../common/ui';

interface AdminPaymentsModuleProps {
  payments: AdminPayment[];
  subscriptions: AdminSubscription[];
  renderPill: (value: string) => React.ReactNode;
  formatCurrency: (value: number) => string;
  formatNumber: (value: number) => string;
  formatDate: (value?: string | null) => string;
  busy?: boolean;
  onAdminSubscriptionAction?: (
    action: 'cancel_at_period_end' | 'resume_auto_renew',
    subscription: AdminSubscription
  ) => Promise<void>;
}

const AdminPaymentsModule: React.FC<AdminPaymentsModuleProps> = ({
  payments,
  subscriptions,
  renderPill,
  formatCurrency,
  formatNumber,
  formatDate,
  busy = false,
  onAdminSubscriptionAction,
}) => {
  const [search, setSearch] = React.useState('');
  const failedPayments = payments.filter((payment) => ['failed', 'declined'].includes(payment.status.toLowerCase()));
  const filteredSubscriptions = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return subscriptions;
    return subscriptions.filter((subscription) => (
      subscription.user_id.toLowerCase().includes(q)
      || subscription.plan_code.toLowerCase().includes(q)
      || String(subscription.provider_subscription_id || '').toLowerCase().includes(q)
      || String(subscription.provider_customer_id || '').toLowerCase().includes(q)
      || subscription.status.toLowerCase().includes(q)
    ));
  }, [search, subscriptions]);

  return (
    <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[1fr_1fr]">
      <SurfaceCard variant="elevated" padding="none" className="p-5">
        <SectionHeader
          title="Payments Ledger"
          action={<span className="text-xs font-black uppercase tracking-wider text-slate-500">{payments.length} records</span>}
        />
        <div className="max-h-[560px] space-y-2 overflow-auto pr-1 mt-4">
          {payments.map((payment) => (
            <div key={payment.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-800">{formatCurrency(payment.amount)} {payment.currency}</p>
                  <p className="mt-1 text-xs text-slate-500">User: {payment.user_id}</p>
                </div>
                {renderPill(payment.status)}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Provider: {payment.provider} • Attempted: {formatDate(payment.attempted_at)}
              </p>
              {payment.failure_reason && <p className="mt-2 text-xs font-semibold text-rose-600">Failure: {payment.failure_reason}</p>}
            </div>
          ))}
        </div>
      </SurfaceCard>

      <div className="space-y-5">
        <SurfaceCard variant="elevated" padding="none" className="p-5">
          <SectionHeader title="Payments Risk Snapshot" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Failures</p>
              <p className="mt-2 text-xl font-black text-rose-600">{formatNumber(failedPayments.length)}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Subscriptions</p>
              <p className="mt-2 text-xl font-black text-slate-900">{formatNumber(subscriptions.length)}</p>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard variant="elevated" padding="none" className="p-5">
          <SectionHeader title="Subscription Monitoring" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by user ID, plan, provider IDs, status"
            className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          />
          <div className="max-h-[420px] mt-4 space-y-2 overflow-auto pr-1">
            {filteredSubscriptions.map((subscription) => (
              <div key={subscription.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-slate-800">{subscription.plan_code}</p>
                  {renderPill(subscription.status)}
                </div>
                <p className="mt-1 text-xs text-slate-500">{subscription.user_id}</p>
                <p className="mt-2 text-xs font-semibold text-slate-600">
                  {formatCurrency(subscription.amount)} {subscription.currency} / {subscription.billing_cycle}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-slate-600">
                  Provider: {subscription.provider || 'internal'}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-slate-500 break-all">
                  Sub ID: {subscription.provider_subscription_id || '—'}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-slate-500 break-all">
                  Cust ID: {subscription.provider_customer_id || '—'}
                </p>
                {onAdminSubscriptionAction && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() => void onAdminSubscriptionAction('cancel_at_period_end', subscription)}
                      disabled={busy || subscription.cancel_at_period_end}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-amber-700 disabled:opacity-50"
                    >
                      Cancel at End
                    </button>
                    <button
                      onClick={() => void onAdminSubscriptionAction('resume_auto_renew', subscription)}
                      disabled={busy || !subscription.cancel_at_period_end}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-700 disabled:opacity-50"
                    >
                      Resume
                    </button>
                  </div>
                )}
              </div>
            ))}
            {!filteredSubscriptions.length && (
              <p className="text-xs font-semibold text-slate-500">No subscriptions match the current search.</p>
            )}
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
};

export default AdminPaymentsModule;
