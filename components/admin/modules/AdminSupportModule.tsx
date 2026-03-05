import React from 'react';
import type { SupportTicket } from '../../../services/admin/types';
import { AppButton, SurfaceCard } from '../../common/ui';

interface AdminSupportModuleProps {
  supportStatusFilter: string;
  supportTickets: SupportTicket[];
  setSupportStatusFilter: (value: string) => void;
  onRefreshSupport: () => void;
  onRunSlaSweep: () => void;
  onManualEscalate: (ticket: SupportTicket) => void;
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
  onRunSlaSweep,
  onManualEscalate,
  onMoveInProgress,
  onResolveTicket,
  renderPill,
  formatDate,
}) => {
  const openTickets = supportTickets.filter((ticket) => !['resolved', 'closed'].includes(String(ticket.status || '').toLowerCase())).length;
  const dueSoonTickets = supportTickets.filter((ticket) => ticket.slaStatus === 'due_soon' && !['resolved', 'closed'].includes(String(ticket.status || '').toLowerCase())).length;
  const breachedTickets = supportTickets.filter((ticket) => ticket.slaStatus === 'breached' && !['resolved', 'closed'].includes(String(ticket.status || '').toLowerCase())).length;
  const escalatedTickets = supportTickets.filter((ticket) => Boolean(ticket.escalated) && !['resolved', 'closed'].includes(String(ticket.status || '').toLowerCase())).length;

  const slaClass = (slaStatus?: string) => {
    if (slaStatus === 'breached') return 'border-rose-200 bg-rose-50 text-rose-700';
    if (slaStatus === 'due_soon') return 'border-amber-200 bg-amber-50 text-amber-700';
    if (slaStatus === 'met') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    return 'border-slate-200 bg-slate-50 text-slate-700';
  };

  const formatDueLabel = (dueAt?: string | null) => {
    if (!dueAt) return 'Not assigned';
    const dueMs = new Date(dueAt).getTime();
    if (!Number.isFinite(dueMs)) return 'Not assigned';
    const deltaHours = Math.round((dueMs - Date.now()) / (60 * 60 * 1000));
    if (deltaHours < 0) return `Overdue ${Math.abs(deltaHours)}h`;
    if (deltaHours === 0) return 'Due <1h';
    return `Due ${deltaHours}h`;
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <SurfaceCard variant="elevated" padding="none" className="p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Open Tickets</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{openTickets}</p>
        </SurfaceCard>
        <SurfaceCard variant="elevated" padding="none" className="p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Due Soon</p>
          <p className="mt-2 text-2xl font-black text-amber-700">{dueSoonTickets}</p>
        </SurfaceCard>
        <SurfaceCard variant="elevated" padding="none" className="p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-rose-600">Breached</p>
          <p className="mt-2 text-2xl font-black text-rose-700">{breachedTickets}</p>
        </SurfaceCard>
        <SurfaceCard variant="elevated" padding="none" className="p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Escalated</p>
          <p className="mt-2 text-2xl font-black text-indigo-700">{escalatedTickets}</p>
        </SurfaceCard>
      </div>

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
        <AppButton tone="secondary" size="md" onClick={onRunSlaSweep}>
          Run SLA Sweep
        </AppButton>
      </SurfaceCard>

      <SurfaceCard variant="elevated" padding="none" className="overflow-hidden">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead className="bg-slate-50">
              <tr>
                {['Ticket', 'Customer', 'Category', 'Priority', 'Status', 'SLA', 'Resolution Due', 'Escalation', 'Updated', 'Actions'].map((header) => (
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
                  <td className="px-3 py-3">
                    <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${slaClass(ticket.slaStatus)}`}>
                      {(ticket.slaStatus || 'on_track').replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs font-semibold text-slate-600">{formatDueLabel(ticket.resolutionDueAt)}</td>
                  <td className="px-3 py-3 text-xs text-slate-600">
                    {ticket.escalated ? `L${ticket.escalationLevel || 1}` : '-'}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500">{formatDate(ticket.updatedAt)}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1.5">
                      <AppButton tone="secondary" size="sm" className="!px-2.5 !py-1.5" onClick={() => onMoveInProgress(ticket)}>
                        In Progress
                      </AppButton>
                      <AppButton tone="secondary" size="sm" className="!px-2.5 !py-1.5" onClick={() => onManualEscalate(ticket)}>
                        Escalate
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
