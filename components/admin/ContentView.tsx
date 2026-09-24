'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  FileText,
  FolderOpen,
  Mic,
  PencilRuler,
  Plus,
  type LucideIcon,
} from 'lucide-react'
import { useAdminTranslator } from './AdminI18nProvider'
import type { AdminTranslationKey } from '@/lib/admin-i18n'

interface ContentType {
  id: string
  route: string
  icon: LucideIcon
  titleKey: AdminTranslationKey
  descKey: AdminTranslationKey
  /** Ob eine Niveau-Vorauswahl an den Editor übergeben wird. */
  levelAware: boolean
}

const CONTENT_TYPES: ContentType[] = [
  { id: 'media', route: 'content/media', icon: FolderOpen, titleKey: 'content_type_media_title', descKey: 'content_type_media_desc', levelAware: false },
  { id: 'vocabulary', route: 'content/vocabulary', icon: FileText, titleKey: 'content_type_vocab_title', descKey: 'content_type_vocab_desc', levelAware: true },
  { id: 'grammar', route: 'content/exercises', icon: PencilRuler, titleKey: 'content_type_grammar_title', descKey: 'content_type_grammar_desc', levelAware: true },
  { id: 'pronunciation', route: 'content/pronunciation', icon: Mic, titleKey: 'content_type_pronunciation_title', descKey: 'content_type_pronunciation_desc', levelAware: true },
]

/**
 * Zentraler Hub „Lerninhalte". Hebt die strikte Trennung der Materialtypen auf
 * und bietet einen geführten „Inhalt hinzufügen"-Workflow: Inhaltstyp wählen,
 * optional ein Niveau vorwählen, und direkt in den passenden Editor springen.
 */
export default function ContentView({ lang, levels }: { lang: string; levels: string[] }) {
  const t = useAdminTranslator()
  const [typeId, setTypeId] = useState(CONTENT_TYPES[0].id)
  const [level, setLevel] = useState('')

  const activeType = CONTENT_TYPES.find(type => type.id === typeId) ?? CONTENT_TYPES[0]
  const useLevel = activeType.levelAware && level !== ''
  const target = `/${lang}/admin/${activeType.route}${useLevel ? `?level=${encodeURIComponent(level)}` : ''}`

  return (
    <div className="min-w-0 space-y-8 text-[var(--foreground)]">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">{t('group_content')}</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('content_hub_title')}</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-[var(--muted)]">{t('content_hub_intro')}</p>
      </header>

      {/* Geführter „Inhalt hinzufügen"-Workflow */}
      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-muted)] px-5 py-4">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-strong)] text-[var(--accent-foreground)]">
            <Plus size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{t('content_add_title')}</h2>
            <p className="text-sm text-[var(--muted)]">{t('content_add_intro')}</p>
          </div>
        </div>

        <div className="space-y-6 p-5">
          {/* Schritt 1: Inhaltstyp */}
          <div>
            <p className="mb-2 text-sm font-semibold text-[var(--muted)]">{t('content_add_step_type')}</p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {CONTENT_TYPES.map(type => {
                const Icon = type.icon
                const selected = type.id === typeId
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setTypeId(type.id)}
                    aria-pressed={selected}
                    className={`flex min-h-14 items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                      selected
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                        : 'border-[var(--border)] hover:bg-[var(--surface-muted)]'
                    }`}
                  >
                    <Icon size={18} aria-hidden="true" className={selected ? 'text-[var(--accent-text)]' : 'text-[var(--muted)]'} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{t(type.titleKey)}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Schritt 2: Niveau */}
          <div className="grid gap-4 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] sm:items-end">
            <label className="min-w-0">
              <span className="mb-2 block text-sm font-semibold text-[var(--muted)]">{t('content_add_step_level')}</span>
              <select
                value={level}
                onChange={event => setLevel(event.target.value)}
                disabled={!activeType.levelAware}
                className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-60"
              >
                <option value="">{t('content_add_level_any')}</option>
                {levels.map(entry => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-3 rounded-xl bg-[var(--canvas)] p-3">
              <p className="min-w-0 flex-1 text-sm text-[var(--muted)]">
                <span className="font-semibold text-[var(--foreground)]">{t(activeType.titleKey)}</span>
                <span className="block truncate">{t(activeType.descKey)}</span>
              </p>
              <Link
                href={target}
                className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-[var(--accent-strong)] px-4 text-sm font-semibold text-[var(--accent-foreground)] transition-opacity hover:bg-[var(--accent-strong-hover)]"
              >
                {t('content_add_cta')}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Alle Bereiche */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">{t('content_areas_title')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {CONTENT_TYPES.map(type => {
            const Icon = type.icon
            return (
              <Link
                key={type.id}
                href={`/${lang}/admin/${type.route}`}
                className="group flex min-w-0 flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-colors hover:bg-[var(--surface-muted)]"
              >
                <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-text)]">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold">{t(type.titleKey)}</span>
                <span className="mt-1 flex-1 text-sm leading-relaxed text-[var(--muted)]">{t(type.descKey)}</span>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent-text)]">
                  {t('content_manage')}
                  <ArrowRight size={15} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
