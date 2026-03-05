<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1t-wNnRRqulGaXMOLQVelOi-OMIOubfKK

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key (server-side only)
3. Run the app:
   `npm run dev`

## Backend Setup (Supabase + Vercel)

1. Create a Supabase project.
2. Run the SQL in `supabase/schema.sql` in the Supabase SQL editor.
   Then run all SQL files in `supabase/migrations` in timestamp order.
3. Set environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `GEMINI_API_KEY` (server-side for `/api/ai-advice`; never use `VITE_GEMINI_API_KEY`)
   - `SUPABASE_URL` (server-side API routes)
   - `SUPABASE_SERVICE_ROLE_KEY` (server-side API routes)
   - `RAZORPAY_KEY_ID` (billing checkout public key)
   - `RAZORPAY_KEY_SECRET` (billing server auth secret)
   - `RAZORPAY_WEBHOOK_SECRET` (required, dedicated webhook signature secret)
   - `BILLING_REFERRAL_SIGNAL_SALT` (required, referral anti-abuse hashing salt)
   - `BILLING_EVENT_PROCESSOR_SECRET` (required for `/api/billing/process-message-events`)
   - `BILLING_ENTITLEMENT_SIGNING_KEY` (recommended for signed entitlement cache)
   - `APP_BASE_URL` (e.g. `https://finvantage.vercel.app`)
   - `WEBHOOK_BASE_URL` (public webhook base URL)

## Subscription Billing Rollout

Routes:
- `/pricing`
- `/billing/manage`
- `/billing/success`
- `/billing/failed`
- `/billing/cancelled`
- `/settings/billing`
- `/legal/terms`
- `/legal/refund-policy`
- `/legal/cancellation-policy`

### Required migrations
Run these in order if not already applied:
- `supabase/migrations/20260301_subscription_referral_points.sql`
- `supabase/migrations/20260301_subscription_comms_and_points_ops.sql`
- `supabase/migrations/20260301_subscription_lifecycle_columns.sql`
- `supabase/migrations/20260306_billing_plan_catalog_integrity.sql`
- `supabase/migrations/20260306_advice_compliance_trail.sql`
- `supabase/migrations/20260306_ai_advice_security_hardening.sql`

### Razorpay webhook
Configure Razorpay webhook to:
- `${WEBHOOK_BASE_URL}/api/billing/webhook`
- Test default: `https://finvantage.vercel.app/api/billing/webhook`

Enable event types:
- `subscription.activated`
- `subscription.charged`
- `subscription.completed`
- `subscription.cancelled`
- `subscription.paused`
- `payment.failed`
- `payment.captured`

### Billing test flow
1. Open `/pricing` or `/billing/manage`.
2. Select plan (₹99 / ₹289 / ₹499 / ₹899), apply coupon/points/referral as needed.
3. Complete checkout and verify redirect to success/failed/cancelled pages.
4. Confirm dashboard paywall transitions based on billing snapshot.
5. In admin (`/admin` -> Operations), verify:
   - plan cards
   - coupon controls
   - points/referral ledger actions
   - overrides
   - webhook events + reminder queue

### Local API Dev (optional)
If you want to use the AI route locally, run Vercel Functions alongside Vite:
1. Terminal A: `vercel dev --listen 3001`
2. Terminal B: `npm run dev`
3. Optional override in `.env.local`:
   - `VITE_API_PROXY_TARGET=http://localhost:3001`

Notes:
- `npm run dev` now defaults `/api` proxy to `http://localhost:3001` in development.
- Use `VITE_API_PROXY_TARGET` to point `/api` to another host if needed.

## Admin Foundation (Tenant + Security)

The admin foundation adds:
- Multi-tenant org/workspace model (`organizations`, `workspaces`, `workspace_memberships`)
- Workspace RBAC roles: `admin`, `manager`, `analyst`, `support`
- Tenant-scoped audit logs, session monitoring, TOTP 2FA + recovery codes

### Migrations required

Run these migrations after `supabase/schema.sql`:
- `supabase/migrations/20260227_admin_control_plane.sql`
- `supabase/migrations/20260228_foundation_tenant_security.sql`
- `supabase/migrations/20260301_auth_signup_trigger_fix.sql`

The foundation migration auto-seeds:
- Organization: `FinVantage`
- Workspace: `Primary Workspace`
- Role/permission matrix
- First `auth.users` account as workspace `admin` (if an auth user already exists)

### Admin UI flow

1. Sign in to the app with a Supabase account.
2. Open `/admin`.
3. Select workspace from the sidebar selector (if multiple memberships exist).
4. Use `Access` module for:
   - user/role assignment
   - permission matrix
   - session monitor + revoke
   - TOTP setup/verify and recovery-code rotation

### Smoke tests (manual SQL)

Run:
- `supabase/tests/foundation_smoke.sql`

This verifies:
- workspace RBAC permission checks
- tenant audit logging
- session registration
- TOTP setup/enable
- tenant-scoped event ingestion write
