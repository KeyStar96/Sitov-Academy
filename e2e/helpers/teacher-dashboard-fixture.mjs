#!/usr/bin/env node
/**
 * Lehrer-Dashboard (Phase 11.2): kurzlebiges Loopback-Fixture anstelle der
 * Supabase-REST-/Auth-Schnittstelle für Browserprüfungen auf Handy und Desktop.
 * Ausschließlich künstliche Daten (reservierte *.invalid-Adressen, erfundene
 * UUIDs). Es ist KEIN Datenbank-, RLS- oder Rechtetest: Filter werden nur
 * vereinfacht nachgebildet; die Geschäftsregeln prüfen die DB-Suites.
 *
 *   node e2e/helpers/teacher-dashboard-fixture.mjs   # Port TEACHER_FIXTURE_PORT, sonst 54331
 */
import http from 'node:http'

const port = Number(process.env.TEACHER_FIXTURE_PORT || 54331)
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const TEACHER = id(2)
const LEVELS = ['A1.1', 'A1.2', 'A2.1', 'A2.2', 'B1.1', 'B1.2']
const day = offset => { const date = new Date(); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10) }
const stamp = offset => { const date = new Date(); date.setUTCHours(date.getUTCHours() + offset); return date.toISOString() }
const month = (offset = 0) => { const date = new Date(); date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + offset); return date.toISOString().slice(0, 10) }

let tables, rpcCalls

function reset() {
  rpcCalls = []
  const names = [
    ['Olena Kovalenko', 'uk', ['A1.1']], ['Dmitri Petrov', 'ru', ['A1.1', 'A1.2']], ['Aylin Demir', 'tr', ['A2.1']],
    ['Maria Schneider', 'ru', ['A1.2']], ['John Miller', 'en', ['B1.1']],
    ['Iryna Bondar', 'uk', []], ['Sergej Wolkow', 'ru', []], ['Neue Anmeldung ohne Namen mit sehr langem Namen zum Testen', 'tr', []],
  ]
  const people = names.map(([name], index) => ({
    id: id(200 + index), auth_user_id: id(100 + index), display_name: name, email: `schueler${index + 1}@example.invalid`,
    phone: index % 2 ? '+49 511 000000' + index : null, city: index % 3 ? 'Hannover' : null, street: index % 3 ? 'Musterstraße 1' : null,
    postal_code: index % 3 ? '30159' : null, preferred_locale: 'de', created_at: stamp(-24 * (40 - index)),
  }))
  const access = names.flatMap(([, , levels], index) => levels.map(level => ({ auth_user_id: id(100 + index), level, granted_at: stamp(-100) })))
  const profileFor = (person, index, [, language, levels]) => ({
    // Oberflächensprache = Muttersprache: Die Trainer sind mit Deutsch als Oberfläche gesperrt.
    id: person.auth_user_id, role: 'student', ui_language: language, native_language: language,
    created_at: index >= 5 ? stamp(-6 - index * 20) : stamp(-24 * (60 - index)), updated_at: null,
    person, people: person, level_access: levels.map(level => ({ level })), student_level_access: levels.map(level => ({ auth_user_id: person.auth_user_id })),
  })
  const courseRow = (n, title, type, category, level, schedules, archived = false) => ({
    id: id(300 + n), slug: `demo-${n}`, title, description: 'Synthetischer Kurs für Browserprüfungen.', type, category, level, audience_code: level,
    unit_price: 15, unit_minutes: 45, start_date: null, end_date: null, trial_lessons: category !== 'private', sort_order: n * 10,
    archived_at: archived ? stamp(-500) : null, course_schedules: schedules.map(([weekday, start_time, end_time]) => ({ course_id: id(300 + n), weekday, start_time: `${start_time}:00`, end_time: `${end_time}:00` })),
    course_translations: [],
  })
  const courses = [
    courseRow(1, 'Deutsch A1.1 (Online)', 'online', 'german', 'A1.1', [[1, '18:00', '19:30'], [3, '18:00', '19:30']]),
    courseRow(2, 'Deutsch A2 (Präsenz)', 'presence', 'german', 'A2', [[2, '10:00', '11:30']]),
    courseRow(3, 'Sprechtraining B1', 'online', 'speaking', 'B1', [[1, '20:00', '21:00'], [4, '19:00', '20:00']]),
    courseRow(4, 'Privatunterricht', 'presence', 'private', '', []),
    courseRow(5, 'Alter Abendkurs', 'presence', 'german', 'A1', [[5, '17:00', '18:30']], true),
  ]
  const exceptions = [
    { id: id(400), date: day(30), reason: 'Feiertag', course_id: null },
    { id: id(401), date: day(10), reason: 'Fortbildung', course_id: id(301) },
    { id: id(402), date: day(17), reason: 'Krankheit', course_id: id(302) },
    { id: id(403), date: day(-20), reason: 'Ferien', course_id: id(301) },
  ]
  for (const course of courses) course.course_exceptions = exceptions.filter(item => item.course_id === course.id)
  const booking = (n, personIndex, kind, status, course, target) => ({
    id: id(500 + n), person_id: people[personIndex].id, kind, status, target_month: target, start_date: target, created_at: stamp(-30 - n),
    contact_name: people[personIndex].display_name, contact_email: people[personIndex].email, contact_phone: people[personIndex].phone,
    contact_street: people[personIndex].street, contact_postal_code: people[personIndex].postal_code, contact_city: people[personIndex].city, contact_birth_date: null,
    privacy_accepted: true, agb_accepted: true, revocation_accepted: true, recording_accepted: null, revision: 1, confirmed_at: null, confirmed_by: null,
    people: { auth_user_id: people[personIndex].auth_user_id },
    booking_items: [{ id: id(600 + n), booking_id: id(500 + n), course_id: course.id, title_snapshot: course.title, amount: 120, unit_price: 15, unit_minutes: 45, units: 8, requested_units: null, calendar_snapshot: {} }],
  })
  const bookings = [
    booking(1, 0, 'registration', 'confirmed', courses[0], month(0)),
    booking(2, 1, 'monthly', 'pending', courses[0], month(1)),
    booking(3, 2, 'registration', 'pending', courses[1], month(0)),
    booking(4, 5, 'trial', 'pending', courses[0], month(0)),
    booking(5, 6, 'registration', 'confirmed', courses[2], month(0)),
  ]
  const students = people.map((person, index) => profileFor(person, index, names[index]))
  const teacherPerson = { id: id(299), auth_user_id: TEACHER, display_name: 'Demo Lehrkraft', email: 'teacher@example.invalid', phone: null, city: null, street: null, postal_code: null, preferred_locale: 'de', created_at: stamp(-9000) }
  const unit = { id: id(700), level: 'A1.1', label: 'Lektion 1', sort_order: 1, is_active: true, owner_auth_user_id: null, trainer: 'pronunciation', learning_levels: { cefr_level: 'A1' } }
  tables = {
    profiles: [...students, { id: TEACHER, role: 'teacher', ui_language: 'de', native_language: 'de', created_at: stamp(-9000), person: teacherPerson, people: teacherPerson, level_access: [], student_level_access: [] }],
    people: [...people, teacherPerson],
    student_level_access: access,
    learning_trainer_grants: [],
    learning_levels: LEVELS.map((code, index) => ({ code, sort_order: index })),
    courses,
    course_exceptions: exceptions,
    bookings,
    booking_items: bookings.flatMap(item => item.booking_items),
    invoice_cases: [],
    submissions: [0, 1].map(index => ({
      id: id(800 + index), auth_user_id: people[index].auth_user_id, type: 'audio', level: 'A1.1', text_content: 'Heute lernen wir zusammen.',
      content_url: null, status: 'pending', created_at: stamp(-3 - index), prompt_id: id(801), prompt: { unit: { label: 'Lektion 1' } }, pronunciation_messages: [],
    })),
    learning_reading_texts: [{ id: id(801), unit_id: unit.id, unit, focus: 'Satzmelodie', audio_url: null, sort_order: 1, title: 'Im kleinen Laden', is_active: true, sentence_de: 'Heute lernen wir zusammen. Wir lesen langsam und machen eine kurze Pause.' }],
    learning_units: [unit],
    lms_media_folder: [{ folder_id: id(900), level: 'A1.1', course_id: null, title: 'Grundlagen', sort_order: 1, created_at: stamp(-300) }],
    learning_videos: [], lms_presentation_asset: [], learning_vocabulary_cards: [], learning_exercises: [],
    // Problemwörter (Phase 11.3) – je Wort Stufe 0…4; `due` wie in PostgreSQL.
    focus_words: [
      { cardId: id(1001), word: 'Tisch', article: 'der', translation: 'стол', wrongCount: 2, articleErrors: 3, stage: 0 },
      { cardId: id(1002), word: 'Haus', article: 'das', translation: 'дом', wrongCount: 4, articleErrors: 0, stage: 0 },
      { cardId: id(1003), word: 'Fenster', article: 'das', translation: 'окно', wrongCount: 3, articleErrors: 0, stage: 1 },
      { cardId: id(1004), word: 'schnell', article: null, translation: 'быстро', wrongCount: 5, articleErrors: 0, stage: 2 },
      { cardId: id(1005), word: 'Katze', article: 'die', translation: 'кошка', wrongCount: 3, articleErrors: 0, stage: 4 },
    ].map(word => ({ level: 'A1.1', status: word.stage >= 4 ? 'mastered' : 'active', dueAt: word.stage >= 4 ? null : stamp(-2), practiceCount: 0, practiceCorrect: 0, masteredAt: word.stage >= 4 ? stamp(-40) : null, ...word })),
    media_views: 0,
  }
}
reset()

const focusDisplay = word => [word.article, word.word].filter(Boolean).join(' ')
const focusDue = word => word.status === 'active' && (!word.dueAt || word.dueAt <= new Date().toISOString())
function focusWord(word) {
  const article = word.articleErrors >= 2 && Boolean(word.article)
  return { cardId: word.cardId, word: word.word, article: word.article, level: word.level, translation: word.translation, status: word.status, stage: word.stage,
    dueAt: word.dueAt, due: focusDue(word), wrongCount: word.wrongCount, articleErrors: word.articleErrors, masteredAt: word.masteredAt,
    reasons: [article ? 'article' : null, word.wrongCount >= 3 || !article ? 'hard' : null].filter(Boolean) }
}
function focusItem(word) {
  const article = word.articleErrors >= 2 && Boolean(word.article)
  const base = { cardId: word.cardId, stage: word.stage, level: word.level, prompt: word.translation, noun: Boolean(word.article), reasons: focusWord(word).reasons }
  const format = article ? 'article' : ['choice', 'build', 'type'][Math.min(2, word.stage)]
  if (format === 'article') return { ...base, format, word: word.word, options: ['der', 'die', 'das'] }
  if (format === 'choice') return { ...base, format, options: [focusDisplay(word), 'der Stuhl', 'die Lampe', 'das Buch'].sort() }
  if (format === 'build') return { ...base, format, letters: [...word.word].reverse(), article: word.article }
  return { ...base, format, firstLetter: word.word[0], length: word.word.length }
}

/** Künstliche, aber stimmige Tageswerte je Modus (7 bis 90 Tage bis heute). */
function learningProgress(studentId, days, level) {
  const seed = Number(studentId.slice(-3)) % 17
  const daily = Array.from({ length: days }, (_, index) => {
    const active = (index + seed) % 4 !== 1
    const answers = active ? 6 + ((index * 7 + seed) % 23) : 0
    const correct = active ? Math.min(answers, Math.round(answers * (0.5 + ((index + seed) % 9) / 20))) : 0
    const focus = active && index % 3 === 0 ? 4 : 0
    const path = active && index % 2 === 0 ? 5 + (index % 4) : 0
    return {
      date: day(index - (days - 1)),
      vocabulary: { answers, correct, learned: active && index % 5 === 0 ? 2 : 0, seconds: answers * 20 },
      focus: { answers: focus, correct: focus ? 3 : 0 },
      path: { answers: path, correct: Math.max(0, path - (index % 3)), stations: path && index % 6 === 0 ? 1 : 0, seconds: path * 30 },
      pronunciation: { recordings: active && index % 4 === 2 ? 2 : 0, replies: active && index % 8 === 2 ? 1 : 0, seconds: active && index % 4 === 2 ? 240 : 0 },
      media: { views: active && index % 5 === 1 ? 1 + (index % 3) : 0 },
    }
  })
  const words = tables.focus_words.filter(word => !level || word.level === level)
  return {
    success: true, studentId, level: level ?? null, days, today: day(0), timezone: 'Europe/Berlin', daily,
    vocabulary: { totalWords: 120, inBox: 64, learnedWords: 18, learnedTotal: 26, overallPercent: 38,
      buckets: [1, 2, 3, 4, 5, 6, 'learned'].map((key, index) => ({ key, count: [14, 11, 8, 6, 4, 3, 18][index] })) },
    focus: { active: words.filter(word => word.status === 'active').length, due: words.filter(focusDue).length, mastered: words.filter(word => word.status === 'mastered').length,
      articleWords: words.filter(word => word.status === 'active' && word.articleErrors >= 2).length,
      words: words.map(word => ({ cardId: word.cardId, word: word.word, article: word.article, level: word.level, status: word.status, stage: word.stage, dueAt: word.dueAt, due: focusDue(word),
        wrongCount: word.wrongCount, articleErrors: word.articleErrors, practiceCount: word.practiceCount, practiceCorrect: word.practiceCorrect, masteredAt: word.masteredAt })) },
    path: { totalStations: 36, completedStations: 11, totalUnits: 6, completedUnits: 2,
      tests: [[-12, 55, false, 'Familie'], [-9, 82, true, 'Familie'], [-3, 91, true, 'Einkaufen im kleinen Laden an der Ecke']].filter(([offset]) => -offset < days)
        .map(([offset, percentage, passed, title]) => ({ completedAt: stamp(offset * 24), percentage, passed, title })) },
    pronunciation: { totalTexts: 24, practicedTexts: 7, recordings: 15, awaitingReply: 1 },
    media: { totalMedia: 18, viewedMedia: 6, recent: [
      { kind: 'video', title: 'Begrüßung und Vorstellung', viewedAt: stamp(-2), views: 2 },
      { kind: 'presentation', title: 'Artikel-Übersicht.pdf', viewedAt: stamp(-30), views: 1 },
      { kind: 'link', title: 'Deutsch lernen mit Liedern', viewedAt: stamp(-70), views: 3 },
    ] },
  }
}

function teacherStudent(profile) {
  const levels = profile.level_access.map(item => item.level)
  const index = Number(profile.id.slice(-3)) - 100
  return {
    id: profile.id, role: profile.role, created_at: profile.created_at,
    person: { display_name: profile.person.display_name, email: profile.person.email, phone: profile.person.phone, street: profile.person.street, postal_code: profile.person.postal_code, city: profile.person.city },
    allowed_levels: levels, trainer_grants: [],
    lastActiveAt: levels.length ? stamp(-5 - index * 30) : null, learningSeconds7d: levels.length ? 1800 + index * 300 : 0, learningSeconds30d: levels.length ? 7200 : 0,
    streakDays: levels.length ? 3 : 0, currentLevel: levels[0] ?? null,
    pathPosition: levels.length ? { unitId: id(700), title: 'Familie', completedNodes: 2 + index, totalNodes: 9 } : null,
    lastTest: levels.length ? { percentage: 60 + index * 7, passed: true, completedAt: stamp(-50) } : null,
    dueCards: levels.length ? 12 * (index + 1) : 0,
    phases: { 1: 12, 2: 8, 3: 5, 4: 3, 5: 2, 6: 1, learned: 4 },
    attentionReasons: index === 1 ? ['inactive_7d'] : index === 3 ? ['too_many_due', 'low_accuracy'] : [],
    completedPathsByLevel: levels.map(level => ({ level, completed: 1, total: 4 })),
  }
}

const rpcs = {
  get_learning_progress: (body, uid) => learningProgress(body.p_student_id ?? uid, body.p_days ?? 30, body.p_level ?? null),
  record_media_view: () => { tables.media_views++; return { success: true, recorded: true } },
  get_vocabulary_focus: body => {
    if (body.p_ui_language === 'de') return { error: 'invalid_learning_language', message: 'x' }
    const words = tables.focus_words.filter(word => !body.p_level || word.level === body.p_level)
    const next = words.filter(word => word.status === 'active' && word.dueAt).map(word => word.dueAt).filter(value => value > new Date().toISOString()).sort()[0] ?? null
    return { success: true, level: body.p_level ?? null,
      summary: { active: words.filter(word => word.status === 'active').length, due: words.filter(focusDue).length, mastered: words.filter(word => word.status === 'mastered').length,
        articleWords: words.filter(word => word.status === 'active' && word.articleErrors >= 2).length, nextDueAt: next },
      words: words.map(focusWord), items: words.filter(focusDue).map(focusItem) }
  },
  submit_vocabulary_focus_answer: body => {
    const word = tables.focus_words.find(item => item.cardId === body.p_card_id)
    if (!word || word.status !== 'active') return { error: 'not_found', message: 'x' }
    if (!focusDue(word)) return { error: 'review_not_due', message: 'x' }
    const answer = String(body.p_answer ?? '').trim()
    const correct = body.p_format === 'article' ? answer === word.article : body.p_format === 'build' ? answer === word.word : answer.toLowerCase() === focusDisplay(word).toLowerCase()
    word.practiceCount++; if (correct) word.practiceCorrect++
    word.stage = correct ? Math.min(4, word.stage + 1) : 0
    word.status = word.stage >= 4 ? 'mastered' : 'active'
    const due = new Date(); due.setUTCDate(due.getUTCDate() + [0, 1, 3, 7, 0][word.stage]); due.setUTCHours(22, 0, 0, 0)
    word.dueAt = word.status === 'mastered' ? null : correct ? due.toISOString() : new Date().toISOString()
    return { success: true, correct, format: body.p_format, stage: word.stage, status: word.status, dueAt: word.dueAt,
      solution: { display: focusDisplay(word), word: word.word, article: word.article }, softError: null,
      feedback: body.p_format === 'type' && word.article && !correct && answer.toLowerCase() === word.word.toLowerCase() ? 'article_missing' : null }
  },
  media_storage_usage: () => ({ total_bytes: 3.1e9, levels: LEVELS.slice(0, 3).map((level, index) => ({ level, bytes: (index + 1) * 0.8e9, limit_bytes: 5e9 })) }),
  get_teacher_dashboard_students: () => ({ success: true, students: tables.profiles.filter(row => row.role === 'student').map(teacherStudent) }),
  get_teacher_student_detail: body => {
    const profile = tables.profiles.find(row => row.id === body.p_student_id)
    if (!profile) return { error: 'student_not_found' }
    const data = {
      overview: teacherStudent(profile),
      vocabulary: { byLevel: [], byLesson: [], halfKnown: [], hardest: [], recentAnswers: [], pausedLessons: [], carryover: [], ownWordCount: 2 },
      path: { paths: [], attempts: [], interventions: [] },
      pronunciation: { conversations: [] },
      activity: { days: Array.from({ length: 30 }, (_, index) => ({ date: day(index - 29), seconds: index % 3 ? 600 : 0, answers: index % 3 ? 12 : 0, active: index % 3 !== 0 })), byMode: [{ mode: 'vocabulary', seconds: 3600 }, { mode: 'path', seconds: 1800 }], totalSeconds: 5400 },
    }[body.p_tab]
    return { success: true, data }
  },
  get_student_learning_analytics: body => ({
    studentId: body.p_student_id, level: body.p_level ?? null, completionByLevel: { 'A1.1': 40, 'A1.2': 10 },
    distribution: { buckets: [1, 2, 3, 4, 5, 6, 'learned'].map((key, index) => ({ key, count: 7 - index })), totalCards: 40, totalInBox: 28, overallPercent: 35 },
    history: Array.from({ length: 30 }, (_, index) => ({ date: day(index - 29), answers: index % 4 ? 10 + index : 0, correct: index % 4 ? 8 + (index % 3) : 0 })),
    timezone: 'Europe/Berlin',
  }),
  prepare_business_month: () => ({ prepared: true }),
  list_registration_identity_conflicts: () => [],
  get_all_students_progress_data: () => ({}),
  certificate_import_baseline: () => 'a'.repeat(32),
  certificate_eligibility: () => [],
  claim_verified_person: () => ({ id: null, unresolved: false }),
  get_learning_new_counts: () => ({ success: true, levels: {}, any: false, visited: [] }),
  get_last_active_level: () => ({ level: null, mode: null, source: 'none', levels: [] }),
  save_course_exception: body => {
    if (!body.p_course_id || !body.p_date || !String(body.p_reason ?? '').trim()) return { error: 'invalid_input', message: 'x' }
    const existing = tables.course_exceptions.find(row => row.course_id === body.p_course_id && row.date === body.p_date)
    if (existing) existing.reason = body.p_reason
    else tables.course_exceptions.push({ id: id(450 + tables.course_exceptions.length), date: body.p_date, reason: body.p_reason, course_id: body.p_course_id })
    for (const course of tables.courses) course.course_exceptions = tables.course_exceptions.filter(item => item.course_id === course.id)
    return { id: (existing ?? tables.course_exceptions.at(-1)).id }
  },
  delete_course_exception: body => {
    const before = tables.course_exceptions.length
    tables.course_exceptions = tables.course_exceptions.filter(row => row.id !== body.p_id)
    for (const course of tables.courses) course.course_exceptions = tables.course_exceptions.filter(item => item.course_id === course.id)
    return before === tables.course_exceptions.length ? { error: 'not_found', message: 'Course exception not found.' } : { deleted: true }
  },
  set_student_level_access: body => {
    tables.student_level_access = tables.student_level_access.filter(row => row.auth_user_id !== body.p_user_id)
      .concat(body.p_levels.map(level => ({ auth_user_id: body.p_user_id, level, granted_at: stamp(0) })))
    const profile = tables.profiles.find(row => row.id === body.p_user_id)
    if (profile) {
      profile.level_access = body.p_levels.map(level => ({ level }))
      profile.student_level_access = body.p_levels.map(() => ({ auth_user_id: body.p_user_id }))
    }
    return { success: true }
  },
  save_business_course: body => body.p_data?.id ?? id(399),
}

function applyFilters(rows, params, select) {
  let data = [...rows]
  for (const [key, raw] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(key) || key.includes('.')) continue
    const value = String(raw)
    const [operator, ...rest] = value.split('.')
    const operand = rest.join('.')
    const read = row => row[key]
    if (operator === 'eq') data = data.filter(row => String(read(row)) === operand)
    else if (operator === 'neq') data = data.filter(row => String(read(row)) !== operand)
    else if (operator === 'in') { const set = operand.replace(/^\(|\)$/g, '').split(',').map(item => item.replace(/^"|"$/g, '')); data = data.filter(row => set.includes(String(read(row)))) }
    else if (operator === 'is') data = data.filter(row => operand === 'null' ? read(row) == null : String(read(row)) === operand)
    else if (operator === 'not' && operand.startsWith('is.null')) data = data.filter(row => read(row) != null)
    else if (operator === 'gte') data = data.filter(row => String(read(row)) >= operand)
    else if (operator === 'lte') data = data.filter(row => String(read(row)) <= operand)
    else if (operator === 'gt') data = data.filter(row => String(read(row)) > operand)
    else if (operator === 'lt') data = data.filter(row => String(read(row)) < operand)
  }
  // `relation!inner(...)` blendet Zeilen ohne verknüpfte Datensätze aus.
  for (const match of (select ?? '').matchAll(/(\w+)!inner\(/g)) {
    data = data.filter(row => { const related = row[match[1]]; return Array.isArray(related) ? related.length > 0 : related != null })
  }
  return data
}

async function body(request) {
  let text = ''
  for await (const chunk of request) text += chunk
  try { return JSON.parse(text || '{}') } catch { return {} }
}

function actor(request) {
  try { return JSON.parse(Buffer.from(request.headers.authorization?.split('.')[1] ?? '', 'base64url').toString()).sub ?? TEACHER } catch { return TEACHER }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${port}`)
  const name = url.pathname.split('/').at(-1)
  let data = []
  let status = 200
  if (url.pathname === '/__teacher/health') data = { fixture: 'teacher-dashboard', synthetic: true }
  else if (url.pathname === '/__teacher/reset') { reset(); data = { ok: true } }
  else if (url.pathname === '/__teacher/rpc-calls') data = rpcCalls
  else if (url.pathname === '/__teacher/media-views') data = { views: tables.media_views }
  else if (url.pathname === '/auth/v1/user') {
    const uid = actor(request)
    data = { id: uid, aud: 'authenticated', role: 'authenticated', email: uid === TEACHER ? 'teacher@example.invalid' : 'student@example.invalid', email_confirmed_at: stamp(-9000), is_anonymous: false, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: stamp(-9000) }
  } else if (url.pathname.startsWith('/rest/v1/rpc/')) {
    const payload = await body(request)
    rpcCalls.push({ name, payload })
    data = rpcs[name] ? rpcs[name](payload, actor(request)) : null
  } else if (url.pathname.startsWith('/rest/v1/')) {
    if (!['GET', 'HEAD'].includes(request.method)) { await body(request); data = [] }
    else {
      const all = applyFilters(tables[name] ?? [], url.searchParams, url.searchParams.get('select'))
      const offset = Number(url.searchParams.get('offset') ?? 0)
      const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined
      data = all.slice(offset, limit === undefined ? undefined : offset + limit)
      const total = all.length
      response.setHeader('content-range', data.length ? `${offset}-${offset + data.length - 1}/${total}` : `*/${total}`)
      if (request.headers.accept?.includes('vnd.pgrst.object+json')) {
        if (data.length !== 1) { status = 406; data = { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: null, hint: null } }
        else data = data[0]
      }
    }
  }
  response.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-expose-headers': 'content-range' })
  response.end(request.method === 'HEAD' ? '' : JSON.stringify(data))
})

server.listen(port, '127.0.0.1', () => console.log(`Synthetic teacher dashboard fixture: http://127.0.0.1:${port}`))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)))
