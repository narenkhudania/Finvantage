import React from 'react';
import type { AdminFraudFlag } from '../../../services/admin/types';
import { AppButton, SectionHeader, SurfaceCard } from '../../common/ui';

interface AdminFraudModuleProps {
  fraudQueue: AdminFraudFlag[];
  renderPill: (value: string) => React.ReactNode;
  formatCurrency: (value: number) => string;
  onResolve: (flag: AdminFraudFlag) => void;
}

const AdminFraudModule: React.FC<AdminFraudModuleProps> = ({
  fraudQueue,
  renderPill,
  formatCurrency,
  onResolve,
}) => {
  return (
    <SurfaceCard variant="elevated" padding="none" className="p-5">
      <SectionHeader
        title="Fraud Monitoring Queue"
        action={<span className="text-xs font-black uppercase tracking-wider text-slate-500">{fraudQueue.length} flags</span>}
      />

      <div className="mt-4 admin-table-wrap">
        <table className="admin-table">
          <thead className="bg-slate-50">
            <tr>
              {['Severity', 'Customer', 'Rule', 'Amount', 'Status', 'Actions'].map((header) => (
                <th key={header} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fraudQueue.map((flag) => (
              <tr key={flag.id} className="border-t border-slate-100">
                <td className="px-3 py-3">{renderPill(flag.severity)}</td>
                <td className="px-3 py-3">
                  <p className="font-black text-slate-800">{flag.email || flag.user_id}</p>
                  <p className="text-xs text-slate-500">{flag.user_id}</p>
                </td>
                <td className="px-3 py-3 text-xs font-semibold text-slate-700">{flag.rule_key}</td>
                <td className="px-3 py-3 text-xs font-semibold text-slate-700">
                  {flag.amount ? formatCurrency(flag.amount) : '-'}
                </td>
                <td className="px-3 py-3">{renderPill(flag.status)}</td>
                <td className="px-3 py-3">
                  <AppButton tone="primary" size="sm" className="!px-2.5 !py-1.5" onClick={() => onResolve(flag)}>
                    Resolve
                  </AppButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SurfaceCard>
  );
};

export default AdminFraudModule;
