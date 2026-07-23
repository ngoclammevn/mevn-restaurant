import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'
import { getLocalSupabaseCredentials } from './localSupabase.js'

const {
  url: SUPABASE_URL,
  anonKey: ANON_KEY,
  serviceRoleKey: SERVICE_KEY,
  jwtSecret: JWT_SECRET,
} = getLocalSupabaseCredentials()

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
