import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, LifeBuoy, RefreshCw, Send, ShieldCheck, Ticket } from 'lucide-react';
import type { CustomerComplaintTicket, FinanceState } from '../types';
import { listMyComplaintTickets, registerComplaintTicket } from '../services/supportService';

interface SupportCenterProps {
  state: FinanceState;
  updateState: (data: Partial<FinanceState>) => void;
}

const statusClass = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized === 'resolved' || normalized === 'closed') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (normalized === 'in_progress' || normalized === 'waiting_user') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-rose-200 bg-rose-50 text-rose-700';
};

const priorityClass = (priority: string) => {
  const normalized = priority.toLowerCase();
  if (normalized === 'urgent' || normalized === 'high') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (normalized === 'medium') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
};

const slaClass = (slaStatus?: string | null) => {
  const normalized = String(slaStatus || 'on_track').toLowerCase();
  if (normalized === 'breached') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (normalized === 'due_soon') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (normalized === 'met') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
};

const dueLabel = (resolutionDueAt?: string | null) => {
  if (!resolutionDueAt) return 'Not assigned';
  const dueMs = new Date(resolutionDueAt).getTime();
  if (!Number.isFinite(dueMs)) return 'Not assigned';
  const deltaHours = Math.round((dueMs - Date.now()) / (60 * 60 * 1000));
  if (deltaHours < 0) return `Overdue by ${Math.abs(deltaHours)}h`;
  if (deltaHours === 0) return 'Due within 1h';
  return `Due in ${deltaHours}h`;
};

const SupportCenter: React.FC<SupportCenterProps> = ({ state, updateState }) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | CustomerComplaintTicket['status']>('all');
  const [tickets, setTickets] = useState<CustomerComplaintTicket[]>([]);
  const [form, setForm] = useState({
    subject: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    tags: '',
  });

  const loadTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listMyComplaintTickets(120);
      setTickets(rows);
    } catch (err) {
      setError((err as Error).message || 'Could not load complaint tickets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTickets();
  }, []);

  const filteredTickets = useMemo(() => {
    if (statusFilter === 'all') return tickets;
    return tickets.filter((ticket) => ticket.status === statusFilter);
  }, [tickets, statusFilter]);

  const supportMetrics = useMemo(() => {
    const open = tickets.filter((ticket) => ticket.status === 'open').length;
    const inProgress = tickets.filter((ticket) => ticket.status === 'in_progress' || ticket.status === 'waiting_user').length;
    const resolved = tickets.filter((ticket) => ticket.status === 'resolved' || ticket.status === 'closed').length;
    const breached = tickets.filter((ticket) => String(ticket.slaStatus || '').toLowerCase() === 'breached').length;
    return { open, inProgress, resolved, breached, total: tickets.length };
  }, [tickets]);

  const handleSubmitComplaint = async () => {
    if (!form.subject.trim()) {
      setError('Please enter complaint subject.');
      return;
    }
    if (!form.description.trim()) {
      setError('Please describe your complaint.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const ticketNumber = await registerComplaintTicket({
        subject: form.subject,
        description: form.description,
        priority: form.priority,
        tags: form.tags.split(',').map((item) => item.trim()).filter(Boolean),
      });

      const existing = state.notifications || [];
      updateState({
        notifications: [
          {
            id: `complaint-${ticketNumber}-${Date.now()}`,
            title: 'Complaint Registered',
            message: `Ticket #${ticketNumber} is created. We will update status in this tracker.`,
            type: 'success',
            timestamp: new Date().toISOString(),
            read: false,
          },
          ...existing,
        ].slice(0, 80),
      });

      setSuccess(`Complaint registered successfully. Ticket #${ticketNumber}`);
      setForm({ subject: '', description: '', priority: 'medium', tags: '' });
      await loadTickets();
    } catch (err) {
      setError((err as Error).message || 'Could not register complaint ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-24">
      <section className="relative overflow-hidden rounded-[2rem] border border-teal-100 bg-gradient-to-br from-teal-50 via-white to-cyan-50 p-5 sm:p-6 md:p-8">
        <div className="pointer-events-none absolute -top-16 -right-12 h-44 w-44 rounded-full bg-teal-100/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-12 h-40 w-40 rounded-full bg-cyan-100/60 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-teal-700">
            <LifeBuoy size={12} /> Complaint Desk
          </div>
          <h2 className="mt-3 text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-slate-900">Raise and Track Complaints</h2>
          <p className="mt-2 max-w-3xl text-sm md:text-base font-semibold text-slate-600">
            Register issues, monitor SLA status, and track resolution updates from one place. Every ticket is synced with internal support operations.
          </p>

          <div className="mt-5 grid grid-cols-2 lg:grid-cols-5 gap-2">
            <div className="rounded-xl border border-white/80 bg-white/85 px-3 py-2.5">
              <p className="text-[11px] font-semibold text-slate-500">Total Tickets</p>
              <p className="mt-0.5 text-lg font-black text-slate-900">{supportMetrics.total}</p>
            </div>
            <div className="rounded-xl border border-white/80 bg-white/85 px-3 py-2.5">
              <p className="text-[11px] font-semibold text-slate-500">Open</p>
              <p className="mt-0.5 text-lg font-black text-rose-700">{supportMetrics.open}</p>
            </div>
            <div className="rounded-xl border border-white/80 bg-white/85 px-3 py-2.5">
              <p className="text-[11px] font-semibold text-slate-500">In Progress</p>
              <p className="mt-0.5 text-lg font-black text-amber-700">{supportMetrics.inProgress}</p>
            </div>
            <div className="rounded-xl border border-white/80 bg-white/85 px-3 py-2.5">
              <p className="text-[11px] font-semibold text-slate-500">Resolved</p>
              <p className="mt-0.5 text-lg font-black text-emerald-700">{supportMetrics.resolved}</p>
            </div>
            <div className="rounded-xl border border-white/80 bg-white/85 px-3 py-2.5">
              <p className="text-[11px] font-semibold text-slate-500">SLA Breach</p>
              <p className="mt-0.5 text-lg font-black text-rose-700">{supportMetrics.breached}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
        <section className="rounded-[1.75rem] md:rounded-[2rem] border border-slate-200 bg-white p-5 sm:p-6 md:p-7 shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-teal-100 bg-teal-50 text-teal-600">
              <Ticket size={16} />
            </span>
            <div>
              <h3 className="text-xl font-black tracking-tight text-slate-900">Complaint Registration</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">Share clear context for faster triage and resolution.</p>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              {success}
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Subject</label>
              <input
                value={form.subject}
                onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
                placeholder="Example: Incorrect goal projection after editing expenses"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-teal-300 focus:bg-white focus:ring-2 focus:ring-teal-100"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Complaint Details</label>
              <textarea
                rows={5}
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Describe what happened, where it happened, and expected result."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-teal-300 focus:bg-white focus:ring-2 focus:ring-teal-100"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Priority</label>
                <select
                  value={form.priority}
                  onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value as 'low' | 'medium' | 'high' | 'urgent' }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-teal-300 focus:bg-white focus:ring-2 focus:ring-teal-100"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tags (Optional)</label>
                <input
                  value={form.tags}
                  onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
                  placeholder="billing, projection, app"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-teal-300 focus:bg-white focus:ring-2 focus:ring-teal-100"
                />
              </div>
            </div>

            <button
              onClick={handleSubmitComplaint}
              disabled={submitting}
              className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-black uppercase tracking-widest text-white hover:bg-teal-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {submitting ? 'Submitting...' : 'Register Complaint'}
              <Send size={14} />
            </button>
          </div>
        </section>

        <aside className="rounded-[1.75rem] md:rounded-[2rem] border border-slate-200 bg-white p-5 sm:p-6 md:p-7 shadow-sm space-y-4 h-fit">
          <h3 className="text-xl font-black tracking-tight text-slate-900">Support Assurance</h3>
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-black text-slate-900">Tracking Transparency</p>
              <p className="mt-1 text-xs font-semibold text-slate-600">Every complaint receives a ticket number with status updates and timestamps.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-black text-slate-900">Integrated Operations Queue</p>
              <p className="mt-1 text-xs font-semibold text-slate-600">Tickets are synced to internal CRM support queues for faster triage.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-black text-slate-900">SLA Monitoring</p>
              <p className="mt-1 text-xs font-semibold text-slate-600">Resolution timelines are tracked with due-soon and breach indicators.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-black text-slate-900">Data Security</p>
              <p className="mt-1 text-xs font-semibold text-slate-600 inline-flex items-center gap-1.5">
                <ShieldCheck size={12} className="text-emerald-600" /> Complaint details are linked only to your signed-in account.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-teal-100 bg-teal-50 p-3">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-teal-700">
              <Clock3 size={12} /> Operations Window
            </p>
            <p className="mt-1 text-sm font-black text-slate-900">Mon-Sat, 09:00-19:00 IST</p>
            <p className="mt-1 text-xs font-semibold text-slate-600">Urgent items are prioritized in the same business window.</p>
          </div>
        </aside>
      </div>

      <section className="bg-white p-5 sm:p-6 md:p-7 rounded-[1.75rem] md:rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="text-xl font-black tracking-tight text-slate-900">My Complaint Tickets</h3>
            <p className="text-sm font-semibold text-slate-500 mt-1">Track live status, escalation level, and SLA movement.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | CustomerComplaintTicket['status'])}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-600 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="waiting_user">Waiting User</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <button
              onClick={() => void loadTickets()}
              className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-teal-700 inline-flex items-center gap-1.5 hover:bg-teal-100"
            >
              <RefreshCw size={12} />
              Refresh
            </button>
          </div>
        </div>

        <div className="space-y-3 lg:hidden">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-500">
              Loading complaint tickets...
            </div>
          ) : filteredTickets.length ? (
            filteredTickets.map((ticket) => (
              <div key={ticket.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 truncate">#{ticket.ticketNumber}</p>
                    <p className="text-sm font-semibold text-slate-700 mt-0.5">{ticket.subject}</p>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{ticket.description || '-'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${priorityClass(ticket.priority)}`}>
                    {ticket.priority}
                  </span>
                  <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${statusClass(ticket.status)}`}>
                    {ticket.status.replace('_', ' ')}
                  </span>
                  <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${slaClass(ticket.slaStatus)}`}>
                    {(ticket.slaStatus || 'on_track').replace('_', ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <p className="font-semibold text-slate-600">Resolution due: <span className="text-slate-500 font-medium">{dueLabel(ticket.resolutionDueAt)}</span></p>
                  <p className="font-semibold text-slate-600">Escalation: <span className="text-slate-500 font-medium">{ticket.escalated ? `Level ${ticket.escalationLevel || 1}` : 'No'}</span></p>
                  <p className="font-semibold text-slate-600">Created: <span className="text-slate-500 font-medium">{new Date(ticket.createdAt).toLocaleString()}</span></p>
                  <p className="font-semibold text-slate-600">Updated: <span className="text-slate-500 font-medium">{new Date(ticket.updatedAt).toLocaleString()}</span></p>
                </div>

                {ticket.resolutionNote && (
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Resolution note</p>
                    <p className="text-xs text-slate-600 mt-1">{ticket.resolutionNote}</p>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-500">
              No complaint tickets found.
            </div>
          )}
        </div>

        <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[1080px] w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['Ticket', 'Subject', 'Priority', 'Status', 'SLA', 'Resolution Due', 'Escalation', 'Created', 'Updated', 'Resolution'].map((header) => (
                  <th key={header} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-sm font-semibold text-slate-500">
                    Loading complaint tickets...
                  </td>
                </tr>
              ) : filteredTickets.length ? (
                filteredTickets.map((ticket) => (
                  <tr key={ticket.id} className="border-t border-slate-100">
                    <td className="px-3 py-3">
                      <p className="text-sm font-black text-slate-900">#{ticket.ticketNumber}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-sm font-semibold text-slate-700">{ticket.subject}</p>
                      <p className="text-xs text-slate-500 line-clamp-2">{ticket.description || '-'}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${priorityClass(ticket.priority)}`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${statusClass(ticket.status)}`}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${slaClass(ticket.slaStatus)}`}>
                        {(ticket.slaStatus || 'on_track').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs font-semibold text-slate-600">
                      {dueLabel(ticket.resolutionDueAt)}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {ticket.escalated ? `Level ${ticket.escalationLevel || 1}` : 'No'}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">{new Date(ticket.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{new Date(ticket.updatedAt).toLocaleString()}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{ticket.resolutionNote || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-sm font-semibold text-slate-500">
                    No complaint tickets found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default SupportCenter;
