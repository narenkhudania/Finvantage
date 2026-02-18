// services/supabase.ts
// REPLACE your existing services/supabase.ts with this file.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Persist the session in localStorage automatically
    persistSession: true,
    autoRefreshToken: true,
  },
});

// ── Profile type (mirrors the Supabase profiles table) ────────
export interface SupabaseProfile {
  id: string;
  identifier: string;
  first_name: string;
  last_name: string | null;
  dob: string | null;
  life_expectancy: number;
  retirement_age: number;
  pincode: string | null;
  city: string | null;
  state: string | null;
  country: string;
  income_source: string;
  iq_score: number;
  onboarding_done: boolean;
  created_at: string;
  updated_at: string;
}
