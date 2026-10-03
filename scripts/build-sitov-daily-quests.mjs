import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { sitovQuestSettings } from './lib/sitov-daily-quest-settings.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
export const sitovQuestLevels = ['A1', 'A2', 'B1', 'B2']
const hash = value => createHash('sha256').update(value).digest('hex')
const sentence = pieces => pieces.join(' ').replace(/\s+([,.;:!?])/g, '$1')
const quote = value => `'${value.replaceAll("'", "''")}'`
const json = value => `${quote(JSON.stringify(value))}::jsonb`
const textCheck = (value, max, label) => assert(typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= max, label)

export async function loadSitovQuestCatalog() {
  const entries = []
  for (const level of sitovQuestLevels) {
    const rows = JSON.parse(await readFile(`${root}content/daily-quests/sitov-${level.toLowerCase()}.json`, 'utf8'))
    assert.equal(rows.length, 100, `${level}: exactly 100 authored journeys required`)
    const keys = new Set(), sentences = new Set(), settings = new Map()
    for (const row of rows) {
      assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug), `${level}: invalid slug`)
      assert(!keys.has(row.slug), `${level}: duplicate slug ${row.slug}`); keys.add(row.slug)
      assert(sitovQuestSettings[row.setting], `${level}/${row.slug}: invalid setting`)
      settings.set(row.setting, (settings.get(row.setting) ?? 0) + 1)
      for (const field of ['title', 'goal', 'intro', 'question', 'explanation', 'focus']) textCheck(row[field], field === 'title' ? 120 : 500, `${level}/${row.slug}: ${field}`)
      assert.equal(row.words.length, 3); assert.equal(row.options.length, 3)
      assert.equal(new Set(row.words).size, 3); assert.equal(new Set(row.options).size, 3)
      for (const value of [...row.words, ...row.options]) textCheck(value, 500, `${level}/${row.slug}: text`)
      assert(/^(der|die|das) \S/.test(row.words[0]), `${level}/${row.slug}: singular noun fallback required`)
      assert(row.pieces.length >= 2 && row.pieces.length <= 20, `${level}/${row.slug}: 2–20 sentence pieces`)
      row.pieces.forEach(value => textCheck(value, 500, `${level}/${row.slug}: piece`))
      assert((row.alternativeOrders ?? []).length <= 11)
      for (const order of row.alternativeOrders ?? []) {
        assert.equal(order.length, row.pieces.length)
        assert.deepEqual([...order].sort((a,b) => a-b), row.pieces.map((_,index) => index), `${level}/${row.slug}: alternate order must use every piece once`)
      }
      assert(!sentences.has(sentence(row.pieces)), `${level}: duplicate sentence ${row.slug}`); sentences.add(sentence(row.pieces))
      assert(!JSON.stringify(row).includes('{{'), `${level}/${row.slug}: unreviewed placeholder`)
    }
    for (const setting of Object.keys(sitovQuestSettings)) assert.equal(settings.get(setting), 5, `${level}: five situations in ${setting}`)
    // Five rounds through all twenty settings keep consecutive days varied.
    const bySetting = Object.keys(sitovQuestSettings).map(setting => rows.filter(row => row.setting === setting))
    for (let round = 0; round < 5; round++) for (let place = 0; place < bySetting.length; place++) {
      entries.push(buildSitovQuest(level, bySetting[place][round], round * 20 + place + 1))
    }
  }
  return entries
}

export function buildSitovQuest(level, row, day) {
  const key = `sitov-${level.toLowerCase()}-${row.slug}`
  assert(key.length <= 120)
  const [location, host, imageAlt] = sitovQuestSettings[row.setting]
  const [article, ...noun] = row.words[0].split(' ')
  const word = noun.join(' ')
  assert(word.length <= 160, `${key}: fallback noun too long`)
  // Only the discovery noun is personalized. A template-specific reviewed
  // lexicon prevents a different noun from changing the scene or its grammar.
  const category = `sitov-${level.toLowerCase()}-${hash(key).slice(0, 16)}`
  const forms = { category, word, article, nominative: row.words[0], accusative: `${{ der: 'einen', die: 'eine', das: 'ein' }[article]} ${word}` }
  // IDs identify content, never a solution position. In particular, a student
  // must not be able to hash "option:0" to discover every correct response.
  const occurrences = new Map()
  const pieces = row.pieces.map(text => {
    const occurrence = occurrences.get(text) ?? 0; occurrences.set(text, occurrence + 1)
    return { id: `sitov-p-${hash(`${key}:piece:${text}:${occurrence}`).slice(0, 14)}`, text }
  })
  const options = row.options.map(text => ({ id: `sitov-o-${hash(`${key}:option:${text}`).slice(0, 14)}`, text }))
  const shuffle = (values, salt) => [...values].sort((a, b) => hash(`${key}:${salt}:${a.id}`).localeCompare(hash(`${key}:${salt}:${b.id}`)))
  let bank = shuffle(pieces, 'bank')
  if (bank.every((piece, index) => piece.id === pieces[index].id)) bank = [...bank.slice(1), bank[0]]
  const content = {
    title: row.title, subtitle: row.goal, sitovCatalogDay: day, sitovFocus: row.focus,
    scene: { backgroundKey: `sitov-${row.setting}`, backgroundImage: `/Bilder/deutschreise/sitov-${row.setting}.png`, imageAlt,
      location, audioText: row.intro, speakerId: 'sitov-host',
      characters: [{ id: 'sitov-host', name: host, voice: 'male' }, { id: 'sitov-learner', name: 'Du', voice: 'male' }] },
    steps: [
      { id: 'discover', kind: 'discover', instruction: 'Entdecke die drei Wörter für diese Situation. Tippe jedes Wort an und höre zu.',
        words: row.words.map((text, index) => ({ id: `sitov-w-${index + 1}`, text: index === 0 ? '{{nominative}}' : text, audioText: index === 0 ? '{{nominative}}' : text })) },
      { id: 'build', kind: 'sentence_build', speakerId: 'sitov-learner', prompt: `${row.goal} Setze den Satz zusammen.`, pieces: bank, audioText: sentence(row.pieces) },
      { id: 'dialogue', kind: 'dialogue_choice', speakerId: 'sitov-host', prompt: row.question, audioText: row.intro, options: shuffle(options, 'choices') },
    ],
    completion: { title: 'Deutsch im Alltag geschafft!', text: `Du hast ${location === 'Sitov Academy' ? 'bei der Sitov Academy' : `am Schauplatz ${location}`} Wörter entdeckt, einen Satz gebaut und passend geantwortet.` },
  }
  const accepted = [pieces.map(piece => piece.id), ...(row.alternativeOrders ?? []).map(order => order.map(index => pieces[index].id))]
  const answerKey = { steps: { build: { accepted }, dialogue: { optionId: options[0].id } }, feedback: {
    discover: { correct: 'Gut! Du hast alle drei Wörter entdeckt.', wrong: 'Tippe zuerst jedes der drei Wörter an.' },
    build: { correct: `Der Satz passt. ${row.explanation}`, wrong: `Prüfe die Reihenfolge. Achte auf: ${row.focus}.` },
    dialogue: { correct: `Deine Antwort passt zur Situation. ${row.explanation}`, wrong: 'Achte auf die Frage und die Informationen aus der Szene. Welche Antwort erfüllt das Ziel?' },
  } }
  return { key, level, day, category, forms, content, answerKey }
}

export function buildSitovQuestSql(entries, runtime) {
  const rows = entries.map(entry => `(${quote(entry.key)},${quote(entry.level)},${quote(entry.category)},${quote(entry.forms.word)},${quote(entry.forms.article)},${json(entry.content)},${json(entry.answerKey)},${quote(entry.forms.nominative)},${quote(entry.forms.accusative)})`).join(',\n')
  return `-- Generated by scripts/build-sitov-daily-quests.mjs. Edit the authored JSON, then rebuild.
-- Sitov Academy: 100 NEW journeys per A1/A2/B1/B2. Existing six starters stay intact.
-- Additive, repeatable, apply after 64 (65/66 belong to the parallel trainer release).
-- Today's assignments, their private answers, claims and streaks are never rewritten.
DO $sitov_catalog$
DECLARE item record; template uuid;
BEGIN
 FOR item IN SELECT * FROM (VALUES
${rows}
 ) authored(template_key,level,category,word_de,article,content,answer_key,nominative,accusative)
 LOOP
  INSERT INTO daily_quest_private.slot_forms(category,word_de,article,nominative,accusative)
   VALUES(item.category,item.word_de,item.article,item.nominative,item.accusative) ON CONFLICT DO NOTHING;
  template:=NULL;
  INSERT INTO public.daily_quests(template_key,level,version,category,fallback_word_de,fallback_article,content)
   VALUES(item.template_key,item.level::public.cefr_code,1,item.category,item.word_de,item.article,item.content)
   ON CONFLICT(template_key) DO NOTHING RETURNING id INTO template;
  IF template IS NULL THEN SELECT q.id INTO template FROM public.daily_quests q WHERE q.template_key=item.template_key; END IF;
  -- Never overwrite an existing editorial version or silently change its keys.
  INSERT INTO daily_quest_private.template_keys(template_id,answer_key)
   SELECT q.id,item.answer_key FROM public.daily_quests q
   WHERE q.id=template AND q.version=1 AND q.content=item.content AND q.category=item.category
   ON CONFLICT DO NOTHING;
 END LOOP;
END $sitov_catalog$;
${runtime}
COMMENT ON TABLE public.daily_quests IS 'Sitov Academy daily journeys: six starters plus 100 authored scenes per A1, A2, B1 and B2. Private solutions are isolated.';
NOTIFY pgrst,'reload schema';
`
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const entries = await loadSitovQuestCatalog()
  const runtime = await readFile(`${root}scripts/lib/sitov-daily-quest-runtime.sql`, 'utf8')
  const output = `${root}supabase/vps/67_sitov_daily_quest_catalog.sql`
  const sql = buildSitovQuestSql(entries, runtime)
  if (process.argv.includes('--check')) assert.equal(await readFile(output, 'utf8'), sql, 'Rebuild the Daily Quest migration after authoring edits')
  else await writeFile(output, sql)
  console.log(`Sitov Academy: ${entries.length} new journeys, ${entries.length * 3} interactive stations; ${process.argv.includes('--check') ? 'verified' : 'built'} migration 67.`)
}
