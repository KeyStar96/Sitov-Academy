'use client'

import { useState } from 'react'
import SitovPreviewAppearance from '@/components/dashboard/SitovPreviewAppearance'
import VocabTrainerPageClient from '@/components/vocabulary/VocabTrainerPageClient'
import PronunciationStudio from '@/components/audio/PronunciationStudio'
import LearningPathClient from '@/components/learning-path/LearningPathClient'
import RuleCard from '@/components/learning-path/RuleCard'
import PathExerciseForm from '@/components/learning-path/PathExerciseForm'
import SitovMotionStage from './SitovMotionStage'
import pathStyles from '@/components/learning-path/learning-path.module.css'
import { computeWordBoxState, summarizeBox } from '@/lib/vocabulary-box'
import type { DueVocabularyCard } from '@/lib/types/vocabulary'
import type { PathMap } from '@/lib/learning-path-contract'
import type { PronunciationPrompt } from '@/lib/pronunciation-prompts'
import de from '@/dictionaries/de.json'

const sitovId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const sitovSummary = summarizeBox(Array.from({ length: 64 }, (_, index) => computeWordBoxState([
  { direction: 'de_to_native', box_number: index % 7 + 1, next_review_date: index < 24 ? '2020-01-01T00:00:00Z' : '2099-01-01T00:00:00Z' },
  { direction: 'native_to_de', box_number: index % 7 + 1, next_review_date: '2099-01-01T00:00:00Z' },
])))
const sitovCards: DueVocabularyCard[] = Array.from({ length: 24 }, (_, index) => ({
  progressId: sitovId(500 + index), direction: 'de_to_native', format: 'word', mode: 'flashcard',
  prompt: 'das Haus', promptLanguage: 'de', contextSentence: null, solution: null, box: 1, phase: 1,
  card: { id: sitovId(200 + index), lesson: 'Lektion 1', level: 'A1.1', word_de: 'Haus', article: 'das', plural: 'Häuser', image_url: null, audio_url: null },
  translation: 'house', isHardForNativeLanguage: false,
}))
const sitovMap: PathMap = {
  level: 'A1.1', completed: false, next_level: 'A1.2', next_level_available: false,
  paths: [{ id: sitovId(601), source_id: 'sitov-preview', title: 'Dein erster Weg auf Deutsch', sort_order: 1, available: true, completed: false,
    nodes: ['Begrüßung', 'Sich vorstellen', 'Im Alltag', 'Wiederholen', 'Dein erster Test'].map((title, index) => ({
      id: sitovId(610 + index), title, kind: index === 3 ? 'review' : index === 4 ? 'test' : 'practice', sort_order: index + 1,
      available: index <= 2, status: index < 2 ? 'completed' : null, stars: index < 2 ? 3 : 0, tests: [],
    })),
  }],
}
const sitovPrompts: PronunciationPrompt[] = [
  { id: sitovId(401), unitId: sitovId(151), title: 'Ein neuer Tag', lesson: 'Lektion 1', cefrLevel: 'A1', focus: 'Satzmelodie', audioUrl: null, sortOrder: 1,
    sentenceDe: 'Guten Morgen! Ich heiße Lukas und lerne Deutsch. Heute treffe ich meinen Freund Max. Wir trinken einen Kaffee und sprechen über unseren Tag. Danach gehen wir zusammen in die Stadt. Ich höre zu, spreche langsam und probiere neue Wörter aus.' },
  { id: sitovId(402), unitId: sitovId(152), title: 'Unterwegs', lesson: 'Lektion 2', cefrLevel: 'A1', focus: 'ü und ö', audioUrl: null, sortOrder: 2,
    sentenceDe: 'Ich fahre früh mit dem Zug. Mein Bruder wartet am Bahnhof. Wir möchten zusammen üben.' },
]

/** All requests in visual QA use the read-only loopback fixture. */
export default function SitovTrainerMotionPreview({ lang, initialView = 'vocabulary' }: {
  lang: string
  initialView?: 'vocabulary' | 'path' | 'pronunciation'
}) {
  const [view, setView] = useState(initialView)
  const [empty, setEmpty] = useState(false)
  const [translation, setTranslation] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  return <div className="st-shell"><div className="academy-container space-y-6 py-8">
    <p className="text-sm text-[var(--muted)]">Sitov Academy · Lokale Motion-Vorschau · Beispieldaten</p>
    <SitovPreviewAppearance />
    <div className="flex flex-wrap items-center gap-2" aria-label="Vorschau auswählen">
      {(['vocabulary', 'path', 'pronunciation'] as const).map(item => <button key={item} type="button" aria-pressed={view === item}
        className="st-button st-button--quiet" onClick={() => { setView(item); setSubmitted(false) }}>{item === 'vocabulary' ? 'Lernbox' : item === 'path' ? 'Lernpfad' : 'Aussprache'}</button>)}
      <label className="flex min-h-12 items-center gap-2"><input type="checkbox" checked={empty} onChange={event => setEmpty(event.target.checked)} />Leerzustand</label>
    </div>
    {view === 'vocabulary' && <VocabTrainerPageClient key={String(empty)} learnerId={sitovId(1)} initialCards={empty ? [] : sitovCards}
      boxSummary={empty ? summarizeBox([]) : sitovSummary} translations={de.vocabulary} lang={lang} level="A1.1" />}
    {view === 'path' && <>
      <LearningPathClient initialPath={empty ? { ...sitovMap, paths: [] } : sitovMap} lang={lang} level="A1.1" />
      {!empty && <div className={pathStyles.root}><SitovMotionStage className={pathStyles.sitovView}>
        <RuleCard card={{ rule: 'Mit ich endet das Verb auf -e. Bei du steht -st, bei er steht -t.', examples: ['Ich lerne Deutsch.', 'Du lernst Deutsch.', 'Er lernt Deutsch.'] }} lang={lang} />
        <PathExerciseForm exercise={{ id: sitovId(701), type: 'fill_in_blank', content: { instruction: 'Ergänze das Verb.', text_before: 'Ich', text_after: 'Deutsch.', gap_hint: 'lernen' }, translation: { task: 'I am learning German.' } }}
          lang={lang} busy={false} isTest={false} translationOpen={translation} onTranslationToggle={() => setTranslation(value => !value)} onSubmit={() => setSubmitted(true)} />
        {submitted && <p role="status">Vorschau: Antwort empfangen.</p>}
      </SitovMotionStage></div>}
    </>}
    {view === 'pronunciation' && <PronunciationStudio key={String(empty)} prompts={empty ? [] : sitovPrompts} conversations={[]} level="A1.1" lang={lang}
      translations={de.pronunciation} learnerId={sitovId(1)} checkpoint={null} />}
  </div></div>
}
