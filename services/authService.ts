// services/authService.ts
// NEW FILE — add this to your services/ folder.
// All Supabase Auth + profile operations used by Onboarding.tsx and App.tsx.

import { supabase, type SupabaseProfile } from './supabase';
import type { IncomeSource } from '../types';
import { getClientDeviceFingerprint } from './deviceFingerprint';

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Supabase Auth requires an email address.
 * Mobile/phone identifiers are no longer supported.
 */
function toAuthEmail(identifier: string): string {
  const email = identifier.trim().toLowerCase();
  if (!email.includes('@')) {
    throw new Error('A valid email address is required.');
  }
  return email;
}

const sanitizeProviderText = (value: string) =>
  value
    .replace(/supabase/gi, 'platform')
    .replace(/gotrue/gi, 'identity service');

const SIGNUP_REFERRAL_PENDING_KEY = 'fv_pending_signup_referral_code';
const AUTH_RETRY_DELAYS_MS = [120, 260, 480];

const wait = async (ms: number) =>
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const normalizeReferralCode = (value?: string) => String(value || '').trim().toUpperCase();

const readPendingSignupReferralCode = () => {
  if (typeof window === 'undefined') return '';
  return normalizeReferralCode(window.localStorage.getItem(SIGNUP_REFERRAL_PENDING_KEY) || '');
};

const writePendingSignupReferralCode = (value: string) => {
  if (typeof window === 'undefined') return;
  const normalized = normalizeReferralCode(value);
  if (!normalized) return;
  window.localStorage.setItem(SIGNUP_REFERRAL_PENDING_KEY, normalized);
};

const clearPendingSignupReferralCode = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SIGNUP_REFERRAL_PENDING_KEY);
};

const getAccessTokenWithRetry = async (attempt = 0): Promise<string> => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token || '';
  if (token) return token;
  if (attempt >= AUTH_RETRY_DELAYS_MS.length - 1) return '';

  await supabase.auth.refreshSession().catch(() => undefined);
  await wait(AUTH_RETRY_DELAYS_MS[attempt]);
  return getAccessTokenWithRetry(attempt + 1);
};

const applyReferralCode = async (code: string): Promise<boolean> => {
  const referralCode = normalizeReferralCode(code);
  if (!referralCode) return false;

  const token = await getAccessTokenWithRetry();
  if (!token) return false;
  const deviceFingerprint = getClientDeviceFingerprint();

  const response = await fetch('/api/billing/apply-referral', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ referralCode, deviceFingerprint }),
  });

  if (!response.ok) return false;
  clearPendingSignupReferralCode();
  return true;
};

const applyPendingSignupReferralCode = async (explicitCode?: string): Promise<void> => {
  const referralCode = normalizeReferralCode(explicitCode || readPendingSignupReferralCode());
  if (!referralCode) return;
  writePendingSignupReferralCode(referralCode);
  await applyReferralCode(referralCode).catch(() => undefined);
};

// ─────────────────────────────────────────────────────────────
// AUTH OPERATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Check whether an email has already been registered.
 * Uses an internal non-disclosive API route (login-first flow) to avoid account enumeration.
 */
export async function checkIdentifier(identifier: string): Promise<boolean> {
  const email = toAuthEmail(identifier);
  try {
    let response: Response | null = null;
    try {
      response = await fetch('/api/auth/check-identifier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email }),
      });
    } catch {
      response = null;
    }

    if (response && response.ok) {
      const payload = await response.json().catch(() => ({}));
      const exists = (payload as any)?.data?.exists;
      if (typeof exists === 'boolean') return exists;
      const useLoginFirst = (payload as any)?.data?.useLoginFirst;
      return useLoginFirst !== false;
    }

    if (response) {
      if (response.status === 429) {
        throw new Error('Too many attempts. Please wait a moment and try again.');
      }
      // API routes may be unavailable in plain Vite mode; fallback to direct RPC.
      if (response.status !== 404 && response.status !== 405) {
        const payload = await response.json().catch(() => ({}));
        const message = String((payload as any)?.error || 'Could not verify identifier.');
        throw new Error(message);
      }
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc('identifier_exists', { p_identifier: email });
    if (!rpcError && typeof rpcData === 'boolean') {
      return rpcData;
    }

    // Last-resort fallback: keep login-first to avoid blocking existing users when lookup infrastructure is unavailable.
    return true;
  } catch (err) {
    const message = String((err as Error)?.message || '');
    const networkOrApiUnavailable =
      !message ||
      /failed to fetch|networkerror|load failed|could not verify identifier/i.test(message);
    if (networkOrApiUnavailable) return true;
    throw new Error(sanitizeProviderText(message || 'Could not verify identifier.'));
  }
}

/**
 * Create a new account.
 * 1. Signs up with Supabase Auth (email + password).
 * 2. Inserts a row into public.profiles with the user's details.
 */
export async function signUp(payload: {
  identifier: string;
  password: string;
  firstName: string;
  lastName?: string;
  phoneCountryCode?: string;
  phoneNumber?: string;
  referralCode?: string;
}): Promise<void> {
  const authEmail = toAuthEmail(payload.identifier);
  const phoneDigits = String(payload.phoneNumber || '').replace(/\D/g, '');
  const phoneCountryCode = String(payload.phoneCountryCode || '+91').trim();
  const phoneE164 = phoneDigits ? `${phoneCountryCode}${phoneDigits}` : null;

  // Step 1 — Create the auth user
  const { data, error } = await supabase.auth.signUp({
    email: authEmail,
    password: payload.password,
    options: {
      data: {
        first_name: payload.firstName,
        last_name:  payload.lastName ?? '',
        phone_country_code: phoneCountryCode,
        phone_number: phoneDigits || '',
        phone_e164: phoneE164,
      },
    },
  });

  if (error) {
    const rawMessage = (error.message || 'Sign-up failed.').trim();
    const lowerMessage = rawMessage.toLowerCase();
    const status = (error as any)?.status;
    const isServerSideSignupFailure =
      status === 500 ||
      lowerMessage.includes('database error saving new user');

    if (isServerSideSignupFailure) {
      throw new Error(
        'Sign-up is blocked by a server-side profile bootstrap error. Apply the latest platform migrations (including signup trigger fixes) and try again.'
      );
    }

    throw new Error(sanitizeProviderText(rawMessage));
  }
  if (!data.user) throw new Error('Sign-up failed — no user returned.');

  // Step 2 — Create the profile row
  // (The DB trigger also does this as a safety net, but we do it
  //  here to control the identifier and name values precisely.)
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id:         data.user.id,
      identifier: payload.identifier.trim(),
      first_name: payload.firstName.trim(),
      last_name:  payload.lastName?.trim() ?? null,
    }, { onConflict: 'id' });

  if (profileError) {
    const profileMessage = (profileError.message || '').toLowerCase();
    const isRlsOrPermission =
      profileMessage.includes('row-level security') ||
      profileMessage.includes('permission denied');

    // In email-confirmation mode, Auth may not return an active session immediately.
    // The auth trigger already creates the profile row, so we don't block signup here.
    if (!isRlsOrPermission) {
      throw new Error(sanitizeProviderText(profileError.message || 'Could not complete profile setup.'));
    }
  }

  // Referral code capture is best-effort to avoid blocking account creation on transient auth/API timing.
  await applyPendingSignupReferralCode(payload.referralCode);
}

/**
 * Sign in an existing user.
 * Returns the Supabase profile row so the app can hydrate state.
 */
export async function signIn(payload: {
  identifier: string;
  password: string;
}): Promise<SupabaseProfile> {
  const authEmail = toAuthEmail(payload.identifier);

  const { data, error } = await supabase.auth.signInWithPassword({
    email:    authEmail,
    password: payload.password,
  });

  if (error) throw new Error('Invalid credentials.');
  if (!data.user) throw new Error('Sign-in failed.');

  // Fetch the profile
  const profile = await getProfile();
  if (!profile) throw new Error('Profile not found. Please contact support.');

  // Retry a deferred signup referral code if one is pending locally.
  await applyPendingSignupReferralCode();

  return profile;
}

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

// ─────────────────────────────────────────────────────────────
// PROFILE OPERATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Fetch the current user's profile from Supabase.
 * Returns null if not authenticated or no profile found.
 */
export async function getProfile(): Promise<SupabaseProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !data) return null;
  return data as SupabaseProfile;
}

/**
 * Save the completed onboarding data.
 * Called at the end of the onboarding flow (the IQ screen).
 */
export async function saveOnboardingProfile(payload: {
  dob: string;
  lifeExpectancy: number;
  retirementAge: number;
  pincode: string;
  city: string;
  state: string;
  country: string;
  incomeSource: IncomeSource;
  iqScore: number;
  termInsuranceAmount?: number;
  healthInsuranceAmount?: number;
}): Promise<void> {
  const dobDate = new Date(payload.dob);
  if (Number.isNaN(dobDate.getTime())) {
    throw new Error('Invalid date of birth.');
  }
  const today = new Date();
  let age = today.getFullYear() - dobDate.getFullYear();
  const m = today.getMonth() - dobDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
    age -= 1;
  }
  if (age < 18 || age > 90) {
    throw new Error('Age must be between 18 and 90.');
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');

  const { error } = await supabase
    .from('profiles')
    .update({
      dob:             payload.dob,
      life_expectancy: payload.lifeExpectancy,
      retirement_age:  payload.retirementAge,
      pincode:         payload.pincode,
      city:            payload.city,
      state:           payload.state,
      country:         payload.country,
      income_source:   payload.incomeSource,
      iq_score:        payload.iqScore,
      onboarding_done: true,
    })
    .eq('id', user.id);

  if (error) throw new Error(sanitizeProviderText(error.message || 'Could not save profile.'));

  const termInsuranceAmount = Number.isFinite(Number(payload.termInsuranceAmount))
    ? Math.max(0, Number(payload.termInsuranceAmount))
    : 0;
  const healthInsuranceAmount = Number.isFinite(Number(payload.healthInsuranceAmount))
    ? Math.max(0, Number(payload.healthInsuranceAmount))
    : 0;

  const insurancePayload = {
    user_id: user.id,
    inflation: 6,
    term_insurance_amount: termInsuranceAmount,
    health_insurance_amount: healthInsuranceAmount,
    updated_at: new Date().toISOString(),
  };

  // Backward-compatible persistence for older schemas.
  const fallbackPayload = {
    user_id: user.id,
    inflation: 6,
    insurance_type: termInsuranceAmount > 0 ? 'Term' : 'Health',
    insurance_amount: termInsuranceAmount > 0 ? termInsuranceAmount : healthInsuranceAmount,
    immediate_needs: termInsuranceAmount,
    existing_insurance: termInsuranceAmount,
    updated_at: new Date().toISOString(),
  };

  const persistInsurancePayload = async (initialPayload: Record<string, any>) => {
    let payloadToPersist = { ...initialPayload };
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const { error: insuranceError } = await supabase
        .from('insurance_analysis_config')
        .upsert(payloadToPersist, { onConflict: 'user_id' });
      if (!insuranceError) return;

      const text = String((insuranceError as any)?.message || '').toLowerCase();
      const match =
        text.match(/could not find the ['"]?([a-z0-9_]+)['"]? column/i) ||
        text.match(/column ['"]?([a-z0-9_]+)['"]? does not exist/i);
      const missingColumn = match?.[1];
      if (!missingColumn || !(missingColumn in payloadToPersist)) {
        throw insuranceError;
      }
      const nextPayload = { ...payloadToPersist };
      delete nextPayload[missingColumn];
      payloadToPersist = nextPayload;
    }
  };

  try {
    await persistInsurancePayload(insurancePayload);
  } catch {
    await persistInsurancePayload(fallbackPayload).catch(() => undefined);
  }
}

/**
 * Get the current Supabase session (null if logged out).
 * Used in App.tsx to restore state on page reload.
 */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}
