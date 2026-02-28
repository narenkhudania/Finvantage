import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, LifeBuoy, RefreshCw, Send, ShieldCheck } from 'lucide-react';
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
    <div className="space-y-8 animate-in fade-in duration-500 pb-24">
      <div className="surface-dark p-10 md:p-14 rounded-[3rem] text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-600/10 blur-[120px] rounded-full translate-x-1/4 -translate-y-1/4" />
        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-teal-500/10 text-teal-300 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-teal-500/20">
            <LifeBuoy size={14} /> Complaint Desk
          </div>
          <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">Raise & Track Complaints</h2>
          <p className="text-slate-300 text-sm md:text-base font-medium max-w-3xl">
            Register service complaints and track ticket status in real time. The same ticket is visible to customer support operations in admin.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-4">
          <div>
            <h3 className="text-xl font-black text-slate-900">Complaint Registration Form</h3>
            <p className="text-sm text-slate-500 mt-1">Please add clear details so support can resolve faster.</p>
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
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-teal-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Complaint Details</label>
              <textarea
                rows={5}
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Describe what happened, where it happened, and expected result."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-teal-400"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Priority</label>
                <select
                  value={form.priority}
                  onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value as 'low' | 'medium' | 'high' | 'urgent' }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-teal-400"
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
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-teal-400"
                />
              </div>
            </div>

            <button
              onClick={handleSubmitComplaint}
              disabled={submitting}
              className="w-full rounded-2xl bg-teal-600 px-4 py-3 text-sm font-black uppercase tracking-widest text-white hover:bg-teal-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {submitting ? 'Submitting...' : 'Register Complaint'}
              <Send size={14} />
            </button>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-4 h-fit">
          <h3 className="text-xl font-black text-slate-900">Support Assurance</h3>
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm font-black text-slate-900">Tracking Transparency</p>
              <p className="text-xs text-slate-600 mt-1">Every complaint gets a ticket number and status timeline.</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm font-black text-slate-900">Integrated Ops Queue</p>
              <p className="text-xs text-slate-600 mt-1">Tickets appear directly in admin CRM complaint tracker for action.</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm font-black text-slate-900">Data Security</p>
              <p className="text-xs text-slate-600 mt-1 inline-flex items-center gap-1.5">
                <ShieldCheck size={12} className="text-emerald-600" /> Complaint details are linked only to your signed-in account.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="text-xl font-black text-slate-900">My Complaint Tickets</h3>
            <p className="text-sm text-slate-500 mt-1">Track current status and latest updates.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | CustomerComplaintTicket['status'])}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-600"
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
              className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-teal-700 inline-flex items-center gap-1.5"
            >
              <RefreshCw size={12} />
              Refresh
            </button>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['Ticket', 'Subject', 'Priority', 'Status', 'Created', 'Updated', 'Resolution'].map((header) => (
                  <th key={header} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm font-semibold text-slate-500">
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
                    <td className="px-3 py-3 text-xs text-slate-500">{new Date(ticket.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{new Date(ticket.updatedAt).toLocaleString()}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{ticket.resolutionNote || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm font-semibold text-slate-500">
                    No complaint tickets found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SupportCenter;
