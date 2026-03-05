import React from 'react';
import { Search } from 'lucide-react';
import type { AdminAuditLog } from '../../../services/admin/types';
import { AppButton, SurfaceCard } from '../../common/ui';

interface AdminAuditModuleProps {
  auditActionFilter: string;
  setAuditActionFilter: (value: string) => void;
  auditLogs: AdminAuditLog[];
  loadAudit: () => void;
  renderPill: (value: string) => React.ReactNode;
  formatDate: (value?: string | null) => string;
}

const AdminAuditModule: React.FC<AdminAuditModuleProps> = ({
  auditActionFilter,
  setAuditActionFilter,
  auditLogs,
  loadAudit,
  renderPill,
  formatDate,
}) => {
  return (
    <div className="space-y-5">
      <SurfaceCard variant="elevated" padding="none" className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 sm:max-w-md">
          <Search size={16} className="text-slate-400" />
          <input
            className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none"
            placeholder="Filter by action"
            value={auditActionFilter}
            onChange={(event) => setAuditActionFilter(event.target.value)}
          />
        </div>
        <AppButton tone="primary" size="md" onClick={loadAudit}>
          Apply Filter
        </AppButton>
      </SurfaceCard>

      <SurfaceCard variant="elevated" padding="none" className="overflow-hidden">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead className="bg-slate-50">
              <tr>
                {['Timestamp', 'Action', 'Entity', 'Entity Id', 'Admin User', 'Reason'].map((header) => (
                  <th key={header} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id} className="border-t border-slate-100">
                  <td className="px-3 py-3 text-xs text-slate-500">{formatDate(log.createdAt)}</td>
                  <td className="px-3 py-3">{renderPill(log.action)}</td>
                  <td className="px-3 py-3 text-xs font-semibold text-slate-600">{log.entityType}</td>
                  <td className="px-3 py-3 text-xs text-slate-500">{log.entityId || '-'}</td>
                  <td className="px-3 py-3 text-xs text-slate-500">{log.adminUserId}</td>
                  <td className="px-3 py-3 text-xs text-slate-500">{log.reason || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceCard>
    </div>
  );
};

export default AdminAuditModule;
