-- Expand billing communication templates across channels (DB-ready hooks).

insert into public.billing_message_templates (template_key, title, channel, subject, body, is_active, metadata)
values
  (
    'billing_trial_migrated_email',
    'Trial Activated (Email)',
    'email',
    'Your 30-day Finvantage trial is now active',
    'Your one-time migrated trial is active from {{trial_start_at}} to {{trial_end_at}}. Subscribe before expiry to keep dashboard access.',
    true,
    '{"source":"subscription_rollout","event":"trial_started"}'::jsonb
  ),
  (
    'billing_trial_migrated_mobile',
    'Trial Activated (Mobile)',
    'mobile',
    null,
    'Your one-time 30-day trial is active. Subscribe before {{trial_end_at}} to avoid dashboard lock.',
    true,
    '{"source":"subscription_rollout","event":"trial_started"}'::jsonb
  ),
  (
    'billing_trial_ending_soon_email',
    'Trial Ending Soon (Email)',
    'email',
    'Your Finvantage trial is ending soon',
    'Your trial ends on {{trial_end_at}} ({{days_left}} days left). Subscribe to keep dashboard access active.',
    true,
    '{"source":"subscription_rollout","event":"trial_ending_soon"}'::jsonb
  ),
  (
    'billing_trial_ending_soon_mobile',
    'Trial Ending Soon (Mobile)',
    'mobile',
    null,
    'Trial ending soon ({{days_left}} days left). Subscribe now to keep dashboard access.',
    true,
    '{"source":"subscription_rollout","event":"trial_ending_soon"}'::jsonb
  ),
  (
    'billing_access_limited_email',
    'Access Limited (Email)',
    'email',
    'Dashboard access is limited due to pending payment',
    'Your payment is pending. Complete payment to restore full dashboard access.',
    true,
    '{"source":"subscription_rollout","event":"access_limited"}'::jsonb
  ),
  (
    'billing_access_limited_mobile',
    'Access Limited (Mobile)',
    'mobile',
    null,
    'Dashboard access is limited due to pending payment. Complete payment in Billing.',
    true,
    '{"source":"subscription_rollout","event":"access_limited"}'::jsonb
  )
on conflict (template_key) do update
set
  title = excluded.title,
  channel = excluded.channel,
  subject = excluded.subject,
  body = excluded.body,
  is_active = excluded.is_active,
  metadata = excluded.metadata,
  updated_at = now();
