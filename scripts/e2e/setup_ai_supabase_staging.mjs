// Explicit, nonproduction-only bootstrap for the AI RLS probe. Never loads production credentials.
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

for (const [target, source] of [
  ['FLAVOR_RLS_TEST_URL', 'SUPABASE_STAGING_URL'],
  ['FLAVOR_RLS_TEST_PROJECT_REF', 'SUPABASE_STAGING_PROJECT_REF'],
  ['FLAVOR_RLS_TEST_MANAGEMENT_TOKEN', 'SUPABASE_STAGING_MANAGEMENT_TOKEN'],
  ['FLAVOR_RLS_TEST_ENVIRONMENT', 'SUPABASE_STAGING_ENVIRONMENT'],
]) {
  if (!process.env[target] && process.env[source]) process.env[target] = process.env[source]
}

const ref = process.env.FLAVOR_RLS_TEST_PROJECT_REF || ''
const url = process.env.FLAVOR_RLS_TEST_URL || ''
const token = process.env.FLAVOR_RLS_TEST_MANAGEMENT_TOKEN || ''
const expectedName = 'FlavorInsightAI-Staging'
const expectedOrg = "XQplayer's Org"
const expectedOrgSlug = process.env.SUPABASE_STAGING_ORGANIZATION_SLUG || ''
const productionRefInMigration = 'nwcoyhavzbygyqeadcnw'
const root = path.resolve(import.meta.dirname, '../..')
const migrationDir = path.join(root, 'supabase/migrations')
const selected = [
  '20260803070000_shimadzu_browser_analysis.sql',
  '20260803080000_shimadzu_admin_bootstrap.sql',
  '20260803083000_rotate_shimadzu_admin_bootstrap.sql',
  '20260807090000_shimadzu_partial_results_admin_retention.sql',
  '20260921090000_disable_shimadzu_raw_input_uploads.sql',
]

function refuse(reason) {
  console.error(`REFUSED: ${reason}; no remote writes were made by this invocation`)
  process.exit(2)
}

if (!ref || !token || !url || process.env.FLAVOR_RLS_TEST_ENVIRONMENT !== 'nonproduction') {
  refuse('private staging URL, ref, scoped management token and nonproduction marker are required')
}
if (!/^[a-z0-9]{20}$/.test(ref) || ref === productionRefInMigration || url !== `https://${ref}.supabase.co`) {
  refuse('staging URL/ref is invalid or matches the project referenced by the production retention job')
}

const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
async function management(pathname, options = {}, timeoutMs = 30000) {
  const response = await fetch(`https://api.supabase.com/v1/${pathname}`, {
    ...options, headers, signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`management request failed: HTTP ${response.status}`)
  const body = await response.text()
  return body ? JSON.parse(body) : {}
}

async function query(sql) {
  const rows = await management(`projects/${ref}/database/query`, {
    method: 'POST', body: JSON.stringify({ query: sql, read_only: true }),
  })
  if (!Array.isArray(rows) || !rows[0]) throw new Error('database metadata response has an unexpected shape')
  return rows[0]
}

async function main() {
  const project = await management(`projects/${ref}`)
  const organizations = await management('organizations')
  const organization = Array.isArray(organizations) ? organizations.find(item => item?.id === project?.organization_id) : null
  const organizationVerified = organization?.name === expectedOrg ||
    (!organization && expectedOrgSlug && project?.organization_slug === expectedOrgSlug && !!project?.organization_id)
  if ((project?.ref || project?.id) !== ref || project?.name !== expectedName || !organizationVerified || !String(project?.status || '').startsWith('ACTIVE')) {
    throw new Error('project ref/name/organization/status does not match the active authorized staging project')
  }
  console.log(`Verified staging project ref/name/status: ${expectedName}, ${ref}`)
  console.log('Organization verified against authorized name/slug')

  const before = await query("select (select count(*) from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE')::int as public_tables, (select count(*) from auth.users)::int as auth_users, (select count(*) from storage.buckets where id in ('shimadzu-results', 'shimadzu-inputs'))::int as shimadzu_buckets, (select count(*) from pg_policies where schemaname = 'storage' and policyname like 'shimadzu_%')::int as shimadzu_policies, (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname in ('is_shimadzu_admin', 'handle_new_shimadzu_user', 'touch_shimadzu_job', 'review_shimadzu_user', 'cleanup_expired_shimadzu_data', 'claim_first_shimadzu_admin'))::int as shimadzu_functions, (select count(*) from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_created_shimadzu')::int as shimadzu_auth_triggers")
  const historyBefore = await management(`projects/${ref}/database/migrations`)
  if (!Array.isArray(historyBefore) || historyBefore.length !== 0) {
    throw new Error('staging migration history is not empty; inspect it before applying migrations')
  }
  if (['public_tables', 'auth_users', 'shimadzu_buckets', 'shimadzu_policies', 'shimadzu_functions', 'shimadzu_auth_triggers'].some(key => Number(before[key]) !== 0)) {
    throw new Error('staging database contains existing business, Auth or Shimadzu objects; inspect it before applying migrations')
  }
  console.log('Verified empty public tables, auth users, Shimadzu buckets/policies/functions/triggers and migration history')

  const previews = []
  for (const filename of selected) {
    let sql = await readFile(path.join(migrationDir, filename), 'utf8')
    const sourceSha256 = createHash('sha256').update(sql).digest('hex')
    // The final repository migration has leading comments before BEGIN.
    sql = sql.replace(/^(?:[ \t]*--[^\r\n]*(?:\r?\n|$)|[ \t]*\r?\n)*/, '')
    if (!/^begin;\s/i.test(sql) || !/\scommit;\s*$/i.test(sql)) throw new Error(`${filename}: expected transaction wrapper is missing`)
    // The original base migration grants a SECURITY DEFINER cleanup function to authenticated.
    // Remove PUBLIC, anon and authenticated execution before the first transaction commits.
    if (filename === selected[0]) {
      const grant = 'grant execute on function public.cleanup_expired_shimadzu_data() to authenticated;'
      if (!sql.includes(grant)) throw new Error('base migration cleanup grant changed; review before staging deployment')
      sql = sql.replace(grant, 'revoke all on function public.cleanup_expired_shimadzu_data() from public, anon, authenticated;')
    }
    sql = sql.replace(/^begin;\s*/i, '').replace(/\s*commit;\s*$/i, '')
    previews.push({ filename, name: `ai_staging_${filename.slice(0, 14)}`, source_sha256: sourceSha256, query: sql })
  }
  console.log('Migration preview (source files and SHA-256, in execution order):')
  for (const item of previews) console.log(`${item.filename} ${item.source_sha256}`)
  console.log('Staging substitution: revoke cleanup function execution from PUBLIC/anon/authenticated in base migration')
  console.log('Excluded: analytics migrations and retention cron migration, which targets a different project URL')
  if (process.env.FLAVOR_RLS_STAGING_APPLY !== 'true') {
    console.log('PREVIEW_ONLY: set FLAVOR_RLS_STAGING_APPLY=true in the ignored staging config only after reviewing this output')
    return
  }

  const applied = []
  for (const item of previews) {
    await management(`projects/${ref}/database/migrations`, {
      method: 'POST', body: JSON.stringify({ name: item.name, query: item.query }),
    }, 180000)
    applied.push(item.filename)
    console.log(`Applied ${item.filename}`)
  }
  const historyAfter = await management(`projects/${ref}/database/migrations`)
  if (!Array.isArray(historyAfter) || previews.some(item => !historyAfter.some(entry => entry?.name === item.name))) {
    throw new Error('migration history does not contain every applied staging migration')
  }
  const after = await query("select (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('profiles', 'shimadzu_jobs', 'shimadzu_job_events') and c.relrowsecurity)::int as rls_tables, (select count(*) from storage.buckets where id in ('shimadzu-results', 'shimadzu-inputs') and public = false)::int as private_buckets, has_function_privilege('authenticated', 'public.cleanup_expired_shimadzu_data()', 'EXECUTE') as authenticated_can_cleanup, has_function_privilege('anon', 'public.cleanup_expired_shimadzu_data()', 'EXECUTE') as anon_can_cleanup")
  if (Number(after.rls_tables) !== 3 || Number(after.private_buckets) !== 2 || after.authenticated_can_cleanup || after.anon_can_cleanup) {
    throw new Error(`post-migration RLS, Storage or cleanup privilege check failed; applied ${applied.length} migration(s), manual review required`)
  }
  console.log('PASS: 3 RLS tables, 2 private buckets, cleanup function inaccessible to anon/authenticated')
}

main().catch(error => {
  console.error(`FAIL: ${String(error.message).slice(0, 220)}`)
  process.exitCode = 1
})
