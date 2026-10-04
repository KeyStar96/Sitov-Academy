'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import TeacherSidebar from './TeacherSidebar'
import { useAdminTranslator } from './AdminI18nProvider'
import { ADMIN_NAV_ICONS } from './TeacherNavIcons'
import { CountBadge, adminButton, adminChip, adminFocus } from './ui'
import { useScrollLock } from '@/components/ui/useScrollLock'
import {
  activeTabbarId,
  buildAdminNav,
  buildAdminTabbar,
  findActiveNavItem,
  findActiveSection,
  type AdminNavCounts,
} from '@/lib/admin-navigation'
import { cn } from '@/lib/utils'

/**
 * Mobile-first-Hülle des Lehrer-Dashboards (Phase 11.2).
 *
 * - Smartphone: schlanke, deckende Kopfzeile mit Bereichstitel, darunter
 *   wischbare Unterreiter des aktuellen Bereichs; unten eine feste Tab-Leiste
 *   (Übersicht · Neue Schüler · Schüler · Kurse · Menü). „Menü“ öffnet ein
 *   Blatt mit allen Bereichen sowie Sprache, Darstellung und Abmelden.
 * - Ab `lg`: gruppierte Seitenleiste links, Kopfzeile mit Kontosteuerung.
 *
 * `brand`, `compactBrand` und `controls` werden serverseitig gerendert
 * übergeben (u. a. das Logout-Formular als Server-Action), damit diese
 * Client-Hülle nur Layout- und Blattzustand verwaltet.
 *
 * Safari (iOS 26+) zeichnet mit `viewport-fit=cover` bis unter die
 * Statusleiste: Kopf- und Tab-Leiste brauchen deckende Hintergründe und die
 * Safe-Area-Abstände, sonst scrollt Inhalt sichtbar darunter durch.
 */
export default function TeacherLayout({
  lang,
  brand,
  compactBrand,
  controls,
  account,
  counts,
  children,
  sitovPreviewPathname,
}: {
  lang: string
  brand: ReactNode
  /** Nur das Logo-Zeichen für schmale Displays. */
  compactBrand?: ReactNode
  controls: ReactNode
  account?: { name: string; role: string }
  counts?: AdminNavCounts
  children: ReactNode
  /** Safe development preview callers only. */
  sitovPreviewPathname?: string
}) {
  const t = useAdminTranslator()
  const actualPathname = usePathname()
  const pathname = sitovPreviewPathname ?? actualPathname
  // Das Menü gilt nur für die Seite, auf der es geöffnet wurde: Jeder
  // Seitenwechsel schließt es ohne zusätzlichen Effekt.
  const [menuPath, setMenuPath] = useState<string | null>(null)
  const menuOpen = menuPath === pathname
  const setMenuOpen = (open: boolean) => setMenuPath(open ? pathname : null)
  const sections = buildAdminNav(lang)
  const section = findActiveSection(pathname, sections)
  const item = findActiveNavItem(pathname, sections)
  const tabbar = buildAdminTabbar(lang)
  const activeTab = activeTabbarId(pathname, sections)
  const sectionTitle = section?.labelKey ? t(section.labelKey) : t('nav_overview')
  const pageTitle = item ? t(item.labelKey) : sectionTitle
  const showSectionTabs = Boolean(section && section.items.length > 1)
  const menuId = useId()


  return (
    <div className="admin-shell min-h-dvh bg-[var(--canvas)] text-[var(--foreground)] lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <a href="#admin-content" className="academy-skip-link">{t('skip_to_content')}</a>

      {/* Desktop-Seitenleiste */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-[var(--admin-line)] bg-[var(--surface)] lg:flex">
        <div className="flex h-16 shrink-0 items-center px-4">{brand}</div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-6 pt-2" data-lenis-prevent>
          <TeacherSidebar lang={lang} counts={counts} sitovPreviewPathname={sitovPreviewPathname} />
        </div>
        {account && (
          <div className="shrink-0 border-t border-[var(--admin-line)] px-4 py-3">
            <p className="truncate text-sm font-semibold" title={account.name}>{account.name}</p>
            <p className="text-xs text-[var(--muted)]">{account.role}</p>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Kopfzeile */}
        <header className="sticky top-0 z-30 border-b border-[var(--admin-line)] bg-[var(--surface)] pt-[env(safe-area-inset-top)]">
          <div className="flex h-[var(--admin-topbar-height)] items-center gap-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] lg:px-8">
            <div className="shrink-0 lg:hidden">{compactBrand ?? brand}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.9375rem] font-semibold leading-tight lg:hidden">{sectionTitle}</p>
              <p className="hidden truncate text-sm text-[var(--muted)] lg:block">
                {section?.labelKey ? <>{sectionTitle}<span aria-hidden="true" className="px-2">/</span></> : null}
                <span className="font-medium text-[var(--foreground)]">{pageTitle}</span>
              </p>
            </div>
            <div className="hidden shrink-0 items-center gap-2 lg:flex">{controls}</div>
          </div>

          {/* Unterreiter des aktuellen Bereichs (Smartphone/Tablet) */}
          {showSectionTabs && section && (
            <nav aria-label={t('section_nav_label', { section: sectionTitle })} className="lg:hidden">
              <ul className="admin-scroll-x flex gap-2 pb-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))]">
                {section.items.map(entry => {
                  const current = entry === item
                  const count = entry.badge ? counts?.[entry.badge] : null
                  return (
                    <li key={entry.href} className="shrink-0">
                      <Link href={entry.href} aria-current={current ? 'page' : undefined} className={adminChip(current)}>
                        {t(entry.shortLabelKey ?? entry.labelKey)}
                        <CountBadge count={count} label={count ? t('badge_count_aria', { count }) : undefined} />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>
          )}
        </header>

        <div
          id="admin-content"
          tabIndex={-1}
          className="mx-auto w-full min-w-0 max-w-[1200px] flex-1 pb-[calc(var(--admin-tabbar-height)+env(safe-area-inset-bottom)+2rem)] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-5 focus:outline-none sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] sm:pt-6 lg:px-8 lg:pb-12 lg:pt-8"
        >
          {children}
        </div>
      </div>

      {/* Untere Tab-Leiste (Smartphone/Tablet) */}
      <nav
        aria-label={t('tabbar_label')}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--admin-line)] bg-[var(--surface)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] lg:hidden"
      >
        <ul className="mx-auto grid h-[var(--admin-tabbar-height)] max-w-xl grid-cols-5">
          {tabbar.map(tab => {
            const Icon = ADMIN_NAV_ICONS[tab.icon]
            const current = tab.id === activeTab
            const count = tab.badge ? counts?.[tab.badge] : null
            const inner = (
              <>
                <span className={cn('relative inline-flex h-7 w-12 items-center justify-center rounded-full transition-colors', current ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]' : 'text-[var(--muted)]')}>
                  <Icon size={20} aria-hidden="true" />
                  {count ? (
                    <span className="absolute -right-0.5 -top-1">
                      <CountBadge count={count} label={t('badge_count_aria', { count })} className="ring-2 ring-[var(--surface)]" />
                    </span>
                  ) : null}
                </span>
                <span className={cn('max-w-full truncate text-[0.6875rem] leading-none', current ? 'font-semibold text-[var(--foreground)]' : 'font-medium text-[var(--muted)]')}>
                  {t(tab.labelKey)}
                </span>
              </>
            )
            const cell = cn('flex h-full w-full flex-col items-center justify-center gap-1 px-1', adminFocus, 'focus-visible:-outline-offset-4')
            return (
              <li key={tab.id} className="min-w-0">
                {tab.href ? (
                  <Link href={tab.href} aria-current={current ? 'page' : undefined} className={cell}>{inner}</Link>
                ) : (
                  <button type="button" onClick={() => setMenuOpen(true)} aria-expanded={menuOpen} aria-controls={menuId} aria-haspopup="dialog" className={cell}>
                    {inner}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      <MenuSheet id={menuId} open={menuOpen} onClose={() => setMenuOpen(false)} title={t('menu_title')} closeLabel={t('sidebar_menu_close')}>
        <TeacherSidebar lang={lang} counts={counts} sitovPreviewPathname={sitovPreviewPathname} onNavigate={() => setMenuOpen(false)} size="comfortable" />
        <section aria-label={t('menu_account')} className="mt-6 space-y-3 border-t border-[var(--admin-line)] pt-5">
          <p className="px-1 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{t('menu_account')}</p>
          {account && (
            <div className="px-1">
              <p className="truncate text-sm font-semibold">{account.name}</p>
              <p className="text-xs text-[var(--muted)]">{account.role}</p>
            </div>
          )}
          {/* Umgekehrt angeordnet: Der Sprachumschalter öffnet seine Liste
              rechtsbündig nach links und braucht deshalb den rechten Rand. */}
          <div className="flex flex-row-reverse flex-wrap items-center justify-start gap-2">{controls}</div>
        </section>
      </MenuSheet>
    </div>
  )
}

/** Blatt von unten mit allen Bereichen; Escape und Tipp auf den Hintergrund schließen. */
function MenuSheet({ id, open, onClose, title, closeLabel, children }: {
  id: string
  open: boolean
  onClose: () => void
  title: string
  closeLabel: string
  children: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose }, [onClose])
  useScrollLock(open)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement
    const frame = requestAnimationFrame(() => panel.current?.focus({ preventScroll: true }))
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current()
      if (event.key !== 'Tab' || !panel.current) return
      const focusable = panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), select, input, [tabindex]:not([tabindex="-1"])')
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKey)
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true })
    }
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button type="button" tabIndex={-1} aria-hidden="true" onClick={onClose} className="absolute inset-0 h-full w-full cursor-default bg-black/50" />
      <div
        id={id}
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-lenis-prevent
        className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-2xl border-t border-[var(--admin-line)] bg-[var(--surface)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] shadow-[var(--shadow-lg)] focus:outline-none"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-3">
          <h2 id={titleId} className="text-base font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className={adminButton('ghost', 'icon')} aria-label={closeLabel}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 pb-6">{children}</div>
      </div>
    </div>
  )
}
