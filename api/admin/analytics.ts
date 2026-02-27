import { requireAdmin } from './_auth';

type RequestLike = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | string[] | undefined>;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (payload: unknown) => void;
};

const safeNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
};

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const ctx = await requireAdmin(req, res, 'analytics.read');
  if (!ctx) return;

  const daysRaw = Array.isArray(req.query?.days) ? req.query?.days[0] : req.query?.days;
  const days = Math.max(7, Math.min(365, safeNumber(daysRaw, 90)));

  const { data, error } = await ctx.client.rpc('admin_analytics_snapshot', {
    p_days: days,
    p_actor_user_id: ctx.user.id,
  });

  if (error) {
    res.status(500).json({ error: 'Could not load analytics snapshot.' });
    return;
  }

  await ctx.client
    .from('admin_audit_logs')
    .insert({
      admin_user_id: ctx.user.id,
      action: 'admin.analytics.read',
      entity_type: 'analytics',
      entity_id: null,
      reason: `days=${days}`,
      payload: {
        role: ctx.roleKey,
      },
      ip: null,
      user_agent: null,
    })
    .then(() => null)
    .catch(() => null);

  res.status(200).json({ data });
}
