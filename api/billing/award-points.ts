import { withBillingAuth } from './_auth';
import { BILLING_POLICY, USAGE_POINT_EVENTS } from './_config';

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

  const basePoints = USAGE_POINT_EVENTS[eventType];
  if (!basePoints) {
    res.status(400).json({ error: 'Unsupported points event type.' });
    return;
  }

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
        res.status(200).json({
          data: {
            awarded: Number(payload.awarded || 0),
            skipped: Boolean(payload.skipped || !fallbackData),
            reason: typeof payload.reason === 'string'
              ? payload.reason
              : (!fallbackData ? 'rpc_unavailable' : undefined),
            remainingCap: Number(payload.remainingCap || payload.remaining_cap || 0),
          },
        });
        return;
      }
      throw new Error(error.message || 'Could not award points.');
    }

    const payload = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    res.status(200).json({
      data: {
        awarded: Number(payload.awarded || 0),
        skipped: Boolean(payload.skipped),
        reason: typeof payload.reason === 'string' ? payload.reason : undefined,
        remainingCap: Number(payload.remainingCap || payload.remaining_cap || 0),
      },
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || 'Could not award points.' });
  }
}
