'use client'

import { useEffect, useState, useTransition, type CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, BookOpen, Check, ChevronRight, Eye, Layers, ListChecks, PenLine, Plus } from 'lucide-react'
import { initializeLesson, setLessonInBox } from '@/app/actions/vocabulary'
import LessonCardsModal from '@/components/vocabulary/LessonCardsModal'
import { createVocabularyTranslator, type VocabularyTranslations } from '@/lib/vocabulary-i18n'
import { isLessonInBox } from '@/lib/vocabulary-box'
import BottomSheet from '@/components/ui/BottomSheet'
import ProgressRing from '@/components/ui/ProgressRing'
import { studentTranslator } from '@/lib/student-ui-i18n'
import type { LessonStation } from '@/lib/learning-status-server'
import type { PathStation } from '@/lib/lesson-stations'

/** Der große Weiter-Knopf: ein Ziel oder „diese Lektion beginnen" (öffnet die Startwahl). */
export type LessonsNext = { href: string; hint: string } | { lesson: string; hint: string }

/**
 * Großer Schalter „In deiner Lernbox". Der Zustand steht immer als Text
 * daneben — Farbe und Knopfposition sind nie das einzige Merkmal.
 */
function BoxSwitch({ on, busy, disabled, label, hint, ariaLabel, onToggle }: {
  on: boolean
  busy: boolean
  disabled?: boolean
  label: string
  hint: string
  ariaLabel: string
  onToggle: () => void
}) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={ariaLabel} aria-busy={busy || undefined}
      disabled={disabled || busy} onClick={onToggle} className="st-switch">
      <span className="st-switch__track" aria-hidden="true">
        <span className="st-switch__thumb">{on && <Check size={16} strokeWidth={3} />}</span>
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="st-switch__label">{label}</span>
        <span className="st-switch__hint">{hint}</span>
      </span>
    </button>
  )
}

/**
 * „Lektionen" im Modus Vokabeln — hier wird entschieden, was in die Lernbox
 * kommt. Bis Phase 2 stand diese Liste auf der Niveau-Seite; „Lernpfad"
 * meint seitdem ausschließlich den Grammatik-Pfad.
 *
 * Jede Lektion ist eine Station mit einem großen Schalter. Das erste
 * Einschalten fragt einmal, wie man anfangen möchte: Wörter prüfen
 * (Einstufung) oder alle Wörter direkt in Fach 1. Danach nimmt der Schalter
 * die Lektion heraus und legt sie wieder hinein, ohne Lernstand zu verlieren.
 * „Eigene Wörter" stehen als eigene Station darunter: einschalten, eintragen,
 * löschen. Die Lernbox-Seite zeigt danach nur noch die Box selbst.
 */
export default function VocabularyLessons({ lang, level, stations, next, vocabularyHref, vocabularyTranslations, ownWords }: {
  lang: string
  level: string
  stations: PathStation[]
  /** Der große Weiter-Knopf; fehlt er, gibt es gerade nichts zu tun. */
  next: LessonsNext | null
  vocabularyHref: string | null
  vocabularyTranslations?: VocabularyTranslations
  /** „Eigene Wörter" des Niveaus; fehlt, wenn der Vokabeltrainer nicht offen ist. */
  ownWords?: LessonStation
}) {
  const t = studentTranslator(lang)
  const vt = createVocabularyTranslator(vocabularyTranslations ?? {})
  const router = useRouter()
  const [, startRefresh] = useTransition()
  // Die Station bleibt nach dem Schließen gesetzt, damit das Blatt mit Inhalt hinausfährt.
  const [selected, setSelected] = useState<PathStation | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [start, setStart] = useState<{ lesson: string; label: string; count: number; fresh: boolean } | null>(null)
  const [startOpen, setStartOpen] = useState(false)
  const [startPending, setStartPending] = useState<'assess' | 'all' | null>(null)
  const [startFailed, setStartFailed] = useState(false)
  const [cardsFor, setCardsFor] = useState<string | null>(null)
  // Schalterstellung sofort zeigen, bis der Server sie bestätigt hat.
  const [override, setOverride] = useState<Record<string, boolean>>({})
  const [pending, setPending] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  useEffect(() => { setOverride({}) }, [stations, ownWords])
  const done = stations.filter(station => station.state === 'done').length
  const ownTitle = vt('own_words_title')

  const inBox = (station: LessonStation) => override[station.lesson] ?? isLessonInBox(station)
  const started = (station: LessonStation) => station.active + station.learned > 0
  const refresh = () => startRefresh(() => router.refresh())

  function openStart(station: LessonStation, label: string) {
    const fresh = !started(station)
    setStart({ lesson: station.lesson, label, count: fresh ? station.total : station.untouched, fresh })
    setStartFailed(false)
    setSheetOpen(false)
    setStartOpen(true)
  }

  async function toggle(station: LessonStation, label: string, own = false) {
    if (pending) return
    const on = inBox(station)
    // Erstes Einschalten einer Kurslektion: einmal fragen, wie es losgehen soll.
    if (!on && !started(station) && !own) { openStart(station, label); return }
    setPending(station.lesson)
    setFailed(null)
    setOverride(previous => ({ ...previous, [station.lesson]: !on }))
    try {
      // Eigene Wörter brauchen keine Einstufung: alle Wörter direkt in Fach 1.
      const result = !on && !started(station)
        ? await initializeLesson(station.lesson, level)
        : await setLessonInBox(station.lesson, level, !on)
      if (!result.success) throw new Error('lesson_switch_failed')
      refresh()
    } catch {
      setOverride(previous => { const next = { ...previous }; delete next[station.lesson]; return next })
      setFailed(station.lesson)
    } finally { setPending(null) }
  }

  async function startWithAssessment() {
    if (!start || !vocabularyHref || startPending) return
    setStartPending('assess')
    // Eine alte Pause (nach Zurücksetzen) darf die frisch eingestufte Lektion
    // nicht verstecken. Scheitert das, bleibt die Einstufung trotzdem möglich.
    await setLessonInBox(start.lesson, level, true).catch(() => undefined)
    router.push(`${vocabularyHref}/assess?lesson=${encodeURIComponent(start.lesson)}`)
  }

  async function startWithAllWords() {
    if (!start || startPending) return
    setStartPending('all')
    setStartFailed(false)
    try {
      const result = await initializeLesson(start.lesson, level)
      if (!result.success) throw new Error('lesson_init_failed')
      setOverride(previous => ({ ...previous, [start.lesson]: true }))
      setStartOpen(false)
      refresh()
    } catch {
      setStartFailed(true)
    } finally { setStartPending(null) }
  }

  function switchHint(station: LessonStation): string {
    if (inBox(station)) return t('switch_hint_on')
    return started(station) ? t('switch_hint_resume') : t('switch_hint_start')
  }

  const ownEmpty = !ownWords || ownWords.total === 0
  const ownOn = !!ownWords && inBox(ownWords)
  const startChoice = start && (
    <div className="grid gap-3">
      <p className="text-lg font-semibold text-[var(--foreground)]">{t('start_question')}</p>
      <button type="button" onClick={() => void startWithAllWords()} disabled={startPending !== null} className="st-choice st-press">
        <Layers size={24} aria-hidden="true" className="shrink-0" />
        <span className="min-w-0">
          <span className="st-choice__title">{startPending === 'all' ? t('start_saving') : t.count('start_all', start.count)}</span>
          <span className="st-choice__hint">{t('start_all_hint')}</span>
        </span>
      </button>
      <button type="button" onClick={() => void startWithAssessment()} disabled={startPending !== null} className="st-choice st-choice--primary st-press">
        <ListChecks size={24} aria-hidden="true" className="shrink-0" />
        <span className="min-w-0">
          <span className="st-choice__title">{startPending === 'assess' ? t('start_saving') : t('start_assess')}</span>
          <span className="st-choice__hint">{t('start_assess_hint')}</span>
        </span>
      </button>
      {startFailed && <p role="alert" className="st-path__error">{t('start_failed')}</p>}
    </div>
  )

  return (
    <div className="space-y-8">
      <section className="st-path-hero sl-glass sl-hero" aria-labelledby="lessons-title">
        <div className="relative">
          <p className="st-eyebrow !mt-0">{t('areas_level', { level })}</p>
          <div className="st-path-hero__row">
            <div className="min-w-0 flex-1">
              <h2 id="lessons-title" className="st-path-hero__title">{t('lessons_title')}</h2>
              <p className="st-path-hero__text">{t('lessons_hint')}</p>
            </div>
            {stations.length > 0 && (
              <ProgressRing value={done / stations.length} size={84} stroke={8} tone={done === stations.length ? 'success' : 'accent'}
                label={t('lessons_progress_aria', { done, total: stations.length })}>
                <strong className="text-2xl font-extrabold tabular-nums text-[var(--foreground)]">{done}/{stations.length}</strong>
              </ProgressRing>
            )}
          </div>
          {stations.length > 0 && <p className="st-path-hero__count">{t('lessons_done', { done, total: stations.length })}</p>}
          {next && ('href' in next ? (
            <Link href={next.href} className="st-cta st-press">
              <span className="st-cta__text">
                <span className="st-cta__label">{t('lessons_continue')}</span>
                <span className="st-cta__hint">{next.hint}</span>
              </span>
              <span className="st-cta__arrow" aria-hidden="true"><ArrowRight size={24} /></span>
            </Link>
          ) : (
            <button type="button" className="st-cta st-press" aria-haspopup="dialog" onClick={() => {
              const station = stations.find(entry => entry.lesson === next.lesson)
              if (station) openStart(station, station.label)
            }}>
              <span className="st-cta__text">
                <span className="st-cta__label">{t('lessons_continue')}</span>
                <span className="st-cta__hint">{next.hint}</span>
              </span>
              <span className="st-cta__arrow" aria-hidden="true"><ArrowRight size={24} /></span>
            </button>
          ))}
        </div>
      </section>

      {vocabularyHref && (
        <div>
          {stations.length === 0 ? <p className="st-empty">{t('lessons_empty')}</p> : (
            <ol className="st-path" aria-labelledby="lessons-title">
              {stations.map((station, index) => {
                const on = inBox(station)
                return (
                  <li key={station.lesson} className="st-path__stop" data-state={station.state} data-inbox={on} style={{ '--i': index } as CSSProperties}>
                    <div className="st-path__row">
                      <span className="st-path__node" aria-hidden="true">
                        {station.state === 'done' ? <Check size={24} strokeWidth={3} /> : station.number}
                      </span>
                      <div className="st-path__card">
                        <button type="button" className="st-path__open st-press" onClick={() => { setSelected(station); setSheetOpen(true) }} aria-haspopup="dialog">
                          <span className="st-path__body">
                            <span className="st-path__name">{station.label}</span>
                            <span className="st-path__meta">
                              <span className="st-path__state">{t(station.state === 'done' ? 'station_done' : station.state === 'current' ? 'station_current' : 'station_open')}</span>
                              <span aria-hidden="true">·</span>
                              <span>{t('station_words', { count: station.total })}</span>
                            </span>
                            {on && station.due > 0 && <span className="st-path__due">{t('station_due', { count: station.due })}</span>}
                            <span className="st-path__bar" aria-hidden="true">
                              <span style={{ width: `${station.total ? ((station.total - station.untouched) / station.total) * 100 : 0}%` }} />
                            </span>
                          </span>
                          <ChevronRight size={20} aria-hidden="true" className="st-path__chevron" />
                        </button>
                        <div className="st-path__switch">
                          <BoxSwitch on={on} busy={pending === station.lesson} label={t(on ? 'switch_on' : 'switch_off')} hint={switchHint(station)}
                            ariaLabel={t('switch_aria', { lesson: station.label })} onToggle={() => void toggle(station, station.label)} />
                          {failed === station.lesson && <p role="alert" className="st-path__error">{t('switch_failed')}</p>}
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}

          {ownWords && (
            <article className="st-own-words" data-inbox={ownOn} aria-labelledby="path-own-title">
              <div className="flex items-start gap-3">
                <span className="st-own-words__icon" aria-hidden="true"><PenLine size={22} /></span>
                <div className="min-w-0 flex-1">
                  <h3 id="path-own-title" className="st-path__name">{ownTitle}</h3>
                  <p className="st-path__meta">{ownEmpty ? vt('own_words_empty') : vt('set_words_total', { count: ownWords.total })}</p>
                  {ownOn && ownWords.due > 0 && <span className="st-path__due mt-1 inline-block">{t('station_due', { count: ownWords.due })}</span>}
                </div>
              </div>
              <BoxSwitch on={ownOn} busy={pending === ownWords.lesson} disabled={ownEmpty}
                label={t(ownOn ? 'switch_on' : 'switch_off')}
                hint={ownEmpty ? vt('own_words_switch_disabled') : switchHint(ownWords)}
                ariaLabel={t('switch_aria', { lesson: ownTitle })} onToggle={() => void toggle(ownWords, ownTitle, true)} />
              {failed === ownWords.lesson && <p role="alert" className="st-path__error">{vt('own_words_activate_failed')}</p>}
              <button type="button" onClick={() => setCardsFor(ownWords.lesson)}
                className={`st-button st-press w-full ${ownEmpty ? 'st-button--primary' : 'st-button--soft'}`}>
                {ownEmpty ? <Plus size={20} aria-hidden="true" /> : <PenLine size={20} aria-hidden="true" />}
                {ownEmpty ? vt('own_words_add_first') : t('own_edit')}
              </button>
            </article>
          )}
        </div>
      )}

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={selected?.label ?? ''} closeLabel={t('close')}
        icon={selected?.state === 'done' ? <Check size={24} strokeWidth={3} /> : <BookOpen size={24} />}
        description={selected ? t(inBox(selected) ? 'switch_on' : 'switch_off') : undefined}
        footer={selected && vocabularyHref ? (
          <div className="grid gap-3">
            <button type="button" onClick={() => { setSheetOpen(false); setCardsFor(selected.lesson) }} className="st-button st-button--soft st-press">
              <Eye size={20} aria-hidden="true" />{t('station_show_words')}
            </button>
            {started(selected) && selected.untouched > 0 && (
              <button type="button" onClick={() => openStart(selected, selected.label)} className="st-button st-button--soft st-press">
                <Plus size={20} aria-hidden="true" />{t.count('station_add_new', selected.untouched)}
              </button>
            )}
            {!started(selected) && (
              <button type="button" onClick={() => openStart(selected, selected.label)} className="st-button st-button--primary st-press">
                <ListChecks size={20} aria-hidden="true" />{t('station_start')}
              </button>
            )}
            {inBox(selected) && selected.due > 0 && (
              <Link href={vocabularyHref} className="st-button st-button--primary st-press">
                <BookOpen size={20} aria-hidden="true" />{t('station_practice')}
              </Link>
            )}
          </div>
        ) : undefined}>
        {selected && (
          <div className="flex flex-col items-center gap-5 py-2 sm:flex-row sm:items-center">
            <ProgressRing value={selected.total ? selected.learned / selected.total : 0} size={112} stroke={10} tone="success"
              label={t('station_learned', { learned: selected.learned, total: selected.total })}>
              <strong className="text-3xl font-extrabold tabular-nums">{selected.learned}</strong>
              <small className="text-sm font-semibold text-[var(--muted)]">/ {selected.total}</small>
            </ProgressRing>
            <ul className="st-station-facts">
              <li>{t('station_learned', { learned: selected.learned, total: selected.total })}</li>
              <li>{t('station_in_box', { count: selected.active })}</li>
              <li>{t('station_new', { count: selected.untouched })}</li>
              {inBox(selected) && selected.due > 0 && <li className="st-station-facts__due">{t('station_due', { count: selected.due })}</li>}
            </ul>
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={startOpen} onClose={() => setStartOpen(false)} dismissible={startPending === null} closeLabel={t('close')}
        title={start ? (start.fresh ? t('start_title', { lesson: start.label }) : t.count('station_add_new', start.count)) : ''}
        description={start && !start.fresh ? start.label : undefined} icon={<Layers size={24} />}>
        {startChoice}
      </BottomSheet>

      {cardsFor && vocabularyTranslations && (
        <LessonCardsModal lesson={cardsFor} level={level} uiLanguage={lang} translations={vocabularyTranslations}
          onClose={() => setCardsFor(null)} onCardAdded={refresh} />
      )}
    </div>
  )
}
