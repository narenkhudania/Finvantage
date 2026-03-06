import { requireAdmin } from './_auth';

type RequestLike = {
  method?: string;
  body?: any;
  headers?: Record<string, string | string[] | undefined>;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (payload: unknown) => void;
};

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const ctx = await requireAdmin(req, res, 'payments.manage');
  if (!ctx) return;

  const deadLetterId = String(req.body?.deadLetterId || '').trim();
  const webhookEventId = String(req.body?.webhookEventId || '').trim();

  if (!deadLetterId && !webhookEventId) {
    res.status(400).json({ error: 'deadLetterId or webhookEventId is required.' });
    return;
  }

  try {
    if (webhookEventId) {
      const { error } = await ctx.client.rpc('admin_replay_webhook_event', {
        p_event_id: webhookEventId,
        p_reason: 'manual_replay_from_admin_api',
      });
      if (error) throw new Error(error.message || 'Could not queue webhook replay.');
      res.status(200).json({ data: { queued: true, webhookEventId } });
      return;
    }

    const { data: deadLetter, error: deadLetterError } = await ctx.client
      .from('billing_dead_letter_events')
      .select('*')
      .eq('id', deadLetterId)
      .maybeSingle();
    if (deadLetterError || !deadLetter) {
      res.status(404).json({ error: 'Dead-letter event not found.' });
      return;
    }

    const eventId = String(deadLetter.event_id || '').trim();
    if (!eventId) {
      throw new Error('Dead-letter event has no event_id.');
    }

    const { data: webhookEvent, error: webhookLookupError } = await ctx.client
      .from('webhook_events')
      .select('id')
      .eq('provider', String(deadLetter.provider || 'razorpay'))
      .eq('event_id', eventId)
      .maybeSingle();
    if (webhookLookupError) throw new Error(webhookLookupError.message || 'Could not locate webhook event.');

    if (!webhookEvent?.id) {
      const { data: inserted, error: insertError } = await ctx.client
        .from('webhook_events')
        .insert({
          provider: String(deadLetter.provider || 'razorpay'),
          event_id: eventId,
          event_type: String(deadLetter.event_type || 'unknown'),
          status: 'replay_queued',
          replay_count: Number(deadLetter.replay_count || 0) + 1,
          received_at: new Date().toISOString(),
          payload: deadLetter.payload || {},
          last_replayed_at: new Date().toISOString(),
        })
        .select('id')
        .maybeSingle();
      if (insertError || !inserted?.id) {
        throw new Error(insertError?.message || 'Could not seed webhook replay event.');
      }
      await ctx.client
        .from('billing_dead_letter_events')
        .update({
          status: 'replayed',
          replay_count: Number(deadLetter.replay_count || 0) + 1,
          last_replayed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', deadLetterId);
      res.status(200).json({ data: { queued: true, deadLetterId, webhookEventId: inserted.id } });
      return;
    }

    const { error: replayError } = await ctx.client.rpc('admin_replay_webhook_event', {
      p_event_id: webhookEvent.id,
      p_reason: 'manual_replay_from_dead_letter',
    });
    if (replayError) throw new Error(replayError.message || 'Could not queue replay for dead-letter event.');

    await ctx.client
      .from('billing_dead_letter_events')
      .update({
        status: 'replayed',
        replay_count: Number(deadLetter.replay_count || 0) + 1,
        last_replayed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', deadLetterId);

    res.status(200).json({ data: { queued: true, deadLetterId, webhookEventId: webhookEvent.id } });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || 'Could not queue replay.' });
  }
}

