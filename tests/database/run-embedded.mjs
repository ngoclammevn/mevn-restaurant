import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'

// SQL-aware splitting preserves function bodies, literals and comments. Each
// command commits separately, like psql autocommit, so transaction guards matter.
function commands(source) {
  const result = []
  let start = 0, quote = null, comment = null
  for (let i = 0; i < source.length; i++) {
    if (comment === 'line') { if (source[i] === '\n') comment = null; continue }
    if (comment === 'block') { if (source.slice(i, i + 2) === '*/') { comment = null; i++ } continue }
    if (quote) {
      if (quote === "'" || quote === '"') {
        if (source[i] === '\\' && quote === "'") { i++; continue }
        if (source[i] === quote) {
          if (source[i + 1] === quote) i++
          else quote = null
        }
      } else if (source.startsWith(quote, i)) { i += quote.length - 1; quote = null }
      continue
    }
    if (source.slice(i, i + 2) === '--') { comment = 'line'; i++; continue }
    if (source.slice(i, i + 2) === '/*') { comment = 'block'; i++; continue }
    if (source[i] === "'" || source[i] === '"') { quote = source[i]; continue }
    const dollar = source.slice(i).match(/^\$[a-zA-Z_0-9]*\$/)?.[0]
    if (dollar) { quote = dollar; i += dollar.length - 1; continue }
    const gset = source.startsWith('\\gset', i)
    if (source[i] === ';' || gset) {
      const sql = source.slice(start, i).trim()
      if (sql) result.push({ sql, gset })
      if (gset) i += 4
      start = i + 1
    }
  }
  if (source.slice(start).trim()) result.push({ sql: source.slice(start), gset: false })
  return result
}

const db = new PGlite()
const variables = {}
let passed = 0, rejected = 0
async function run(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  for (const command of commands(source)) {
    const sql = command.sql.replace(/:'([a-zA-Z_0-9]+)'/g, (_, name) => {
      if (!(name in variables)) throw new Error(`Unknown fixture variable ${name}`)
      return "'" + String(variables[name]).replaceAll("'", "''") + "'"
    })
    try {
      const results = await db.exec(sql)
      if (command.gset) {
        const rows = results.at(-1)?.rows
        if (rows?.length !== 1) throw new Error('Fixture must return one row')
        Object.assign(variables, rows[0])
      }
      if (/^select public\.test_assert\(/.test(sql)) passed++
      if (/^select public\.test_rejected\(/.test(sql)) rejected++
    } catch (error) {
      console.error(`Failed in ${path}: ${sql.slice(0, 160)}`)
      throw error
    }
  }
}
try {
  await run('bootstrap.sql')
  for (const migration of ['0001_schema_rls.sql', '0002_storage.sql', '0003_prod_safe.sql', '0004_close_ordering.sql']) await run(`../../supabase/migrations/${migration}`)
  await run('legacy.sql')
  await db.exec("alter table public.menus add column order_deadline timestamptz; update public.menus set is_closed=false, order_deadline=now()-interval '1 day' where id='00000000-0000-4000-8000-000000000001'; update public.menus set is_closed=false, order_deadline=now()+interval '1 day' where id='00000000-0000-4000-8000-000000000002';")
  await run('../../supabase/migrations/20261003070000_close_ordering_compat.sql')
  const compatibility = await db.query("select id,is_closed from public.menus where id in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002') order by id")
  if (!compatibility.rows[0]?.is_closed || compatibility.rows[1]?.is_closed) throw new Error('Deadline compatibility must close expired menus and preserve future menus')
  await db.exec('update public.menus set is_closed=true')
  await run('../../supabase/migrations/20261003080019_lunch_catalog_reviews.sql')
  await run('checks.sql')
  console.log(`PostgreSQL checks: ${passed} assertions, ${rejected} rejected writes, all passed`)
} catch (error) {
  console.error(`SQL check failed: ${error.message}`)
  process.exitCode = 1
} finally { await db.close() }
