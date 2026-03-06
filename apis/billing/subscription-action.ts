import { withBillingAuth } from './_auth';
import { BILLING_POLICY } from './_config';
import {
  cancelRazorpaySubscription,
  getLatestSubscription,
  nowIso,
  queueBillingMessageEvent,
  recordBillingActivity,
  resumeRazorpaySubscription,
} from './_helpers';

type RequestLike = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: any;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (payload: unknown) => void;
};

const ALLOWED_ACTIONS = new Set(['cancel_at_period_end', 'resume_auto_renew']);

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const ctx = await withBillingAuth(req, res);
  if (!ctx) return;

  const action = String(req.body?.action || '').trim();
  const requestedId = String(req.body?.subscriptionId || '').trim();
  if (!ALLOWED_ACTIONS.has(action)) {
    res.status(400).json({ error: 'Unsupported subscription action.' });
    return;
  }

  try {
    const latest = await getLatestSubscription(ctx.client, ctx.user.id);
    if (!latest) {
      res.status(404).json({ error: 'No subscription found.' });
      return;
    }

    if (requestedId && String(latest.id) !== requestedId) {
      res.status(409).json({ error: 'Subscription has changed. Refresh and retry.' });
      return;
    }

    const status = String(latest.status || '').toLowerCase();
    if (!['active', 'trialing', 'past_due'].includes(status)) {
      res.status(400).json({ error: 'Subscription is not eligible for this action.' });
      return;
    }

    const now = nowIso();
    const providerSubId = latest.provider_subscription_id ? String(latest.provider_subscription_id) : '';
    if (providerSubId && String(latest.provider || '').toLowerCase() === 'razorpay') {
      if (action === 'cancel_at_period_end') {
        await cancelRazorpaySubscription(providerSubId, true);
      } else {
        await resumeRazorpaySubscription(providerSubId);
      }
    }
    const patch = action === 'cancel_at_period_end'
      ? {
          cancel_at_period_end: true,
          auto_renew: false,
          updated_at: now,
          metadata: {
            ...(latest.metadata || {}),
            cancelled_at: now,
            cancellation_mode: 'period_end',
          },
        }
      : {
          cancel_at_period_end: false,
          auto_renew: true,
          updated_at: now,
          metadata: {
            ...(latest.metadata || {}),
            resumed_at: now,
          },
        };

    const { data: updated, error } = await ctx.client
      .from('subscriptions')
      .update(patch)
      .eq('id', latest.id)
      .eq('user_id', ctx.user.id)
      .select('*')
      .maybeSingle();

    if (error || !updated) {
      throw new Error(error?.message || 'Could not update subscription.');
    }

    await recordBillingActivity(ctx.client, ctx.user.id, 'billing.subscription_action', {
      action,
      subscription_id: String(updated.id),
      status: String(updated.status || ''),
      max_override_days: BILLING_POLICY.maxOverrideDays,
    });
    await queueBillingMessageEvent(ctx.client, {
      userId: ctx.user.id,
      templateKey: action === 'cancel_at_period_end'
        ? 'billing_subscription_cancelled_in_app'
        : 'billing_subscription_resumed_in_app',
      channel: 'in_app',
      payload: {
        subscription_id: String(updated.id),
        action,
      },
    }).catch(() => false);

    res.status(200).json({
      data: {
        subscription: {
          id: String(updated.id),
          planCode: String(updated.plan_code || ''),
          status: String(updated.status || ''),
          startAt: String(updated.start_at || ''),
          endAt: updated.end_at ? String(updated.end_at) : null,
          cancelAtPeriodEnd: Boolean(updated.cancel_at_period_end),
          autoRenew: updated.auto_renew !== false,
          updatedAt: String(updated.updated_at || now),
        },
      },
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || 'Could not process subscription action.' });
  }
}
