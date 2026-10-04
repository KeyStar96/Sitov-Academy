'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { UserRound } from 'lucide-react'
import BrandLogo from './BrandLogo'
import DashboardHeader from './DashboardHeader'
import ThemeToggle from './ThemeToggle'
import LogoutButton from '@/components/dashboard/LogoutButton'
import StudentNavigation from '@/components/dashboard/StudentNavigation'
import MotionProvider from '@/components/motion/MotionProvider'
import { createDashboardTranslator, type DashboardTranslations } from '@/lib/dashboard-i18n'
import { EASE_OUT_SOFT, MOTION, useIsHydrating, useReducedMotionSafe } from '@/lib/motion'
import { studentTranslator } from '@/lib/student-ui-i18n'
import type { SupportLabels } from '@/lib/support-channels'
import { isSitovExamPath } from '@/lib/exam-navigation'
import { AppearanceProvider, useAppearanceCopy } from './AppearanceProvider'
import { APPEARANCE_FALLBACKS } from '@/lib/appearance-i18n'

/** A single persistent learner shell for every module, round and daily journey. */
export default function SitovLearningShell({ lang, translations, displayName, levels, lastActiveLevel, supportLabels,
  breadcrumbLabel, learnNew = false, sitovPreviewPathname, children }: {
  lang: string
  translations: DashboardTranslations
  displayName: string
  levels: string[]
  lastActiveLevel?: string | null
  supportLabels: SupportLabels
  breadcrumbLabel?: string
  learnNew?: boolean
  /** Synthetic route in local visual previews; no learner session is created. */
  sitovPreviewPathname?: string
  children: ReactNode
}) {
  const sitovCurrentPath = usePathname() ?? ''
  const sitovPathname = sitovPreviewPathname ?? sitovCurrentPath
  const sitovExam = isSitovExamPath(sitovPathname)
  const sitovReduced = useReducedMotionSafe()
  const sitovHydrating = useIsHydrating()
  const sitovT = createDashboardTranslator(sitovExam ? {} : translations)
  const sitovS = studentTranslator(sitovExam ? 'de' : lang)
  const sitovAppearance = useAppearanceCopy()
  const sitovShell = useRef<HTMLDivElement>(null)
  const sitovHeader = useRef<HTMLElement>(null)

  useEffect(() => {
    const sitovElement = sitovHeader.current
    if (!sitovElement) return
    const sitovMeasure = () => sitovShell.current?.style.setProperty('--sitov-shell-header-height', `${Math.round(sitovElement.getBoundingClientRect().height)}px`)
    sitovMeasure()
    const sitovObserver = new ResizeObserver(sitovMeasure)
    sitovObserver.observe(sitovElement)
    return () => sitovObserver.disconnect()
  }, [])

  return <AppearanceProvider copy={sitovExam ? APPEARANCE_FALLBACKS : sitovAppearance}><MotionProvider><div ref={sitovShell} className="academy-student-shell sitov-learning-shell" data-tabbar="visible" lang={sitovExam ? 'de' : lang} translate="no">
    <header ref={sitovHeader} className="academy-student-header">
      <div className="academy-container sitov-shell-frame">
        <div className="academy-student-toolbar">
          <Link href={`/${lang}/dashboard`} className="academy-brand-link sitov-shell-brand" aria-label="Sitov Academy">
            <BrandLogo name="Sitov Academy" />
          </Link>
          <div className="sitov-shell-account">
            <p className="sitov-shell-greeting">{sitovT('hello', { name: displayName })}</p>
            <div className="sitov-shell-tools">
              <Link href={`/${lang}/dashboard/profile`} className="st-toolbar-button st-press sitov-shell-profile" aria-label={sitovT('open_profile_aria')}>
                <UserRound size={21} aria-hidden="true" /><span aria-hidden="true">{sitovS('nav_profile')}</span>
              </Link>
              <ThemeToggle lightLabel={sitovT('toggle_theme_light')} darkLabel={sitovT('toggle_theme_dark')} label={sitovS('settings_appearance')} />
              <LogoutButton lang={lang} uiLanguage={sitovExam ? 'de' : lang} />
            </div>
          </div>
        </div>
        <div className="sitov-shell-navigation-row">
          <StudentNavigation lang={lang} firstLevel={levels[0] ?? null} levels={levels} supportLabels={supportLabels}
            lastActiveLevel={lastActiveLevel} learnNew={learnNew} sitovPathname={sitovPreviewPathname} />
          <div className="academy-student-breadcrumb"><DashboardHeader lang={lang} translations={translations}
            breadcrumbLabel={breadcrumbLabel} sitovPathname={sitovPreviewPathname} /></div>
        </div>
        <div className="sitov-shell-motion-track" aria-hidden="true">
          <motion.span key={sitovPathname} initial={sitovReduced || sitovHydrating ? false : { x: '-100%', opacity: 0 }}
            animate={{ x: '0%', opacity: 1 }} transition={{ duration: sitovReduced ? 0 : MOTION.slower, ease: EASE_OUT_SOFT }} />
        </div>
      </div>
    </header>
    <div className="academy-student-content academy-container">{children}</div>
  </div></MotionProvider></AppearanceProvider>
}
