'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CalendarClock,
  CheckCircle2,
  FileText,
  PauseCircle,
  Search,
} from 'lucide-react'
import { useAdminTranslator } from './AdminI18nProvider'
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatTile, adminButton, adminChip, adminInput, adminLabel, type AdminTone } from './ui'
import { formatProfileMonth } from '@/lib/profile-month'
import { formatCourseQuantity } from '@/lib/course-quantity-i18n'
import type { RegistrationOverview, StaffRegistration, StaffInvoice } from '@/lib/types/admin-registrations'
import type { NextMonthOverview, NextMonthStudentRow } from '@/lib/types/admin-staff'

type StatusFilter = 'all' | 'unconfirmed' | 'outstanding' | 'done'

/**
 * Monatsübersicht im Bereich „Verwaltung“.
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

  const metrics: Array<{ key: string; label: string; value: number; tone: 'neutral' | 'accent' | 'warning' }> = [
    { key: 'students', label: t('finance_kpi_students'), value: kpis.students, tone: 'neutral' },
    { key: 'confirmed', label: t('finance_kpi_confirmed'), value: kpis.confirmed, tone: 'neutral' },
    { key: 'pending', label: t('finance_kpi_pending'), value: kpis.pending, tone: kpis.pending ? 'warning' : 'neutral' },
    { key: 'invoiced', label: t('finance_kpi_invoiced'), value: kpis.invoiced, tone: 'neutral' },
    { key: 'outstanding', label: t('finance_kpi_outstanding'), value: kpis.outstanding, tone: kpis.outstanding ? 'accent' : 'neutral' },
  ]

  const filters: Array<{ value: StatusFilter; label: string }> = [
    { value: 'all', label: t('finance_filter_all') },
    { value: 'unconfirmed', label: t('finance_filter_unconfirmed') },
    { value: 'outstanding', label: t('finance_filter_outstanding') },
    { value: 'done', label: t('finance_filter_done') },
  ]

  const regTone = (status: StaffRegistration['status']): AdminTone => status === 'confirmed' ? 'success' : status === 'pending' ? 'warning' : 'danger'
  return (
    <div className="min-w-0 space-y-5 text-[var(--foreground)] sm:space-y-6">
      <PageHeader eyebrow={formatProfileMonth(month, lang)} title={t('finance_title')} description={t('finance_intro')} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {metrics.map(metric => <StatTile key={metric.key} label={metric.label} value={metric.value} tone={metric.tone} />)}
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_13rem] sm:items-end">
        <label className="block min-w-0">
          <span className={adminLabel}>{t('finance_search')}</span>
          <span className="relative block">
            <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input type="search" value={search} onChange={event => setSearch(event.target.value)} className={`${adminInput} pl-9`} />
          </span>
        </label>
        <label className="block min-w-0">
          <span className={adminLabel}>{t('finance_month')}</span>
          <input
            type="month"
            value={monthValue}
            onChange={event => {
              if (/^\d{4}-\d{2}$/.test(event.target.value)) router.push(`/${lang}/admin/finance?month=${event.target.value}`)
            }}
            className={adminInput}
          />
        </label>
      </div>

      <div className="admin-scroll-x -mx-1 flex gap-2 px-1" role="group" aria-label={t('finance_col_registration')}>
        {filters.map(option => (
          <button key={option.value} type="button" onClick={() => setFilter(option.value)} aria-pressed={filter === option.value} className={adminChip(filter === option.value)}>
            {option.label}
          </button>
        ))}
      </div>

      {/* Matrix */}
      <Card as="section">
        {rows.length === 0 ? (
          <EmptyState icon={CheckCircle2} title={t('finance_empty')} description={t('finance_empty_hint')} />
        ) : (
          <table className="block w-full border-collapse text-left text-sm lg:table">
            <caption className="sr-only">{t('finance_title')} · {formatProfileMonth(month, lang)}</caption>
            <thead className="hidden border-b border-[var(--admin-line)] bg-[var(--surface-muted)] lg:table-header-group">
              <tr>
                {[
                  t('finance_col_student'),
                  t('finance_col_courses'),
                  t('finance_col_registration'),
                  t('finance_col_invoice'),
                  t('finance_col_amount'),
                  t('finance_col_actions'),
                ].map(label => (
                  <th key={label} scope="col" className="px-4 py-2.5 text-xs font-semibold text-[var(--muted)]">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="block divide-y divide-[var(--admin-line)] lg:table-row-group">
              {rows.map(row => {
                const invoice = invoiceFor(row)
                const created = invoice?.status === 'created'
                return (
                  <tr key={`${row.source}:${row.id}`} className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 align-top lg:table-row lg:p-0">
                    <td className="col-span-2 min-w-0 break-words lg:px-4 lg:py-3">
                      <p className="font-semibold">{row.contact.name}</p>
                      <p className="mt-0.5 break-all text-xs text-[var(--muted)]">{row.contact.email}</p>
                    </td>
                    <td className="col-span-2 min-w-0 lg:px-4 lg:py-3">
                      <p className="mb-1 text-xs text-[var(--muted)] lg:hidden">{t('finance_col_courses')}</p>
                      {row.courses.length ? (
                        <ul className="space-y-1">
                          {row.courses.map(course => (
                            <li key={course.id} className="break-words">
                              {course.title}
                              <span className="block text-xs text-[var(--muted)]">{formatCourseQuantity(course.units, course.unitMinutes, lang)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-[var(--muted)]">{t('finance_no_courses')}</span>
                      )}
                    </td>
                    <td className="min-w-0 lg:px-4 lg:py-3">
                      <p className="mb-1 text-xs text-[var(--muted)] lg:hidden">{t('finance_col_registration')}</p>
                      <Badge tone={regTone(row.status)}>
                        {row.status === 'confirmed' ? t('finance_reg_confirmed') : row.status === 'pending' ? t('finance_reg_pending') : t('finance_reg_cancelled')}
                      </Badge>
                    </td>
                    <td className="min-w-0 lg:px-4 lg:py-3">
                      <p className="mb-1 text-xs text-[var(--muted)] lg:hidden">{t('finance_col_invoice')}</p>
                      {row.status === 'confirmed' ? (
                        <Badge tone={created ? 'success' : 'warning'}>
                          {created ? t('finance_filter_done') : t('finance_filter_outstanding')}
                          {invoice?.reference ? ` · ${invoice.reference}` : ''}
                        </Badge>
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td className="min-w-0 tabular-nums lg:px-4 lg:py-3">
                      <p className="mb-1 text-xs text-[var(--muted)] lg:hidden">{t('finance_col_amount')}</p>
                      <span className="font-semibold">{row.totalPrice !== null ? currency(row.totalPrice) : '—'}</span>
                    </td>
                    <td className="min-w-0 lg:px-4 lg:py-3">
                      <Link href={`/${lang}/admin/invoices?month=${monthValue}`} className={adminButton('secondary', 'sm', 'w-full lg:w-auto')}>
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
      </Card>

      {/* Kontinuität & Pausen */}
      {continuity && (continuity.inherited.length > 0 || continuity.paused.length > 0) && (
        <Card labelledBy="finance-continuity">
          <CardHeader id="finance-continuity" icon={CalendarClock} title={t('finance_continuity_title')} description={`${t('finance_continuity_intro')}${continuity.month ? ` · ${formatProfileMonth(continuity.month, lang)}` : ''}`} />
          <div className="grid gap-3 p-4 md:grid-cols-2">
            <ContinuityList
              icon={<CalendarClock size={16} aria-hidden="true" className="text-[var(--muted)]" />}
              title={t('finance_inherited')}
              rows={continuity.inherited}
              tone="neutral"
              t={t}
            />
            <ContinuityList
              icon={<PauseCircle size={16} aria-hidden="true" className="text-[var(--warning-foreground)]" />}
              title={t('finance_paused')}
              rows={continuity.paused}
              tone="warning"
              t={t}
            />
          </div>
        </Card>
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
  tone: 'neutral' | 'warning'
  t: ReturnType<typeof useAdminTranslator>
}) {
  return (
    <div className="min-w-0 rounded-lg border border-[var(--admin-line)] p-3">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
        <Badge tone={tone}>{rows.length}</Badge>
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">—</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {rows.map(row => (
            <li key={row.student.id} className="min-w-0 break-words">
              {row.student.person?.display_name || row.student.person?.email || t('finance_col_student')}
              {row.courseSelections.length > 0 && <span className="ml-1 text-xs text-[var(--muted)]">· {row.courseSelections.length}</span>}
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
