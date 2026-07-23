import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

export function createServerSupabaseClient() {
  const url = process.env.VITE_SUPABASE_URL
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

  if (!url || !publishableKey) {
    throw new Error('Missing Supabase public environment variables')
  }

  return createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    realtime: { transport: ws },
  })
}
