import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = name => readFile(new URL(name, import.meta.url), 'utf8')
const [migration, canonical, rollback, runner] = await Promise.all([
  read('../vps/122_sitov_learner_read_performance.sql'), read('../migrations/20261010213000_sitov_learner_read_performance.sql'),
  read('../vps/rollback/122_sitov_learner_read_performance.sql'), read('../../deploy/vps/migrate-local.py'),
])

// Equal results for every account are measured on a production copy (see the Obsidian note of
// 2026-10-10); this test keeps the deployed text, its registration and its way back together.
test('122 is deployed as authored and registered after 121', () => {
  assert.equal(migration, canonical)
  assert.match(runner, /121_sitov_pretest_publication_marks\.sql'\)\nORDER\.append\('122_sitov_learner_read_performance\.sql'\)/)
})

test('122 replaces per-item rules by sets without leaving a per-row verb check in its reports', () => {
  assert.match(migration, /ALTER POLICY sitov_verb_catalog_read ON public\.sitov_verb_catalog\n USING\(id IN\(SELECT sitov_access_private\.sitov_verb_scope_ids\(\(SELECT auth\.uid\(\)\)\)\)\);/)
  for (const contract of ['sitov_last_active_level_contract_changed', 'sitov_learning_progress_contract_changed', 'sitov_pronunciation_evidence_contract_changed'])
    assert.equal(migration.split(contract).length - 1, 1, contract)
  // Only authenticated callers may ask for a scope, and only their own unless they are staff.
  assert.match(migration, /REVOKE ALL ON FUNCTION sitov_access_private\.sitov_verb_scope_ids\(uuid\) FROM PUBLIC,anon;/)
  assert.match(migration, /WHERE p\.id=p_student AND sitov_access_private\.actor_allowed\(p_student\)/)
  // The level counter must keep the caller's row policies: no definer rights.
  const counts = migration.slice(migration.indexOf('FUNCTION public.get_sitov_vocabulary_level_counts()'), migration.indexOf('REVOKE ALL ON FUNCTION public.get_sitov_vocabulary_level_counts()'))
  assert.doesNotMatch(counts, /SECURITY DEFINER/)
})

test('the rollback names every object 122 changes or creates', () => {
  for (const name of ['sitov_verb_private.level_allowed(', 'sitov_access_private.sitov_vocabulary_visible_unit_ids(', 'sitov_pronunciation_private.pretest_catalog(', 'public.get_learning_path('])
    assert.ok(rollback.includes(`CREATE OR REPLACE FUNCTION ${name}`), name)
  for (const name of ['public.get_last_active_level()', 'public.get_learning_progress(uuid,text,integer)', 'sitov_pronunciation_private.evidence(uuid)'])
    assert.ok(rollback.includes(`pg_get_functiondef('${name}'::regprocedure)`), name)
  for (const drop of ['DROP FUNCTION IF EXISTS public.get_sitov_vocabulary_level_counts()', 'DROP FUNCTION IF EXISTS sitov_verb_private.sitov_allowed_levels(uuid)',
    'DROP FUNCTION IF EXISTS sitov_access_private.sitov_verb_scope_ids(uuid)', 'DROP INDEX IF EXISTS public.sitov_verb_challenge_latest_idx',
    'DROP INDEX IF EXISTS sitov_pronunciation_private.sitov_pretest_attempt_latest_idx'])
    assert.ok(rollback.includes(drop), drop)
  assert.match(rollback, /USING\(sitov_verb_private\.verb_allowed\(\(SELECT auth\.uid\(\)\),id\)\)/)
})
