'use client'

import { usePathname } from 'next/navigation'
import { isSitovExamPath } from '@/lib/exam-navigation'

export default function AcademySkipLink({ label }: { label: string }) {
  const sitovExam = isSitovExamPath(usePathname() ?? '')
  return <a className="academy-skip-link" href="#main-content" lang={sitovExam ? 'de' : undefined}>
    {sitovExam ? 'Zum Inhalt' : label}
  </a>
}
