'use client'

import { useState } from 'react'
import LearningScreen from '@/components/vocabulary/LearningScreen'
import { AppearanceProvider } from '@/components/layout/AppearanceProvider'
import SitovLearningShell from '@/components/layout/SitovLearningShell'
import ModeDock from './ModeDock'
import { LEARNING_MODES } from '@/lib/mode-targets'
import { type AppearanceCopy } from '@/lib/appearance-i18n'
import { type DashboardTranslations } from '@/lib/dashboard-i18n'
import { type SupportLabels } from '@/lib/support-channels'

export default function SitovTrainerFramePreview({ lang, copy, translations, supportLabels }: {
  lang: string; copy: AppearanceCopy; translations: DashboardTranslations; supportLabels: SupportLabels
}) {
  const [answer, setAnswer] = useState(false)
  return <AppearanceProvider copy={copy}><SitovLearningShell lang={lang} translations={translations} displayName="Dennis"
    levels={['A1.1']} supportLabels={supportLabels} sitovPreviewPathname={`/${lang}/dashboard/level/A1.1/path`}>
    <ModeDock lang={lang} level="A1.1" entries={LEARNING_MODES.map(mode => ({ mode, lock: null }))} />
    <LearningScreen title="Learning path · Practice" subtitle="1 / 16" progress={6.25} onExit={() => setAnswer(false)} t={() => 'Back to overview'}>
      <div className="learning-card"><div className="learning-card-content"><h2 className="learning-word" lang="de">Guten Tag! Wie geht es dir?</h2>
        <button className="learning-button learning-button-wide" onClick={() => setAnswer(true)}>Mir geht es gut.</button>
        {answer && <p role="status">Correct! Well done.</p>}
      </div></div>
    </LearningScreen>
  </SitovLearningShell></AppearanceProvider>
}
