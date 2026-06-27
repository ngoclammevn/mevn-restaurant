import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'

// Default local Supabase values (supabase start)
const SUPABASE_URL = 'http://127.0.0.1:54321'
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRFA0NiK7kyqd6SIHDkIdLRJ3DVWu-DCE8v_MHr6Ipc'
const SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hj04zWl196z2-SBc0'
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

