import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  getRlsVitestArgs,
  getLocalSupabaseCredentials,
  toSupabaseTestEnv,
} from './localSupabase.js'

const watch = process.argv.includes('--watch')
const vitestEntry = fileURLToPath(
  new URL('../../node_modules/vitest/vitest.mjs', import.meta.url),
)
const credentials = getLocalSupabaseCredentials()
const result = spawnSync(
  process.execPath,
  [
    vitestEntry,
    ...getRlsVitestArgs({ watch }),
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      ...toSupabaseTestEnv(credentials),
    },
  },
)

process.exit(result.status ?? 1)
