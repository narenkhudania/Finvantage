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

const ALLOWED_BILLING_MONTHS = new Set([1, 3, 6, 12]);

const safeNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const sanitizePlanCode = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');

const normalizeMetadata = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const ctx = await requireAdmin(req, res, 'subscriptions.manage');
  if (!ctx) return;

  const planCode = sanitizePlanCode(req.body?.plan_code);
  const displayName = String(req.body?.display_name || '').trim();
  const billingMonths = Math.round(safeNumber(req.body?.billing_months, 0));
  const amountInr = safeNumber(req.body?.amount_inr, -1);
  const sortOrder = Math.round(safeNumber(req.body?.sort_order, 0));
  const taxInclusive = Boolean(req.body?.tax_inclusive);
  const autoRenew = Boolean(req.body?.auto_renew);
  const isActive = Boolean(req.body?.is_active);
  const metadata = normalizeMetadata(req.body?.metadata);

  if (!planCode) {
    res.status(400).json({ error: 'plan_code is required.' });
    return;
  }

  if (!displayName) {
    res.status(400).json({ error: 'display_name is required.' });
    return;
  }

  if (!ALLOWED_BILLING_MONTHS.has(billingMonths)) {
    res.status(400).json({ error: 'billing_months must be one of 1, 3, 6, or 12.' });
    return;
  }

  if (amountInr < 0) {
    res.status(400).json({ error: 'amount_inr must be 0 or higher.' });
    return;
  }

  const upsertPayload = {
    plan_code: planCode,
    display_name: displayName,
    billing_months: billingMonths,
    amount_inr: amountInr,
    tax_inclusive: taxInclusive,
    auto_renew: autoRenew,
    is_active: isActive,
    sort_order: sortOrder,
    metadata,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await ctx.client
    .from('billing_plans')
    .upsert(upsertPayload, { onConflict: 'plan_code' })
    .select('*')
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message || 'Could not upsert billing plan.' });
    return;
  }

  if (ctx.workspaceId) {
    try {
      await ctx.client.rpc('workspace_admin_insert_audit_log', {
        p_workspace_id: ctx.workspaceId,
        p_action: 'admin.billing_plan.upsert',
        p_entity_type: 'billing_plan',
        p_entity_id: planCode,
        p_reason: null,
        p_payload: {
          role: ctx.roleKey,
          billing_months: billingMonths,
          amount_inr: amountInr,
          is_active: isActive,
        },
        p_ip: null,
        p_user_agent: null,
      });
    } catch {
      // best-effort audit write
    }
  } else {
    try {
      await ctx.client.from('admin_audit_logs').insert({
        admin_user_id: ctx.user.id,
        action: 'admin.billing_plan.upsert',
        entity_type: 'billing_plan',
        entity_id: planCode,
        reason: null,
        payload: {
          role: ctx.roleKey,
          billing_months: billingMonths,
          amount_inr: amountInr,
          is_active: isActive,
        },
        ip: null,
        user_agent: null,
      });
    } catch {
      // best-effort audit write
    }
  }

  res.status(200).json({ data });
}
