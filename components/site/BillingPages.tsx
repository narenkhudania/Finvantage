import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, CreditCard, ShieldCheck, XCircle } from 'lucide-react';
import { applySeoMeta } from '../../services/seoMeta';
import { supabase } from '../../services/supabase';
import {
  applySubscriptionAction,
  createCheckoutOrder,
  ensureRazorpayScript,
  getBillingHistory,
  getPublicBillingPlans,
  getCachedBillingPlans,
  getBillingSnapshot,
  type BillingHistoryResponse,
  verifyCheckoutPayment,
  type BillingPlan,
  type BillingSnapshot,
} from '../../services/billingService';
import { formatCurrency } from '../../lib/currency';
import {
  getBillingPlanBadge,
  getBillingPlanFeatureBullets,
  getBillingPlanPricingSnapshot,
} from '../../lib/billingPlanDisplay';
import { computeBonusDaysFromPointsRule } from '../../lib/billingRules.mjs';

const shellClass =
  'min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30 px-4 py-8 md:px-8 md:py-10';

const cardClass = 'rounded-[1.5rem] border border-slate-200 bg-white p-5 md:p-6';

const getPathMeta = (pathname: string) => {
  const root = window.location.origin;
  if (pathname === '/pricing') {
    return {
      title: 'Pricing | FinVantage',
      description: 'Choose monthly or bundled subscription plans for FinVantage.',
      canonicalUrl: `${root}/pricing`,
    };
  }
  if (pathname === '/billing/success') {
    return {
      title: 'Payment Success | FinVantage',
      description: 'Subscription payment completed successfully.',
      canonicalUrl: `${root}/billing/success`,
    };
  }
  if (pathname === '/billing/failed') {
    return {
      title: 'Payment Failed | FinVantage',
      description: 'Subscription payment failed. Retry from Billing Management.',
      canonicalUrl: `${root}/billing/failed`,
    };
  }
  if (pathname === '/billing/cancelled') {
    return {
      title: 'Payment Cancelled | FinVantage',
      description: 'Checkout cancelled. Resume anytime from Billing Management.',
      canonicalUrl: `${root}/billing/cancelled`,
    };
  }
  return {
    title: 'Billing Management | FinVantage',
    description: 'Manage subscriptions, coupons, and points for FinVantage.',
    canonicalUrl: `${root}/billing/manage`,
  };
};

const labelClass = 'text-[11px] font-semibold tracking-wide text-slate-500';

export const BillingManagePage: React.FC<{ mode?: 'manage' | 'pricing' }> = ({ mode = 'manage' }) => {
  const [snapshot, setSnapshot] = useState<BillingSnapshot | null>(null);
  const [publicPlans, setPublicPlans] = useState<BillingPlan[]>(() => getCachedBillingPlans()?.plans || []);
  const [plansLoadedFromServer, setPlansLoadedFromServer] = useState<boolean>(() => {
    const cached = getCachedBillingPlans();
    return Boolean(cached?.plans?.length);
  });
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectedPlanCode, setSelectedPlanCode] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [showPromoCodeInput, setShowPromoCodeInput] = useState(false);
  const [usePointsForExtension, setUsePointsForExtension] = useState(false);
  const [history, setHistory] = useState<BillingHistoryResponse | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [showSkipCta, setShowSkipCta] = useState(false);
  const [skipHref, setSkipHref] = useState('/');
  const availablePlans = useMemo(() => {
    if (plansLoadedFromServer && publicPlans.length > 0) return publicPlans;
    if (Array.isArray(snapshot?.plans) && snapshot.plans.length > 0) return snapshot.plans;
    if (publicPlans.length > 0) return publicPlans;
    return [];
  }, [plansLoadedFromServer, publicPlans, snapshot?.plans]);
  const monthlyPlanAmount = useMemo(() => {
    const monthly = availablePlans.find((plan) => Number(plan.billingMonths || 0) === 1);
    return Number(monthly?.amountInr || 0);
  }, [availablePlans]);

  const sortedPlans = useMemo(
    () => [...availablePlans].sort((a, b) => Number(a.billingMonths || 1) - Number(b.billingMonths || 1)),
    [availablePlans],
  );

  const normalizeUiError = useCallback((input: unknown) => {
    const message = String((input as Error)?.message || input || 'Something went wrong.');
    if (message.toLowerCase().includes("reading 'country'")) {
      return 'Country is missing in profile. Update country in Settings and retry checkout.';
    }
    if (/billing api endpoint is unavailable/i.test(message)) {
      return 'Billing is temporarily unavailable. Please retry in a moment.';
    }
    if (/billing request failed \(http 5\d\d\)/i.test(message)) {
      return 'Checkout could not be completed right now. Please retry shortly.';
    }
    if (message.includes('HTTP 405')) {
      return 'This checkout action is not available right now. Please refresh and retry.';
    }
    return message;
  }, []);

  useEffect(() => {
    applySeoMeta({
      ...getPathMeta(mode === 'pricing' ? '/pricing' : '/billing/manage'),
      type: 'website',
      robots: mode === 'pricing' ? 'index,follow' : 'noindex,nofollow',
    });
  }, [mode]);

  const loadPublicPlans = useCallback(async () => {
    try {
      const payload = await getPublicBillingPlans();
      setPublicPlans(payload.plans);
      setPlansLoadedFromServer(true);
      setError((current) => {
        if (/pricing api endpoint is unavailable|pricing plans payload is invalid/i.test(String(current || '').toLowerCase())) {
          return '';
        }
        return current;
      });
    } catch (err) {
      const message = String((err as Error)?.message || '');
      const isLocalApiUnavailable = /pricing api endpoint is unavailable|pricing plans payload is invalid|http 404|http 405/i.test(message.toLowerCase());
      if (isLocalApiUnavailable) {
        const cached = getCachedBillingPlans();
        if (cached?.plans?.length) {
          setPublicPlans(cached.plans);
          setPlansLoadedFromServer(true);
        } else {
          setPlansLoadedFromServer(false);
        }
        if (mode === 'pricing') {
          setError('');
        }
        return;
      }
      if (mode === 'pricing') {
        setError((current) => current || normalizeUiError(err));
      }
    }
  }, [mode, normalizeUiError]);

  const loadBillingData = useCallback(async () => {
    const run = async (attempt: number): Promise<void> => {
      try {
        setLoading(true);
        const [snapshotResponse, historyResponse] = await Promise.all([getBillingSnapshot(), getBillingHistory()]);
        const safeSnapshot = snapshotResponse && typeof snapshotResponse === 'object'
          ? snapshotResponse
          : null;
        const safeHistory = historyResponse && typeof historyResponse === 'object'
          ? historyResponse
          : null;
        const snapshotPlans = Array.isArray((safeSnapshot as BillingSnapshot | null)?.plans)
          ? (safeSnapshot as BillingSnapshot).plans
          : [];

        setSnapshot(safeSnapshot);
        setHistory(safeHistory);
        if (snapshotPlans.length > 0) {
          setPublicPlans(snapshotPlans);
          setPlansLoadedFromServer(true);
        }
        setError('');
      } catch (err) {
        const msg = normalizeUiError(err) || 'Could not load billing data.';
        const authIssue = /sign in required|missing bearer token|invalid auth token/i.test(msg.toLowerCase());
        const apiUnavailableIssue = /api endpoint is unavailable|payload is invalid|http 404|http 405/i.test(msg.toLowerCase());
        if (authIssue && attempt < 2) {
          await supabase.auth.refreshSession().catch(() => undefined);
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, 180 * (attempt + 1));
          });
          return run(attempt + 1);
        }
        setSnapshot(null);
        setHistory(null);
        setError(mode === 'pricing' && (authIssue || apiUnavailableIssue) ? '' : msg);
      } finally {
        setLoading(false);
      }
    };
    await run(0);
  }, [mode, normalizeUiError]);

  useEffect(() => {
    let active = true;

    const bootstrapAuth = async () => {
      let session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) {
        await supabase.auth.refreshSession().catch(() => undefined);
        session = (await supabase.auth.getSession()).data.session;
      }
      if (!active) return;
      setIsSignedIn(Boolean(session));
      setAuthReady(true);
    };

    void bootstrapAuth();

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setIsSignedIn(Boolean(session));
      setAuthReady(true);
    });

    return () => {
      active = false;
      authSub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    void loadPublicPlans();
  }, [loadPublicPlans]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadPublicPlans();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [loadPublicPlans]);

  useEffect(() => {
    if (!availablePlans.length) {
      setSelectedPlanCode('');
      return;
    }
    setSelectedPlanCode((current) => {
      if (current && availablePlans.some((plan) => plan.planCode === current)) return current;
      return availablePlans[0]?.planCode || '';
    });
  }, [availablePlans]);

  useEffect(() => {
    if (!authReady) return;
    if (mode === 'pricing' && !isSignedIn) {
      setSnapshot(null);
      setHistory(null);
      setError('');
      setLoading(false);
      return;
    }
    void loadBillingData();
  }, [authReady, isSignedIn, loadBillingData, mode]);

  useEffect(() => {
    if (mode !== 'pricing') return;
    const query = new URLSearchParams(window.location.search);
    const allowSkip = ['1', 'true', 'yes'].includes((query.get('skip') || '').toLowerCase());
    setShowSkipCta(allowSkip || query.get('entry') === 'terminal');
    const nextHref = (query.get('skip_to') || '/').trim();
    setSkipHref(nextHref || '/');
  }, [mode]);

  const selectedPlan = useMemo(
    () => availablePlans.find((plan) => plan.planCode === selectedPlanCode) || availablePlans[0] || null,
    [availablePlans, selectedPlanCode]
  );

  const pointsBalance = snapshot?.points.balance || 0;
  const pointsFrozen = Boolean(snapshot?.points?.frozen);
  const maxEligiblePoints = Math.max(0, Math.floor(Number(pointsBalance) || 0));
  const pointsEligible = usePointsForExtension && !pointsFrozen
    ? maxEligiblePoints
    : 0;
  const projectedBonusDays = computeBonusDaysFromPointsRule(
    pointsEligible,
    Number(selectedPlan?.amountInr || monthlyPlanAmount || 0),
    Number(selectedPlan?.billingMonths || 1),
    Number(snapshot?.points?.pointsToInr || 1)
  );

  useEffect(() => {
    if (pointsBalance <= 0 || pointsFrozen) {
      setUsePointsForExtension(false);
    }
  }, [pointsBalance, pointsFrozen]);

  const onCheckout = async () => {
    if (!selectedPlan) {
      setError('No active plans available. Please contact support.');
      return;
    }
    if (!isSignedIn) {
      setError('Sign in to continue checkout.');
      return;
    }
    if (!authReady || loading) {
      setError('Preparing secure checkout. Please retry in a moment.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const points = Math.max(0, Math.floor(Number(pointsEligible || 0)));
      const checkout = await createCheckoutOrder({
        planCode: selectedPlan.planCode,
        couponCode: couponCode.trim() || undefined,
        pointsToRedeem: points,
      });

      if (checkout.mode === 'zero_amount') {
        await verifyCheckoutPayment({ paymentId: checkout.paymentId });
        window.location.href = '/billing/success';
        return;
      }

      const loaded = await ensureRazorpayScript();
      if (!loaded || !window.Razorpay) {
        throw new Error('Could not load Razorpay checkout. Please retry.');
      }

      const options: Record<string, any> = {
        key: checkout.keyId,
        currency: checkout.currency || 'INR',
        name: 'FinVantage',
        description: `${selectedPlan.displayName} (${selectedPlan.billingMonths} month plan)`,
        prefill: {
          email: '',
          contact: '',
        },
        notes: {
          payment_id: checkout.paymentId,
          plan_code: selectedPlan.planCode,
        },
        theme: { color: '#0f766e' },
        handler: async (response: any) => {
          try {
            await verifyCheckoutPayment({
              paymentId: checkout.paymentId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              razorpaySubscriptionId: response.razorpay_subscription_id,
            });
            window.location.href = '/billing/success';
          } catch (err) {
            setError((err as Error).message || 'Payment verification failed.');
            window.location.href = '/billing/failed';
          }
        },
        modal: {
          ondismiss: () => {
            window.location.href = '/billing/cancelled';
          },
        },
      };
      if (checkout.mode === 'razorpay_order') {
        options.amount = checkout.amountMinor;
        options.order_id = checkout.orderId;
      }
      if (checkout.mode === 'razorpay_subscription') {
        options.subscription_id = checkout.subscriptionId;
      }

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      setError(normalizeUiError(err) || 'Could not start checkout.');
    } finally {
      setBusy(false);
    }
  };

  const refreshBillingState = async () => {
    try {
      if (!isSignedIn) {
        setError('Sign in required to refresh billing data.');
        return;
      }
      await loadBillingData();
    } catch (err) {
      setError(normalizeUiError(err) || 'Could not refresh billing data.');
    }
  };

  const onSubscriptionAction = async (action: 'cancel_at_period_end' | 'resume_auto_renew') => {
    if (!snapshot?.subscription?.id) return;
    setActionBusy(true);
    setError('');
    try {
      await applySubscriptionAction(action, snapshot.subscription.id);
      await refreshBillingState();
    } catch (err) {
      setError(normalizeUiError(err) || 'Could not update subscription.');
    } finally {
      setActionBusy(false);
    }
  };

  const retryTimeline = history?.retryTimeline || snapshot?.retryTimeline || [];
  const invoices = history?.invoices || [];
  const recentPayments = history?.payments.slice(0, 8) || [];
  const activeSubscription = snapshot?.subscription || null;
  const canCancel = Boolean(
    activeSubscription?.id &&
    !activeSubscription.cancelAtPeriodEnd &&
    activeSubscription.status === 'active'
  );
  const canResume = Boolean(activeSubscription?.id && activeSubscription.cancelAtPeriodEnd);
  const referralRewardReferrer = snapshot?.referral?.referralReward?.referrer ?? 0;
  const referralRewardReferred = snapshot?.referral?.referralReward?.referred ?? 0;
  const selectedPlanPricing = useMemo(
    () =>
      selectedPlan
        ? getBillingPlanPricingSnapshot(selectedPlan, monthlyPlanAmount)
        : {
            months: 1,
            amountInr: 0,
            effectivePerMonth: 0,
            savingsVsMonthly: 0,
            discountPct: 0,
          },
    [selectedPlan, monthlyPlanAmount],
  );
  const selectedPlanAmountInr = selectedPlanPricing.amountInr;
  const selectedPlanSavings = selectedPlanPricing.savingsVsMonthly;
  const pointsToInr = Number(snapshot?.points?.pointsToInr || 1);
  const pointsAppliedValue = pointsEligible * pointsToInr;
  const pointsEarnRateOnPayment = Number(
    snapshot?.points?.earnedEvents?.find((row) => row.eventType === 'subscription_payment_success')?.pointsPerEvent || 50,
  );
  const activePlanName = useMemo(() => {
    const code = String(activeSubscription?.planCode || '').trim();
    if (!code) return 'No Active Plan';
    const matched = sortedPlans.find((plan) => plan.planCode === code);
    if (matched?.displayName) return matched.displayName;
    return code
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }, [activeSubscription?.planCode, sortedPlans]);
  const nextBillingDate = useMemo(() => {
    const raw = activeSubscription?.endAt;
    if (!raw) return null;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  }, [activeSubscription?.endAt]);
  const daysRemaining = nextBillingDate
    ? Math.max(0, Math.ceil((nextBillingDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;
  const autoRenewStateLabel = activeSubscription
    ? (activeSubscription.autoRenew && !activeSubscription.cancelAtPeriodEnd
      ? 'Enabled'
      : 'Disabled')
    : 'Not Active';
  const billingHistoryRows = useMemo(() => {
    if (invoices.length > 0) {
      return invoices.map((invoice) => ({
        id: String(invoice.invoiceNumber || invoice.paymentId || '—'),
        plan: activePlanName,
        date: String(invoice.issuedAt || new Date().toISOString()),
        amount: Number(invoice.amount || 0),
        status: String(invoice.status || 'unknown'),
      }));
    }
    return recentPayments.map((payment) => ({
      id: String(payment.providerOrderId || payment.id || '—'),
      plan: activePlanName,
      date: String(payment.attemptedAt || new Date().toISOString()),
      amount: Number(payment.amount || 0),
      status: String(payment.status || 'unknown'),
    }));
  }, [activePlanName, invoices, recentPayments]);
  const latestPayment = useMemo(() => {
    const successful = recentPayments.find((payment) =>
      ['captured', 'paid', 'succeeded', 'authorized'].includes(String(payment.status || '').toLowerCase())
    );
    return successful || recentPayments[0] || null;
  }, [recentPayments]);
  const latestPaymentMeta = useMemo(
    () => ((latestPayment?.metadata && typeof latestPayment.metadata === 'object')
      ? latestPayment.metadata
      : {}) as Record<string, unknown>,
    [latestPayment?.metadata],
  );
  const paymentMethodLabel = useMemo(() => {
    const raw = String(
      latestPaymentMeta.payment_method ||
      latestPaymentMeta.method ||
      latestPaymentMeta.instrument_type ||
      latestPaymentMeta.channel ||
      latestPayment?.provider ||
      '',
    )
      .trim()
      .toLowerCase();
    if (!raw) return 'Razorpay AutoPay';
    if (raw.includes('upi')) return 'UPI AutoPay';
    if (raw.includes('card')) return 'Card AutoPay';
    if (raw.includes('netbank')) return 'Netbanking AutoPay';
    if (raw.includes('wallet')) return 'Wallet AutoPay';
    return raw.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }, [latestPayment?.provider, latestPaymentMeta]);
  const paymentMethodDetail = useMemo(() => {
    const vpa = String(latestPaymentMeta.vpa || '').trim();
    const bank = String(latestPaymentMeta.bank || latestPaymentMeta.bank_name || '').trim();
    const network = String(latestPaymentMeta.card_network || latestPaymentMeta.network || '').trim().toUpperCase();
    const last4 = String(latestPaymentMeta.card_last4 || latestPaymentMeta.last4 || '').trim();
    if (vpa) return vpa;
    if (network && last4) return `${network} •••• ${last4}`;
    if (last4) return `•••• ${last4}`;
    if (bank) return bank;
    if (latestPayment?.providerPaymentId) return `Txn ${latestPayment.providerPaymentId}`;
    return 'Saved mandate on Razorpay';
  }, [latestPayment?.providerPaymentId, latestPaymentMeta]);
  const paymentProviderLabel = useMemo(() => {
    const raw = String(latestPayment?.provider || 'razorpay');
    return raw.toUpperCase();
  }, [latestPayment?.provider]);
  const lastPaymentLabel = useMemo(() => {
    if (!latestPayment) return 'No payment recorded yet';
    const when = latestPayment.attemptedAt ? new Date(latestPayment.attemptedAt).toLocaleDateString() : 'Unknown date';
    const status = String(latestPayment.status || 'unknown').replace(/_/g, ' ').toUpperCase();
    return `${status} • ${when}`;
  }, [latestPayment]);
  const limitedAfterDays = snapshot?.policy?.limitedAfterDays ?? 5;
  const blockedAfterDays = snapshot?.policy?.blockedAfterDays ?? 10;
  return (
    <div className={shellClass}>
      <div className="mx-auto max-w-6xl space-y-4">
        {mode === 'pricing' && showSkipCta && (
          <div className={cardClass}>
            <a href={skipHref} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-700">
              Skip for now <ArrowRight size={12} />
            </a>
          </div>
        )}

        {loading && (
          <div className={cardClass}>
            <p className="text-sm font-semibold text-slate-600">Loading billing snapshot...</p>
          </div>
        )}

        {mode === 'manage' && !loading && !snapshot && (
          <div className={cardClass}>
            <p className={labelClass}>Subscription Data</p>
            <p className="mt-2 text-lg font-black text-slate-900">Live billing data is currently unavailable</p>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              {error || 'We could not load current subscription details. Retry to fetch latest billing state.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => void refreshBillingState()}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold tracking-wide text-slate-700"
              >
                Retry
              </button>
              <a
                href="/pricing"
                className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold tracking-wide text-teal-700"
              >
                Open Pricing
              </a>
            </div>
          </div>
        )}

        {!loading && (snapshot || mode === 'pricing') && (
          <>
            {mode === 'manage' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4">
                  <div className={cardClass}>
                    <div className="flex items-center gap-3">
                      <span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-600 text-white">
                        <CreditCard size={18} />
                      </span>
                      <div>
                        <p className={labelClass}>Current Subscription</p>
                        <p className="text-lg font-black text-slate-900">{activePlanName}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className={labelClass}>Next Billing Date</p>
                        <p className="mt-1 text-base font-black text-slate-900">{nextBillingDate ? nextBillingDate.toLocaleDateString() : '—'}</p>
                        <p className="mt-1 text-[11px] font-semibold text-slate-500">{daysRemaining} days remaining</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className={labelClass}>Auto Renew</p>
                        <p className="mt-1 text-base font-black text-slate-900">{autoRenewStateLabel}</p>
                        <p className="mt-1 text-[11px] font-semibold text-slate-500">Status updates are applied immediately.</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => void onSubscriptionAction(canCancel ? 'cancel_at_period_end' : 'resume_auto_renew')}
                        disabled={actionBusy || (!canCancel && !canResume)}
                        className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold tracking-wide text-teal-700 disabled:opacity-60"
                      >
                        {canCancel ? 'Cancel at Period End' : 'Resume Auto Renew'}
                      </button>
                      <a
                        href="/pricing"
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold tracking-wide text-slate-700"
                      >
                        Change Plan
                      </a>
                    </div>
                  </div>

                  <div className={cardClass}>
                    <p className={labelClass}>Payment Method</p>
                    <div className="mt-3 space-y-2">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className={labelClass}>Current Method</p>
                        <p className="mt-1 text-base font-black text-slate-900">{paymentMethodLabel}</p>
                        <p className="mt-1 text-[11px] font-semibold text-slate-500">{paymentMethodDetail}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className={labelClass}>Last Payment</p>
                        <p className="mt-1 text-sm font-black text-slate-900">{lastPaymentLabel}</p>
                        <p className="mt-1 text-[11px] font-semibold text-slate-500">Provider: {paymentProviderLabel}</p>
                      </div>
                      <a
                        href="/support"
                        className="inline-flex w-full items-center justify-center rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold tracking-wide text-teal-700"
                      >
                        Update Payment Method
                      </a>
                    </div>
                  </div>
                </div>

                <div className={cardClass}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className={labelClass}>Billing History</p>
                      <p className="mt-1 text-sm font-semibold text-slate-600">Recent invoices and payment records.</p>
                    </div>
                  </div>
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-left">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Invoice ID</th>
                          <th className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Plan</th>
                          <th className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Date</th>
                          <th className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Amount</th>
                          <th className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billingHistoryRows.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-3 py-8 text-center text-sm font-semibold text-slate-500">
                              No billing history recorded yet.
                            </td>
                          </tr>
                        ) : (
                          billingHistoryRows.map((row) => (
                            <tr key={`history-${row.id}`} className="border-t border-slate-200">
                              <td className="px-3 py-2 text-xs font-black text-slate-900">{row.id}</td>
                              <td className="px-3 py-2 text-xs font-semibold text-slate-700">{row.plan}</td>
                              <td className="px-3 py-2 text-xs font-semibold text-slate-700">{new Date(row.date).toLocaleDateString()}</td>
                              <td className="px-3 py-2 text-xs font-semibold text-slate-700">{formatCurrency(row.amount, 'India')}</td>
                              <td className="px-3 py-2 text-xs font-black text-slate-600">
                                {String(row.status || '').replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {mode === 'pricing' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {sortedPlans.length === 0 && (
                    <div className="xl:col-span-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-semibold text-amber-800">
                      No active plans are configured in Billing Plans Management.
                    </div>
                  )}
                  {sortedPlans.map((plan) => {
                    const active = selectedPlanCode === plan.planCode;
                    const pricing = getBillingPlanPricingSnapshot(plan, monthlyPlanAmount);
                    const planMonths = pricing.months;
                    const effectivePerMonth = pricing.effectivePerMonth;
                    const savingsVsMonthly = pricing.savingsVsMonthly;
                    const badge = getBillingPlanBadge(plan, 'pricing');
                    const features = getBillingPlanFeatureBullets(planMonths);
                    return (
                      <button
                        key={plan.planCode}
                        onClick={() => setSelectedPlanCode(plan.planCode)}
                        className={`group relative rounded-2xl border p-4 text-left transition-all ${
                          active
                            ? 'border-teal-400 bg-teal-50 shadow-[0_0_0_1px_rgba(13,148,136,0.2)]'
                            : 'border-slate-200 bg-white hover:border-teal-200'
                        }`}
                      >
                        {active && (
                          <span className="absolute -top-3 right-4 rounded-full bg-teal-600 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">
                            Selected
                          </span>
                        )}
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                          active ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {badge}
                        </span>
                        <p className="mt-3 text-2xl leading-none font-black text-slate-950">{formatCurrency(Number(plan.amountInr || 0), 'India')}</p>
                        <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                          {planMonths} Month{planMonths > 1 ? 's' : ''} Access
                        </p>
                        <p className="mt-3 text-sm font-black text-slate-900">{plan.displayName}</p>
                        <p className="mt-1 text-[11px] font-semibold text-slate-600">
                          Effective monthly: {formatCurrency(effectivePerMonth, 'India')}
                        </p>
                        <p className={`mt-1 text-[11px] font-black ${savingsVsMonthly > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                          {savingsVsMonthly > 0 ? `Save ${formatCurrency(savingsVsMonthly, 'India')}` : 'No bundle discount'}
                        </p>
                        <ul className="mt-4 space-y-1.5">
                          {features.map((feature) => (
                            <li key={`${plan.planCode}-${feature}`} className="flex items-start gap-2 text-[11px] font-semibold text-slate-700">
                              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                        <span
                          className={`mt-5 inline-flex w-full items-center justify-center rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] ${
                            active
                              ? 'bg-teal-600 text-white'
                              : 'border border-slate-200 bg-slate-50 text-slate-600 group-hover:border-teal-200 group-hover:text-teal-700'
                          }`}
                        >
                          {active ? 'Selected' : 'Select Plan'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-8 grid grid-cols-1 xl:grid-cols-[1.45fr_0.85fr] gap-4">
                  <div className="space-y-4">
                    <div className={cardClass}>
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-4">
                          <span className="grid h-12 w-12 place-items-center rounded-xl bg-teal-50 text-teal-600">
                            <CheckCircle2 size={22} />
                          </span>
                          <div>
                            <p className="text-xl font-black text-slate-900">Reward Points</p>
                            <p className="text-sm font-semibold text-slate-600">
                              You have <span className="font-black text-teal-700">{pointsBalance} points</span> available for extension.
                            </p>
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <p className={labelClass}>Redemption Value</p>
                          <p className="mt-1 text-lg font-black text-slate-900">
                            {formatCurrency(pointsAppliedValue, 'India')}
                          </p>
                          <p className="text-[10px] font-semibold text-slate-500">Extension equivalent</p>
                        </div>
                      </div>
                    </div>

                    <div className={`${cardClass} space-y-4`}>
                      {!showPromoCodeInput && (
                        <button
                          type="button"
                          onClick={() => setShowPromoCodeInput(true)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:border-teal-200 hover:bg-teal-50"
                        >
                          Do you have a promo code?
                        </button>
                      )}
                      {showPromoCodeInput && (
                        <div className="grid grid-cols-1 gap-3">
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className={labelClass}>Promo Coupon</p>
                            <input
                              value={couponCode}
                              onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                              placeholder="Enter coupon code"
                              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                            />
                          </div>
                        </div>
                      )}

                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold tracking-wide text-slate-600">Use Points for Extension</p>
                            <p className="text-[11px] font-semibold text-slate-500">
                              {pointsFrozen
                                ? 'Points are frozen by admin.'
                                : maxEligiblePoints > 0
                                  ? `Auto apply full eligible points (${maxEligiblePoints} points).`
                                  : 'No points available right now'}
                            </p>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={usePointsForExtension}
                            onClick={() => {
                              if (maxEligiblePoints <= 0 || pointsFrozen) return;
                              setUsePointsForExtension((prev) => !prev);
                            }}
                            disabled={maxEligiblePoints <= 0 || pointsFrozen}
                            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                              usePointsForExtension ? 'bg-teal-600' : 'bg-slate-300'
                            } disabled:cursor-not-allowed disabled:opacity-50`}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                                usePointsForExtension ? 'translate-x-5' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                        </div>
                        {usePointsForExtension && !pointsFrozen && maxEligiblePoints > 0 && (
                          <div className="mt-2 space-y-2">
                            <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-600">
                              <span>Points applied</span>
                              <span className="font-black text-slate-900">{pointsEligible}</span>
                            </div>
                            <p className="text-[11px] font-semibold text-slate-500">
                              Estimated extension: {projectedBonusDays} days.
                            </p>
                          </div>
                        )}
                      </div>

                      <p className="text-xs font-semibold text-slate-500">
                        Referral reward applies after first successful paid subscription. Referrer gets {referralRewardReferrer} points, referred user gets {referralRewardReferred} points.
                      </p>
                    </div>
                  </div>

                  <div className={`${cardClass} xl:sticky xl:top-6 h-fit`}>
                    <p className={labelClass}>Order Summary</p>
                    <p className="mt-2 text-xl font-black tracking-tight text-slate-900">{selectedPlan?.displayName || 'Select Plan'}</p>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-600">Base Price</span>
                        <span className="font-black text-slate-900">{formatCurrency(selectedPlanAmountInr, 'India')}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-600">Plan Savings</span>
                        <span className="font-black text-emerald-700">
                          {selectedPlanSavings > 0 ? `-${formatCurrency(selectedPlanSavings, 'India')}` : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-600">Points Applied</span>
                        <span className="font-black text-slate-900">{pointsEligible}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2">
                        <span className="text-slate-600">Points to Earn</span>
                        <span className="font-black text-teal-700">+{pointsEarnRateOnPayment} pts</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2">
                        <span className="text-slate-600">Total Payable</span>
                        <span className="text-3xl font-black text-slate-900">{formatCurrency(selectedPlanAmountInr, 'India')}</span>
                      </div>
                    </div>

                    {authReady && !isSignedIn && (
                      <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                        Sign in is required to continue checkout.
                      </p>
                    )}

                    {error && (
                        <div className="mt-3 rounded-xl border border-rose-300/60 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                          {error}
                        </div>
                    )}

                    <button
                      onClick={() => void onCheckout()}
                      disabled={busy || !selectedPlan || !authReady || loading || sortedPlans.length === 0}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold tracking-wide text-white transition hover:bg-teal-500 disabled:opacity-60"
                    >
                      <CreditCard size={14} /> {busy ? 'Processing...' : 'Subscribe Now'}
                    </button>
                    <p className="mt-3 text-[11px] font-semibold text-slate-500">
                      By continuing, you agree to subscription terms, cancellation policy, and refund policy.
                    </p>
                    {showSkipCta && (
                      <a href={skipHref} className="mt-3 inline-flex text-[11px] font-semibold tracking-wide text-slate-500 hover:text-slate-700">
                        Continue with limited access
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

          </>
        )}
      </div>
    </div>
  );
};

export const PricingPage: React.FC = () => {
  return <BillingManagePage mode="pricing" />;
};

export const BillingResultPage: React.FC<{ status: 'success' | 'failed' | 'cancelled' }> = ({ status }) => {
  useEffect(() => {
    applySeoMeta({
      ...getPathMeta(`/billing/${status}`),
      type: 'website',
      robots: 'noindex,nofollow',
    });
  }, [status]);

  const statusMeta = {
    success: {
      title: 'Payment Successful',
      detail: 'Your subscription is active. Dashboard access is restored.',
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      icon: <CheckCircle2 size={20} />,
    },
    failed: {
      title: 'Payment Failed',
      detail: 'The payment could not be completed. You can retry from Billing Management.',
      tone: 'border-rose-200 bg-rose-50 text-rose-700',
      icon: <XCircle size={20} />,
    },
    cancelled: {
      title: 'Checkout Cancelled',
      detail: 'No amount was charged. Resume checkout when ready.',
      tone: 'border-amber-200 bg-amber-50 text-amber-700',
      icon: <ShieldCheck size={20} />,
    },
  }[status];

  return (
    <div className={shellClass}>
      <div className="mx-auto max-w-xl space-y-4">
        <div className={cardClass}>
          <p className={labelClass}>Billing Status</p>
          <div className={`mt-4 rounded-2xl border p-4 ${statusMeta.tone}`}>
            <div className="inline-flex items-center gap-2">
              {statusMeta.icon}
              <p className="text-lg font-black">{statusMeta.title}</p>
            </div>
            <p className="mt-2 text-sm font-semibold">{statusMeta.detail}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href="/billing/manage" className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold tracking-wide text-teal-700">
              Billing Management
            </a>
            <a href="/" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold tracking-wide text-slate-700">
              Back to App
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export const BillingLegalPage: React.FC<{ type: 'subscription-terms' | 'refund-policy' | 'cancellation-policy' }> = ({ type }) => {
  const config = useMemo(() => {
    if (type === 'subscription-terms') {
      return {
        title: 'Subscription Terms',
        canonical: '/legal/terms',
        body: [
          'Legal Entity: Finvantage',
          'Support: dummy@finvantage.com',
          'Address: Mumbai, India',
          'Jurisdiction: India',
          'Plans auto-renew by default unless cancelled at period end.',
          'Paid access governs dashboard unlock. Other modules remain available as per policy.',
          'Coupons can be managed by admin and may include flat/percentage discounts.',
          'Points can be redeemed for plan extension using effective daily plan value.',
        ],
      };
    }
    if (type === 'refund-policy') {
      return {
        title: 'Refund Policy',
        canonical: '/legal/refund-policy',
        body: [
          'Refunds are admin-approved and processed on a prorated basis when applicable.',
          'Refund request window: within 7 calendar days from payment date.',
          'Proration basis: remaining days in current billing cycle.',
          'Approved refund timelines depend on payment provider settlement windows.',
        ],
      };
    }
    return {
      title: 'Cancellation Policy',
      canonical: '/legal/cancellation-policy',
      body: [
        'Cancellation is processed at period end (no immediate service termination for paid period).',
        'Users can resume subscription before end date from Billing Management.',
        'Downgrades are disabled in current policy. Upgrades apply from next billing cycle.',
        'Failed-payment policy: retries Day 1/3/5, limited mode after Day 5, dashboard block after Day 10.',
      ],
    };
  }, [type]);

  useEffect(() => {
    applySeoMeta({
      title: `${config.title} | FinVantage`,
      description: `${config.title} for FinVantage subscriptions and billing.`,
      canonicalUrl: `${window.location.origin}${config.canonical}`,
      type: 'website',
      robots: 'index,follow',
    });
  }, [config]);

  return (
    <div className={shellClass}>
      <div className="mx-auto max-w-4xl space-y-4">
        <div className={cardClass}>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-600">Legal</p>
          <h1 className="mt-3 text-3xl md:text-5xl font-black tracking-tight text-slate-900">{config.title}</h1>
          <p className="mt-3 text-sm font-semibold text-slate-600">Last updated: March 1, 2026</p>
        </div>
        <div className={cardClass}>
          <div className="space-y-2 text-sm font-semibold text-slate-700">
            {config.body.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
