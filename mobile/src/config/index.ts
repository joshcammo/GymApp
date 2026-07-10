/**
 * ─────────────────────────────────────────────────────────────
 * Supabase configuration
 *
 * Values come from EXPO_PUBLIC_* env vars (see .env.example),
 * which Expo inlines at build time and are safe to ship in the
 * client — access control is enforced by Row Level Security in
 * Supabase, not by keeping these values secret.
 * ─────────────────────────────────────────────────────────────
 */

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — check mobile/.env'
  );
}
