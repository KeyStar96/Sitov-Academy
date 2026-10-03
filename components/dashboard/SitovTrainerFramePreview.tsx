'use client'

import { useState } from 'react'
import LearningScreen from '@/components/vocabulary/LearningScreen'
import ThemeToggle from '@/components/layout/ThemeToggle'
import { AppearanceProvider } from '@/components/layout/AppearanceProvider'
import ModeDock from './ModeDock'
import { LEARNING_MODES } from '@/lib/mode-targets'
import { type AppearanceCopy } from '@/lib/appearance-i18n'

export default function SitovTrainerFramePreview({ lang, copy }: { lang: string; copy: AppearanceCopy }) {
  const [answer, setAnswer] = useState(false)
  return <AppearanceProvider copy={copy}><div className="academy-student-shell academy-container" style={{ paddingBlock: 20 }}>
    <header className="academy-student-header" style={{ padding: 12, marginBottom: 20 }}>
      <div className="flex items-center justify-between gap-3"><strong>Sitov Academy</strong><ThemeToggle lightLabel={copy.light} darkLabel={copy.dark} label={copy.title} /></div>
    </header>
    <ModeDock lang={lang} level="A1.1" entries={LEARNING_MODES.map(mode => ({ mode, lock: null }))} />
    <LearningScreen title="Learning path · Practice" subtitle="1 / 16" progress={6.25} onExit={() => setAnswer(false)} t={() => 'Back to overview'}>
      <div className="learning-card"><div className="learning-card-content"><h2 className="learning-word" lang="de">Guten Tag! Wie geht es dir?</h2>
        <button className="learning-button learning-button-wide" onClick={() => setAnswer(true)}>Mir geht es gut.</button>
        {answer && <p role="status">Correct! Well done.</p>}
      </div></div>
    </LearningScreen>
  </div></AppearanceProvider>
}
