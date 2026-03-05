import { createClient } from '@supabase/supabase-js';

type RequestLike = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: any;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (payload: unknown) => void;
};

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const processorSecret = process.env.BILLING_EVENT_PROCESSOR_SECRET || '';

const readHeader = (
  headers: Record<string, string | string[] | undefined> | undefined,
  key: string
) => {
  const value = headers?.[key] ?? headers?.[key.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
};

const nowIso = () => new Date().toISOString();

const renderTemplateText = (
  template: string,
  payload: Record<string, unknown>
) => {
  return String(template || '').replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => {
    const value = payload[key];
    if (value == null) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });
};

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.' });
    return;
  }

  if (!processorSecret) {
    res.status(500).json({ error: 'Missing BILLING_EVENT_PROCESSOR_SECRET.' });
    return;
  }

  const secretHeader = String(readHeader(req.headers, 'x-billing-processor-secret') || '');
  if (!secretHeader || secretHeader !== processorSecret) {
    res.status(401).json({ error: 'Unauthorized processor request.' });
    return;
  }

  const limit = Math.max(1, Math.min(200, Number(req.body?.limit || 50)));
  const client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: queued, error: queueError } = await client
      .from('billing_message_events')
      .select('id,user_id,template_key,channel,payload')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(limit);
    if (queueError) throw new Error(queueError.message || 'Could not load queued billing message events.');

    const rows = (queued || []) as Array<Record<string, any>>;
    let processed = 0;
    let failed = 0;

    for (const row of rows) {
      const eventId = String(row.id || '');
      if (!eventId) continue;
      const payload = (row.payload && typeof row.payload === 'object')
        ? (row.payload as Record<string, unknown>)
        : {};
      try {
        const { data: template } = await client
          .from('billing_message_templates')
          .select('template_key,subject_template,body_template')
          .eq('template_key', String(row.template_key || ''))
          .maybeSingle();

        if (String(row.channel || '') === 'in_app') {
          await client
            .from('notifications')
            .insert({
              user_id: String(row.user_id || ''),
              title: renderTemplateText(String(template?.subject_template || 'FinVantage Update'), payload),
              message: renderTemplateText(String(template?.body_template || 'There is an update on your billing account.'), payload),
              type: 'billing',
              read: false,
              timestamp: nowIso(),
              created_at: nowIso(),
            });
        }

        await client
          .from('billing_message_events')
          .update({
            status: 'sent',
            sent_at: nowIso(),
          })
          .eq('id', eventId);

        processed += 1;
      } catch (err) {
        failed += 1;
        await client
          .from('billing_message_events')
          .update({
            status: 'failed',
            reason: (err as Error).message || 'message_processor_failure',
          })
          .eq('id', eventId);

        await client
          .from('billing_error_events')
          .insert({
            source: 'billing.message_processor',
            severity: 'warn',
            error_message: (err as Error).message || 'Billing message processor failed.',
            metadata: {
              event_id: eventId,
              template_key: row.template_key,
              channel: row.channel,
            },
            created_at: nowIso(),
          })
          .catch(() => undefined);
      }
    }

    res.status(200).json({
      data: {
        queued: rows.length,
        processed,
        failed,
      },
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || 'Billing event processor failed.' });
  }
}

