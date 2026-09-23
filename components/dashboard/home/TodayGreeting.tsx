'use client'

import { useEffect, useState } from 'react'
import { dashboardHomeMessages, type DashboardHomeMessages } from '@/lib/dashboard-home-i18n'
import { interpolate } from '@/lib/i18n-runtime'

function greetingKey(hour: number): keyof DashboardHomeMessages {
  if (hour >= 5 && hour < 11) return 'greeting_morning'
  if (hour >= 11 && hour < 17) return 'greeting_afternoon'
  if (hour >= 17 && hour < 22) return 'greeting_evening'
  return 'greeting_night'
}

/**
 * Kopf von „Heute für dich": Begrüßung nach Tageszeit, darunter Datum und Uhr
 * in ruhiger Größe. Erst nach dem Mounten zählt die echte Uhrzeit — Server und
 * erster Client-Render stimmen so überein.
 */
export default function TodayGreeting({ name, lang }: { name: string; lang: string }) {
  const messages = dashboardHomeMessages(lang)
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const timer = window.setInterval(() => setNow(new Date()), 15_000)
    return () => window.clearInterval(timer)
  }, [])
  const greeting = interpolate(messages[now ? greetingKey(now.getHours()) : 'greeting_afternoon'], { name })
  const date = now ? new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long' }).format(now) : ''
  const time = now ? new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit', hour12: false }).format(now) : ''
  return (
    <div className="st-today__greeting">
      <p className="st-today__date" suppressHydrationWarning>
        <span className="capitalize">{date || ' '}</span>
        {time && <><span aria-hidden="true"> · </span><time role="timer" aria-label={messages.clock_aria} className="tabular-nums">{time}</time></>}
      </p>
      <h1 className="st-today__hello" suppressHydrationWarning>{greeting}</h1>
    </div>
  )
}
