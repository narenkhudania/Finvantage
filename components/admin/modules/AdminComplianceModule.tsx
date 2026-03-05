import React from 'react';
import type { AdminKycCase } from '../../../services/admin/types';
import { AppButton, SectionHeader, SurfaceCard } from '../../common/ui';

interface AdminComplianceModuleProps {
  kycQueue: AdminKycCase[];
  renderPill: (value: string) => React.ReactNode;
  formatDate: (value?: string | null) => string;
  onApprove: (item: AdminKycCase) => void;
  onReject: (item: AdminKycCase) => void;
}

const AdminComplianceModule: React.FC<AdminComplianceModuleProps> = ({
  kycQueue,
  renderPill,
  formatDate,
  onApprove,
  onReject,
}) => {
  return (
    <SurfaceCard variant="elevated" padding="none" className="p-5">
      <SectionHeader
        title="KYC Review Queue"
        action={<span className="text-xs font-black uppercase tracking-wider text-slate-500">{kycQueue.length} records</span>}
      />

      <div className="mt-4 admin-table-wrap">
        <table className="admin-table">
          <thead className="bg-slate-50">
            <tr>
              {['Customer', 'Status', 'Risk Score', 'Risk Band', 'Updated', 'Actions'].map((header) => (
                <th key={header} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {kycQueue.map((item) => (
              <tr key={item.user_id} className="border-t border-slate-100">
                <td className="px-3 py-3">
                  <p className="font-black text-slate-800">{item.email || item.user_id}</p>
                  <p className="text-xs text-slate-500">{item.user_id}</p>
                </td>
                <td className="px-3 py-3">{renderPill(item.status)}</td>
                <td className="px-3 py-3 text-xs font-semibold text-slate-700">{item.risk_score}</td>
                <td className="px-3 py-3 text-xs font-semibold text-slate-700">{item.risk_band || '-'}</td>
                <td className="px-3 py-3 text-xs text-slate-500">{formatDate(item.updated_at)}</td>
                <td className="px-3 py-3">
                  <div className="flex gap-1.5">
                    <AppButton tone="primary" size="sm" className="!px-2.5 !py-1.5" onClick={() => onApprove(item)}>
                      Approve
                    </AppButton>
                    <AppButton tone="danger" size="sm" className="!px-2.5 !py-1.5" onClick={() => onReject(item)}>
                      Reject
                    </AppButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SurfaceCard>
  );
};

export default AdminComplianceModule;
