import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

export const sitovCurrentSchema = new URL('../../schema.sql', import.meta.url)
export const sitovPrerequisites = new URL('../fixtures/sitov-night-current-prerequisites.sql', import.meta.url)
export const sitovBaseline = new URL('../fixtures/sitov-night-current-baseline.sql', import.meta.url)
export const sitovReviewedThrough = 92

/** Read the authoritative runner without executing its production code. */
export async function sitovCurrentPlan() {
 const runner = await readFile(new URL('../../../deploy/vps/migrate-local.py', import.meta.url), 'utf8')
 const names = [...runner.matchAll(/['"]([0-9]{2}_[a-z0-9_]+\.sql)['"]/g)].map(match => match[1])
 const migrations = [...new Set(names)].filter(name => Number(name.slice(0,2)) <= sitovReviewedThrough)
 if (migrations.length !== 92 || new Set(migrations.map(name => Number(name.slice(0,2)))).size !== 92)
  throw new Error('The reviewed 01–92 runner inventory is incomplete')
 const schema = await readFile(sitovCurrentSchema, 'utf8')
 const files = await Promise.all(migrations.map(async name => ({
  name, sha256: createHash('sha256').update(await readFile(new URL(`../../vps/${name}`, import.meta.url))).digest('hex'),
  transaction: name === '08_performance_indexes.sql' ? 'autocommit' : 'separate',
 })))
 return { source: 'supabase/schema.sql (canonical normalized snapshot)', through: sitovReviewedThrough,
  schemaSha256: createHash('sha256').update(schema).digest('hex'), migrations: files,
  sequence: ['synthetic Supabase SQL prerequisites', 'canonical snapshot base',
   'public catalog lookup INSERTs from vps-content.sql', 'canonical snapshot consolidated additions',
   '90 separate transaction', '91 separate transaction', '92 separate transaction',
   'Auth-owned trigger using real business_private.provision_profile()', 'synthetic rights/history baseline'],
  historicalReplay: false, omissions: ['Auth HTTP/JWT verification', 'PostgREST HTTP', 'Storage HTTP/object bytes'],
 }
}

export const sitovId = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
export const sitovUsers = { all: sitovId(101), none: sitovId(102), selected: sitovId(103),
 disabled: sitovId(104), german: sitovId(105), teacher: sitovId(106), outsider: sitovId(107), explicitAll: sitovId(108) }

/** Core normalized functions evaluate actual effective unit rights, not row counts. */
export async function sitovRightsSnapshot(db) {
 const rights = {}
 for (const [name,uid] of Object.entries(sitovUsers)) {
  // Private predicates are deliberately inaccessible to API roles. The owner
  // evaluates them with the learner's auth claims; direct-role RLS is tested separately.
  await db.actor(uid,'postgres',{role:'authenticated'})
  rights[name] = (await db.query(`SELECT u.id,u.level,u.trainer::text,
   trainer_access_private.allowed(u.level,u.trainer::text) AS trainer_allowed,
   learning_private.unit_allowed(u.id) AS unit_allowed
   FROM public.learning_units u WHERE u.label LIKE 'Sitov QA %' ORDER BY u.id`)).rows
 }
 await db.actor(null,'postgres')
 return rights
}

export async function sitovHistorySnapshot(db) {
 await db.actor(null,'postgres')
 const tables=['vocabulary_direction_progress','sitov_learning_checkpoints','sitov_pronunciation_access',
  'learning_activity_days','learning_sessions','submissions']
 const pairs=tables.map(table=>`'${table}',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]')
  FROM public.${table} t WHERE auth_user_id='${sitovUsers.selected}')`)
 pairs.push(`'messages',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id),'[]')
  FROM public.pronunciation_messages t WHERE submission_id='${sitovId(304)}')`)
 pairs.push(`'storage',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id),'[]')
  FROM storage.objects t WHERE id='${sitovId(305)}')`)
 return (await db.query(`SELECT jsonb_build_object(${pairs.join(',')}) snapshot`)).rows[0].snapshot
}
