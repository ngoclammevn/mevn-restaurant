import { execFileSync } from 'node:child_process'

export function parseSupabaseEnv(output) {
  const values = {}

  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/)
    if (!match) continue

    const [, key, rawValue] = match
    const value = rawValue.trim()
    if (value.startsWith('"') && value.endsWith('"')) {
      values[key] = JSON.parse(value)
    } else if (value.startsWith("'") && value.endsWith("'")) {
      values[key] = value.slice(1, -1)
    } else {
      values[key] = value
    }
  }

  return values
}

function readLocalStatus() {
  return execFileSync('supabase', ['status', '-o', 'env'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
}

export function getLocalSupabaseCredentials({
  env = process.env,
  readStatus = readLocalStatus,
} = {}) {
  const explicit = {
    url: env.SUPABASE_TEST_URL,
    anonKey: env.SUPABASE_TEST_ANON_KEY,
    serviceRoleKey: env.SUPABASE_TEST_SERVICE_ROLE_KEY,
    jwtSecret: env.SUPABASE_TEST_JWT_SECRET,
  }

  if (Object.values(explicit).every(Boolean)) return explicit

  const local = parseSupabaseEnv(readStatus())
  const credentials = {
    url: explicit.url || local.API_URL,
    anonKey: explicit.anonKey || local.ANON_KEY,
    serviceRoleKey: explicit.serviceRoleKey || local.SERVICE_ROLE_KEY,
    jwtSecret: explicit.jwtSecret || local.JWT_SECRET,
  }

  const missing = Object.entries(credentials)
    .filter(([, value]) => !value)
    .map(([key]) => key)

  if (missing.length) {
    throw new Error(`Missing local Supabase test credentials: ${missing.join(', ')}`)
  }

  return credentials
}

export function toSupabaseTestEnv(credentials) {
  return {
    SUPABASE_TEST_URL: credentials.url,
    SUPABASE_TEST_ANON_KEY: credentials.anonKey,
    SUPABASE_TEST_SERVICE_ROLE_KEY: credentials.serviceRoleKey,
    SUPABASE_TEST_JWT_SECRET: credentials.jwtSecret,
  }
}

export function getRlsVitestArgs({ watch }) {
  return [
    ...(watch ? [] : ['run']),
    '--no-file-parallelism',
    'tests/rls',
  ]
}
