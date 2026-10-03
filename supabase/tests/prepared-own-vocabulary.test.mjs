import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createPhase1Database, actor, student, outsider, result } from './helpers/phase1-db.mjs'

const migration = new URL('../migrations/20261003192958_sitov_prepared_own_vocabulary.sql', import.meta.url)
const fingerprint = '96db5949cf9ba060eb5fbeeec3b472d232d55e0b22dc2512cf65dc53c8c47df5'
const sha = value => createHash('sha256').update(value).digest('hex')
const normalized = text => text.normalize('NFC').trim().replace(/\s+/gu, ' ')
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, entry]) => [key, canonical(entry)])) : value
const pathFor = text => `sitov-qwen-v1/de/${sha(JSON.stringify({ text: normalized(text), voice: 'sitov-qwen-male-de-v1', rate: 'qwen-native-1-lufs-18-aligned-v1', format: 'audio-24khz-48kbitrate-mono-mp3', leadIn: 0.35, profile: fingerprint }))}.mp3`
const metadataFor = text => ({ engine: 'qwen3-tts', voice: 'sitov-qwen-male-de-v1', revision: 'sitov-qwen-base-bf16-v1', profileFingerprint: fingerprint,
  textSha256: sha(normalized(text)), audioSha256: 'a'.repeat(64), wordTimings: normalized(text).split(' ').map((_, index) => ({ start: index + 0.35, end: index + 1 })) })

test('own-word RPC requires prepared canonical Qwen audio and preserves existing learning state', async t => {
  const db = await createPhase1Database()
  const add = (word, article = null, locale = 'ru') => result(db, 'SELECT public.add_own_vocabulary($1,$2,$3,$4,$5) result', ['A1.1', word, article, 'перевод', locale])
  const snapshot = () => db.query('SELECT id,card_id,direction,box_number,next_review_date,last_answered_at FROM public.vocabulary_direction_progress ORDER BY id')
  const fnState = () => db.query("SELECT oid,proname,proacl::text acl,prosecdef FROM pg_proc WHERE oid IN ('public.add_own_vocabulary(text,text,text,text,text)'::regprocedure,'vocabulary_private.add_own_word(text,text,text,text,text)'::regprocedure) ORDER BY oid")
  const put = async (text, changes = {}, rowChanges = {}) => {
    await db.exec('RESET ROLE')
    const path = rowChanges.name ?? pathFor(text)
    await db.query('INSERT INTO storage.objects(bucket_id,name,metadata,user_metadata,archived_at,is_delete_marker) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(bucket_id,name) DO UPDATE SET metadata=excluded.metadata,user_metadata=excluded.user_metadata,archived_at=excluded.archived_at,is_delete_marker=excluded.is_delete_marker',
      ['audio_cache', path, JSON.stringify(rowChanges.metadata ?? { mimetype: 'audio/mpeg', size: 4096 }), JSON.stringify({ ...metadataFor(text), ...changes }), rowChanges.archived_at ?? null, rowChanges.is_delete_marker ?? false])
    await actor(db, student)
    return path
  }
  try {
    const profile = JSON.parse(await readFile(new URL('../../lib/audio/models/sitov-qwen-male-de/config.json', import.meta.url), 'utf8'))
    assert.equal(sha(JSON.stringify(canonical(profile))), fingerprint, 'profile changes require a coordinated guard migration')
    await db.exec("ALTER TABLE storage.objects ADD COLUMN archived_at timestamptz, ADD COLUMN is_delete_marker boolean DEFAULT false; INSERT INTO storage.buckets(id,name,public) VALUES('audio_cache','audio_cache',true);")
    // A pre-existing card and its learned progress must survive the migration.
    await actor(db, student)
    const old = await add('Altwort')
    await result(db, 'SELECT initialize_vocabulary_cards($1) result', [JSON.stringify([{ cardId: old.cardId, alreadyKnown: false }])])
    await db.exec('RESET ROLE')
    await db.query('UPDATE vocabulary_direction_progress SET box_number=3 WHERE card_id=$1', [old.cardId])
    const before = (await snapshot()).rows
    const functionsBefore = (await fnState()).rows
    await db.exec(await readFile(migration, 'utf8'))
    assert.deepEqual((await snapshot()).rows, before)
    assert.deepEqual((await fnState()).rows, functionsBefore, 'original OIDs, signatures, ACLs and security modes are retained')

    await t.test('normalization and canonical path match the TypeScript identity, including Unicode whitespace', async () => {
      for (const text of ['das Brot', '  die Tu\u0308r\n', 'der\u00a0Mann', '\ufeffdas\u202fHaus\u3000', 'die "Tür"', 'C:\\Weg']) {
        const spoken = normalized(text)
        await put(spoken)
        await db.exec('RESET ROLE')
        assert.equal((await db.query('SELECT vocabulary_private.sitov_normalize_audio_text($1) text', [text])).rows[0].text, spoken)
        assert.equal((await db.query('SELECT vocabulary_private.sitov_prepared_german_audio_url($1) url', [text])).rows[0].url, `/supabase/storage/v1/object/public/audio_cache/${pathFor(text)}`)
      }
    })

    await t.test('direct authenticated RPC cannot create a missing-audio word or progress', async () => {
      await actor(db, student)
      const response = await add('Unvorbereitet')
      assert.equal(response.error, 'prepared_audio_required')
      assert.equal(response.sqlstate, '22023')
      await db.exec('RESET ROLE')
      assert.equal((await db.query("SELECT count(*)::int n FROM learning_vocabulary_cards WHERE word_de='Unvorbereitet'")).rows[0].n, 0)
      assert.deepEqual((await snapshot()).rows, before)
    })

    await t.test('malformed, mismatched, archived or deleted-marker audio cannot activate a word', async () => {
      const cases = [
        { engine: 'piper-local' }, { voice: 'female' }, { revision: 'different' }, { profileFingerprint: 'b'.repeat(64) },
        { textSha256: sha('another text') }, { audioSha256: null }, { wordTimings: [] },
        { wordTimings: [{ start: 0.35, end: 1 }] },
        { wordTimings: [{ start: -1, end: 1 }, { start: 1, end: 2 }] },
        { wordTimings: [{ start: 0.35, end: 2 }, { start: 1, end: 3 }] },
        { wordTimings: [{ start: 0.35, end: 1 }, { start: 1, end: 1201 }] },
        { wordTimings: [{ start: '0.35', end: 1 }, { start: 1, end: 2 }] },
      ]
      for (const changes of cases) {
        await put('das Testwort', changes)
        assert.equal((await add('Testwort', 'das')).error, 'prepared_audio_required')
      }
      for (const rowChanges of [{ name: 'sitov-qwen-v1/de/' + 'b'.repeat(64) + '.mp3' }, { archived_at: '2026-10-03T00:00:00Z' }, { is_delete_marker: true }, { metadata: { mimetype: 'audio/wav', size: 4096 } }, { metadata: { mimetype: 'audio/mpeg', size: 0 } }]) {
        await put('das Testwort', { voice: 'invalid' })
        await put('das Testwort', {}, rowChanges)
        assert.equal((await add('Testwort', 'das')).error, 'prepared_audio_required')
      }
      await db.exec('RESET ROLE')
      assert.deepEqual((await snapshot()).rows, before)
    })

    await t.test('prepared audio URL, private card, translation and active progress commit together', async () => {
      const path = await put('das Brot')
      const added = await add('  Brot ', 'das')
      assert.equal(added.activated, true)
      assert.ok(added.cardId)
      await db.exec('RESET ROLE')
      const card = (await db.query('SELECT word_de,article,audio_url FROM public.learning_vocabulary_cards WHERE id=$1', [added.cardId])).rows[0]
      assert.deepEqual(card, { word_de: 'Brot', article: 'das', audio_url: `/supabase/storage/v1/object/public/audio_cache/${path}` })
      assert.deepEqual((await db.query('SELECT direction,box_number FROM vocabulary_direction_progress WHERE card_id=$1 ORDER BY direction', [added.cardId])).rows,
        [{ direction: 'de_to_native', box_number: 1 }, { direction: 'native_to_de', box_number: 1 }])
      assert.deepEqual((await db.query('SELECT locale,translation FROM vocabulary_translations WHERE card_id=$1', [added.cardId])).rows, [{ locale: 'ru', translation: 'перевод' }])
      assert.deepEqual((await snapshot()).rows.filter(row => row.card_id === old.cardId), before)
      await actor(db, student)
      assert.equal((await add('Brot', 'das')).error, 'own_word_exists')
      assert.equal((await add('Brot', 'dem')).error, 'invalid_input')
      assert.equal((await add('Brot', 'das', 'de')).error, 'invalid_language')
    })

    await t.test('actor/access and helper ACLs remain closed before audio lookup', async () => {
      await actor(db, outsider)
      assert.equal((await add('Fremdwort')).error, 'trainer_access_denied')
      await actor(db, null)
      assert.equal((await add('Fremdwort')).error, 'authentication_required')
      await actor(db, student)
      await assert.rejects(db.query('SELECT vocabulary_private.sitov_prepared_german_audio_url($1)', ['das Brot']), /permission denied/)
      await db.exec('RESET ROLE')
      const helpers = (await db.query("SELECT prosecdef,has_function_privilege('authenticated',oid,'EXECUTE') executable FROM pg_proc WHERE pronamespace='vocabulary_private'::regnamespace AND proname LIKE 'sitov_%audio%'")).rows
      assert.equal(helpers.length, 2)
      assert.ok(helpers.every(row => row.prosecdef === false && row.executable === false))
      await db.query("INSERT INTO student_level_access VALUES($1,'A1.1')", [outsider])
      await actor(db, outsider)
      assert.equal((await add('NochFehltAudio')).error, 'prepared_audio_required')
      await db.exec('RESET ROLE')
      assert.equal((await db.query('SELECT count(*)::int n FROM learning_units WHERE owner_auth_user_id=$1', [outsider])).rows[0].n, 0, 'no empty private unit is inserted on a miss')
    })

    await t.test('a broad future Storage policy cannot forge or overwrite prepared audio', async () => {
      await db.exec('RESET ROLE')
      await db.exec("CREATE POLICY sitov_test_broad_storage ON storage.objects FOR ALL TO authenticated USING(true) WITH CHECK(true)")
      await actor(db, student)
      await assert.rejects(db.query('INSERT INTO storage.objects(bucket_id,name,metadata,user_metadata) VALUES($1,$2,$3,$4)',
        ['audio_cache', pathFor('Fälschung'), '{"mimetype":"audio/mpeg","size":4096}', JSON.stringify(metadataFor('Fälschung'))]), /row-level security/)
      assert.deepEqual((await db.query("UPDATE storage.objects SET user_metadata='{}' WHERE bucket_id='audio_cache' RETURNING id")).rows, [])
      assert.deepEqual((await db.query("DELETE FROM storage.objects WHERE bucket_id='audio_cache' RETURNING id")).rows, [])
      await db.exec('RESET ROLE')
      assert.ok((await db.query("SELECT count(*)::int n FROM storage.objects WHERE bucket_id='audio_cache'")).rows[0].n > 0)
    })
  } finally { await db.close() }
})
