import { createClient } from '@supabase/supabase-js'

/**
 * The single Supabase client for the app. The publishable/anon key is public by
 * design; every table is guarded by row-level security (supabase/schema.sql), so
 * this key can only ever see what the signed-in user is allowed to see.
 */
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — copy .env.example to .env and fill them in.',
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // needed for the magic-link redirect
  },
})
