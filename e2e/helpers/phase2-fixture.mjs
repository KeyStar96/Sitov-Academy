#!/usr/bin/env node
/**
 * Phase-2-Oberflächentests: kurzlebiges Loopback-Fixture anstelle der
 * Supabase-REST-/Auth-Schnittstelle (wie die Phase-0/1-Bildaufnahmen, hier
 * versioniert). Ausschließlich künstliche Daten („Demo", reservierte Adresse
 * demo@example.invalid, erfundene UUIDs), nur A1.1 freigeschaltet.
 *
 * Es ist KEIN Datenbank-, RLS- oder Auth-Test: Filter werden ignoriert, jede
 * Tabelle liefert ihre wenigen Zeilen, schreibende Anfragen werden mit 405
 * abgelehnt, RPCs antworten fest. Bewertung und Zugriff prüfen die DB-Tests.
 *
 *   node e2e/helpers/phase2-fixture.mjs   # Port PHASE2_FIXTURE_PORT, sonst 54329
 */
import http from 'node:http'

const port = Number(process.env.PHASE2_FIXTURE_PORT || 54329)
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
export const FIXTURE_USER = {
  id: id(1), aud: 'authenticated', role: 'authenticated', email: 'demo@example.invalid',
  email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z',
}

const unit = (n, trainer = 'vocabulary') => ({ id: id((trainer === 'vocabulary' ? 100 : 150) + n), level: 'A1.1', label: `Lektion ${n}`, sort_order: n,
  is_active: true, owner_auth_user_id: null, trainer, learning_levels: { cefr_level: 'A1' } })
const terms = [['Name', 'name'], ['Familie', 'family'], ['Apfel', 'apple'], ['Tisch', 'table'], ['Morgen', 'morning'], ['Sonne', 'sun'], ['Schule', 'school']]
const cards = terms.map(([word, en], index) => ({
  id: id(200 + index), unit_id: unit(index + 1).id, word_de: word, article: index === 5 || index === 6 ? 'die' : 'der', plural: null,
  image_url: null, audio_url: null, created_at: '2026-01-01T00:00:00Z', sentence_practice: false, alternative_answers_de: [], target_form: null,
  unit: unit(index + 1),
  translations: [{ locale: 'en', translation: en, context_sentence: null, is_difficult: false }, { locale: 'de', translation: word, context_sentence: null, is_difficult: false }],
}))
const progress = ['de_to_native', 'native_to_de'].map((direction, index) => ({
  id: id(300 + index), card_id: cards[0].id, direction, box_number: 1, next_review_date: '2026-01-01T00:00:00Z', last_answered_at: null,
}))
// Ein langer, frei formulierter Lesetext: Die Aussprache-Seite muss scrollen.
const reading = {
  id: id(401), unit_id: unit(1, 'pronunciation').id, unit: unit(1, 'pronunciation'), focus: 'Satzmelodie', audio_url: null,
  sentence_de: Array.from({ length: 18 }, (_, index) => `Abschnitt ${index + 1}. Heute lernen wir zusammen. Wir lesen langsam und machen eine kurze Pause.`).join('\n\n'),
}

const tables = {
  profiles: [{ id: FIXTURE_USER.id, role: 'student', native_language: 'en', ui_language: 'en',
    person: { display_name: 'Demo', email: FIXTURE_USER.email }, level_access: [{ level: 'A1.1' }] }],
  learning_vocabulary_cards: cards,
  vocabulary_direction_progress: progress,
  learning_reading_texts: [reading],
  learning_units: [...cards.map(card => card.unit), reading.unit],
}

const rpcs = {
  claim_verified_person: { id: null, unresolved: false },
  get_last_active_level: { level: 'A1.1', mode: 'vocabulary', source: 'activity',
    levels: [{ level: 'A1.1', mode: 'vocabulary', at: '2026-09-24T18:00:00Z', unit_label: 'Lektion 1', topic: null }] },
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${port}`)
  const name = url.pathname.split('/').at(-1)
  let data = []
  if (url.pathname === '/__phase2/health') data = { fixture: 'phase2', writes: false }
  else if (url.pathname === '/auth/v1/user') data = FIXTURE_USER
  else if (url.pathname.startsWith('/rest/v1/rpc/')) data = rpcs[name] ?? []
  else if (url.pathname.startsWith('/rest/v1/')) {
    data = tables[name] ?? []
    if (Number(url.searchParams.get('offset') || 0) > 0) data = []
    if (request.headers.accept?.includes('vnd.pgrst.object+json')) data = data[0] ?? null
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !url.pathname.startsWith('/rest/v1/rpc/')) {
    response.writeHead(405, { 'content-type': 'application/json' })
    return response.end('{}')
  }
  const count = Array.isArray(data) ? data.length : 1
  response.writeHead(200, {
    'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*',
    'content-range': `0-${Math.max(0, count - 1)}/${count}`,
  })
  response.end(request.method === 'HEAD' ? '' : JSON.stringify(data))
})

server.listen(port, '127.0.0.1', () => console.log(`phase2 fixture on http://127.0.0.1:${port}`))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)))
