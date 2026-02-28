import React from 'react';
import type { SupportTicket } from '../../../services/admin/types';
import { AppButton, SurfaceCard } from '../../common/ui';

interface AdminSupportModuleProps {
  supportStatusFilter: string;
  supportTickets: SupportTicket[];
  setSupportStatusFilter: (value: string) => void;
  onRefreshSupport: () => void;
  onMoveInProgress: (ticket: SupportTicket) => void;
  onResolveTicket: (ticket: SupportTicket) => void;
  renderPill: (value: string) => React.ReactNode;
  formatDate: (value?: string | null) => string;
}

const AdminSupportModule: React.FC<AdminSupportModuleProps> = ({
  supportStatusFilter,
  supportTickets,
  setSupportStatusFilter,
  onRefreshSupport,
  onMoveInProgress,
  onResolveTicket,
  renderPill,
  formatDate,
}) => {
  return (
    <div className="space-y-5">
      <SurfaceCard variant="elevated" padding="none" className="flex flex-wrap items-center gap-2 p-4">
        <select
          value={supportStatusFilter}
          onChange={(event) => setSupportStatusFilter(event.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-600"
        >
          <option value="all">All Tickets</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="waiting_user">Waiting User</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <AppButton tone="primary" size="md" onClick={onRefreshSupport}>
          Refresh Tickets
        </AppButton>
      </SurfaceCard>

      <SurfaceCard variant="elevated" padding="none" className="overflow-hidden">
        <div className="overflow-auto">
          <table className="min-w-[620px] xl:min-w-[900px] 2xl:min-w-[1080px] w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['Ticket', 'Customer', 'Category', 'Priority', 'Status', 'Updated', 'Actions'].map((header) => (
                  <th key={header} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {supportTickets.map((ticket) => (
                <tr key={ticket.id} className="border-t border-slate-100">
                  <td className="px-3 py-3">
                    <p className="font-black text-slate-800">#{ticket.ticketNumber}</p>
                    <p className="text-xs text-slate-500">{ticket.subject}</p>
                  </td>
                  <td className="px-3 py-3 text-xs font-semibold text-slate-600">{ticket.userId || '-'}</td>
                  <td className="px-3 py-3">{renderPill(ticket.category)}</td>
                  <td className="px-3 py-3">{renderPill(ticket.priority)}</td>
                  <td className="px-3 py-3">{renderPill(ticket.status)}</td>
                  <td className="px-3 py-3 text-xs text-slate-500">{formatDate(ticket.updatedAt)}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1.5">
                      <AppButton tone="secondary" size="sm" className="!px-2.5 !py-1.5" onClick={() => onMoveInProgress(ticket)}>
                        In Progress
                      </AppButton>
                      <AppButton tone="primary" size="sm" className="!px-2.5 !py-1.5" onClick={() => onResolveTicket(ticket)}>
                        Resolve
                      </AppButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceCard>
    </div>
  );
};

export default AdminSupportModule;
