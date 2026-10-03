'use client'

import Link from 'next/link'
import { ArrowUpRight, BookOpen, Check, LockKeyhole, Route, Sparkles, Workflow } from 'lucide-react'
import { studentTranslator } from '@/lib/student-ui-i18n'
import type { SitovPronunciationReadiness } from '@/lib/sitov-pronunciation-readiness'
import styles from './PronunciationStudio.module.css'

const sitovDe = {
  title: 'Schritt für Schritt zum sicheren Vorlesen', hard: 'Direkt von deiner Lehrkraft freigeschaltet',
  hardHint: 'Du kannst alle Texte dieses Lernbereichs anhören, vorlesen und einreichen.',
  hint: 'Bekannte Wörter und geübte Satzmuster machen das Vorlesen leichter. Deine Texte öffnen sich mit deinem Lernfortschritt.',
  stage: 'Nächster Schritt: {tier} von 3', complete: 'Alle Lernschritte erreicht', words: 'Wörter sicher', grammar: 'Grammatik geübt', verbs: 'Verbformen verlässlich geübt',
  wordHint: 'Wörter in beiden Richtungen mindestens in Phase 3 und jeweils einmal schriftlich richtig beantwortet.', grammarHint: '{nodes} Lernpfad-Abschnitte mit mindestens 2 Sternen und {tests} bestandene Tests — oder {exercises} Grammatikaufgaben aus {topics} Themen.',
  verbHint: 'Mindestens 3 Antworten je Form und 80 % richtig.', ready: '{count} Texte bereit',
  coverage: 'Für jeden Text brauchst du zusätzlich mindestens 60 % bekannte Inhaltswörter.',
  locked: 'Noch in Vorbereitung', textCoverage: '{known} % der Inhaltswörter bekannt · benötigt: {needed} %',
  textTier: 'Öffnet sich mit Lernschritt {tier}', unavailable: 'Dein Lernstand konnte gerade nicht geprüft werden.', unavailableHint: 'Deine bisherigen Aufnahmen bleiben im Postfach. Lade den Lernstand erneut, um Texte zu öffnen.', retry: 'Lernstand erneut laden',
}
type SitovCopy = typeof sitovDe
const sitovCopies: Record<string, SitovCopy> = {
  de: sitovDe,
  en: { title: 'Build up to confident reading', hard: 'Your teacher has unlocked this directly', hardHint: 'You can listen to, read and submit all texts in this learning area.', hint: 'Familiar words and practised sentence patterns make reading easier. Texts open as your learning grows.', stage: 'Next step: {tier} of 3', complete: 'All learning steps completed', words: 'Words you know', grammar: 'Grammar practised', verbs: 'Reliably practised forms', wordHint: 'Words at phase 3 or higher, with a correct typed answer in each direction.', grammarHint: '{nodes} learning path sections with at least 2 stars and {tests} passed tests — or {exercises} grammar tasks across {topics} topics.', verbHint: 'At least 3 answers per form and 80% correct.', ready: '{count} texts ready', coverage: 'For each text, you also need to know at least 60% of its content words.', locked: 'Still preparing', textCoverage: '{known}% of content words known · required: {needed}%', textTier: 'Opens at learning step {tier}', unavailable: 'Your learning progress could not be checked just now.', unavailableHint: 'Your previous recordings remain in your mailbox. Reload your progress to open texts.', retry: 'Reload learning progress' },
  ru: { title: 'Шаг за шагом к уверенному чтению', hard: 'Преподаватель открыл прямой доступ', hardHint: 'Ты можешь слушать, читать и отправлять все тексты этого раздела.', hint: 'Знакомые слова и изученные конструкции помогают читать. Тексты открываются по мере твоего прогресса.', stage: 'Следующий шаг: {tier} из 3', complete: 'Все учебные шаги пройдены', words: 'Знакомые слова', grammar: 'Изученная грамматика', verbs: 'Надёжно изученные формы', wordHint: 'Слова минимум на этапе 3 и хотя бы один верный письменный ответ в каждом направлении.', grammarHint: '{nodes} разделов учебного пути с минимум 2 звёздами и {tests} пройденных тестов — или {exercises} заданий по грамматике из {topics} тем.', verbHint: 'Минимум 3 ответа на форму и 80% верных.', ready: 'Доступно текстов: {count}', coverage: 'Для каждого текста также нужно знать минимум 60% знаменательных слов.', locked: 'Ещё готовимся', textCoverage: 'Знакомо {known}% слов · нужно {needed}%', textTier: 'Откроется на учебном шаге {tier}', unavailable: 'Сейчас не удалось проверить твой прогресс.', unavailableHint: 'Предыдущие записи доступны в почте. Загрузи прогресс ещё раз, чтобы открыть тексты.', retry: 'Загрузить прогресс' },
  uk: { title: 'Крок за кроком до впевненого читання', hard: 'Викладач відкрив прямий доступ', hardHint: 'Ти можеш слухати, читати та надсилати всі тексти цього розділу.', hint: 'Знайомі слова й вивчені конструкції допомагають читати. Тексти відкриваються разом із твоїм прогресом.', stage: 'Наступний крок: {tier} із 3', complete: 'Усі навчальні кроки пройдено', words: 'Знайомі слова', grammar: 'Вивчена граматика', verbs: 'Надійно вивчені форми', wordHint: 'Слова щонайменше на етапі 3 та хоча б одна правильна письмова відповідь у кожному напрямку.', grammarHint: '{nodes} розділів навчального шляху з мінімум 2 зірками та {tests} пройдених тестів — або {exercises} завдань з граматики із {topics} тем.', verbHint: 'Щонайменше 3 відповіді на форму та 80% правильних.', ready: 'Доступно текстів: {count}', coverage: 'Для кожного тексту також потрібно знати щонайменше 60% змістових слів.', locked: 'Ще готуємося', textCoverage: 'Знайомо {known}% слів · потрібно {needed}%', textTier: 'Відкриється на навчальному кроці {tier}', unavailable: 'Зараз не вдалося перевірити твій прогрес.', unavailableHint: 'Попередні записи доступні в пошті. Завантаж прогрес знову, щоб відкрити тексти.', retry: 'Завантажити прогрес' },
  tr: { title: 'Adım adım güvenle okumaya', hard: 'Öğretmenin doğrudan erişim açtı', hardHint: 'Bu öğrenme alanındaki tüm metinleri dinleyebilir, okuyabilir ve gönderebilirsin.', hint: 'Bildiğin kelimeler ve çalıştığın cümle yapıları okumayı kolaylaştırır. İlerledikçe metinler açılır.', stage: 'Sonraki adım: 3 adımın {tier}. adımı', complete: 'Tüm öğrenme adımları tamamlandı', words: 'Bilinen kelimeler', grammar: 'Çalışılan dil bilgisi', verbs: 'Güvenilir biçimde çalışılan fiiller', wordHint: 'Her iki yönde en az 3. aşamada olan ve her yönde en az bir doğru yazılı cevabı bulunan kelimeler.', grammarHint: 'En az 2 yıldızlı {nodes} öğrenme yolu bölümü ve {tests} başarılı test — veya {topics} konudan {exercises} dil bilgisi görevi.', verbHint: 'Her biçimde en az 3 cevap ve %80 doğruluk.', ready: '{count} metin hazır', coverage: 'Her metinde ayrıca içerik kelimelerinin en az %60’ını bilmen gerekir.', locked: 'Hazırlanıyoruz', textCoverage: 'Kelimelerin %{known} kadarı biliniyor · gereken: %{needed}', textTier: '{tier}. öğrenme adımında açılır', unavailable: 'İlerlemen şu anda kontrol edilemedi.', unavailableHint: 'Önceki kayıtların posta kutusunda kalır. Metinleri açmak için ilerlemeni yeniden yükle.', retry: 'İlerlemeyi yeniden yükle' },
}
function fill(template: string, values: Record<string, number>): string { return template.replace(/\{(\w+)\}/gu, (_, key: string) => String(values[key] ?? '')) }
export function sitovReadinessCopy(lang: string): SitovCopy { return sitovCopies[lang] ?? sitovDe }

export default function SitovPronunciationReadinessCard({ readiness, lang, level, onRetry }: {
  readiness: SitovPronunciationReadiness | null; lang: string; level: string; onRetry: () => void
}) {
  const copy = sitovReadinessCopy(lang)
  const s = studentTranslator(lang)
  if (!readiness) return <section className={styles.sitovReadiness} role="status"><LockKeyhole size={24} aria-hidden="true" /><h3>{copy.unavailable}</h3><p>{copy.unavailableHint}</p><button className="st-button st-button--quiet" onClick={onRetry}>{copy.retry}</button></section>
  if (readiness.mode === 'hard') return <section className={`${styles.sitovReadiness} ${styles.sitovHardAccess}`}><Sparkles size={24} aria-hidden="true" /><div><h3>{copy.hard}</h3><p>{copy.hardHint}</p></div></section>
  const requirement = readiness.requirements.find(row => row.tier === Math.min(3, readiness.tier + 1))
  if (!requirement) return null
  const stats = readiness.stats
  const pathReady = stats.grammarNodes >= requirement.grammarNodes && stats.passedTests >= requirement.passedTests
  const legacyReady = stats.legacyGrammarExercises >= requirement.legacyGrammarExercises && stats.legacyGrammarTopics >= requirement.legacyGrammarTopics
  const pathFraction = Math.min(stats.grammarNodes / requirement.grammarNodes, requirement.passedTests ? stats.passedTests / requirement.passedTests : 1, 1)
  const legacyFraction = Math.min(stats.legacyGrammarExercises / requirement.legacyGrammarExercises, stats.legacyGrammarTopics / requirement.legacyGrammarTopics, 1)
  const grammarFraction = Math.max(pathFraction, legacyFraction)
  const base = `/${lang}/dashboard/level/${encodeURIComponent(level)}`
  const items = [
    { icon: BookOpen, title: copy.words, value: `${stats.knownWords} / ${requirement.knownWords}`, fraction: Math.min(1, stats.knownWords / requirement.knownWords), hint: copy.wordHint, href: `${base}/vocabulary`, link: s('area_vocabulary') },
    { icon: Route, title: copy.grammar, value: pathReady || legacyReady ? '✓' : `${Math.round(grammarFraction * 100)} %`, fraction: grammarFraction,
      hint: fill(copy.grammarHint, { nodes: requirement.grammarNodes, tests: requirement.passedTests, exercises: requirement.legacyGrammarExercises, topics: requirement.legacyGrammarTopics }), href: `${base}/path`, link: s('area_path') },
    ...(stats.verbEvidenceRequired ? [{ icon: Workflow, title: copy.verbs, value: `${stats.confidentVerbForms} / ${requirement.confidentVerbForms}`, fraction: requirement.confidentVerbForms ? Math.min(1, stats.confidentVerbForms / requirement.confidentVerbForms) : 1, hint: copy.verbHint, href: `${base}/verbs`, link: s('area_verbs') }] : []),
  ]
  return <section className={styles.sitovReadiness} aria-labelledby="sitov-readiness-title">
    <div className={styles.sitovReadinessHead}><div><span>{readiness.tier === 3 ? copy.complete : fill(copy.stage, { tier: requirement.tier })}</span><h3 id="sitov-readiness-title">{copy.title}</h3></div><span className={styles.sitovReadinessReady}><Check size={15} aria-hidden="true" />{fill(copy.ready, { count: readiness.texts.filter(row => row.ready).length })}</span></div>
    <p>{copy.hint}</p>
    <div className={styles.sitovMilestones}>{items.map(item => <div key={item.title} className={styles.sitovMilestone} data-ready={item.fraction >= 1}>
      <div className={styles.sitovMilestoneHeading}><item.icon size={18} aria-hidden="true" /><strong>{item.title}</strong><span>{item.value}</span></div>
      <div role="progressbar" aria-label={item.title} aria-valuenow={Math.round(item.fraction * 100)} aria-valuemin={0} aria-valuemax={100} className={styles.sitovMilestoneTrack}><span style={{ width: `${item.fraction * 100}%` }} /></div>
      <p>{item.hint}</p><Link href={item.href}>{item.link}<ArrowUpRight size={15} aria-hidden="true" /></Link>
    </div>)}</div>
    <p className={styles.sitovCoverageHint}>{copy.coverage}</p>
  </section>
}

export function SitovLockedReadings({ readiness, lang }: { readiness: SitovPronunciationReadiness; lang: string }) {
  const copy = sitovReadinessCopy(lang)
  const rows = readiness.texts.filter(row => !row.ready)
  if (!rows.length) return null
  return <ul className={styles.sitovLockedReadings} aria-label={copy.locked}>{rows.map(row => <li key={row.id}>
    <LockKeyhole size={18} aria-hidden="true" /><div><h3>{row.title}</h3><p>{fill(copy.textTier, { tier: row.tier })}</p><p>{fill(copy.textCoverage, { known: row.coveragePercent, needed: row.requiredCoveragePercent })}</p></div>
  </li>)}</ul>
}
