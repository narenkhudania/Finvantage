import { withBillingAuth } from './_auth';
import { BILLING_POLICY, USAGE_POINT_EVENTS } from './_config';
import { getUsagePointEvents } from './_helpers';

type RequestLike = {
  method?: string;
  body?: any;
  headers?: Record<string, string | string[] | undefined>;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (payload: unknown) => void;
};

const isMissingRpcFunctionError = (error: unknown, fnName: string) => {
  const text = String((error as { message?: string })?.message || '').toLowerCase();
  const code = String((error as { code?: string })?.code || '').toLowerCase();
  const fn = String(fnName || '').toLowerCase();
  return (
    text.includes('does not exist') ||
    text.includes('could not find') ||
    text.includes('schema cache') ||
    (fn ? text.includes(fn) : false) ||
    code === 'pgrst202' ||
    code === '404'
  );
};

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const ctx = await withBillingAuth(req, res);
  if (!ctx) return;

  const eventType = String(req.body?.eventType || '').trim();
  const sourceRef = req.body?.sourceRef ? String(req.body.sourceRef) : null;
  const metadata = req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {};

  const usagePointEvents = await getUsagePointEvents(ctx.client);
  const hasKnownEvent =
    Object.prototype.hasOwnProperty.call(USAGE_POINT_EVENTS, eventType) ||
    Object.prototype.hasOwnProperty.call(usagePointEvents, eventType);
  if (!hasKnownEvent) {
    res.status(400).json({ error: 'Unsupported points event type.' });
    return;
  }
  const defaultPoints = Math.max(0, Math.trunc(Number(USAGE_POINT_EVENTS[eventType] || 0)));
  const configuredPoints = Math.max(
    0,
    Math.trunc(Number(usagePointEvents[eventType] ?? defaultPoints))
  );
  if (configuredPoints <= 0) {
    res.status(200).json({
      data: {
        awarded: 0,
        skipped: true,
        reason: 'event_disabled',
        remainingCap: BILLING_POLICY.pointsMonthlyCap,
      },
    });
    return;
  }

  const applyConfigDeltaIfNeeded = async (
    rpcAwarded: number,
    remainingCapValue: number
  ) => {
    if (rpcAwarded <= 0) {
      return { deltaAwarded: 0, remainingCap: Math.max(0, Math.trunc(Number(remainingCapValue || 0))) };
    }
    const rawDelta = configuredPoints - defaultPoints;
    if (!rawDelta) {
      return { deltaAwarded: 0, remainingCap: Math.max(0, Math.trunc(Number(remainingCapValue || 0))) };
    }

    const remainingCap = Math.max(0, Math.trunc(Number(remainingCapValue || 0)));
    const boundedDelta = rawDelta > 0 ? Math.min(rawDelta, remainingCap) : rawDelta;
    if (!boundedDelta) {
      return { deltaAwarded: 0, remainingCap };
    }

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + BILLING_POLICY.pointsExpiryMonths);
    const adjustmentSourceRef = sourceRef
      ? `${sourceRef}:rule_adjust`
      : `${eventType}:${now.toISOString().slice(0, 10)}:rule_adjust`;

    const { error: adjustError } = await ctx.client
      .from('reward_points_ledger')
      .insert({
        user_id: ctx.user.id,
        event_type: 'points_rule_adjustment',
        points: boundedDelta,
        source_ref: adjustmentSourceRef,
        metadata: {
          event_type: eventType,
          configured_points: configuredPoints,
          default_points: defaultPoints,
          source: 'billing.award_points.rule_adjust',
          metadata,
        },
        expires_at: boundedDelta > 0 ? expiresAt.toISOString() : null,
        created_at: now.toISOString(),
      });

    if (adjustError) {
      throw new Error(adjustError.message || 'Could not apply points rule adjustment.');
    }

    return {
      deltaAwarded: boundedDelta,
      remainingCap: Math.max(0, remainingCap - Math.max(0, boundedDelta)),
    };
  };

  try {
    const { data, error } = await ctx.client.rpc('billing_award_points_client_v2', {
      p_event_type: eventType,
      p_source_ref: sourceRef,
      p_metadata: metadata,
      p_monthly_cap: BILLING_POLICY.pointsMonthlyCap,
      p_points_expiry_months: BILLING_POLICY.pointsExpiryMonths,
      p_user_id: ctx.user.id,
    });

    if (error) {
      if (isMissingRpcFunctionError(error, 'billing_award_points_client_v2')) {
        const { data: fallbackData, error: fallbackError } = await ctx.client.rpc(
          'billing_award_points_client',
          {
            p_event_type: eventType,
            p_source_ref: sourceRef,
            p_metadata: metadata,
          }
        );
        if (fallbackError && !isMissingRpcFunctionError(fallbackError, 'billing_award_points_client')) {
          throw new Error(fallbackError.message || 'Could not award points.');
        }
        const payload =
          fallbackData && typeof fallbackData === 'object'
            ? (fallbackData as Record<string, unknown>)
            : {};
        const fallbackAwarded = Number(payload.awarded || 0);
        const fallbackRemainingCap = Number(payload.remainingCap || payload.remaining_cap || 0);
        const adjustedFallback = await applyConfigDeltaIfNeeded(
          fallbackAwarded,
          fallbackRemainingCap
        );
        res.status(200).json({
          data: {
            awarded: fallbackAwarded + adjustedFallback.deltaAwarded,
            skipped: Boolean(payload.skipped || !fallbackData),
            reason: typeof payload.reason === 'string'
              ? payload.reason
              : (!fallbackData ? 'rpc_unavailable' : undefined),
            remainingCap: adjustedFallback.remainingCap,
          },
        });
        return;
      }
      throw new Error(error.message || 'Could not award points.');
    }

    const payload = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    const awarded = Number(payload.awarded || 0);
    const remainingCap = Number(payload.remainingCap || payload.remaining_cap || 0);
    const adjusted = await applyConfigDeltaIfNeeded(awarded, remainingCap);
    res.status(200).json({
      data: {
        awarded: awarded + adjusted.deltaAwarded,
        skipped: Boolean(payload.skipped),
        reason: typeof payload.reason === 'string' ? payload.reason : undefined,
        remainingCap: adjusted.remainingCap,
      },
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || 'Could not award points.' });
  }
}
