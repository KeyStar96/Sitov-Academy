'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, MessageSquareText } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import WaveformPlayer from '@/components/audio/WaveformPlayer'
import TeacherAvatar from '@/components/audio/TeacherAvatar'
import { markPronunciationSeen } from '@/app/actions/pronunciation-conversations'
import { createPronunciationTranslator, type PronunciationTranslations } from '@/lib/pronunciation-i18n'
import { studentTranslator } from '@/lib/student-ui-i18n'
import { teacherFirstName } from '@/lib/teacher-portraits'
import type { UnseenFeedbackSummary } from '@/lib/types/feedback'

/**
 * Briefkasten-Karte der Startseite: Die neueste Sprachnachricht der Lehrkraft
 * lässt sich direkt hier abspielen — mit Foto und Namen, ohne Umweg über die
 * Gesprächsliste. Beim ersten Abspielen gilt sie als gelesen; die Karte
 * bleibt aber stehen (mit „Gehört ✓"), damit man sie in Ruhe zu Ende hört.
 */
export default function MailboxPreview({ summary, lang, translations }: {
  summary: UnseenFeedbackSummary
  lang: string
  translations: PronunciationTranslations
}) {
  const t = studentTranslator(lang)
  const p = createPronunciationTranslator(translations)
  const reduced = useReducedMotion() ?? false
  const [heard, setHeard] = useState(false)
  const marked = useRef(false)
  const latest = summary.latest
  if (!latest || summary.count === 0) return null
  const name = teacherFirstName(latest.senderName) ?? t('teacher_fallback_subject')
  const href = `/${lang}/dashboard/level/${encodeURIComponent(latest.level)}/pronunciation?tab=mailbox`

  function acknowledge() {
    if (marked.current || !latest) return
    marked.current = true
    setHeard(true)
    void markPronunciationSeen(latest.submissionId).catch(() => { marked.current = false })
  }

  return (
    <motion.section aria-labelledby="mailbox-preview-title" className="st-mail-card sl-glass"
      initial={reduced ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}>
      <div className="st-mail-card__head">
        <span className="st-envelope" data-open={heard} aria-hidden="true">
          <span className="st-envelope__flap" /><span className="st-envelope__body" />
          {!heard && <span className="st-envelope__count">{summary.count}</span>}
        </span>
        <TeacherAvatar name={latest.senderName} size={52} />
        <div className="min-w-0 flex-1">
          <h2 id="mailbox-preview-title" className="st-mail-card__title">{t('mailbox_card_title', { name })}</h2>
          <p className="st-mail-card__meta">{[latest.title, latest.level].filter(Boolean).join(' · ')}</p>
        </div>
        {heard && <span className="st-heard st-pop"><Check size={16} strokeWidth={3} aria-hidden="true" />{t('mailbox_heard')}</span>}
      </div>
      {latest.audioUrl && (
        <div className="mt-4">
          <WaveformPlayer src={latest.audioUrl} t={p} compact onProgress={state => { if (state.playing) acknowledge() }} />
        </div>
      )}
      {latest.text && (
        <p className="st-mail-card__text">
          {!latest.audioUrl && <MessageSquareText size={18} aria-hidden="true" className="mr-2 inline text-[var(--accent-text)]" />}
          {latest.text}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!latest.audioUrl && !heard && (
          <button type="button" onClick={acknowledge} className="st-button st-button--soft st-press"><Check size={18} aria-hidden="true" />{t('mailbox_heard')}</button>
        )}
        <Link href={href} className="st-link-pill st-press">{summary.count > 1 ? t.count('mailbox_new', summary.count) : t('mailbox_card_more')}<ArrowRight size={18} aria-hidden="true" /></Link>
      </div>
    </motion.section>
  )
}
