'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import TeacherSidebar from './TeacherSidebar'
import { useAdminTranslator } from './AdminI18nProvider'

/**
 * Moderne SaaS-Hülle für das Lehrer-Dashboard mit strukturierter Sidebar-
 * Navigation statt der alten Top-Navigation.
 *
 * - Desktop (ab `lg`): dauerhaft sichtbare Sidebar-Leiste links, schlanke,
 *   sticky Kopfzeile mit Kontext + Konten-Steuerung rechts.
 * - Mobil: die Sidebar wird zum Off-Canvas-Drawer (Hamburger-Menü).
 *
 * `brand`, `compactBrand` und `controls` werden serverseitig gerendert
 * übergeben (u. a. das Logout-Formular als Server-Action), damit diese
 * Client-Hülle rein für Layout und Drawer-Zustand zuständig bleibt.
 *
 * Smartphone-Kopfzeile: Sie braucht eine deckende eigene Hintergrundfarbe.
 * Safari (iOS 26+) zeichnet Seiten mit `viewport-fit=cover` bis unter die
 * Statusleiste und füllt diesen Streifen nur aus einem fixen/sticky Element,
 * dessen Hintergrund oben anliegt – sonst scrollt dort der Seiteninhalt
 * durch. `env(safe-area-inset-top)` ist im Browser 0 und greift nur in der
 * Home-Bildschirm-App (Statusleiste `black-translucent`).
 */
export default function TeacherLayout({
  lang,
  brand,
  compactBrand,
  controls,
  children,
}: {
  lang: string
  brand: ReactNode
  /** Nur das Logo-Zeichen für schmale Displays, damit die Steuerung Platz hat. */
  compactBrand?: ReactNode
  controls: ReactNode
  children: ReactNode
}) {
  const t = useAdminTranslator()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Beim Routenwechsel und per ESC schließen; Body-Scroll sperren, solange offen.
  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open])

  return (
    <div className="min-h-dvh bg-[var(--canvas)] text-[var(--foreground)] lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      {/* Desktop-Sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-[var(--border)] bg-[var(--surface)] lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-[var(--border)] px-5">{brand}</div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
          <TeacherSidebar lang={lang} />
        </div>
        <p className="shrink-0 border-t border-[var(--border)] px-5 py-3 text-xs text-[var(--muted)]">{t('sidebar_workspace')}</p>
      </aside>

      {/* Hauptspalte */}
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)] pt-[env(safe-area-inset-top)]">
          <div className="flex min-h-16 items-center gap-2 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:gap-3 sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] lg:px-8">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={t('sidebar_menu_open')}
              aria-expanded={open}
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--foreground)] transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] lg:hidden"
            >
              <Menu size={20} aria-hidden="true" />
            </button>
            <div className="min-w-0 lg:hidden">
              {compactBrand ? <><div className="sm:hidden">{compactBrand}</div><div className="hidden sm:block">{brand}</div></> : brand}
            </div>
            <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">{controls}</div>
          </div>
        </header>

        <div className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1440px] py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] lg:px-8">
            {children}
          </div>
        </div>
      </div>

      {/* Mobiler Drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={t('sidebar_primary_label')}>
          <button
            type="button"
            aria-label={t('sidebar_menu_close')}
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-black/50"
          />
          <div className="absolute inset-y-0 left-0 flex w-[calc(18rem_+_env(safe-area-inset-left))] max-w-[85vw] flex-col border-r border-[var(--border)] bg-[var(--surface)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pt-[env(safe-area-inset-top)] shadow-xl">
            <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-4">
              <div className="min-w-0">{brand}</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('sidebar_menu_close')}
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
              <TeacherSidebar lang={lang} onNavigate={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
