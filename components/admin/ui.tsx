import Link from 'next/link'
import type { ComponentType, ReactNode } from 'react'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Admin-UI-Kit des Lehrer-Dashboards (Phase 11.2).
 *
 * Sachlich statt verspielt: ruhige Haarlinien (`--admin-line`), kompakte
 * Typografie, Orange nur für primäre Aktionen, aktive Navigation und Fokus.
 * Mobile first: Touch-Ziele ≥ 48 px, Eingabefelder 16 px (kein iOS-Zoom),
 * alles einspaltig bis `sm`. Ausschließlich Theme-Tokens, damit hell, dunkel
 * und beide Hochkontrast-Paletten ohne Sonderfälle funktionieren.
 *
 * Bewusst ohne Hooks: Server- und Client-Komponenten können alles nutzen.
 */

export type AdminTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'
type Icon = ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>

export const adminFocus =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]'

/** Eingabefelder: 16 px Schrift verhindert den Auto-Zoom von iOS Safari. */
export const adminInput = cn(
  'min-h-12 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-base text-[var(--foreground)]',
  'placeholder:text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-60',
  adminFocus,
)
export const adminLabel = 'mb-1.5 block text-sm font-medium text-[var(--foreground)]'
export const adminHint = 'mt-1.5 text-sm leading-relaxed text-[var(--muted)]'

export type AdminButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type AdminButtonSize = 'md' | 'sm' | 'icon'

const buttonVariants: Record<AdminButtonVariant, string> = {
  primary: 'bg-[var(--accent-strong)] text-[var(--accent-foreground)] hover:bg-[var(--accent-strong-hover)]',
  secondary: 'border border-[var(--admin-line-strong)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--admin-hover)]',
  ghost: 'text-[var(--foreground)] hover:bg-[var(--admin-hover)]',
  danger: 'border border-[var(--admin-line-strong)] bg-[var(--surface)] text-[var(--danger)] hover:bg-[var(--admin-danger-soft)]',
}
const buttonSizes: Record<AdminButtonSize, string> = {
  md: 'min-h-12 px-4',
  sm: 'min-h-11 px-3',
  icon: 'h-12 w-12 shrink-0',
}

/** Klassen für Buttons und Button-Links (`<Link className={adminButton()}>`). */
export function adminButton(variant: AdminButtonVariant = 'secondary', size: AdminButtonSize = 'md', className?: string) {
  return cn(
    'inline-flex select-none items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-px',
    adminFocus,
    buttonSizes[size],
    buttonVariants[variant],
    className,
  )
}

/** Segment-/Filterknopf (mit `aria-pressed` oder `aria-current` verwenden). */
export function adminChip(active: boolean, className?: string) {
  return cn(
    'inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors',
    adminFocus,
    active
      ? 'border-[var(--foreground)] bg-[var(--foreground)] text-[var(--canvas)]'
      : 'border-[var(--admin-line-strong)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--admin-hover)] hover:text-[var(--foreground)]',
    className,
  )
}

const toneClasses: Record<AdminTone, string> = {
  neutral: 'bg-[var(--surface-muted)] text-[var(--foreground)]',
  accent: 'bg-[var(--accent-soft)] text-[var(--accent-text)]',
  success: 'bg-[var(--admin-success-soft)] text-[var(--success)]',
  warning: 'bg-[var(--warning)] text-[var(--warning-foreground)]',
  danger: 'bg-[var(--admin-danger-soft)] text-[var(--danger)]',
  info: 'bg-[var(--admin-info-soft)] text-[var(--violet)]',
}

export function Badge({ tone = 'neutral', children, className }: { tone?: AdminTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex max-w-full items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold leading-5', toneClasses[tone], className)}>
      {children}
    </span>
  )
}

/** Zähler für Navigation und Listen; `null`/0 wird nicht angezeigt. */
export function CountBadge({ count, label, className }: { count: number | null | undefined; label?: string; className?: string }) {
  if (!count) return null
  return (
    <span
      className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent-strong)] px-1.5 text-[0.7rem] font-bold tabular-nums leading-none text-[var(--accent-foreground)]', className)}
      aria-label={label}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

export function PageHeader({ title, description, eyebrow, actions, back, className }: {
  title: ReactNode
  description?: ReactNode
  eyebrow?: ReactNode
  actions?: ReactNode
  back?: { href: string; label: string }
  className?: string
}) {
  return (
    <header className={cn('min-w-0 space-y-3', className)}>
      {back && (
        <Link href={back.href} className={cn('-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]', adminFocus)}>
          <ArrowLeft size={16} aria-hidden="true" />
          {back.label}
        </Link>
      )}
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{eyebrow}</p>}
          <h1 className="break-words text-[1.375rem] font-semibold leading-tight tracking-tight text-[var(--foreground)] sm:text-2xl">{title}</h1>
          {description && <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">{actions}</div>}
      </div>
    </header>
  )
}

export function Card({ children, className, as: Tag = 'section', id, labelledBy, label }: {
  children: ReactNode
  className?: string
  as?: 'section' | 'div' | 'article' | 'aside'
  id?: string
  labelledBy?: string
  label?: string
}) {
  return (
    <Tag id={id} aria-labelledby={labelledBy} aria-label={label} className={cn('min-w-0 overflow-hidden rounded-xl border border-[var(--admin-line)] bg-[var(--surface)]', className)}>
      {children}
    </Tag>
  )
}

export function CardHeader({ title, description, actions, icon: IconComponent, id, className }: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  icon?: Icon
  id?: string
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 items-start gap-3 border-b border-[var(--admin-line)] px-4 py-3', className)}>
      {IconComponent && <IconComponent size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--muted)]" />}
      <div className="min-w-0 flex-1">
        <h2 id={id} className="text-sm font-semibold text-[var(--foreground)]">{title}</h2>
        {description && <p className="mt-0.5 text-sm leading-relaxed text-[var(--muted)]">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export function SectionHeading({ title, description, actions, id }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; id?: string }) {
  return (
    <div className="flex min-w-0 items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="text-sm font-semibold text-[var(--foreground)]">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-[var(--muted)]">{description}</p>}
      </div>
      {actions}
    </div>
  )
}

export function StatTile({ label, value, hint, href, icon: IconComponent, tone = 'neutral', children, className }: {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  href?: string
  icon?: Icon
  tone?: 'neutral' | 'accent' | 'warning'
  children?: ReactNode
  className?: string
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[0.8125rem] font-medium leading-snug text-[var(--muted)]">{label}</p>
        {IconComponent && (
          <span className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', tone === 'accent' ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]' : tone === 'warning' ? 'bg-[var(--warning)] text-[var(--warning-foreground)]' : 'bg-[var(--surface-muted)] text-[var(--muted)]')}>
            <IconComponent size={16} aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="mt-2 text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums text-[var(--foreground)]">{value}</p>
      {hint && <p className="mt-1.5 text-xs leading-snug text-[var(--muted)]">{hint}</p>}
      {children}
    </>
  )
  const frame = cn('block min-w-0 rounded-xl border border-[var(--admin-line)] bg-[var(--surface)] p-4', className)
  if (!href) return <div className={frame}>{body}</div>
  return <Link href={href} className={cn(frame, 'transition-colors hover:border-[var(--admin-line-strong)] hover:bg-[var(--admin-hover)]', adminFocus)}>{body}</Link>
}

export function ProgressBar({ value, max, tone = 'neutral', label }: { value: number; max: number; tone?: 'neutral' | 'warning' | 'accent'; label?: string }) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <div
        className={cn('h-full rounded-full', tone === 'warning' ? 'bg-[var(--danger)]' : tone === 'accent' ? 'bg-[var(--accent)]' : 'bg-[var(--foreground)]')}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

export function Notice({ tone = 'info', title, children, action, role, className }: {
  tone?: Exclude<AdminTone, 'neutral' | 'accent'>
  title?: ReactNode
  children?: ReactNode
  action?: ReactNode
  role?: 'alert' | 'status'
  className?: string
}) {
  return (
    <div role={role} className={cn('flex min-w-0 flex-col gap-3 rounded-xl px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between', toneClasses[tone], className)}>
      <div className="min-w-0 leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : undefined}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function EmptyState({ icon: IconComponent, title, description, action, className }: {
  icon?: Icon
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center px-4 py-12 text-center', className)}>
      {IconComponent && (
        <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--muted)]">
          <IconComponent size={20} aria-hidden="true" />
        </span>
      )}
      <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm leading-relaxed text-[var(--muted)]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/** Liste mit Trennlinien – der Standard für mobile Datensätze statt Tabellen. */
export function ListCard({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <Card as="div" className={className}>
      <ul className="divide-y divide-[var(--admin-line)]" aria-label={label}>{children}</ul>
    </Card>
  )
}

export function ListLink({ href, icon: IconComponent, title, description, meta, trailing }: {
  href: string
  icon?: Icon
  title: ReactNode
  description?: ReactNode
  meta?: ReactNode
  trailing?: ReactNode
}) {
  return (
    <li>
      <Link href={href} className={cn('flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--admin-hover)]', adminFocus, 'focus-visible:-outline-offset-2')}>
        {IconComponent && (
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-[var(--muted)]">
            <IconComponent size={18} aria-hidden="true" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem] font-medium text-[var(--foreground)]">{title}</span>
          {description && <span className="mt-0.5 block text-sm leading-snug text-[var(--muted)]">{description}</span>}
        </span>
        {meta && <span className="shrink-0 text-sm tabular-nums text-[var(--muted)]">{meta}</span>}
        {trailing}
        <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-[var(--muted)]" />
      </Link>
    </li>
  )
}

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block min-w-0', className)}>
      <span className={adminLabel}>{label}</span>
      {children}
      {hint && <span className={cn('block', adminHint)}>{hint}</span>}
    </label>
  )
}

/** Schlichte Schlüssel/Wert-Liste für Detailansichten. */
export function KeyValueList({ items, className }: { items: Array<{ label: ReactNode; value: ReactNode }>; className?: string }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-4 sm:grid-cols-2', className)}>
      {items.map((item, index) => (
        <div key={index} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{item.label}</dt>
          <dd className="mt-1 break-words text-[0.9375rem] font-medium text-[var(--foreground)]">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
