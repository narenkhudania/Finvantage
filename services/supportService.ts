import { supabase } from './supabase';
import type { CustomerComplaintTicket } from '../types';

type ComplaintPriority = 'low' | 'medium' | 'high' | 'urgent';

const isMissingRelationError = (error: unknown) => {
  const code = (error as { code?: string } | null)?.code;
  return code === '42P01' || code === 'PGRST205' || code === 'PGRST204';
};

const generateTicketNumber = () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CMP-${date}-${random}`;
};

const normalizePriority = (value?: string): ComplaintPriority => {
  if (value === 'low' || value === 'medium' || value === 'high' || value === 'urgent') return value;
  return 'medium';
};

const mapTicket = (row: Record<string, any>): CustomerComplaintTicket => ({
  id: String(row.id),
  ticketNumber: String(row.ticket_number || String(row.id).slice(0, 8).toUpperCase()),
  subject: String(row.subject || 'Customer Complaint'),
  description: String(row.description || ''),
  category: String(row.category || 'complaint'),
  priority: normalizePriority(String(row.priority || 'medium')),
  status: ['open', 'in_progress', 'waiting_user', 'resolved', 'closed'].includes(String(row.status))
    ? (row.status as CustomerComplaintTicket['status'])
    : 'open',
  resolutionNote: row.resolution_note ? String(row.resolution_note) : null,
  createdAt: String(row.created_at || new Date().toISOString()),
  updatedAt: String(row.updated_at || row.created_at || new Date().toISOString()),
});

const requireAuthUserId = async (): Promise<string> => {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) throw new Error('Sign in required to manage complaint tickets.');
  return data.user.id;
};

export async function listMyComplaintTickets(limit = 100): Promise<CustomerComplaintTicket[]> {
  const userId = await requireAuthUserId();
  const safeLimit = Math.max(10, Math.min(limit, 300));

  const { data, error } = await supabase
    .from('support_tickets')
    .select('id, ticket_number, subject, description, category, priority, status, resolution_note, created_at, updated_at')
    .eq('user_id', userId)
    .eq('category', 'complaint')
    .order('updated_at', { ascending: false })
    .limit(safeLimit);

  if (error) {
    if (isMissingRelationError(error)) return [];
    throw new Error(error.message || 'Unable to load complaint tickets.');
  }

  return (data || []).map((row: any) => mapTicket(row));
}

export async function registerComplaintTicket(payload: {
  subject: string;
  description: string;
  priority?: ComplaintPriority;
  tags?: string[];
}): Promise<string> {
  const userId = await requireAuthUserId();
  const nowIso = new Date().toISOString();
  const ticketNumber = generateTicketNumber();

  const { error } = await supabase.from('support_tickets').insert({
    ticket_number: ticketNumber,
    user_id: userId,
    subject: payload.subject.trim(),
    description: payload.description.trim(),
    category: 'complaint',
    priority: normalizePriority(payload.priority || 'medium'),
    status: 'open',
    tags: (payload.tags || []).map((tag) => tag.trim()).filter(Boolean),
    created_at: nowIso,
    updated_at: nowIso,
  });

  if (error) throw new Error(error.message || 'Unable to register complaint ticket.');
  return ticketNumber;
}
