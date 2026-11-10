// Apply only the reviewed PCA schema to the exact nonproduction Supabase project.
// Load the ignored private environment with Node --env-file; never print secrets.
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const REF = 'zwbzyrshzegwlgcaxudo'
const ORG = 'wkbburugozvjmhjgwjsz'
const SHA256 = '36873E47D15FB0BB5179FFF22A9732AA9F1C19A91F8F34889269081004D22174'
const NAME = 'ai_pca_jobs_20261110090000'
const token = process.env.SUPABASE_STAGING_MANAGEMENT_TOKEN
const url = process.env.SUPABASE_STAGING_URL
const configuredRef = process.env.SUPABASE_STAGING_PROJECT_REF
if (!token || url !== `https://${REF}.supabase.co` || configuredRef !== REF ||
    process.env.SUPABASE_STAGING_ORGANIZATION_SLUG !== ORG ||
    process.env.SUPABASE_STAGING_ENVIRONMENT !== 'nonproduction') {
  throw new Error('REFUSED: exact Staging identity and private management token are required')
}

async function api(path, options = {}) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${REF}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(options.method === 'POST' ? 180000 : 15000),
  })
  if (!response.ok) throw new Error(`Staging management request failed: HTTP ${response.status}`)
  const body = await response.text()
  return body ? JSON.parse(body) : null
}

async function query(sql) {
  const rows = await api('/database/query', {
    method: 'POST', body: JSON.stringify({ query: sql, read_only: true }),
  })
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error('Unexpected metadata response')
  return rows[0]
}

const project = await api('')
if ((project.ref || project.id) !== REF || project.name !== 'FlavorInsightAI-Staging' ||
    project.organization_slug !== ORG || !project.organization_id ||
    !String(project.status || '').startsWith('ACTIVE')) {
  throw new Error('REFUSED: Staging project identity mismatch')
}
console.log('Verified exact Staging ref, name, organization and active status')

const sql = await readFile(new URL('../../supabase/migrations/20261110090000_ai_pca_jobs.sql', import.meta.url), 'utf8')
const actual = createHash('sha256').update(sql).digest('hex').toUpperCase()
if (actual !== SHA256) throw new Error('REFUSED: reviewed SQL SHA-256 changed')
const before = await query("select to_regclass('public.ai_pca_jobs') is not null as exists, to_regclass('public.profiles') is not null as profiles_exists")
const history = await api('/database/migrations')
if (!Array.isArray(history)) throw new Error('Unexpected migration history')
if (history.some(item => item.name === NAME)) {
  if (!before.exists) throw new Error('Migration recorded but table absent')
  console.log('Already applied; read-back verification follows')
} else {
  if (before.exists || !before.profiles_exists) throw new Error('REFUSED: target table exists or profiles dependency missing')
  // Supabase migrations run in their own transaction. Remove only the reviewed
  // transaction wrapper and leading comments; the DDL body is unchanged.
  const body = sql.replace(/^(?:[ \t]*--[^\r\n]*(?:\r?\n|$)|[ \t]*\r?\n)*/, '')
    .replace(/^begin;\s*/i, '').replace(/\s*commit;\s*$/i, '')
  if (body === sql || !body.includes('create table public.ai_pca_jobs')) throw new Error('Unexpected SQL wrapper')
  await api('/database/migrations', { method: 'POST', body: JSON.stringify({ name: NAME, query: body }) })
  console.log(`Applied reviewed PCA migration ${NAME}; SHA-256 ${SHA256}`)
}

const after = await query("select c.relrowsecurity as rls, (select count(*) from pg_policies where schemaname='public' and tablename='ai_pca_jobs' and policyname='ai_pca_jobs_owner_select')::int as owner_policies, has_table_privilege('authenticated','public.ai_pca_jobs','SELECT') as authenticated_select, has_table_privilege('authenticated','public.ai_pca_jobs','INSERT') as authenticated_insert, has_table_privilege('anon','public.ai_pca_jobs','SELECT') as anon_select, has_table_privilege('service_role','public.ai_pca_jobs','INSERT') as server_insert from pg_class c where c.oid='public.ai_pca_jobs'::regclass")
if (!after.rls || Number(after.owner_policies) !== 1 || !after.authenticated_select ||
    after.authenticated_insert || after.anon_select || !after.server_insert) {
  throw new Error('Post-migration RLS or grant verification failed')
}
console.log('Verified RLS enabled, owner SELECT policy, authenticated read-only, anon denied and server insert grant')
