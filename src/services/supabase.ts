import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabaseProjectUrl = supabaseUrl;

// Firebase remains available as a fallback until the hosted environment receives
// the two VITE_SUPABASE_* variables. This keeps the existing local setup intact.
export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
  return supabase;
}
