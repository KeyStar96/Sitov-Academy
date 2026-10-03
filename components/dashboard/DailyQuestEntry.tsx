import Link from 'next/link'
import { ArrowRight, BookOpen, Check, Flame, Headphones, Map, MessageCircle } from 'lucide-react'
import { getDailyQuestCopy } from '@/lib/daily-quest-i18n'
import type { DailyQuestStatus } from '@/lib/daily-quest-contract'
import styles from './DailyQuestEntry.module.css'

export default function DailyQuestEntry({ lang, status }: { lang: string; status: DailyQuestStatus }) {
  const copy = getDailyQuestCopy(lang)
  const completed = status.today?.status === 'completed'
  const href = status.enabled ? `/${lang}/dashboard/daily-quest` : `/${lang}/dashboard/profile#daily-quest`
  const label = !status.enabled ? copy.openSettings
    : completed ? copy.entryDone : copy.entryStart
  return (
    <section aria-labelledby="sitov-daily-quest-entry-title" className={styles.sitovEntry} data-completed={completed} data-enabled={status.enabled} data-testid="daily-quest-entry">
      <div className={styles.sitovHeader}>
        <p className={styles.sitovEyebrow}><Map size={18} aria-hidden="true" />{copy.settingsTitle}</p>
        {status.streak.current > 0 && <p className={styles.sitovStreak}>
          <Flame size={17} aria-hidden="true" /><span>{status.streak.current} {copy.streakDays}</span>
        </p>}
      </div>
      <div className={styles.sitovBody}>
        <div className={styles.sitovText}>
          <h2 id="sitov-daily-quest-entry-title" className={styles.sitovTitle}>{status.enabled ? copy.title : copy.disabledTitle}</h2>
          <p className={styles.sitovHint}>{status.enabled ? copy.entryHint : copy.disabledHint}</p>
        </div>
        <div className={styles.sitovRoute} aria-hidden="true">
          <svg className={styles.sitovRoutePath} viewBox="0 0 120 104" fill="none">
            <path d="M23 23H78C108 23 108 77 78 77H44" stroke="currentColor" strokeWidth="2" strokeDasharray="3 5" strokeLinecap="round" />
          </svg>
          <span className={styles.sitovRouteWord}><BookOpen size={20} /></span>
          <span className={styles.sitovRouteListen}><Headphones size={20} /></span>
          <span className={styles.sitovRouteTalk}>{completed ? <Check size={23} /> : <MessageCircle size={21} />}</span>
        </div>
      </div>
      <Link href={href} className={`${styles.sitovAction} st-press`}>
        {completed && status.enabled && <Check size={19} aria-hidden="true" />}
        <span>{label}</span><ArrowRight size={19} aria-hidden="true" />
      </Link>
    </section>
  )
}
