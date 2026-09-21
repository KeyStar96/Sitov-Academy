'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CalendarClock,
  CheckCircle2,
  FileText,
  PauseCircle,
  Receipt,
  Search,
  UserPlus,
} from 'lucide-react'
import { useAdminTranslator } from './AdminI18nProvider'
import { formatProfileMonth } from '@/lib/profile-month'
import { formatCourseQuantity } from '@/lib/course-quantity-i18n'
import type { RegistrationOverview, StaffRegistration, StaffInvoice } from '@/lib/types/admin-registrations'
import type { NextMonthOverview, NextMonthStudentRow } from '@/lib/types/admin-staff'

type StatusFilter = 'all' | 'unconfirmed' | 'outstanding' | 'done'

const control =
  'min-h-11 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]'

function badge(kind: 'ok' | 'warn' | 'muted' | 'danger') {
  const map = {
    ok: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    warn: 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
    danger: 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200',
    muted: 'bg-[var(--surface-muted)] text-[var(--muted)]',
  } as const
  return `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[kind]}`
}

/**
 * Konsolidierte Ansicht „Administration & Finanzen".
 *
 * Vereint die frühere Studentenverwaltung, Anmeldungen, Folgemonat-Buchungen
 * und Rechnungen zu einer Arbeitsgrundlage: Welche Schüler nehmen im gewählten
 * Monat an welchen Kursen teil – kombiniert mit Anmelde- und Rechnungsstatus.
 * Die eigentlichen Zustandsänderungen bleiben in den spezialisierten Desks
 * (Anmeldungen/Rechnungen), auf die hier direkt verlinkt wird.
 */
export default function AdminView({
  lang,
  overview,
  bookings,
}: {
  lang: string
  overview: RegistrationOverview
  bookings: NextMonthOverview | null
}) {
  const t = useAdminTranslator()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')
  const month = overview.targetMonth
  const monthValue = month.slice(0, 7)
  const currency = (amount: number) => new Intl.NumberFormat(lang, { style: 'currency', currency: 'EUR' }).format(amount)

  const invoiceFor = (row: StaffRegistration): StaffInvoice | undefined =>
    overview.invoices.find(invoice => invoice.source === row.source && invoice.sourceId === row.id)

  // Monatsmatrix: reguläre (Nicht-Probe-)Buchungen des gewählten Abrechnungsmonats.
  const monthRows = useMemo(
    () => overview.registrations.filter(row => row.targetMonth === month && !row.isTrial),
    [overview.registrations, month],
  )

  const kpis = useMemo(() => {
    const active = monthRows.filter(row => row.status !== 'cancelled' && row.status !== 'rejected')
    const confirmed = monthRows.filter(row => row.status === 'confirmed')
    const pending = monthRows.filter(row => row.status === 'pending')
    const invoiced = confirmed.filter(row => invoiceFor(row)?.status === 'created')
    const outstanding = confirmed.filter(row => invoiceFor(row)?.status !== 'created')
    return {
      students: active.length,
      confirmed: confirmed.length,
      pending: pending.length,
      invoiced: invoiced.length,
      outstanding: outstanding.length,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthRows, overview.invoices])

  const rows = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase(lang)
    return monthRows
      .filter(row => {
        const invoice = invoiceFor(row)
        const created = invoice?.status === 'created'
        if (filter === 'unconfirmed' && row.status !== 'pending') return false
        if (filter === 'outstanding' && !(row.status === 'confirmed' && !created)) return false
        if (filter === 'done' && !created) return false
        if (!needle) return true
        return `${row.contact.name} ${row.contact.email}`.toLocaleLowerCase(lang).includes(needle)
      })
      .sort((a, b) => a.contact.name.localeCompare(b.contact.name, lang))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthRows, overview.invoices, filter, search, lang])

  const continuity = useMemo(() => deriveContinuity(bookings), [bookings])

  const metrics: Array<{ key: string; label: string; value: number; tone: 'accent' | 'ok' | 'warn' }> = [
    { key: 'students', label: t('finance_kpi_students'), value: kpis.students, tone: 'accent' },
    { key: 'confirmed', label: t('finance_kpi_confirmed'), value: kpis.confirmed, tone: 'ok' },
    { key: 'pending', label: t('finance_kpi_pending'), value: kpis.pending, tone: 'warn' },
    { key: 'invoiced', label: t('finance_kpi_invoiced'), value: kpis.invoiced, tone: 'ok' },
    { key: 'outstanding', label: t('finance_kpi_outstanding'), value: kpis.outstanding, tone: 'warn' },
  ]

  const filters: Array<{ value: StatusFilter; label: string }> = [
    { value: 'all', label: t('finance_filter_all') },
    { value: 'unconfirmed', label: t('finance_filter_unconfirmed') },
    { value: 'outstanding', label: t('finance_filter_outstanding') },
    { value: 'done', label: t('finance_filter_done') },
  ]

  return (
    <div className="min-w-0 space-y-6 text-[var(--foreground)]">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">{formatProfileMonth(month, lang)}</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('finance_title')}</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-[var(--muted)]">{t('finance_intro')}</p>
      </header>

      {/* Kennzahlen */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {metrics.map(metric => (
          <div key={metric.key} className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="truncate text-xs text-[var(--muted)]">{metric.label}</p>
            <p
              className={`mt-2 text-2xl font-semibold tabular-nums ${
                metric.tone === 'accent' ? 'text-[var(--accent)]' : ''
              }`}
            >
              {metric.value}
            </p>
          </div>
        ))}
      </div>

      {/* Werkzeugleiste */}
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1">
          <span className="mb-1.5 block text-sm font-medium text-[var(--muted)]">{t('finance_search')}</span>
          <span className="relative block">
            <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-3 text-[var(--muted)]" />
            <input type="search" value={search} onChange={event => setSearch(event.target.value)} className={`${control} pl-9`} />
          </span>
        </label>
        <label className="min-w-0 sm:w-52">
          <span className="mb-1.5 block text-sm font-medium text-[var(--muted)]">{t('finance_month')}</span>
          <input
            type="month"
            value={monthValue}
            onChange={event => {
              if (/^\d{4}-\d{2}$/.test(event.target.value)) router.push(`/${lang}/admin/finance?month=${event.target.value}`)
            }}
            className={control}
          />
        </label>
      </div>

      {/* Statusfilter + Sprünge in die Desks */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('finance_col_registration')}>
          {filters.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              aria-pressed={filter === option.value}
              className={`inline-flex min-h-10 items-center rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                filter === option.value
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--foreground)]'
                  : 'border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-muted)]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/${lang}/admin/registrations`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-muted)]">
            <UserPlus size={16} aria-hidden="true" />
            {t('finance_open_registrations')}
          </Link>
          <Link href={`/${lang}/admin/invoices?month=${monthValue}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-muted)]">
            <Receipt size={16} aria-hidden="true" />
            {t('finance_open_invoices')}
          </Link>
          <Link href={`/${lang}/admin/bookings`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-muted)]">
            <CalendarClock size={16} aria-hidden="true" />
            {t('finance_open_bookings')}
          </Link>
        </div>
      </div>

      {/* Matrix */}
      <section className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {rows.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <CheckCircle2 size={34} className="mx-auto mb-3 text-[var(--accent)]" aria-hidden="true" />
            <p className="font-semibold">{t('finance_empty')}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">{t('finance_empty_hint')}</p>
          </div>
        ) : (
          <table className="block w-full border-collapse text-left text-sm lg:table">
            <caption className="sr-only">{t('finance_title')} · {formatProfileMonth(month, lang)}</caption>
            <thead className="hidden border-b border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)] lg:table-header-group">
              <tr>
                {[
                  t('finance_col_student'),
                  t('finance_col_courses'),
                  t('finance_col_registration'),
                  t('finance_col_invoice'),
                  t('finance_col_amount'),
                  t('finance_col_actions'),
                ].map(label => (
                  <th key={label} scope="col" className="px-4 py-3 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="block divide-y divide-[var(--border)] lg:table-row-group">
              {rows.map(row => {
                const invoice = invoiceFor(row)
                const created = invoice?.status === 'created'
                return (
                  <tr
                    key={`${row.source}:${row.id}`}
                    className="grid grid-cols-1 gap-3 p-4 align-top sm:grid-cols-2 lg:table-row lg:p-0"
                  >
                    <td className="min-w-0 break-words lg:px-4 lg:py-3">
                      <p className="font-semibold">{row.contact.name}</p>
                      <p className="mt-0.5 break-all text-xs text-[var(--muted)]">{row.contact.email}</p>
                    </td>
                    <td className="min-w-0 lg:px-4 lg:py-3">
                      <p className="mb-1 text-xs text-[var(--muted)] lg:hidden">{t('finance_col_courses')}</p>
                      {row.courses.length ? (
                        <ul className="space-y-1">
                          {row.courses.map(course => (
                            <li key={course.id} className="break-words">
                              {course.title}
                              <span className="block text-xs text-[var(--muted)]">
                                {formatCourseQuantity(course.units, course.unitMinutes, lang)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-[var(--muted)]">{t('finance_no_courses')}</span>
                      )}
                    </td>
                    <td className="min-w-0 lg:px-4 lg:py-3">
                      <p className="mb-1 text-xs text-[var(--muted)] lg:hidden">{t('finance_col_registration')}</p>
                      <span
                        className={badge(
                          row.status === 'confirmed' ? 'ok' : row.status === 'pending' ? 'warn' : 'danger',
                        )}
                      >
                        {row.status === 'confirmed'
                          ? t('finance_reg_confirmed')
                          : row.status === 'pending'
                            ? t('finance_reg_pending')
                            : t('finance_reg_cancelled')}
                      </span>
                    </td>
                    <td className="min-w-0 lg:px-4 lg:py-3">
                      <p className="mb-1 text-xs text-[var(--muted)] lg:hidden">{t('finance_col_invoice')}</p>
                      {row.status === 'confirmed' ? (
                        <span className={badge(created ? 'ok' : 'warn')}>
                          {created ? t('finance_filter_done') : t('finance_filter_outstanding')}
                          {invoice?.reference ? ` · ${invoice.reference}` : ''}
                        </span>
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td className="min-w-0 tabular-nums lg:px-4 lg:py-3">
                      <p className="mb-1 text-xs text-[var(--muted)] lg:hidden">{t('finance_col_amount')}</p>
                      {row.totalPrice !== null ? currency(row.totalPrice) : '—'}
                    </td>
                    <td className="min-w-0 sm:col-span-2 lg:px-4 lg:py-3">
                      <Link
                        href={`/${lang}/admin/invoices?month=${monthValue}`}
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-muted)]"
                      >
                        <FileText size={15} aria-hidden="true" />
                        {t('finance_row_action_invoice')}
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Kontinuität & Pausen */}
      {continuity && (continuity.inherited.length > 0 || continuity.paused.length > 0) && (
        <section className="min-w-0 space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
          <div>
            <h2 className="text-sm font-semibold">{t('finance_continuity_title')}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {t('finance_continuity_intro')}
              {continuity.month ? ` · ${formatProfileMonth(continuity.month, lang)}` : ''}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <ContinuityList
              icon={<CalendarClock size={16} aria-hidden="true" className="text-[var(--muted)]" />}
              title={t('finance_inherited')}
              rows={continuity.inherited}
              tone="muted"
              t={t}
            />
            <ContinuityList
              icon={<PauseCircle size={16} aria-hidden="true" className="text-amber-600 dark:text-amber-300" />}
              title={t('finance_paused')}
              rows={continuity.paused}
              tone="warn"
              t={t}
            />
          </div>
        </section>
      )}
    </div>
  )
}

function ContinuityList({
  icon,
  title,
  rows,
  tone,
  t,
}: {
  icon: React.ReactNode
  title: string
  rows: NextMonthStudentRow[]
  tone: 'muted' | 'warn'
  t: ReturnType<typeof useAdminTranslator>
}) {
  return (
    <div className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--canvas)] p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
        <span className={badge(tone)}>{rows.length}</span>
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">—</p>
      ) : (
        <ul className="space-y-2">
          {rows.map(row => (
            <li key={row.student.id} className="min-w-0 break-words">
              <p className="text-sm font-medium">{row.student.person?.display_name || row.student.person?.email || t('finance_col_student')}</p>
              {row.courseSelections.length > 0 && (
                <p className="text-xs text-[var(--muted)]">{row.courseSelections.length}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function deriveContinuity(bookings: NextMonthOverview | null) {
  if (!bookings) return null
  const inherited: NextMonthStudentRow[] = []
  const seen = new Set<string>()
  for (const group of bookings.groups) {
    for (const row of group.students) {
      if (row.source === 'previous' && !seen.has(row.student.id)) {
        seen.add(row.student.id)
        inherited.push(row)
      }
    }
  }
  return { month: bookings.targetMonth, inherited, paused: bookings.paused }
}
