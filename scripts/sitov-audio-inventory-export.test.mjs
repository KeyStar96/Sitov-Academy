import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'

test('read-only inventory SQL exports author/system metadata but excludes archived, deleted, and other cache objects', async () => {
  const source = readFileSync(new URL('../deploy/vps/export-sitov-audio-catalog.sql', import.meta.url), 'utf8')
  assert.match(source, /BEGIN READ ONLY;/)
  assert.match(source, /ROLLBACK;/)
  const query = source.match(/'storage_audio_inventory', coalesce\(\((SELECT jsonb_agg[\s\S]*?)\), '\[\]'::jsonb\),\s*'counts'/)?.[1]
  assert.ok(query, 'Test the actual exported Storage inventory SELECT')
  const db = new PGlite()
  try {
    await db.exec(`CREATE SCHEMA storage;
      CREATE TABLE storage.objects (bucket_id text, name text, user_metadata jsonb, metadata jsonb, archived_at timestamptz, is_delete_marker boolean);`)
    const name = 'sitov-qwen-v1/de/' + 'a'.repeat(64) + '.mp3'
    const authored = { engine: 'qwen3-tts', wordTimings: [{ start: .35, end: .6 }] }
    const system = { mimetype: 'audio/mpeg', size: 200 }
    for (const row of [
      ['audio_cache', name, null, false],
      ['audio_cache', name + '.archived', '2026-10-03T00:00:00Z', false],
      ['audio_cache', name + '.deleted', null, true],
      ['other_bucket', name, null, false],
      ['audio_cache', 'legacy/de.mp3', null, false],
    ]) await db.query('INSERT INTO storage.objects VALUES ($1,$2,$3,$4,$5,$6)', [row[0], row[1], authored, system, row[2], row[3]])
    await db.exec('BEGIN READ ONLY')
    const result = await db.query(query)
    await db.exec('ROLLBACK')
    assert.deepEqual(result.rows[0].jsonb_agg, [{ bucket_id: 'audio_cache', name, user_metadata: authored, metadata: system, archived_at: null, is_delete_marker: false }])
  } finally {
    await db.close()
  }
})

test('vocabulary export includes prepared chunks before and after migration 74 without leaking the full private row', async () => {
  const source = readFileSync(new URL('../deploy/vps/export-sitov-audio-catalog.sql', import.meta.url), 'utf8')
  const query = source.match(/'learning_vocabulary_cards', coalesce\(\((SELECT jsonb_agg[\s\S]*?)\), '\[\]'::jsonb\),\s*'vocabulary_translations'/)?.[1]
  assert.ok(query, 'Test the actual exported vocabulary SELECT')
  const db = new PGlite()
  try {
    await db.exec(`CREATE TABLE public.learning_vocabulary_cards (
      id uuid PRIMARY KEY, word_de text, article text, plural text, audio_url text,
      sentence_practice boolean, alternative_answers_de jsonb, target_form text[],
      owner_auth_user_id uuid, private_note text);
      INSERT INTO public.learning_vocabulary_cards VALUES (
        '00000000-0000-4000-8000-000000000001', 'Termin', 'der', 'Termine', NULL,
        true, '[]', NULL, '00000000-0000-4000-8000-000000000002', 'private');`)
    const before = (await db.query(query)).rows[0].jsonb_agg
    assert.equal(before[0].chunk_de, null)
    assert.equal(before[0].word_de, 'Termin')
    assert.equal('owner_auth_user_id' in before[0], false)
    assert.equal('private_note' in before[0], false)
    await db.exec("ALTER TABLE public.learning_vocabulary_cards ADD COLUMN chunk_de text; UPDATE public.learning_vocabulary_cards SET chunk_de='einen Termin vereinbaren';")
    await db.exec('BEGIN READ ONLY')
    const after = (await db.query(query)).rows[0].jsonb_agg
    await db.exec('ROLLBACK')
    assert.deepEqual(after, [{ ...before[0], chunk_de: 'einen Termin vereinbaren' }])
  } finally {
    await db.close()
  }
})
