'use client'

import { useMemo } from 'react'
import DailyQuestEngine from './DailyQuestEngine'
import { createDailyQuestPreviewActions } from './DailyQuestPreview'
import type { DailyQuest, DailyQuestPreview as SitovPreviewData } from '@/lib/daily-quest-contract'

/** Entirely local authored scene for development visual checks, without an account. */
const sitovQuest: DailyQuest = {
  id: 'c9e3e3ca-69ac-4383-90cd-3788dc1e3104', date: '2026-10-03', status: 'active', level: 'A1',
  templateKey: 'sitov-preview-bakery', title: 'Beim Bäcker', subtitle: 'Hol dir ein kleines Frühstück.',
  scene: {
    backgroundKey: 'bakery', backgroundImage: '/Bilder/deutschreise/sitov-bakery-male.png',
    imageAlt: 'Martin steht mit Brot und Brötchen hinter dem Tresen seiner Bäckerei.',
    location: 'Bäckerei', audioText: 'Guten Morgen! Was möchten Sie?', speakerId: 'sitov-martin',
    characters: [{ id: 'sitov-martin', name: 'Martin', voice: 'male' }],
  },
  personalization: { source: 'fallback', cardId: null },
  steps: [
    { id: 'sitov-discover', kind: 'discover', instruction: 'Entdecke die Wörter.', words: [
      { id: 'sitov-bread', text: 'das Brot', audioText: 'Das Brot.' },
      { id: 'sitov-coffee', text: 'der Kaffee', audioText: 'Der Kaffee.' },
      { id: 'sitov-roll', text: 'das Brötchen', audioText: 'Das Brötchen.' },
    ] },
    { id: 'sitov-build', kind: 'sentence_build', speakerId: 'sitov-martin', prompt: 'Bestelle freundlich.', pieces: [
      { id: 'sitov-i', text: 'Ich' }, { id: 'sitov-want', text: 'möchte' }, { id: 'sitov-a-bread', text: 'ein Brot.' },
    ], audioText: 'Ich möchte ein Brot.' },
    { id: 'sitov-dialogue', kind: 'dialogue_choice', speakerId: 'sitov-martin', prompt: 'Möchten Sie eine Tüte?',
      options: [{ id: 'sitov-yes', text: 'Ja, bitte.' }, { id: 'sitov-morning', text: 'Guten Morgen.' }], audioText: 'Möchten Sie eine Tüte?' },
  ],
  completedStepIds: [], completion: { title: 'Deutsch im Alltag geschafft!', text: 'Du hast Wörter entdeckt, einen Satz gebaut und passend geantwortet.' },
}

export default function SitovDailyQuestShellPreview({ lang, completed = false }: { lang: string; completed?: boolean }) {
  const sitovPreview = useMemo<SitovPreviewData>(() => ({ success: true,
    quest: completed ? { ...sitovQuest, status: 'completed', completedStepIds: sitovQuest.steps.map(sitovStep => sitovStep.id) } : sitovQuest,
    answerKey: { steps: { 'sitov-build': { accepted: [['sitov-i', 'sitov-want', 'sitov-a-bread']] }, 'sitov-dialogue': { optionId: 'sitov-yes' } } },
  }), [completed])
  const sitovActions = useMemo(() => createDailyQuestPreviewActions(sitovPreview), [sitovPreview])
  return <DailyQuestEngine key={completed ? 'completed' : 'active'} initialQuest={sitovPreview.quest}
    initialStreak={{ current: 1, longest: 1, lastCompletedDate: '2026-10-03' }} locale={lang}
    dashboardHref={`/${lang}/sitov-preview/home-motion`} actions={sitovActions} />
}
