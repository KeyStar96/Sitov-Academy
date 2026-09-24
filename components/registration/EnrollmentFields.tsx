'use client'

import { useEffect, useState, type ComponentProps, type FocusEvent } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Under a field: the error in a full sentence, otherwise the example. */
function FieldMessage({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  if (error) return <p id={`${id}-error`} className="reg-field__error"><AlertCircle size={22} aria-hidden="true" /><span>{error}</span></p>
  if (hint) return <p id={`${id}-hint`} className="reg-field__hint">{hint}</p>
  return null
}

const describedBy = (id: string, error?: string, hint?: string) => error ? `${id}-error` : hint ? `${id}-hint` : undefined

/** Report "touched" only when focus leaves the whole group, not between its own boxes. */
const leaveGroup = (onBlur: () => void) => (event: FocusEvent<HTMLElement>) => {
  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onBlur()
}

/** Fixed label above a framed box; nothing floats or shrinks while typing. */
export function TextField({ id, label, hint, error, className, ...input }: {
  id: string; label: string; hint?: string; error?: string
} & ComponentProps<'input'>) {
  return (
    <div className={cn('reg-field', className)} data-invalid={error ? 'true' : undefined}>
      <label htmlFor={id} className="reg-field__label">{label}</label>
      <input id={id} className="reg-input" aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, error, hint)} {...input} />
      <FieldMessage id={id} error={error} hint={hint} />
    </div>
  )
}

const COUNTRY_CODES = ['+49', '+43', '+41', '+44', '+1', '+7', '+90', '+380', '+33', '+34', '+39', '+48']

/** Stores "+49 0151 …" like before; an empty number clears the optional field. */
export function PhoneField({ id, label, hint, error, countryCodeLabel, value, onChange, onBlur }: {
  id: string; label: string; hint: string; error?: string; countryCodeLabel: string
  value?: string; onChange: (value: string) => void; onBlur: () => void
}) {
  const [code, setCode] = useState('+49')
  const [number, setNumber] = useState('')
  useEffect(() => {
    if (!value) return
    const found = COUNTRY_CODES.find(candidate => value.startsWith(`${candidate} `))
    if (found) { setCode(found); setNumber(value.slice(found.length + 1)) } else setNumber(value)
  }, [value])
  const update = (nextCode: string, nextNumber: string) => {
    setCode(nextCode)
    setNumber(nextNumber)
    onChange(nextNumber.trim() ? `${nextCode} ${nextNumber}` : '')
  }
  return (
    <div className="reg-field" data-invalid={error ? 'true' : undefined} onBlur={leaveGroup(onBlur)}>
      <label htmlFor={id} className="reg-field__label">{label}</label>
      <div className="reg-phone">
        <select aria-label={countryCodeLabel} autoComplete="tel-country-code" value={code} onChange={event => update(event.target.value, number)} className="reg-input reg-phone__code">
          {COUNTRY_CODES.map(country => <option key={country} value={country}>{country}</option>)}
        </select>
        <input id={id} type="tel" inputMode="tel" autoComplete="tel-national" value={number}
          onChange={event => update(code, event.target.value)} className="reg-input"
          aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, error, hint)} />
      </div>
      <FieldMessage id={id} error={error} hint={hint} />
    </div>
  )
}

const pad = (part: string) => part.length === 1 ? `0${part}` : part

/**
 * Three separate boxes for day, month and year, as recommended for dates people
 * know by heart. The combined value keeps the schema's DD.MM.YYYY format; an
 * incomplete date stays incomplete so the schema can name what is missing.
 */
export function BirthDateField({ id, legend, hint, error, labels, value, onChange, onBlur }: {
  id: string; legend: string; hint: string; error?: string
  labels: { day: string; month: string; year: string }
  value?: string; onChange: (value: string) => void; onBlur: () => void
}) {
  const [parts, setParts] = useState(() => {
    const [day = '', month = '', year = ''] = value ? value.split('.') : []
    return { day: day.replace(/^0/, ''), month: month.replace(/^0/, ''), year }
  })
  const update = (key: keyof typeof parts, raw: string) => {
    const next = { ...parts, [key]: raw.replace(/\D/g, '').slice(0, key === 'year' ? 4 : 2) }
    setParts(next)
    onChange(next.day || next.month || next.year ? `${pad(next.day)}.${pad(next.month)}.${next.year}` : '')
  }
  const box = (key: keyof typeof parts, autoComplete: string, width: string) => (
    <div className={cn('reg-date__part', width)}>
      <label htmlFor={`${id}-${key}`} className="reg-date__label">{labels[key]}</label>
      <input id={`${id}-${key}`} inputMode="numeric" autoComplete={autoComplete} value={parts[key]}
        onChange={event => update(key, event.target.value)} className="reg-input" maxLength={key === 'year' ? 4 : 2}
        aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, error, hint)} />
    </div>
  )
  return (
    <fieldset className="reg-field" data-invalid={error ? 'true' : undefined} onBlur={leaveGroup(onBlur)}>
      <legend className="reg-field__label">{legend}</legend>
      <div className="reg-date">
        {box('day', 'bday-day', 'reg-date__part--short')}
        {box('month', 'bday-month', 'reg-date__part--short')}
        {box('year', 'bday-year', 'reg-date__part--year')}
      </div>
      <FieldMessage id={id} error={error} hint={hint} />
    </fieldset>
  )
}
