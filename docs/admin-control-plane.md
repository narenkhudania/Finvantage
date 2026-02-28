# FinVantage Admin Control Plane (`/admin`)

## 0) Assumptions Locked
- Deployment model: same app, route `/admin`
- DB: Supabase Postgres
- Auth: Supabase Auth
- Geography: India-first
- Scale target: 1M users
- KYC/fraud/payments providers: not integrated yet, schema ready
- Access: bootstrap as `super_admin` initially (full permissions)

## 1) System Architecture

### 1.1 High-Level Text Diagram
```text
[Admin Browser (/admin)]
  -> Supabase Auth (JWT)
  -> PostgREST RPCs (admin_* functions, RLS enforced)
  -> Admin Tables (RBAC, audit, kyc, fraud, payments, flags, webhooks)
  -> Core Product Tables (profiles, goals, assets, loans, transactions)

[Optional API Layer (/api/admin/* on Vercel)]
  -> Bearer token validation (Supabase Auth)
  -> Service-role Supabase client
  -> Permission check via admin_has_permission
  -> Analytics/Audit actions
```

### 1.2 Service Separation (logical modules)
- `Auth + Session`: Supabase Auth, admin identity check
- `Customer Ops`: search, timeline, block/unblock, force logout
- `Compliance`: KYC queue + review workflow
- `Risk Ops`: fraud queue + manual resolution
- `Billing Ops`: subscriptions + payments monitoring
- `Analytics`: KPI + time-series snapshots
- `Operations`: feature flags, webhook replay, customer communication
- `Governance`: immutable admin audit logs

### 1.3 RBAC Model
- Roles: `super_admin`, `compliance_officer`, `operations`, `support`, `finance`, `read_only_audit`
- Permissions include: `customers.read/manage`, `payments.read/manage`, `subscriptions.read/manage`, `kyc.read/review`, `fraud.read/review`, `analytics.read`, `ops.manage`, `audit.read/write`, `admin.manage`
- Super admin receives all permissions automatically.

### 1.4 API Design Principles
- RPC-first for sensitive admin operations (`admin_*` functions)
- All mutating operations write audit logs
- Permission checks at DB boundary, not only UI
- Pagination/limit clamps enforced in SQL
- Secure defaults: deny unless role+permission passes

### 1.5 Audit Logging
- Table: `admin_audit_logs`
- Captures: `admin_user_id`, `action`, `entity_type`, `entity_id`, `reason`, `payload`, `ip`, `user_agent`, `created_at`
- Indexed for regulator and forensic retrieval

### 1.6 Webhook Handling Design
- Table: `webhook_events`
- States: `received`, `processed`, `failed`, `replay_queued`
- Operational action: `admin_replay_webhook_event(...)` increments replay counter and records replay time

### 1.7 Data Warehouse Suggestion (next phase)
- Introduce ClickHouse/BigQuery/Snowflake for:
  - Cohort and LTV/CAC at scale
  - Attribution and funnel depth
  - Heavy historical BI without primary DB load
- Feed via CDC from Postgres + event bus.

## 2) Database Schema Coverage

Implemented in migration:
- RBAC: `admin_roles`, `admin_permissions`, `admin_role_permissions`, `admin_users`
- Customer control: `user_admin_flags`
- Compliance: `kyc_records`
- Fraud: `fraud_flags`
- Billing: `subscriptions`, `payments`
- Ops: `feature_flags`, `webhook_events`, `admin_notifications`, `support_tickets`
- Activity and analytics: `activity_events`
- Governance: `admin_audit_logs`

Key indices added for lookup and queue performance (status/time/user composites).

## 3) Feature Modules Implemented in `/admin`

### A. Customer Management
- Search by email/name/UUID
- KYC filter
- Customer timeline drawer
- Block/unblock and force logout (single + bulk)
- CSV export for ops/review workflows

### B. Payments & Subscriptions
- Payment status feed
- Failed payments visibility
- Subscription status + plan telemetry
- Placeholder ready for refunds/chargebacks provider integration

### C. KYC Review Panel
- KYC queue view
- Approve/reject actions with audit trail
- Risk score + band surfaced

### D. Fraud & Risk Monitoring
- Fraud queue by severity/status
- Manual resolve workflow
- Rule-key + amount visibility for investigations

### E. Analytics Dashboard
- DAU/MAU summary
- New users, txn count, txn volume, revenue
- Time-series charts via `admin_analytics_snapshot`

## 4) Security & Compliance Controls

- AuthN: Supabase Auth
- AuthZ: role+permission model with DB-level enforcement
- RLS on all admin/control tables
- Immutable-style audit append table for privileged actions
- Sensitive controls: block, force logout, review actions via RPC only
- Field masking strategy (next increment):
  - Implement masked views for PII columns (PAN/Aadhaar placeholders)
  - Permission key gate for full-value reveal
- India compliance alignment baseline:
  - DPDP: purpose limitation + retention policies + minimization
  - PMLA/AML readiness via fraud/KYC tables and event auditability

## 5) Tech Stack Recommendation

Current implemented pattern:
- Frontend admin: React + Tailwind classes in existing Vite app
- Backend admin API: Supabase RPC + optional Vercel serverless (`/api/admin/analytics`)
- DB: Supabase Postgres
- Queue (next phase): Upstash Redis / SQS for async KYC/webhook/fraud pipelines
- Monitoring (next phase): Sentry + OpenTelemetry + Postgres stats dashboard
- CI/CD (next phase): GitHub Actions with migration gating + smoke tests

Trade-off:
- RPC-centric pattern ships fastest and keeps data logic close to Postgres.
- As complexity grows, move heavy orchestration into dedicated NestJS services.

## 6) Starter Code Delivered

- Admin UI page:
  - `components/admin/AdminPage.tsx`
- Admin client service + types:
  - `services/admin/adminService.ts`
  - `services/admin/types.ts`
- API sample (RBAC + analytics endpoint):
  - `api/admin/_auth.ts`
  - `api/admin/analytics.ts`
- Database migration:
  - `supabase/migrations/20260227_admin_control_plane.sql`
  - `supabase/migrations/20260228_foundation_tenant_security.sql`

## 7) Scalability & Future-Proofing Path

### 7.1 Multi-Region
- Keep writes in primary region, add read replicas for admin analytics and reporting.
- Route read-heavy dashboard endpoints to replicas / warehouse.

### 7.2 Microservices Migration Path
- Split into services by bounded context:
  - `admin-ops-service`
  - `compliance-service`
  - `payments-ledger-service`
  - `fraud-engine-service`
- Preserve Postgres contracts with stable event schemas.

### 7.3 Event-Driven Option
- Emit domain events (`user.blocked`, `kyc.reviewed`, `fraud.flagged`, `payment.failed`)
- Consumers update analytics marts and notification pipelines.

### 7.4 ML Fraud Upgrade
- Start with rules engine (velocity, threshold, geo mismatch)
- Add supervised risk scoring once labeled fraud outcomes accumulate.

## 8) Operational Controls Included

- Bulk actions (customer block/unblock/force logout)
- CSV export (customers)
- Webhook replay tool
- Customer communication sender
- Feature flag control
- Config-ready pattern (`feature_flags.config` JSON)

## 9) Stress Scenario Readiness (Current vs Required)

- 2008-like crash / 30% drawdown:
  - Current: admin visibility only
  - Required: portfolio stress engine + customer impact alerts
- High inflation:
  - Current: no admin inflation control panel
  - Required: scenario policy toggles and assumption governance
- Liquidity freeze / mass redemptions:
  - Current: no liquidity waterfall control
  - Required: liquidity buffer policy + queue prioritization + communications playbook
- Broker/API failure:
  - Current: webhook replay scaffold
  - Required: circuit breakers, dead-letter queue, reconciler jobs
- Regulatory audit:
  - Current: action logs + review traces
  - Required: exportable evidence bundles + retention automation

## 10) Bootstrap Instructions

1. (Recommended for legacy schemas) run strict cleanup:
   `supabase/migrations/20260227_strict_unused_legacy_cleanup.sql`
2. Run migration `supabase/migrations/20260227_admin_control_plane.sql`.
3. Run migration `supabase/migrations/20260228_foundation_tenant_security.sql` for:
   - Tenant core: organizations, workspaces, memberships
   - Workspace RBAC roles: Admin/Manager/Analyst/Support
   - Tenant-scoped audit logs, session monitoring, TOTP 2FA + recovery codes
   - Seeded default org/workspace + first-user workspace admin bootstrap
4. Run migration `supabase/migrations/20260228_internal_crm_behavior_automation.sql` for:
   - Behavior intelligence tables (heatmaps, session records, feedback polls)
   - Internal CRM objects (contacts, leads, deals, tasks, templates, workflows, custom objects)
5. Insert first admin user (legacy `admin_users`, optional if workspace bootstrap is active):
```sql
insert into public.admin_users (user_id, role_id)
select '<YOUR_AUTH_USER_UUID>'::uuid, id
from public.admin_roles
where role_key = 'super_admin';
```
6. Open `/admin` and sign in with that Supabase account.
7. Run smoke checks: `supabase/tests/foundation_smoke.sql`.

## 11) New Internal Modules (No External Integrations)

- `Behavior` module:
  - Event-based analytics and real-time event stream
  - Cohorting, retention/churn reports, path/journey analysis
  - Funnel drop-off visualization and A/B impact table
  - Cross-platform traffic, rage/dead click metrics, issue triggers
  - Session replay index + searchable event/issue insights

- `CRM` module:
  - Contact + lead management with scoring and tags
  - Deal pipeline board with stage updates
  - Task/meeting scheduling and unified timeline
  - Email template analytics and builder
  - Workflow automation with conditional logic and channels
  - Custom objects for internal automation flows
