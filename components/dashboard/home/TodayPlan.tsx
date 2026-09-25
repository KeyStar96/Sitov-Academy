import Link from 'next/link'
import type { CSSProperties } from 'react'
import { ArrowRight, BookOpen, CalendarCheck, CalendarClock, ChevronRight, Clock, Mail, Mic, PartyPopper, PenTool } from 'lucide-react'
import TodayGreeting from './TodayGreeting'
import WeekStrip from './WeekStrip'
import { studentTranslator } from '@/lib/student-ui-i18n'

export type TodayItemKind = 'vocabulary' | 'feedback' | 'grammar' | 'pronunciation' | 'course' | 'booking'

export interface TodayItem {
  kind: TodayItemKind
  label: string
  href: string
  /** Etwas, das man jetzt tun kann — nur solche Punkte startet der große Knopf. */
  actionable: boolean
}

const ICONS = {
  vocabulary: BookOpen, feedback: Mail, grammar: PenTool, pronunciation: Mic, course: CalendarClock, booking: CalendarCheck,
} as const

const START_HINT = {
  vocabulary: 'today_start_vocab', feedback: 'today_start_feedback', grammar: 'today_start_grammar',
  pronunciation: 'today_start_pronunciation',
} as const

/**
 * „Heute für dich": der erste Blick nach dem Anmelden.
 *
 * Wie die Kopfzeile der Lernbox sagt die Karte in ganzen Sätzen, was heute
 * wartet — und darunter steht genau *ein* großer Knopf. Er startet den
 * ersten Punkt, den man tun kann; ohne offene Punkte führt er zum Lernweg.
 * Jede Zeile ist selbst ein großes Ziel, falls man lieber etwas anderes
 * zuerst erledigt.
 */
export default function TodayPlan({ lang, name, items, fallbackHref, week, noLevel }: {
  lang: string
  name: string
  items: TodayItem[]
  /** Ziel des Knopfs, wenn nichts ansteht: der Lernweg des empfohlenen Niveaus. */
  fallbackHref: string | null
  week: { days: string[]; learned: string[]; today: string } | null
  noLevel: boolean
}) {
  const t = studentTranslator(lang)
  const first = items.find(item => item.actionable)
  const start = first
    ? { href: first.href, hint: t(START_HINT[first.kind as keyof typeof START_HINT] ?? 'today_start_path') }
    : fallbackHref ? { href: fallbackHref, hint: t('today_start_path') } : null
  const allDone = !items.some(item => item.actionable)

  return (
    <section aria-labelledby="today-title" className="st-today sl-glass sl-hero">
      <div className="relative">
        <TodayGreeting name={name} lang={lang} />
        <h2 id="today-title" className="st-eyebrow">{t('today_title')}</h2>

        {allDone && !noLevel && (
          <div className="st-today__done st-rise">
            <span className="st-today__done-icon" aria-hidden="true"><PartyPopper size={26} /></span>
            <div className="min-w-0">
              <p className="font-bold text-[var(--foreground)]">{t('today_done_title')}</p>
              <p className="mt-1 text-base leading-relaxed text-[var(--muted)]">{t('today_done_text')}</p>
            </div>
          </div>
        )}
        {noLevel && <section aria-labelledby="pending-access-title" className="st-rise my-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7">
          <div className="flex items-start gap-4">
            <span className="sl-icon-tile h-12 w-12 shrink-0" aria-hidden="true"><Clock size={26} /></span>
            <div className="min-w-0">
              <h3 id="pending-access-title" className="text-xl font-bold text-[var(--foreground)]">{t('pending_access_title')}</h3>
              <p className="mt-4 text-lg leading-relaxed text-[var(--foreground)]"><strong>{t('pending_access_thanks')}</strong> {t('pending_access_review')}</p>
              <p className="mt-3 text-base leading-relaxed text-[var(--muted)]">{t('pending_access_email')}</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={`/${lang}/dashboard#dashboard-support-title`} className="st-button st-button--soft st-press">{t('nav_help')}</Link>
            <Link href={`/${lang}/dashboard/calendar`} className="st-button st-button--soft st-press">{t('nav_calendar')}</Link>
          </div>
        </section>}

        {items.length > 0 && (
          <ul className="st-today__list">
            {items.map((item, index) => {
              const Icon = ICONS[item.kind]
              return (
                <li key={item.kind} className="st-rise" style={{ '--i': index + 1 } as CSSProperties}>
                  <Link href={item.href} className="st-today__item st-press" data-kind={item.kind} data-actionable={item.actionable}>
                    <span className="st-today__icon" aria-hidden="true">
                      <Icon size={22} />
                      {item.kind === 'feedback' && <span className="st-today__ping" />}
                    </span>
                    <span className="st-today__label">{item.label}</span>
                    <ChevronRight size={20} aria-hidden="true" className="st-today__chevron" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}

        {start && (
          <Link href={start.href} className="st-cta st-press st-rise" style={{ '--i': items.length + 1 } as CSSProperties}>
            <span className="st-cta__text">
              <span className="st-cta__label">{t('today_start')}</span>
              <span className="st-cta__hint">{start.hint}</span>
            </span>
            <span className="st-cta__arrow" aria-hidden="true"><ArrowRight size={24} /></span>
          </Link>
        )}

        {week && <WeekStrip lang={lang} week={week} />}
      </div>
    </section>
  )
}
