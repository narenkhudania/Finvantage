# FinVantage Subscription Management

## 1. Architecture + API Contract

### Architecture
- Client: React + TypeScript (`/pricing`, `/billing/manage`, `/settings/billing`, `/billing/success`, `/billing/failed`, `/billing/cancelled`)
- API: Serverless handlers under `apis/billing/*` (public route alias remains `/api/billing/*`)
- Auth: Supabase Auth bearer token (validated in `apis/billing/_auth.ts`)
- Data: Supabase Postgres (plans, subscriptions, payments, coupons, points, referrals, overrides)
- Gateway: Razorpay Subscriptions + Orders fallback + signature verification + webhook processing
- Access control: Dashboard paywall reads billing `accessState` from `/api/billing/snapshot` and keeps non-dashboard pages open.
- Auditability: billing activity events and webhook event logs

### API Contract
- `GET /api/billing/snapshot`
  - Returns current access state, trial status, active subscription, plans, points, referral, retry policy/timeline.
- `POST /api/billing/create-order`
  - Body: `{ planCode, couponCode?, referralCode?, pointsToRedeem? }`
  - Returns checkout mode (`razorpay_order` or `zero_amount`) and payment/order metadata.
- `POST /api/billing/verify-payment`
  - Body: `{ paymentId, razorpayOrderId?, razorpayPaymentId?, razorpaySignature? }`
  - Verifies payment, creates/upgrades subscription, consumes points FIFO, applies coupon redemption, triggers referral rewards.
- `GET /api/billing/history`
  - Returns subscriptions, payments, invoices, coupon redemptions, points ledger, retry timeline.
- `POST /api/billing/subscription-action`
  - Body: `{ action: "cancel_at_period_end" | "resume_auto_renew", subscriptionId? }`
  - Updates renewal state for active/trial/past-due subscription.
- `POST /api/billing/award-points`
  - Body: `{ eventType, sourceRef?, metadata? }`
  - Awards usage points with monthly cap controls.
- `POST /api/billing/webhook`
  - Razorpay webhook endpoint with signature verification and idempotent event handling.
  - Handles `subscription.activated`, `subscription.charged`, `subscription.completed`, `subscription.cancelled`, `subscription.paused`, `payment.failed`, `payment.captured`.

## 2. DB Schema / Migration Changes

Source migration:
- `supabase/migrations/20260301_subscription_referral_points.sql`
- `supabase/migrations/20260301_subscription_comms_and_points_ops.sql`
- `supabase/migrations/20260301_subscription_lifecycle_columns.sql`
- `supabase/migrations/20260301_subscription_trial_first_login_fix.sql`
- `supabase/migrations/20260301_subscription_comms_channel_expansion.sql`

Key entities:
- `billing_plans`
- `user_billing_profiles`
- `subscription_coupons`
- `subscription_coupon_redemptions`
- `reward_points_ledger`
- `referral_events`
- `billing_admin_overrides`
- `billing_internal_reminders`
- `billing_message_templates`
- `billing_message_events`

Extended base billing entities:
- `subscriptions`: provider fields, access-state fields, retry markers
- `payments`: provider order id, coupon, points metadata

One-time migration behavior:
- Seeds paid plans: monthly/3m/6m/12m at `₹199/₹249/₹299/₹399`
- Marks eligible legacy users for one-time trial activation on first post-release login
- Adds RLS policies for user/admin access boundaries

## 3. Backend Implementation

Core files:
- `apis/billing/_auth.ts`: token validation and Supabase service client context
- `apis/billing/_helpers.ts`: pricing helpers, access-state logic, points balance/FIFO, history loaders, billing activity writes
- `apis/billing/_config.ts`: policy constants (retry windows, caps, referral values, override cap)
- `apis/billing/create-order.ts`: coupon + points + referral attachment + Razorpay order creation
- `apis/billing/verify-payment.ts`: signature verification, idempotent payment finalization, subscription creation, points and referral rewards
- `apis/billing/history.ts`: customer-visible billing timeline and invoice feed
- `apis/billing/subscription-action.ts`: cancel at period end / resume auto-renew
- `apis/billing/webhook.ts`: idempotent webhook intake and payment/subscription status updates
- `apis/billing/award-points.ts`: usage points + monthly cap + points-freeze enforcement

Security controls:
- Bearer token required for all customer billing endpoints
- Signature verification for checkout and webhook events
- Idempotency guard in verify + webhook flows
- Admin overrides capped by policy (`365 days`)
- Points freeze support for fraud/risk controls

## 4. Frontend Screens / Components

Customer billing pages:
- `components/site/BillingPages.tsx`
  - `/pricing` route with country selector and display-only non-INR labels
  - Access status card
  - Trial + retry timeline visibility
  - Plan selector (monthly/3m/6m/12m)
  - Coupon/referral/points inputs
  - Checkout via Razorpay
  - Cancel/resume renewal controls
  - Payment history + invoice list
  - Legal policy links
  - Points status badge (`Active` / `Frozen by Admin`)

Client service:
- `services/billingService.ts`
  - Snapshot, history, create-order, verify-payment, subscription-action, points award helpers

Dashboard paywall:
- `App.tsx` + `components/Dashboard.tsx`
  - Locked dashboard preview for blocked users
  - “Subscribe Now” CTA to `/billing/manage`

## 5. Test Cases

### Pricing & plan rules
- Validate selected plan code exists and is active.
- Validate upgrade-only checks prevent lower monthly equivalent when current plan is paid.
- Validate next-cycle start for upgrades (no immediate proration).

### Coupon + points
- Coupon validity windows (`valid_from`, `valid_until`).
- Coupon plan scope enforcement.
- Usage limit (global + per-user) enforcement.
- Coupon + points stacking works in single checkout.
- Points conversion to extension days uses fixed chunk rule (`99 -> 30 days`).

### Points ledger
- Monthly cap (`1000`) enforcement for usage rewards.
- FIFO redemption consumes oldest unexpired positive points first.
- Expiry logic (12 months) excludes expired balances.
- Points-freeze check blocks earning/redemption when enabled by admin.

### Referrals
- Reward trigger only on first successful paid conversion of referred user.
- Self-referral blocked.
- Duplicate referral reward prevented.
- Award values default from config/env (`BILLING_REFERRAL_POINTS_REFERRER`, `BILLING_REFERRAL_POINTS_REFERRED`).
- Monthly referrer cap enforced (`100` rewarded referrals/month).

### Payment and subscription lifecycle
- Zero-amount checkout flow finalizes without gateway.
- Razorpay signature verification failure blocks activation.
- Verify endpoint idempotency returns existing subscription on repeated requests.
- Cancel-at-period-end and resume toggles update correct flags.

### Access-state transitions
- Trial active => access active.
- `past_due` day 1/3/5 retry window behavior.
- `limited` after day 5.
- `blocked` after day 10.
- Auto restore on successful capture.

### Webhook reliability
- Duplicate webhook event ignored idempotently.
- Webhook processing state transitions (`received` -> `processed` / `failed`).
- Failure path stores `error_message`.

### Communication hooks
- Billing communication templates are DB-managed.
- Payment initiated/success/failed and subscription cancel/resume queue message events.
- Channels supported in queue: `email`, `mobile`, `in_app`.
- Legal pages: `/legal/terms`, `/legal/refund-policy`, `/legal/cancellation-policy` (legacy aliases retained).

## 6. Rollout Checklist

### Pre-release
- Run Supabase migration on target project.
- Set env vars:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `RAZORPAY_KEY_ID`
  - `RAZORPAY_KEY_SECRET`
  - `RAZORPAY_WEBHOOK_SECRET`
  - `APP_BASE_URL`
  - `WEBHOOK_BASE_URL`
- Configure Razorpay webhook URL:
  - `https://finvantage.vercel.app/api/billing/webhook`

### Release steps
- Deploy API + UI together.
- Validate one migrated trial user and one new user path.
- Validate payment success/failed/cancelled redirects.
- Validate dashboard lock behavior for blocked account.
- Validate cancel/resume action from billing page.
- Validate points freeze/reversal/export controls from admin operations.

### Post-release monitoring
- Monitor `webhook_events` failures.
- Monitor `payments` in `failed` and `past_due` cohorts.
- Monitor points ledger anomalies (large positive spikes).
- Review billing activity events for audit trail completeness.
