'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { dashboardHomeMessages, type DashboardHomeMessages } from '@/lib/dashboard-home-i18n'
import { interpolate } from '@/lib/i18n-runtime'

/** Which greeting fits the current local hour. Neutral welcome outside daytime. */
function greetingKey(hour: number): keyof DashboardHomeMessages {
  if (hour >= 5 && hour < 11) return 'greeting_morning'
  if (hour >= 11 && hour < 17) return 'greeting_afternoon'
  if (hour >= 17 && hour < 22) return 'greeting_evening'
  return 'greeting_night'
}

/**
 * Header-Widget: zeitabhängige Begrüßung und eine ruhige, große Digitaluhr.
 *
 * Erst nach dem Mounten wird die echte Uhrzeit gesetzt – Server und Client
 * rendern zunächst denselben neutralen Zustand, das vermeidet Hydration-Fehler.
 */
export default function GreetingClock({ name, lang, children }: {
  name: string
  lang: string
  children?: ReactNode
}) {
  const messages = dashboardHomeMessages(lang)
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const greeting = interpolate(messages[now ? greetingKey(now.getHours()) : 'greeting_afternoon'], { name })
  const time = now
    ? new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit', hour12: false }).format(now)
    : '--:--'
  const date = now
    ? new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long' }).format(now)
    : ' '

  return (
    <section className="flex min-w-0 flex-col gap-6 rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-8 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <h1 className="break-words text-3xl font-bold leading-tight tracking-tight text-[var(--foreground)] sm:text-4xl">{greeting}</h1>
        <p className="mt-3 max-w-xl text-lg leading-relaxed text-[var(--muted)]">{messages.greeting_sub}</p>
      </div>
      <div className="flex shrink-0 items-center gap-5">
        <div className="text-right" role="timer" aria-label={messages.clock_aria}>
          <p className="font-mono text-5xl font-bold leading-none tracking-tight tabular-nums text-[var(--foreground)] sm:text-6xl" suppressHydrationWarning>{time}</p>
          <p className="mt-2 text-base font-medium capitalize text-[var(--muted)]" suppressHydrationWarning>{date}</p>
        </div>
        {children}
      </div>
    </section>
  )
}
