import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.',
  )
}

/**
 * A browser-only app cannot keep a client secret, so we use PKCE: the authorization
 * code is bound to a verifier this tab generated, and an intercepted code is useless
 * without it. Supabase rotates refresh tokens and detects reuse, which is the
 * mitigation available to us short of putting a backend-for-frontend in front of the
 * API. Sessions live server-side at Supabase, so signOut genuinely revokes them.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'carbon-logic-auth',
  },
})
