'use client'

import { useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { ArrowRight, BookOpen, Check, ChevronRight, ListChecks, Map as MapIcon } from 'lucide-react'
import BottomSheet from '@/components/ui/BottomSheet'
import ProgressRing from '@/components/ui/ProgressRing'
import { studentTranslator } from '@/lib/student-ui-i18n'
import type { PathStation } from '@/lib/level-path'

export default function LevelPath({ lang, level, title, description, stations, next, vocabularyHref }: {
  lang: string
  level: string
  title: string
  description: string
  stations: PathStation[]
  /** Der große Weiter-Knopf; fehlt er, ist gerade kein Bereich offen. */
  next: { href: string; hint: string } | null
  vocabularyHref: string | null
}) {
  const t = studentTranslator(lang)
  // Die Station bleibt nach dem Schließen gesetzt, damit das Blatt mit Inhalt hinausfährt.
  const [selected, setSelected] = useState<PathStation | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const done = stations.filter(station => station.state === 'done').length

  return (
    <div className="space-y-8">
      <section className="st-path-hero sl-glass sl-hero" aria-labelledby="path-level-title">
        <div className="relative">
          <p className="st-eyebrow !mt-0">{t('areas_level', { level })}</p>
          <div className="st-path-hero__row">
            <div className="min-w-0 flex-1">
              <h1 id="path-level-title" className="st-path-hero__title">{title}</h1>
              <p className="st-path-hero__text">{description}</p>
            </div>
            {stations.length > 0 && (
              <ProgressRing value={done / stations.length} size={84} stroke={8} tone={done === stations.length ? 'success' : 'accent'}
                label={t('path_progress_aria', { done, total: stations.length })}>
                <strong className="text-2xl font-extrabold tabular-nums text-[var(--foreground)]">{done}/{stations.length}</strong>
              </ProgressRing>
            )}
          </div>
          {stations.length > 0 && <p className="st-path-hero__count">{t('path_done', { done, total: stations.length })}</p>}
          {next && (
            <Link href={next.href} className="st-cta st-press">
              <span className="st-cta__text">
                <span className="st-cta__label">{t('path_continue')}</span>
                <span className="st-cta__hint">{next.hint}</span>
              </span>
              <span className="st-cta__arrow" aria-hidden="true"><ArrowRight size={24} /></span>
            </Link>
          )}
        </div>
      </section>

      {vocabularyHref && (
        <section aria-labelledby="path-title">
          <div className="st-section-head">
            <div className="min-w-0">
              <h2 id="path-title" className="st-section-title flex items-center gap-2"><MapIcon size={22} aria-hidden="true" className="text-[var(--accent-text)]" />{t('path_title')}</h2>
              <p className="st-section-sub">{t('path_hint')}</p>
            </div>
          </div>
          {stations.length === 0 ? <p className="st-empty">{t('path_empty')}</p> : (
            <ol className="st-path">
              {stations.map((station, index) => (
                <li key={station.lesson} className="st-path__stop" data-state={station.state} style={{ '--i': index } as CSSProperties}>
                  <button type="button" className="st-path__button st-press" onClick={() => { setSelected(station); setSheetOpen(true) }} aria-haspopup="dialog">
                    <span className="st-path__node" aria-hidden="true">
                      {station.state === 'done' ? <Check size={24} strokeWidth={3} /> : station.number}
                    </span>
                    <span className="st-path__card">
                      <span className="st-path__body">
                        <span className="st-path__name">{station.label}</span>
                        <span className="st-path__meta">
                          <span className="st-path__state">{t(station.state === 'done' ? 'station_done' : station.state === 'current' ? 'station_current' : 'station_open')}</span>
                          <span aria-hidden="true">·</span>
                          <span>{t('station_words', { count: station.total })}</span>
                        </span>
                        {station.due > 0 && <span className="st-path__due">{t('station_due', { count: station.due })}</span>}
                        <span className="st-path__bar" aria-hidden="true">
                          <span style={{ width: `${station.total ? ((station.total - station.untouched) / station.total) * 100 : 0}%` }} />
                        </span>
                      </span>
                      <ChevronRight size={20} aria-hidden="true" className="st-path__chevron" />
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={selected?.label ?? ''} closeLabel={t('close')}
        icon={selected?.state === 'done' ? <Check size={24} strokeWidth={3} /> : <BookOpen size={24} />}
        description={selected ? t(selected.state === 'done' ? 'station_done' : selected.state === 'current' ? 'station_current' : 'station_open') : undefined}
        footer={selected && vocabularyHref ? (
          <div className="grid gap-3">
            {selected.untouched > 0 && (
              <Link href={`${vocabularyHref}/assess?lesson=${encodeURIComponent(selected.lesson)}`} className="st-button st-button--primary st-press">
                <ListChecks size={20} aria-hidden="true" />{t('station_start')}
              </Link>
            )}
            {selected.active + selected.learned > 0 && (
              <Link href={vocabularyHref} className={`st-button st-press ${selected.untouched > 0 ? 'st-button--soft' : 'st-button--primary'}`}>
                <BookOpen size={20} aria-hidden="true" />{t('station_practice')}
              </Link>
            )}
          </div>
        ) : undefined}>
        {selected && (
          <div className="flex flex-col items-center gap-5 py-2 sm:flex-row sm:items-center">
            <ProgressRing value={selected.total ? selected.learned / selected.total : 0} size={112} stroke={10} tone="success"
              label={t('station_learned', { learned: selected.learned, total: selected.total })}>
              <strong className="text-3xl font-extrabold tabular-nums">{selected.learned}</strong>
              <small className="text-sm font-semibold text-[var(--muted)]">/ {selected.total}</small>
            </ProgressRing>
            <ul className="st-station-facts">
              <li>{t('station_learned', { learned: selected.learned, total: selected.total })}</li>
              <li>{t('station_in_box', { count: selected.active })}</li>
              <li>{t('station_new', { count: selected.untouched })}</li>
              {selected.due > 0 && <li className="st-station-facts__due">{t('station_due', { count: selected.due })}</li>}
            </ul>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
