'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Check,
  Inbox,
  Layers,
  ListChecks,
  ListPlus,
  Plus,
  Sparkles,
  Trash2,
  X,
  BookOpenCheck,
} from 'lucide-react'
import { createVocabularyTranslator, type VocabularyTranslations } from '@/lib/vocabulary-i18n'
import { loadLernkastenSelection, saveLernkastenSelection, consumeVocabularyAutostart, hasVocabularyAutostart } from '@/lib/vocabulary-lernkasten'
import type { DueVocabularyCard, LessonStat } from '@/lib/types/vocabulary'
import { cn } from '@/lib/utils'
import { initializeLesson } from '@/app/actions/vocabulary'
import VocabCardSession from './VocabCardSession'
import LessonCardsModal from './LessonCardsModal'

interface VocabTrainerPageClientProps {
  initialCards: DueVocabularyCard[]
  lessonStats: LessonStat[]
  translations?: VocabularyTranslations
  lang: string
  level: string
}

const DND_MIME = 'application/x-sitov-lesson'

export default function VocabTrainerPageClient({
  initialCards,
  lessonStats,
  translations = {},
  lang,
  level,
}: VocabTrainerPageClientProps) {
  const router = useRouter()
  const t = useMemo(() => createVocabularyTranslator(translations), [translations])
  const levelSegment = encodeURIComponent(level)
  const overviewBase = `/${lang}/dashboard/level/${levelSegment}/vocabulary`
  const overviewHref = `/${lang}/dashboard/level/${levelSegment}`

  const dueByLesson = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of initialCards) {
      map.set(item.card.lesson, (map.get(item.card.lesson) ?? 0) + 1)
    }
    return map
  }, [initialCards])

  const lessons = useMemo(() => {
    return [...lessonStats].sort((a, b) => {
      const dueA = dueByLesson.get(a.lesson) ?? 0
      const dueB = dueByLesson.get(b.lesson) ?? 0
      if (dueA > 0 !== dueB > 0) return dueA > 0 ? -1 : 1
      return a.lesson.localeCompare(b.lesson, 'de-DE')
    })
  }, [lessonStats, dueByLesson])

  const selectableLessons = useMemo(
    () => new Set(lessons.filter((l) => (dueByLesson.get(l.lesson) ?? 0) > 0).map((l) => l.lesson)),
    [lessons, dueByLesson]
  )

  const defaultSelection = useMemo(() => [...selectableLessons], [selectableLessons])

  const [selection, setSelection] = useState<string[]>(defaultSelection)
  const [hydrated, setHydrated] = useState(false)
  const [phase, setPhase] = useState<'compose' | 'train'>('compose')
  const [sessionCards, setSessionCards] = useState<DueVocabularyCard[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [openLesson, setOpenLesson] = useState<string | null>(null)
  const didAutoStart = useRef(false)
  
  // Onboarding Modal State
  const [onboardingLesson, setOnboardingLesson] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)

  useEffect(() => {
    const saved = loadLernkastenSelection(level)
    if (saved !== null) {
      setSelection(saved.filter((lesson) => lessonStats.some((s) => s.lesson === lesson)))
    }
    setHydrated(true)
  }, [level, lessonStats])

  useEffect(() => {
    if (!hydrated) return
    saveLernkastenSelection(level, selection)
  }, [selection, hydrated, level])

  const selectionSet = useMemo(() => new Set(selection), [selection])

  useEffect(() => {
    if (!hydrated || didAutoStart.current) return
    if (!hasVocabularyAutostart(level)) return
    const chosen = initialCards.filter((item) => selectionSet.has(item.card.lesson))
    if (chosen.length === 0) return
    consumeVocabularyAutostart(level)
    didAutoStart.current = true
    setSessionCards(chosen)
    setPhase('train')
  }, [hydrated, initialCards, level, selectionSet])

  const selectedDueCount = useMemo(
    () => selection.reduce((sum, lesson) => sum + (dueByLesson.get(lesson) ?? 0), 0),
    [selection, dueByLesson]
  )

  const addLesson = useCallback(
    (lesson: string) => {
      setSelection((prev) => (prev.includes(lesson) ? prev : [...prev, lesson]))
    },
    []
  )

  const removeLesson = useCallback((lesson: string) => {
    setSelection((prev) => prev.filter((entry) => entry !== lesson))
  }, [])

  const handleToggleLesson = useCallback(
    (lessonName: string) => {
      if (selectionSet.has(lessonName)) {
        removeLesson(lessonName)
        return
      }

      const stat = lessonStats.find((s) => s.lesson === lessonName)
      if (!stat) return

      const hasProgress = stat.active > 0 || stat.learned > 0
      
      // Onboarding Decision: Wenn kein Fortschritt existiert und die Lektion noch nie berührt wurde, Modal zeigen.
      if (!hasProgress && stat.untouched > 0) {
        setOnboardingLesson(lessonName)
      } else {
        addLesson(lessonName)
      }
    },
    [selectionSet, lessonStats, removeLesson, addLesson]
  )

  const handleInitializeLesson = async (lessonName: string) => {
    setIsInitializing(true)
    const result = await initializeLesson(lessonName, level)
    setIsInitializing(false)
    if (result.success) {
      setOnboardingLesson(null)
      addLesson(lessonName)
    }
  }

  const clearSelection = useCallback(() => setSelection([]), [])

  const startSession = useCallback(() => {
    const chosen = initialCards.filter((item) => selectionSet.has(item.card.lesson))
    if (chosen.length === 0) return
    setSessionCards(chosen)
    setPhase('train')
  }, [initialCards, selectionSet])

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setDragOver(false)
      const lesson = event.dataTransfer.getData(DND_MIME) || event.dataTransfer.getData('text/plain')
      if (lesson) handleToggleLesson(lesson)
    },
    [handleToggleLesson]
  )

  const handleCardAdded = useCallback(() => {
    router.refresh()
  }, [router])

  if (phase === 'train') {
    return (
      <VocabCardSession
        cards={sessionCards}
        translations={translations}
        overviewHref={overviewBase}
        onBackToLernkasten={() => setPhase('compose')}
      />
    )
  }

  const canStart = selectedDueCount > 0

  return (
    <div className="mx-auto min-h-screen w-full max-w-4xl rounded-3xl bg-white p-4 py-6 shadow-sm ring-1 ring-gray-900/5 sm:p-10">

      <div className="mb-8 border-b border-gray-200 pb-6">
        <h1 className="break-words text-3xl font-extrabold text-gray-900 sm:text-4xl">{t('title')}</h1>
        <p className="mt-2 text-xl text-gray-600">{t('subtitle')}</p>
      </div>

      {/* ── Lernkasten (Selection-Box) ───────────────────────────────── */}
      <section
        aria-label={t('lernkasten_title')}
        onDragOver={(event) => {
          event.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          'rounded-3xl border-2 border-dashed p-6 shadow-sm transition-colors sm:p-8',
          dragOver ? 'border-[#FF5C00] bg-orange-50' : 'border-blue-300 bg-blue-50/60'
        )}
      >
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md">
                <Inbox size={26} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="text-2xl font-extrabold text-gray-900">{t('lernkasten_title')}</h2>
                <p className="mt-1 text-base leading-relaxed text-gray-600">{t('lernkasten_intro')}</p>
              </div>
            </div>

            {selection.length === 0 ? (
              <p className="mt-6 rounded-2xl border-2 border-dashed border-blue-200 bg-white/70 p-6 text-center text-lg text-gray-600">
                {t('lernkasten_empty')}
              </p>
            ) : (
              <>
                <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-lg font-bold text-blue-900 shadow-sm ring-1 ring-blue-100">
                  <Layers size={20} aria-hidden="true" />
                  {t('lernkasten_summary', { lessons: selection.length, cards: selectedDueCount })}
                </p>

                <ul className="mt-4 flex flex-wrap gap-2">
                  {selection.map((lesson) => (
                    <li key={lesson}>
                      <span className="inline-flex items-center gap-2 rounded-full border-2 border-blue-200 bg-white py-2 pl-4 pr-2 text-base font-semibold text-blue-900 shadow-sm">
                        {lesson}
                        <button
                          type="button"
                          onClick={() => removeLesson(lesson)}
                          aria-label={t('lernkasten_remove_aria', { lesson })}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-blue-500 transition-colors hover:bg-blue-100 hover:text-blue-800 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00]"
                        >
                          <X size={20} aria-hidden="true" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="shrink-0 flex flex-col items-center justify-center rounded-2xl border-2 border-blue-200 bg-white p-6 shadow-sm">
            <div className="text-5xl font-extrabold text-blue-700">{selectedDueCount}</div>
            <div className="mt-1 text-lg font-bold text-blue-900">{t('due_count')}</div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={startSession}
            disabled={!canStart}
            className="inline-flex min-h-16 flex-1 items-center justify-center gap-3 rounded-2xl bg-blue-600 px-8 py-4 text-xl font-bold text-white shadow-md transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00]"
          >
            <Sparkles size={24} aria-hidden="true" />
            {t('start_learning')}
          </button>

          {selection.length > 0 && (
            <button
              type="button"
              onClick={clearSelection}
              className="inline-flex min-h-16 items-center justify-center gap-2 rounded-2xl border-2 border-gray-300 bg-white px-6 py-4 text-lg font-bold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00]"
            >
              <Trash2 size={20} aria-hidden="true" />
              {t('lernkasten_clear')}
            </button>
          )}
        </div>

        {!canStart && (
          <p className="mt-3 text-base font-medium text-gray-600" role="status">
            {selection.length === 0
              ? t('lernkasten_start_hint_empty')
              : t('lernkasten_start_hint_nothing_due')}
          </p>
        )}
      </section>

      {/* ── Lektionsliste ─────────────────────────────────────── */}
      <h2 className="mb-6 mt-12 text-2xl font-bold text-gray-900">{t('your_sets')}</h2>

      {lessons.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center sm:p-12">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-blue-50">
            <BookOpenCheck className="h-10 w-10 text-blue-600" aria-hidden="true" />
          </div>
          <p className="break-words text-xl font-bold text-gray-800">{t('no_sets')}</p>
          <p className="mx-auto mt-2 max-w-md break-words text-lg text-gray-600">{t('no_sets_hint')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {lessons.map((stat) => {
            const due = dueByLesson.get(stat.lesson) ?? 0
            const inBox = selectionSet.has(stat.lesson)
            const learnedPercent = stat.total > 0 ? Math.round((stat.learned / stat.total) * 100) : 0
            const hasProgress = stat.active > 0 || stat.learned > 0
            const assessHref = `${overviewBase}/assess?lesson=${encodeURIComponent(stat.lesson)}`

            return (
              <div
                key={stat.lesson}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData(DND_MIME, stat.lesson)
                  event.dataTransfer.setData('text/plain', stat.lesson)
                  event.dataTransfer.effectAllowed = 'copy'
                }}
                className={cn(
                  "overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition-shadow hover:shadow-md",
                  inBox ? "border-blue-400 ring-2 ring-blue-50" : "border-gray-200"
                )}
              >
                <div className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold text-gray-900">{stat.lesson}</h3>
                      {inBox && (
                        <span className="shrink-0 rounded-full bg-blue-600 px-3 py-1 text-sm font-bold text-white">
                          {t('lernkasten_in_box')}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-4 text-lg text-gray-600">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-blue-500" aria-hidden="true" />
                        {stat.active} {t('in_training')}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-green-500" aria-hidden="true" />
                        {stat.learned} {t('learned')}
                      </span>
                      {due > 0 && (
                        <span className="inline-flex items-center gap-2 font-bold text-amber-700">
                          <span className="h-3 w-3 rounded-full bg-amber-500" aria-hidden="true" />
                          {due} {t('due_now')}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-gray-300" aria-hidden="true" />
                        {stat.total} {t('total')}
                      </span>
                    </div>

                    {stat.learned > 0 && (
                      <div className="mt-4 flex max-w-md items-center gap-3">
                        <div
                          className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100"
                          role="progressbar"
                          aria-valuenow={learnedPercent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={t('learned')}
                        >
                          <div
                            className="h-full rounded-full bg-green-500 transition-all duration-500"
                            style={{ width: `${learnedPercent}%` }}
                          />
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-500">
                          {learnedPercent}%
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:justify-end md:w-full md:mt-4 md:border-t md:border-gray-100 md:pt-4">
                    {stat.untouched > 0 && (
                      <Link
                        href={assessHref}
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-base font-bold text-white shadow-sm transition-colors hover:bg-emerald-500 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00]"
                      >
                        <ListChecks size={20} aria-hidden="true" />
                        {hasProgress ? t('continue_assessing') : t('assess_set')}
                      </Link>
                    )}

                    <button
                      type="button"
                      onClick={() => handleToggleLesson(stat.lesson)}
                      className={cn(
                        "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 px-5 py-2.5 text-base font-bold shadow-sm transition-colors focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00]",
                        inBox
                          ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800"
                          : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
                      )}
                    >
                      {inBox ? <Check size={20} aria-hidden="true" /> : <Plus size={20} aria-hidden="true" />}
                      {inBox ? 'Aus Lernbox entfernen' : 'In Lernbox aufnehmen'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setOpenLesson(stat.lesson)}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-gray-300 bg-white px-5 py-2.5 text-base font-bold text-gray-800 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00]"
                    >
                      <ListPlus size={20} aria-hidden="true" />
                      {t('show_cards')}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {openLesson && (
        <LessonCardsModal
          lesson={openLesson}
          level={level}
          translations={translations}
          onClose={() => setOpenLesson(null)}
          onCardAdded={handleCardAdded}
        />
      )}

      {/* ── Onboarding Modal (Einstufung vs Neu lernen) ────────────────── */}
      {onboardingLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setOnboardingLesson(null)} />
          <div
            className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-modal-title"
          >
            <button
              onClick={() => setOnboardingLesson(null)}
              className="absolute right-4 top-4 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00]"
              aria-label="Schließen"
            >
              <X size={24} />
            </button>
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <Sparkles className="h-8 w-8 text-blue-600" />
            </div>
            <h3 id="onboarding-modal-title" className="mb-2 text-center text-2xl font-bold text-gray-900">
              Neue Lektion: {onboardingLesson}
            </h3>
            <p className="mb-8 text-center text-lg text-gray-600">
              Möchtest du bekannte Wörter zuerst überspringen, oder möchtest du alle Wörter von Null lernen?
            </p>
            <div className="flex flex-col gap-4">
              <Link
                href={`${overviewBase}/assess?lesson=${encodeURIComponent(onboardingLesson)}`}
                className="inline-flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-6 text-xl font-bold text-white shadow-md transition-colors hover:bg-emerald-500"
              >
                <ListChecks size={24} />
                Zuerst einstufen
              </Link>
              <button
                type="button"
                onClick={() => handleInitializeLesson(onboardingLesson)}
                disabled={isInitializing}
                className="inline-flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl border-2 border-blue-600 bg-white px-6 text-xl font-bold text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50"
              >
                <Plus size={24} />
                {isInitializing ? "Wird geladen..." : "Alles von Null lernen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
