import { withBillingAuth } from './_auth';
import { BILLING_POLICY } from './_config';
import {
  assessReferralAbuseRisk,
  ensureBillingProfile,
  getReferrerRewardCountForCurrentMonth,
  getRequestClientContext,
  nowIso,
  recordReferralIdentitySignal,
  recordBillingActivity,
} from './_helpers';

type RequestLike = {
  method?: string;
  body?: any;
  headers?: Record<string, string | string[] | undefined>;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (payload: unknown) => void;
};

const normalizeReferralCode = (value: unknown) => String(value || '').trim().toUpperCase();

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const ctx = await withBillingAuth(req, res);
  if (!ctx) return;

  const referralCode = normalizeReferralCode(req.body?.referralCode);
  if (!referralCode) {
    res.status(400).json({ error: 'Referral code is required.' });
    return;
  }

  try {
    const profile = await ensureBillingProfile(ctx.client, ctx.user.id);
    const clientContext = getRequestClientContext(req);
    const deviceFingerprint = String(req.body?.deviceFingerprint || '').trim();

    if (profile?.referred_by_code) {
      res.status(200).json({
        data: {
          applied: false,
          reason: 'already_linked',
          referredByCode: String(profile.referred_by_code),
        },
      });
      return;
    }

    const { data: referrerProfile, error: referrerError } = await ctx.client
      .from('user_billing_profiles')
      .select('user_id, referral_code')
      .eq('referral_code', referralCode)
      .maybeSingle();

    if (referrerError || !referrerProfile) {
      res.status(400).json({ error: 'Invalid referral code.' });
      return;
    }

    if (String(referrerProfile.user_id) === ctx.user.id) {
      res.status(400).json({ error: 'Self-referral is not allowed.' });
      return;
    }

    await recordReferralIdentitySignal(ctx.client, {
      userId: ctx.user.id,
      eventType: 'apply_referral',
      referralCode,
      email: ctx.user.email || null,
      ip: clientContext.ip,
      userAgent: clientContext.userAgent,
      deviceFingerprint: deviceFingerprint || null,
      metadata: { stage: 'apply_referral' },
    }).catch(() => false);

    const risk = await assessReferralAbuseRisk(ctx.client, {
      referrerUserId: String(referrerProfile.user_id),
      referredUserId: ctx.user.id,
    });

    if (risk.is_high_risk) {
      await recordBillingActivity(ctx.client, ctx.user.id, 'billing.referral_blocked_risk', {
        referral_code: referralCode,
        referrer_user_id: String(referrerProfile.user_id),
        risk,
      }).catch(() => undefined);
      res.status(400).json({
        error: 'Referral code cannot be applied automatically due to risk checks. Contact support for review.',
      });
      return;
    }

    const referralCount = await getReferrerRewardCountForCurrentMonth(
      ctx.client,
      String(referrerProfile.user_id)
    );

    if (referralCount >= BILLING_POLICY.referralMonthlyCap) {
      res.status(400).json({ error: 'Referral code has reached monthly reward capacity.' });
      return;
    }

    const { error: updateError } = await ctx.client
      .from('user_billing_profiles')
      .update({
        referred_by_code: referralCode,
        referred_by_user_id: referrerProfile.user_id,
        updated_at: nowIso(),
      })
      .eq('user_id', ctx.user.id);

    if (updateError) {
      throw new Error(updateError.message || 'Could not apply referral code.');
    }

    await recordBillingActivity(ctx.client, ctx.user.id, 'billing.referral_applied', {
      referral_code: referralCode,
      referrer_user_id: String(referrerProfile.user_id),
      risk,
    }).catch(() => undefined);

    res.status(200).json({
      data: {
        applied: true,
        referredByCode: referralCode,
      },
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || 'Could not apply referral code.' });
  }
}
