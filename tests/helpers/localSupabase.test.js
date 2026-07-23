import { describe, expect, it } from 'vitest'
import {
  getRlsVitestArgs,
  getLocalSupabaseCredentials,
  parseSupabaseEnv,
  toSupabaseTestEnv,
} from './localSupabase.js'

describe('parseSupabaseEnv', () => {
  it('parses quoted values from supabase status output', () => {
    expect(parseSupabaseEnv([
      'API_URL="http://127.0.0.1:54321"',
      'ANON_KEY="anon-value"',
      'SERVICE_ROLE_KEY="service-value"',
      'JWT_SECRET="jwt-value"',
    ].join('\n'))).toEqual({
      API_URL: 'http://127.0.0.1:54321',
      ANON_KEY: 'anon-value',
      SERVICE_ROLE_KEY: 'service-value',
      JWT_SECRET: 'jwt-value',
    })
  })
})

describe('getLocalSupabaseCredentials', () => {
  it('prefers explicit test environment variables', () => {
    const credentials = getLocalSupabaseCredentials({
      env: {
        SUPABASE_TEST_URL: 'http://localhost:54321',
        SUPABASE_TEST_ANON_KEY: 'env-anon',
        SUPABASE_TEST_SERVICE_ROLE_KEY: 'env-service',
        SUPABASE_TEST_JWT_SECRET: 'env-jwt',
      },
      readStatus: () => {
        throw new Error('status should not be called')
      },
    })

    expect(credentials).toEqual({
      url: 'http://localhost:54321',
      anonKey: 'env-anon',
      serviceRoleKey: 'env-service',
      jwtSecret: 'env-jwt',
    })
  })

  it('falls back to the running local Supabase status', () => {
    const credentials = getLocalSupabaseCredentials({
      env: {},
      readStatus: () => [
        'API_URL="http://127.0.0.1:54321"',
        'ANON_KEY="status-anon"',
        'SERVICE_ROLE_KEY="status-service"',
        'JWT_SECRET="status-jwt"',
      ].join('\n'),
    })

    expect(credentials).toEqual({
      url: 'http://127.0.0.1:54321',
      anonKey: 'status-anon',
      serviceRoleKey: 'status-service',
      jwtSecret: 'status-jwt',
    })
  })
})

describe('toSupabaseTestEnv', () => {
  it('maps credentials to worker-safe environment names', () => {
    expect(toSupabaseTestEnv({
      url: 'http://127.0.0.1:54321',
      anonKey: 'anon',
      serviceRoleKey: 'service',
      jwtSecret: 'jwt',
    })).toEqual({
      SUPABASE_TEST_URL: 'http://127.0.0.1:54321',
      SUPABASE_TEST_ANON_KEY: 'anon',
      SUPABASE_TEST_SERVICE_ROLE_KEY: 'service',
      SUPABASE_TEST_JWT_SECRET: 'jwt',
    })
  })
})

describe('getRlsVitestArgs', () => {
  it('serializes database test files to protect shared fixtures', () => {
    expect(getRlsVitestArgs({ watch: false })).toEqual([
      'run',
      '--no-file-parallelism',
      'tests/rls',
    ])
  })
})
