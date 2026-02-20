// services/authService.ts
// NEW FILE — add this to your services/ folder.
// All Supabase Auth + profile operations used by Onboarding.tsx and App.tsx.

import { supabase, type SupabaseProfile } from './supabase';
import type { IncomeSource } from '../types';

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

// ─────────────────────────────────────────────────────────────
// AUTH OPERATIONS
// ─────────────────────────────────────────────────────────────

/**
 * Check whether an email has already been registered.
 * Uses a SECURITY DEFINER Postgres function so the anon key
 * can safely query without exposing other users' data.
 */
export async function checkIdentifier(identifier: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('identifier_exists', {
    p_identifier: identifier.trim(),
  });
  if (error) throw new Error(error.message);
  return data as boolean;
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
}): Promise<void> {
  const authEmail = toAuthEmail(payload.identifier);

  // Step 1 — Create the auth user
  const { data, error } = await supabase.auth.signUp({
    email: authEmail,
    password: payload.password,
    options: {
      data: {
        first_name: payload.firstName,
        last_name:  payload.lastName ?? '',
      },
    },
  });

  if (error) throw new Error(error.message);
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

  if (profileError) throw new Error(profileError.message);
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

  if (error) throw new Error(error.message);
}

/**
 * Get the current Supabase session (null if logged out).
 * Used in App.tsx to restore state on page reload.
 */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}
