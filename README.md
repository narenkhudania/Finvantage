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
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Backend Setup (Supabase + Vercel)

1. Create a Supabase project.
2. Run the SQL in `supabase/schema.sql` in the Supabase SQL editor.
   Then run all SQL files in `supabase/migrations` in timestamp order.
3. Set environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `GEMINI_API_KEY` (server-side for `/api/ai-advice`)
   - `SUPABASE_URL` (server-side API routes)
   - `SUPABASE_SERVICE_ROLE_KEY` (server-side API routes)

### Local API Dev (optional)
If you want to use the AI route locally, run Vercel Functions alongside Vite:
1. Terminal A: `vercel dev --listen 3001`
2. Terminal B: `npm run dev`
3. Set `VITE_API_BASE_URL=http://localhost:3001` in `.env.local`

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
