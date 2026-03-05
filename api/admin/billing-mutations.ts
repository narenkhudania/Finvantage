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

const toIsoOrNull = (value: unknown) => {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const ctx = await requireAdmin(req, res, 'subscriptions.manage');
  if (!ctx) return;

  const action = String(req.body?.action || '').trim().toLowerCase();
  if (!action) {
    res.status(400).json({ error: 'action is required.' });
    return;
  }

  try {
    if (action === 'upsert_coupon') {
      const code = String(req.body?.code || '').trim().toUpperCase();
      if (!code) {
        res.status(400).json({ error: 'Coupon code is required.' });
        return;
      }
      const payload = {
        code,
        description: String(req.body?.description || '').trim() || null,
        discount_type: String(req.body?.discountType || 'percentage').toLowerCase() === 'flat' ? 'flat' : 'percentage',
        discount_value: Math.max(0, Number(req.body?.discountValue || 0)),
        max_discount_amount: Number(req.body?.maxDiscountAmount || 0) > 0 ? Number(req.body?.maxDiscountAmount || 0) : null,
        valid_from: toIsoOrNull(req.body?.validFrom) || new Date().toISOString(),
        valid_until: toIsoOrNull(req.body?.validUntil),
        is_active: req.body?.isActive !== false,
        stackable: req.body?.stackable !== false,
        recurring_allowed: req.body?.recurringAllowed !== false,
        applies_to_plan_codes: Array.isArray(req.body?.appliesToPlanCodes) ? req.body.appliesToPlanCodes : [],
        usage_limit_total: Number(req.body?.usageLimitTotal || 0) > 0 ? Math.trunc(Number(req.body?.usageLimitTotal || 0)) : null,
        usage_limit_per_user: Number(req.body?.usageLimitPerUser || 0) > 0 ? Math.trunc(Number(req.body?.usageLimitPerUser || 0)) : null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await ctx.client
        .from('subscription_coupons')
        .upsert(payload, { onConflict: 'code' })
        .select('*')
        .maybeSingle();
      if (error) throw new Error(error.message || 'Could not save coupon.');
      res.status(200).json({ data });
      return;
    }

    if (action === 'toggle_coupon') {
      const couponId = String(req.body?.couponId || '').trim();
      if (!couponId) {
        res.status(400).json({ error: 'couponId is required.' });
        return;
      }
      const isActive = Boolean(req.body?.isActive);
      const { data, error } = await ctx.client
        .from('subscription_coupons')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', couponId)
        .select('*')
        .maybeSingle();
      if (error) throw new Error(error.message || 'Could not update coupon status.');
      res.status(200).json({ data });
      return;
    }

    if (action === 'grant_override') {
      const userId = String(req.body?.userId || '').trim();
      const durationDays = Math.max(1, Math.min(365, Math.trunc(Number(req.body?.durationDays || 0))));
      if (!userId) {
        res.status(400).json({ error: 'userId is required.' });
        return;
      }
      const now = new Date();
      const endsAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await ctx.client
        .from('billing_admin_overrides')
        .insert({
          user_id: userId,
          starts_at: now.toISOString(),
          ends_at: endsAt,
          reason: String(req.body?.reason || '').trim() || 'Admin override',
          is_active: true,
          metadata: {
            source: 'admin.billing-mutations',
            actor: ctx.user.id,
          },
        })
        .select('*')
        .maybeSingle();
      if (error) throw new Error(error.message || 'Could not grant override.');
      res.status(200).json({ data });
      return;
    }

    if (action === 'adjust_points' || action === 'reverse_points') {
      const userId = String(req.body?.userId || '').trim();
      const points = Math.trunc(Number(req.body?.points || 0));
      if (!userId || !points) {
        res.status(400).json({ error: 'userId and non-zero points are required.' });
        return;
      }
      const expiry = new Date();
      expiry.setMonth(expiry.getMonth() + 12);
      const eventType = action === 'reverse_points'
        ? 'admin_fraud_reversal'
        : String(req.body?.eventType || 'admin_manual_adjustment');
      const { data, error } = await ctx.client
        .from('reward_points_ledger')
        .insert({
          user_id: userId,
          event_type: eventType,
          points,
          source_ref: String(req.body?.sourceRef || '').trim() || (action === 'reverse_points' ? 'fraud_reversal' : 'admin_manual'),
          metadata: {
            reason: String(req.body?.reason || '').trim() || (action === 'reverse_points' ? 'fraud reversal' : 'manual adjustment'),
            actor: ctx.user.id,
          },
          expires_at: points > 0 ? expiry.toISOString() : null,
          created_at: new Date().toISOString(),
        })
        .select('*')
        .maybeSingle();
      if (error) throw new Error(error.message || 'Could not adjust points.');
      res.status(200).json({ data });
      return;
    }

    if (action === 'freeze_points') {
      const userId = String(req.body?.userId || '').trim();
      if (!userId) {
        res.status(400).json({ error: 'userId is required.' });
        return;
      }
      const frozen = Boolean(req.body?.frozen);
      const { data, error } = await ctx.client
        .from('user_billing_profiles')
        .update({
          points_frozen: frozen,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select('*')
        .maybeSingle();
      if (error) throw new Error(error.message || 'Could not update points freeze state.');
      res.status(200).json({ data });
      return;
    }

    if (action === 'update_referral_status') {
      const referralEventId = String(req.body?.referralEventId || '').trim();
      const status = String(req.body?.status || '').trim();
      if (!referralEventId || !status) {
        res.status(400).json({ error: 'referralEventId and status are required.' });
        return;
      }
      const allowedStatuses = new Set(['rewarded', 'fraud_hold', 'reversed']);
      if (!allowedStatuses.has(status)) {
        res.status(400).json({ error: 'Unsupported referral status.' });
        return;
      }
      const metadataPatch = req.body?.metadata && typeof req.body.metadata === 'object'
        ? req.body.metadata
        : {};
      const { data: existing, error: existingError } = await ctx.client
        .from('referral_events')
        .select('metadata')
        .eq('id', referralEventId)
        .maybeSingle();
      if (existingError || !existing) throw new Error(existingError?.message || 'Referral event not found.');

      const mergedMetadata = {
        ...((existing.metadata && typeof existing.metadata === 'object') ? existing.metadata : {}),
        ...metadataPatch,
        reviewed_by_admin: true,
        reviewed_by: ctx.user.id,
        reviewed_at: new Date().toISOString(),
      };
      const { data, error } = await ctx.client
        .from('referral_events')
        .update({
          status,
          metadata: mergedMetadata,
        })
        .eq('id', referralEventId)
        .select('*')
        .maybeSingle();
      if (error) throw new Error(error.message || 'Could not update referral status.');
      res.status(200).json({ data });
      return;
    }

    if (action === 'export_points_ledger') {
      const userId = String(req.body?.userId || '').trim();
      let query = ctx.client
        .from('reward_points_ledger')
        .select('user_id,event_type,points,source_ref,expires_at,created_at,metadata')
        .order('created_at', { ascending: false })
        .limit(5000);
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query;
      if (error) throw new Error(error.message || 'Could not export points ledger.');
      res.status(200).json({ data: data || [] });
      return;
    }

    if (action === 'export_referral_events') {
      const { data, error } = await ctx.client
        .from('referral_events')
        .select('id,referrer_user_id,referred_user_id,referral_code,status,created_at,metadata')
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) throw new Error(error.message || 'Could not export referral events.');
      res.status(200).json({ data: data || [] });
      return;
    }

    res.status(400).json({ error: 'Unsupported action.' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || 'Admin billing mutation failed.' });
  }
}

