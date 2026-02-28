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
}

const AdminPaymentsModule: React.FC<AdminPaymentsModuleProps> = ({
  payments,
  subscriptions,
  renderPill,
  formatCurrency,
  formatNumber,
  formatDate,
}) => {
  const failedPayments = payments.filter((payment) => ['failed', 'declined'].includes(payment.status.toLowerCase()));

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
          <div className="max-h-[420px] mt-4 space-y-2 overflow-auto pr-1">
            {subscriptions.map((subscription) => (
              <div key={subscription.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-slate-800">{subscription.plan_code}</p>
                  {renderPill(subscription.status)}
                </div>
                <p className="mt-1 text-xs text-slate-500">{subscription.user_id}</p>
                <p className="mt-2 text-xs font-semibold text-slate-600">
                  {formatCurrency(subscription.amount)} {subscription.currency} / {subscription.billing_cycle}
                </p>
              </div>
            ))}
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
};

export default AdminPaymentsModule;
