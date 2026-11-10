// Metadata-only production/Staging comparison. No data rows, credentials or SQL writes.
// Load both ignored private files with Node --env-file; never print token values.
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const ORG = 'wkbburugozvjmhjgwjsz'
const targets = [
  { label: 'production', ref: 'nwcoyhavzbygyqeadcnw', url: process.env.SUPABASE_PROD_URL,
    configuredRef: process.env.SUPABASE_PROD_PROJECT_REF,
    configuredOrg: process.env.SUPABASE_PROD_ORGANIZATION_SLUG,
    token: process.env.SUPABASE_PROD_MANAGEMENT_TOKEN },
  { label: 'staging', ref: 'zwbzyrshzegwlgcaxudo', url: process.env.SUPABASE_STAGING_URL,
    configuredRef: process.env.SUPABASE_STAGING_PROJECT_REF,
    configuredOrg: process.env.SUPABASE_STAGING_ORGANIZATION_SLUG,
    token: process.env.SUPABASE_STAGING_MANAGEMENT_TOKEN },
]
for (const target of targets) {
  if (target.configuredRef !== target.ref || target.url !== `https://${target.ref}.supabase.co` ||
      target.configuredOrg !== ORG || !target.token) {
    throw new Error(`REFUSED: exact ${target.label} project identity and read token required`)
  }
}
if (process.env.SUPABASE_STAGING_ENVIRONMENT !== 'nonproduction') {
  throw new Error('REFUSED: Staging environment marker is missing')
}

async function api(target, pathname, options = {}) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${target.ref}${pathname}`, {
    ...options,
    headers: { Authorization: `Bearer ${target.token}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) throw new Error(`${target.label} metadata HTTP ${response.status}`)
  const body = await response.text()
  return body ? JSON.parse(body) : null
}

async function query(target, sql) {
  if (!/^select\s/i.test(sql)) throw new Error('REFUSED: only fixed SELECT metadata queries are permitted')
  const rows = await api(target, '/database/query', {
    method: 'POST', body: JSON.stringify({ query: sql, read_only: true }),
  })
  if (!Array.isArray(rows)) throw new Error(`${target.label} metadata response shape changed`)
  return rows
}

const queries = {
  tables: "select c.relname as table_name, c.relrowsecurity as rls, c.relforcerowsecurity as force_rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') order by c.relname",
  policies: "select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname in ('public','storage') order by schemaname,tablename,policyname",
  grants: "select table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated','service_role') and table_name in ('profiles','shimadzu_jobs','shimadzu_job_events','ai_pca_jobs') order by table_name,grantee,privilege_type",
  effective_privileges: "select c.relname as table_name,has_table_privilege('anon',c.oid,'SELECT') as anon_select,has_table_privilege('authenticated',c.oid,'SELECT') as authenticated_select,has_table_privilege('authenticated',c.oid,'INSERT') as authenticated_insert,has_table_privilege('authenticated',c.oid,'UPDATE') as authenticated_update,has_table_privilege('service_role',c.oid,'INSERT') as server_insert from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('profiles','shimadzu_jobs','shimadzu_job_events','ai_pca_jobs') order by c.relname",
  cleanup_privileges: "select has_function_privilege('anon','public.cleanup_expired_shimadzu_data()','EXECUTE') as anon_execute,has_function_privilege('authenticated','public.cleanup_expired_shimadzu_data()','EXECUTE') as authenticated_execute,(select prosecdef from pg_proc where oid='public.cleanup_expired_shimadzu_data()'::regprocedure) as security_definer",
  security_functions: "select p.proname,pg_get_functiondef(p.oid) as definition,p.prosecdef as security_definer from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('cleanup_expired_shimadzu_data','is_shimadzu_admin','review_shimadzu_user') order by p.proname",
  columns: "select table_name,column_name,data_type,is_nullable from information_schema.columns where table_schema='public' and table_name in ('profiles','shimadzu_jobs','shimadzu_job_events','ai_pca_jobs') order by table_name,ordinal_position",
  buckets: 'select id,public,file_size_limit,allowed_mime_types from storage.buckets order by id',
  auth_triggers: "select tgname from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal order by tgname",
}

const result = {}
for (const target of targets) {
  const project = await api(target, '')
  if ((project.ref || project.id) !== target.ref || project.organization_slug !== ORG ||
      !String(project.status || '').startsWith('ACTIVE') ||
      (target.label === 'staging' && project.name !== 'FlavorInsightAI-Staging') ||
      (target.label === 'production' && project.name === 'FlavorInsightAI-Staging')) {
    throw new Error(`REFUSED: ${target.label} project metadata mismatch`)
  }
  let migrations = null
  try {
    migrations = await api(target, '/database/migrations')
    if (!Array.isArray(migrations)) throw new Error(`${target.label} migration response shape changed`)
  } catch (error) {
    if (target.label !== 'production' || error.message !== 'production metadata HTTP 403') throw error
    // The scoped PAT can query catalog metadata in read-only mode even when
    // the dedicated migration endpoint is forbidden.
    migrations = await query(target, 'select version,name from supabase_migrations.schema_migrations order by version')
    console.log('production: migration history read from schema_migrations via read-only query')
  }
  result[target.label] = {
    project: { ref: target.ref, name: project.name, organization_slug: project.organization_slug, status: project.status },
    migrations: migrations?.map(item => ({ version: item.version, name: item.name })) || null,
  }
  for (const [name, sql] of Object.entries(queries)) result[target.label][name] = await query(target, sql)
  console.log(`${target.label}: ${result[target.label].migrations?.length ?? 'unavailable'} migrations, ${result[target.label].tables.length} public tables, ${result[target.label].policies.length} policies, ${result[target.label].buckets.length} buckets`)
}

const nameSet = (rows, key) => new Set(rows.map(item => item[key]))
const stageTables = nameSet(result.staging.tables, 'table_name')
const prodTables = nameSet(result.production.tables, 'table_name')
const onlyStaging = [...stageTables].filter(name => !prodTables.has(name)).sort()
const onlyProduction = [...prodTables].filter(name => !stageTables.has(name)).sort()
const differentRls = result.staging.tables.filter(item => prodTables.has(item.table_name) &&
  result.production.tables.find(other => other.table_name === item.table_name).rls !== item.rls).map(item => item.table_name)
const policyId = item => `${item.schemaname}.${item.tablename}.${item.policyname}`
const stagePolicies = new Set(result.staging.policies.map(policyId))
const prodPolicies = new Set(result.production.policies.map(policyId))
result.diff = {
  only_staging_tables: onlyStaging,
  only_production_tables: onlyProduction,
  rls_flag_differences: differentRls,
  only_staging_policies: [...stagePolicies].filter(id => !prodPolicies.has(id)).sort(),
  only_production_policies: [...prodPolicies].filter(id => !stagePolicies.has(id)).sort(),
  staging_pca_table: stageTables.has('ai_pca_jobs'),
  production_pca_table: prodTables.has('ai_pca_jobs'),
}
const output = path.join(ROOT, '_local/verification/ai-pca/prod-readonly-metadata.json')
await mkdir(path.dirname(output), { recursive: true })
await writeFile(output, JSON.stringify(result, null, 2), { mode: 0o600 })
console.log(JSON.stringify({ status: 'READ_ONLY_COMPLETE', diff: result.diff,
  production_name: result.production.project.name,
  production_migration_count: result.production.migrations?.length ?? 'unavailable',
  staging_migration_count: result.staging.migrations.length,
  evidence_path: '_local/verification/ai-pca/prod-readonly-metadata.json' }))
