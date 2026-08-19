import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'

// Default local Supabase values (supabase start)
const SUPABASE_URL = 'http://127.0.0.1:54321'
// ponytail: hardcoded local-only demo keys drift across supabase CLI versions
// (same secret, but CLI's own signature differs) — re-sync with `supabase start` output if tests start 401ing.
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const JWT_SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long'

// Mint a fake Clerk-style JWT accepted by local Supabase PostgREST
function makeToken(userId) {
  return jwt.sign(
    { sub: userId, role: 'authenticated', iss: 'supabase-demo' },
    JWT_SECRET,
  )
}

import ws from 'ws'

// Client acting as a specific user (RLS applies)
export function asUser(userId) {
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${makeToken(userId)}` } },
    auth: { persistSession: false },
    realtime: { transport: ws },
  })
}

// Service-role client (bypasses RLS — only for test setup/teardown)
export const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
  realtime: { transport: ws },
})

