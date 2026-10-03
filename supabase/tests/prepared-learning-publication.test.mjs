import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createPhase1Database, actor, id, student, teacher, vocabularyUnit, exerciseUnit, result } from './helpers/phase1-db.mjs'

const prerequisites = new URL('../migrations/20261003192958_sitov_prepared_own_vocabulary.sql', import.meta.url)
const migration = new URL('../migrations/20261003195521_sitov_prepared_learning_publication.sql', import.meta.url)
const fingerprint = '96db5949cf9ba060eb5fbeeec3b472d232d55e0b22dc2512cf65dc53c8c47df5'
const sha = text => createHash('sha256').update(text).digest('hex')
const normalize = text => text.normalize('NFC').trim().replace(/\s+/gu, ' ')
const pathFor = text => `sitov-qwen-v1/de/${sha(JSON.stringify({ text: normalize(text), voice: 'sitov-qwen-male-de-v1', rate: 'qwen-native-1-lufs-18-aligned-v1', format: 'audio-24khz-48kbitrate-mono-mp3', leadIn: 0.35, profile: fingerprint }))}.mp3`
const urlFor = text => `/supabase/storage/v1/object/public/audio_cache/${pathFor(text)}`
const metadataFor = text => ({ engine: 'qwen3-tts', voice: 'sitov-qwen-male-de-v1', revision: 'sitov-qwen-base-bf16-v1', profileFingerprint: fingerprint,
  textSha256: sha(normalize(text)), audioSha256: 'a'.repeat(64), wordTimings: normalize(text).split(' ').map((_, index) => ({ start: index + 0.35, end: index + 1 })) })
const exercise = { topic: 'Verben', type: 'fill_in_blank', content: { text_before: 'Wir ', correct_answer: 'lernen', text_after: ' Deutsch.', target_form: ['lernen'], accepted_answers: ['lernen'] } }

test('direct CMS RPC requires prepared German audio before active publication', async t => {
  const db = await createPhase1Database()
  const oldCard = id(801), oldExercise = id(802)
  const fnState = async () => (await db.query("SELECT oid,proacl::text acl,prosecdef,proconfig FROM pg_proc WHERE oid='public.save_learning_content(text,jsonb,uuid)'::regprocedure")).rows
  const learnerState = async () => ({
    vocabulary: (await db.query('SELECT * FROM vocabulary_direction_progress ORDER BY id')).rows,
    grammar: (await db.query('SELECT * FROM user_exercise_progress ORDER BY id')).rows,
  })
  const contentState = async () => ({
    units: (await db.query('SELECT * FROM learning_units ORDER BY id')).rows,
    vocabulary: (await db.query('SELECT * FROM learning_vocabulary_cards ORDER BY id')).rows,
    translations: (await db.query('SELECT * FROM vocabulary_translations ORDER BY card_id,locale')).rows,
    exercises: (await db.query('SELECT * FROM learning_exercises ORDER BY id')).rows,
    grammarTranslations: (await db.query('SELECT * FROM grammar_translations ORDER BY exercise_id,locale')).rows,
    reading: (await db.query('SELECT * FROM learning_reading_texts ORDER BY id')).rows,
  })
  const save = (trainer, fields, { target = null, label = `CMS ${trainer}`, active, translations = [] } = {}) => result(db,
    'SELECT public.save_learning_content($1,$2,$3) result', [trainer, JSON.stringify({ unit: { level: 'A1.1', label, ...(active === undefined ? {} : { is_active: active }) }, fields, translations }), target])
  const put = async (text, changes = {}, objectChanges = {}) => {
    await db.exec('RESET ROLE')
    await db.query('INSERT INTO storage.objects(bucket_id,name,metadata,user_metadata,archived_at,is_delete_marker) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(bucket_id,name) DO UPDATE SET metadata=excluded.metadata,user_metadata=excluded.user_metadata,archived_at=excluded.archived_at,is_delete_marker=excluded.is_delete_marker',
      ['audio_cache', pathFor(text), JSON.stringify(objectChanges.metadata ?? { mimetype: 'audio/mpeg', size: 4096 }), JSON.stringify({ ...metadataFor(text), ...changes }), objectChanges.archived_at ?? null, objectChanges.is_delete_marker ?? false])
    await actor(db, teacher)
  }
  try {
    await db.exec("ALTER TABLE storage.objects ADD COLUMN archived_at timestamptz, ADD COLUMN is_delete_marker boolean DEFAULT false; INSERT INTO storage.buckets(id,name,public) VALUES('audio_cache','audio_cache',true)")
    await db.query("INSERT INTO learning_vocabulary_cards(id,unit_id,word_de,article,audio_url) VALUES($1,$2,'Brot','das','https://recordings.example.test/teacher.mp3')", [oldCard, vocabularyUnit])
    await db.query("INSERT INTO vocabulary_translations(card_id,locale,translation) VALUES($1,'ru','хлеб')", [oldCard])
    await db.query("INSERT INTO learning_exercises(id,unit_id,topic,type,content,solution_audio_url) VALUES($1,$2,$3,$4,$5,'https://recordings.example.test/grammar.mp3')", [oldExercise, exerciseUnit, exercise.topic, exercise.type, JSON.stringify(exercise.content)])
    await actor(db, student)
    await result(db, 'SELECT initialize_vocabulary_cards($1) result', [JSON.stringify([{ cardId: oldCard, alreadyKnown: false }])])
    assert.equal((await result(db, 'SELECT record_grammar_attempt($1,$2,false) result', [oldExercise, 'lernen'])).status, 'EXACT')
    await db.exec('RESET ROLE')
    const functionsBefore = await fnState(), progressBefore = await learnerState(), contentBefore = await contentState()
    await db.exec(await readFile(prerequisites, 'utf8'))
    const migrationSql = await readFile(migration, 'utf8')
    await db.exec(migrationSql)
    assert.deepEqual(await fnState(), functionsBefore, 'same RPC OID, ACL, invoker mode and empty search path')
    assert.deepEqual(await learnerState(), progressBefore)
    assert.deepEqual(await contentState(), contentBefore, 'migration changes no authored content')

    await t.test('SQL extraction covers exact UI speech, first replacement, Unicode and exact German contexts', async () => {
      await db.exec('RESET ROLE')
      const vectors = [
        ['vocabulary', { word_de: ' Tu\u0308r ', article: 'die', plural: 'Türen', target_form: ['Akkusativ'] }, [{ locale: 'de', context_sentence: 'Die\u00a0Tür ist offen.' }, { locale: 'en', context_sentence: 'The door is open.' }], ['die Tür', 'Die Tür ist offen.']],
        ['vocabulary', { word_de: ' Straße\n', article: null }, [], ['Straße']],
        ['exercises', exercise, [], ['lernen', 'Wir lernen Deutsch.']],
        ['exercises', { type: 'multiple_choice', content: { question: 'Das ist ___ Tisch. ___', correct_answer: 'ein' } }, [], ['Das ist ein Tisch. ___']],
        ['exercises', { type: 'multiple_choice', content: { question: 'Wie heißt du?', correct_answer: 'Ich heiße Jan.' } }, [], ['Wie heißt du? Ich heiße Jan.']],
        ['exercises', { type: 'sentence_building', content: { correct_answer: 'Ich komme aus Berlin.' } }, [], ['Ich komme aus Berlin.']],
        ['pronunciation', { sentence_de: '\ufeffÄpfel\n sind süß. ' }, [], ['Äpfel sind süß.']],
        ['videos', { title: 'Ein Video' }, [], []],
      ]
      for (const [trainer, fields, translations, expected] of vectors) {
        const actual = (await db.query('SELECT learning_private.sitov_learning_audio_texts($1,$2,$3) texts', [trainer, JSON.stringify(fields), JSON.stringify(translations)])).rows[0].texts
        assert.deepEqual([...actual].sort(), [...expected].sort())
      }
    })

    await t.test('all active German trainers reject direct missing-audio writes atomically', async () => {
      for (const [trainer, fields] of [
        ['vocabulary', { word_de: 'Unvorbereitet', article: 'das' }],
        ['exercises', exercise],
        ['pronunciation', { sentence_de: 'Eine neue Aussprache.', focus: 'Lesen' }],
      ]) {
        await actor(db, teacher)
        const response = await save(trainer, fields, { label: 'Must roll back' })
        assert.deepEqual(Object.keys(response).sort(), ['error', 'message'])
        assert.equal(response.error, 'prepared_audio_required')
        await db.exec('RESET ROLE')
        assert.deepEqual(await contentState(), contentBefore)
        assert.deepEqual(await learnerState(), progressBefore)
      }
    })

    await t.test('missing sentence/context proof blocks publication even when the headword/answer is ready', async () => {
      await put('das Wort')
      assert.equal((await save('vocabulary', { word_de: 'Wort', article: 'das' }, { translations: [{ locale: 'de', context_sentence: 'Ein neuer deutscher Kontext.' }, { locale: 'en', context_sentence: 'An English context.' }] })).error, 'prepared_audio_required')
      await put('lernen')
      assert.equal((await save('exercises', exercise)).error, 'prepared_audio_required')
      await put('Wir lernen Deutsch.')
      const saved = await save('exercises', exercise)
      assert.ok(saved.id)
      // Interface-language translations have no effect on German identity.
      await put('Ein neuer deutscher Kontext.')
      assert.ok((await save('vocabulary', { word_de: 'Wort', article: 'das' }, { translations: [{ locale: 'de', context_sentence: 'Ein neuer deutscher Kontext.' }, { locale: 'tr', context_sentence: 'Türkçe örnek.' }] })).id)
      const fields = { topic: 'Fragen', type: 'multiple_choice', content: { question: 'Wie heißt du?', correct_answer: 'Ich heiße Jan.', options: ['Ich heiße Jan.', 'Ich wohne in Berlin.'], target_form: ['Ich heiße Jan.'], accepted_answers: ['Ich heiße Jan.'] } }
      await put('Wie heißt du? Ich heiße Jan.')
      const multipleChoice = await save('exercises', fields)
      assert.ok(multipleChoice.id, `multiple-choice requires exactly its single joined UI utterance: ${JSON.stringify(multipleChoice)}`)
    })

    await t.test('male profile, exact text, complete timings and live Storage metadata are mandatory', async () => {
      for (const changes of [{ engine: 'piper-local' }, { voice: 'female' }, { profileFingerprint: 'b'.repeat(64) }, { textSha256: sha('Different') }, { wordTimings: [] }, { wordTimings: [{ start: 0.35, end: 1 }] }]) {
        await put('Guten Tag.', changes)
        assert.equal((await save('pronunciation', { sentence_de: 'Guten Tag.', focus: 'Lesen' })).error, 'prepared_audio_required')
      }
      for (const objectChanges of [{ metadata: { mimetype: 'audio/wav', size: 4096 } }, { metadata: { mimetype: 'audio/mpeg', size: 0 } }, { archived_at: '2026-10-03T00:00:00Z' }, { is_delete_marker: true }]) {
        await put('Guten Tag.', {}, objectChanges)
        assert.equal((await save('pronunciation', { sentence_de: 'Guten Tag.', focus: 'Lesen' })).error, 'prepared_audio_required')
      }
      await put('Guten Tag.')
      assert.ok((await save('pronunciation', { sentence_de: 'Guten Tag.', focus: 'Lesen' })).id)
    })

    await t.test('inactive drafts stay possible and a false payload flag cannot bypass an active shared unit', async () => {
      for (const [trainer, fields] of [
        ['vocabulary', { word_de: 'Entwurfswort', article: null }],
        ['exercises', { ...exercise, content: { ...exercise.content, correct_answer: 'sprechen', target_form: ['sprechen'], accepted_answers: ['sprechen'] } }],
        ['pronunciation', { sentence_de: 'Noch nicht vorbereiteter Entwurf.', focus: 'Lesen' }],
      ]) {
        await actor(db, teacher)
        const draft = await save(trainer, fields, { label: `Draft ${trainer}`, active: false })
        assert.ok(draft.id, `${trainer}: ${JSON.stringify(draft)}`)
        await db.exec('RESET ROLE')
        assert.equal((await db.query('SELECT is_active FROM learning_units WHERE label=$1', [`Draft ${trainer}`])).rows[0].is_active, false)
        if (trainer === 'pronunciation') {
          await actor(db, teacher)
          assert.equal((await save(trainer, fields, { target: draft.id, label: `Draft ${trainer}`, active: true })).error, 'prepared_audio_required')
          await db.exec('RESET ROLE')
          assert.equal((await db.query('SELECT is_active FROM learning_units WHERE label=$1', [`Draft ${trainer}`])).rows[0].is_active, false)
          await put(fields.sentence_de)
          assert.deepEqual(await save(trainer, fields, { target: draft.id, label: `Draft ${trainer}`, active: true }), { id: draft.id })
        }
      }
      await actor(db, teacher)
      assert.equal((await save('vocabulary', { word_de: 'Bypasswort', article: null }, { label: 'Lektion 1', active: false })).error, 'prepared_audio_required')
      assert.equal((await save('exercises', { ...exercise, content: { ...exercise.content, correct_answer: 'reisen', target_form: ['reisen'], accepted_answers: ['reisen'] } }, { label: 'Lektion 1', active: false })).error, 'prepared_audio_required')
      await db.exec('RESET ROLE')
      assert.equal((await db.query('SELECT is_active FROM learning_units WHERE id=$1', [vocabularyUnit])).rows[0].is_active, true)
    })

    await t.test('partial updates require merged spoken fields and preserve IDs, recordings and old progress', async () => {
      await put('das Brot')
      assert.deepEqual(await save('vocabulary', { plural: 'Brote' }, { target: oldCard, label: 'Lektion 1', translations: [{ locale: 'ru', translation: 'хлеб' }] }), { id: oldCard })
      await put('Wir lernen heute Deutsch.')
      const updated = { ...exercise.content, text_after: ' heute Deutsch.' }
      assert.deepEqual(await save('exercises', { content: updated }, { target: oldExercise, label: 'Lektion 1' }), { id: oldExercise })
      await db.exec('RESET ROLE')
      assert.equal((await db.query('SELECT audio_url FROM learning_vocabulary_cards WHERE id=$1', [oldCard])).rows[0].audio_url, 'https://recordings.example.test/teacher.mp3')
      assert.equal((await db.query('SELECT solution_audio_url FROM learning_exercises WHERE id=$1', [oldExercise])).rows[0].solution_audio_url, 'https://recordings.example.test/grammar.mp3')
      assert.deepEqual(await learnerState(), progressBefore)
      await actor(db, teacher)
      const missing = { ...updated, text_after: ' ohne vorbereitetes Audio.' }
      assert.equal((await save('exercises', { content: missing }, { target: oldExercise, label: 'Other unit' })).error, 'prepared_audio_required')
      await db.exec('RESET ROLE')
      assert.deepEqual((await db.query('SELECT unit_id,content FROM learning_exercises WHERE id=$1', [oldExercise])).rows[0], { unit_id: exerciseUnit, content: updated })
      assert.deepEqual(await learnerState(), progressBefore)
      assert.equal((await db.query("SELECT count(*)::int n FROM learning_units WHERE label='Other unit'")).rows[0].n, 0)
    })

    await t.test('new and changed active rows atomically link their exact audio, while teacher URLs survive text changes', async () => {
      const cases = [
        { trainer: 'vocabulary', table: 'learning_vocabulary_cards', column: 'audio_url',
          fields: { word_de: 'Tür', article: 'die' }, texts: ['die Tür'], spoken: 'die Tür',
          update: { word_de: 'Haus', article: 'das' }, updatedTexts: ['das Haus'], updatedSpoken: 'das Haus' },
        { trainer: 'pronunciation', table: 'learning_reading_texts', column: 'audio_url',
          fields: { sentence_de: 'Ich lese laut.', focus: 'Lesen' }, texts: ['Ich lese laut.'], spoken: 'Ich lese laut.',
          update: { sentence_de: 'Ich spreche ruhig.' }, updatedTexts: ['Ich spreche ruhig.'], updatedSpoken: 'Ich spreche ruhig.' },
        { trainer: 'exercises', table: 'learning_exercises', column: 'solution_audio_url',
          fields: exercise, texts: ['lernen', 'Wir lernen Deutsch.'], spoken: 'lernen',
          update: { content: { ...exercise.content, correct_answer: 'arbeiten', text_after: ' heute.', target_form: ['arbeiten'], accepted_answers: ['arbeiten'] } },
          updatedTexts: ['arbeiten', 'Wir arbeiten heute.'], updatedSpoken: 'arbeiten' },
        { trainer: 'exercises', table: 'learning_exercises', column: 'solution_audio_url',
          fields: { topic: 'Fragen', type: 'multiple_choice', content: { question: 'Wo ist ___?', correct_answer: 'der Tisch', options: ['der Tisch', 'die Tür'], target_form: ['der Tisch'], accepted_answers: ['der Tisch'] } },
          texts: ['Wo ist der Tisch?'], spoken: 'Wo ist der Tisch?',
          update: { content: { question: 'Wie heißt du?', correct_answer: 'Ich heiße Jan.', options: ['Ich heiße Jan.', 'Ich wohne in Berlin.'], target_form: ['Ich heiße Jan.'], accepted_answers: ['Ich heiße Jan.'] } },
          updatedTexts: ['Wie heißt du? Ich heiße Jan.'], updatedSpoken: 'Wie heißt du? Ich heiße Jan.' },
      ]
      for (const [index, value] of cases.entries()) {
        const label = `Atomic Audio ${index}`
        const read = async savedId => (await db.query(`SELECT id,unit_id,${value.column} audio_url FROM public.${value.table} WHERE id=$1`, [savedId])).rows[0]
        for (const text of value.texts) await put(text)
        const saved = await save(value.trainer, { ...value.fields, [value.column]: null }, { label })
        assert.ok(saved.id, JSON.stringify(saved))
        const initial = await read(saved.id)
        assert.equal(initial.audio_url, urlFor(value.spoken), `${value.trainer}: new row has the exact played source`)
        for (const text of value.updatedTexts) await put(text)
        assert.deepEqual(await save(value.trainer, value.update, { target: saved.id, label }), { id: saved.id })
        assert.deepEqual(await read(saved.id), { ...initial, audio_url: urlFor(value.updatedSpoken) }, 'omitted URL refreshes the inherited generated reference without changing identity/unit')
        const legacyUrl = '/supabase/storage/v1/object/public/audio_cache/piper-local-v9/de/legacy.mp3'
        assert.deepEqual(await save(value.trainer, { [value.column]: legacyUrl }, { target: saved.id, label }), { id: saved.id })
        assert.equal((await read(saved.id)).audio_url, urlFor(value.updatedSpoken), 'an explicitly supplied old Piper cache URL is repaired')

        const teacherUrl = `https://recordings.example.test/teacher-${index}.mp3`
        assert.deepEqual(await save(value.trainer, { [value.column]: teacherUrl }, { target: saved.id, label }), { id: saved.id })
        assert.deepEqual(await save(value.trainer, value.fields, { target: saved.id, label }), { id: saved.id })
        assert.equal((await read(saved.id)).audio_url, teacherUrl, 'actual external teacher recording remains after a text change')
        assert.deepEqual(await save(value.trainer, { [value.column]: '' }, { target: saved.id, label }), { id: saved.id })
        assert.equal((await read(saved.id)).audio_url, urlFor(value.spoken), 'explicit empty URL is repaired in the same save')
      }
      await db.exec('RESET ROLE')
      assert.deepEqual(await learnerState(), progressBefore)
    })

    await t.test('proof uses the stored text/context/unit and ignores forged payload sources', async () => {
      const text = 'der Zustand', context = 'Der Zustand ist neu.'
      await put(text); await put(context)
      const saved = await save('vocabulary', { word_de: 'Zustand', article: 'der' }, {
        label: 'Authoritative audio source', translations: [{ locale: 'de', context_sentence: context }],
      })
      assert.ok(saved.id)
      const unit = (await db.query('SELECT unit_id FROM learning_vocabulary_cards WHERE id=$1', [saved.id])).rows[0].unit_id
      const misleading = { id: saved.id, word_de: 'Unprepared fake source', audio_url: 'https://recordings.example.test/forged.mp3' }
      await db.query('SELECT learning_private.sitov_require_prepared_learning_audio($1,$2,$3,$4)', ['vocabulary', JSON.stringify(misleading), '[{"locale":"de","context_sentence":"Also fake"}]', unit])
      assert.equal((await db.query('SELECT audio_url FROM learning_vocabulary_cards WHERE id=$1', [saved.id])).rows[0].audio_url, urlFor(text))
      await assert.rejects(db.query('SELECT learning_private.sitov_require_prepared_learning_audio($1,$2,$3,$4)', ['vocabulary', JSON.stringify(misleading), '[]', exerciseUnit]), error => error.code === '23514' && error.message === 'Content unavailable')
      await db.exec('RESET ROLE')
      await db.query('DELETE FROM storage.objects WHERE bucket_id=$1 AND name=$2', ['audio_cache', pathFor(context)])
      const before = await contentState()
      await actor(db, teacher)
      await assert.rejects(db.query('SELECT learning_private.sitov_require_prepared_learning_audio($1,$2,$3,$4)', ['vocabulary', JSON.stringify({ id: saved.id, word_de: 'Brot', article: 'das' }), '[]', unit]), error => error.code === '22023' && error.message === 'prepared_audio_required')
      assert.equal((await save('vocabulary', { word_de: 'Brot', article: 'das', audio_url: null }, { target: saved.id, label: 'Authoritative audio source', translations: [{ locale: 'de', context_sentence: context }] })).error, 'prepared_audio_required')
      await db.exec('RESET ROLE')
      assert.deepEqual(await contentState(), before, 'failed publication retains old text, audio URL, translations and identity')
      assert.deepEqual(await learnerState(), progressBefore)
    })

    await t.test('staff authorization precedes lookup and cannot be bypassed with a JWT role claim', async () => {
      await actor(db, student)
      await db.query("SELECT set_config('request.jwt.claim.role','service_role',false)")
      assert.equal((await save('pronunciation', { sentence_de: 'Unprepared', focus: 'Lesen' })).error, 'not_authorized')
      await assert.rejects(db.query('SELECT learning_private.sitov_require_prepared_learning_audio($1,$2,$3,$4)', ['vocabulary', '{}', '[]', vocabularyUnit]), error => error.code === '42501' && error.message === 'Staff required')
      await assert.rejects(db.query('SELECT learning_private.sitov_learning_audio_texts($1,$2,$3)', ['vocabulary', '{}', '[]']), /permission denied/)
      await assert.rejects(db.query('SELECT vocabulary_private.sitov_prepared_german_audio_url($1)', ['das Brot']), /permission denied/)
      await actor(db, null, 'service_role')
      assert.equal((await save('pronunciation', { sentence_de: 'Still unprepared.', focus: 'Lesen' })).error, 'prepared_audio_required', 'trusted imports also require proof')
      await actor(db, null, 'anon')
      await assert.rejects(save('pronunciation', { sentence_de: 'Unprepared', focus: 'Lesen' }), /permission denied/)
      await db.exec('RESET ROLE')
      const helpers = (await db.query("SELECT proname,prosecdef,proconfig,has_function_privilege('authenticated',oid,'EXECUTE') authenticated,has_function_privilege('anon',oid,'EXECUTE') anon FROM pg_proc WHERE pronamespace='learning_private'::regnamespace AND proname LIKE 'sitov_%' ORDER BY proname")).rows
      assert.equal(helpers.length, 2)
      assert.ok(helpers.every(row => row.anon === false && row.proconfig.includes('search_path=""')))
      assert.equal(helpers.find(row => row.proname === 'sitov_learning_audio_texts').authenticated, false)
      assert.equal(helpers.find(row => row.proname === 'sitov_require_prepared_learning_audio').prosecdef, true)
    })

    await t.test('content-quality errors and video behavior retain their prior contracts', async () => {
      await actor(db, teacher)
      const invalid = { ...exercise, content: { ...exercise.content, target_form: [] } }
      assert.equal((await save('exercises', invalid)).error, 'target_form_required')
      assert.equal((await save('pronunciation', { sentence_de: 'İstanbul', focus: 'Lesen' })).error, 'german_text_required')
      const saved = await save('videos', { title: 'Lehrervideo', source_url: 'https://video.example.test/lesson', description: 'Unterricht' })
      assert.ok(saved.id, 'video publication has no synthetic German utterance')
      await db.exec('RESET ROLE')
      assert.deepEqual(await learnerState(), progressBefore)
    })

    await t.test('replay retains function definitions, ACLs, content and progress', async () => {
      await db.exec('RESET ROLE')
      const functions = await fnState(), definition = (await db.query("SELECT pg_get_functiondef('public.save_learning_content(text,jsonb,uuid)'::regprocedure) definition")).rows[0].definition
      const contents = await contentState(), progress = await learnerState()
      await db.exec(migrationSql)
      assert.deepEqual(await fnState(), functions)
      assert.equal((await db.query("SELECT pg_get_functiondef('public.save_learning_content(text,jsonb,uuid)'::regprocedure) definition")).rows[0].definition, definition)
      assert.deepEqual(await contentState(), contents)
      assert.deepEqual(await learnerState(), progress)
    })
  } finally { await db.close() }
})
