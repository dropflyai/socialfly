// Apply migration 020 to the live Supabase via the exec_sql RPC (service role).
// $$-aware statement splitter so the touch_updated_at function body survives.
// Idempotent-ish: tables/indexes use IF NOT EXISTS; policies/triggers error if
// already present (first run is clean). Continue-on-error, report at the end.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const envFile = readFileSync('.env.local', 'utf8')
const env = (n) => (envFile.match(new RegExp(`^${n}=(.+)$`, 'm'))?.[1] || '').trim()
const url = env('NEXT_PUBLIC_SUPABASE_URL')
const key = env('SUPABASE_SERVICE_ROLE_KEY')
if (!url || !key) { console.error('missing supabase url/service key'); process.exit(1) }
const supabase = createClient(url, key, { auth: { persistSession: false } })

// --- verify exec_sql RPC exists ---
const probe = await supabase.rpc('exec_sql', { query: 'select 1;' })
if (probe.error) {
  console.error('EXEC_SQL_UNAVAILABLE:', probe.error.message)
  console.error('=> apply 020 via the Supabase SQL editor instead.')
  process.exit(2)
}
console.log('exec_sql OK ->', JSON.stringify(probe.data))

// --- $$-aware split ---
function splitSql(sql) {
  const out = []; let cur = ''; let inDollar = false
  for (let i = 0; i < sql.length; i++) {
    if (sql.slice(i, i + 2) === '$$') { inDollar = !inDollar; cur += '$$'; i++; continue }
    const ch = sql[i]
    if (ch === ';' && !inDollar) { if (cur.trim()) out.push(cur.trim()); cur = ''; continue }
    cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}
const isMeaningful = (s) => s.replace(/--.*$/gm, '').trim().length > 0

const sql = readFileSync('supabase/migrations/020_brand_dna_soul_ledger.sql', 'utf8')
const stmts = splitSql(sql).filter(isMeaningful)
console.log(`Applying ${stmts.length} statements...\n`)

let ok = 0; const errs = []
for (let i = 0; i < stmts.length; i++) {
  const stmt = stmts[i] + ';'
  const preview = stmt.replace(/\s+/g, ' ').slice(0, 72)
  const { data, error } = await supabase.rpc('exec_sql', { query: stmt })
  const failMsg = error?.message || (data && data.success === false ? data.error : null)
  if (failMsg) { errs.push({ i: i + 1, preview, failMsg }); console.log(`[${i + 1}/${stmts.length}] ERR  ${preview}\n        -> ${failMsg}`) }
  else { ok++; console.log(`[${i + 1}/${stmts.length}] ok   ${preview}`) }
}
console.log(`\nDONE: ${ok}/${stmts.length} ok, ${errs.length} errors`)

// --- verify the 3 tables exist ---
for (const t of ['brand_souls', 'generation_jobs', 'soul_memory']) {
  const { error } = await supabase.from(t).select('*', { count: 'exact', head: true })
  console.log(`table ${t}: ${error ? 'MISSING (' + error.message + ')' : 'EXISTS'}`)
}
