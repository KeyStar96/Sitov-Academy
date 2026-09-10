'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { UserRound, Check, Loader2 } from 'lucide-react'
import { updatePersonalDetails } from '@/app/actions/profile'
import { personalDetailsSchema, type PersonalDetails } from '@/lib/types/profile'
import { createProfileTranslator, type ProfileTranslations, type ProfileTranslationKey } from '@/lib/profile-i18n'
import { registrationLabels } from '@/lib/admin-registration-i18n'

export default function ProfileDetailsForm({ initial, pendingEmail, lang, translations, birthDate }: {
  initial: PersonalDetails; pendingEmail: string | null; lang: string; translations: ProfileTranslations; birthDate?: string | null
}) {
  const t = createProfileTranslator(translations)
  const [saved, setSaved] = useState(initial)
  const [pending, setPending] = useState(pendingEmail)
  const [draft, setDraft] = useState({ ...initial, email: pendingEmail ?? initial.email })
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)
  const [notice, setNotice] = useState<ProfileTranslationKey | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!inFlight.current) {
      setSaved(initial)
      setPending(pendingEmail)
      setDraft({ ...initial, email: pendingEmail ?? initial.email })
    }
  }, [initial, pendingEmail])
  useEffect(() => {
    if (!saving) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [saving])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    const values = { ...draft, lang }
    const validated = personalDetailsSchema.safeParse(values)
    if (validated.success === false) { setNotice('invalid_input'); setFailed(true); return }
    const before = saved
    inFlight.current = true
    setSaving(true)
    setFailed(false)
    setNotice(null)
    setSaved(draft)
    try {
      const result = await updatePersonalDetails(validated.data)
      if (result.success === false) throw new Error(result.error)
      setSaved(result.data.profile)
      setPending(result.data.pendingEmail)
      setDraft({ ...result.data.profile, email: result.data.pendingEmail ?? result.data.profile.email })
      setNotice(result.data.emailChange === 'failed' ? 'email_change_failed'
        : result.data.emailChange === 'pending' ? 'email_confirmation' : 'saved')
      setFailed(result.data.emailChange === 'failed')
    } catch {
      setSaved(before)
      setDraft({ ...before, email: pending ?? before.email })
      setNotice('profile_save_failed')
      setFailed(true)
    } finally { setSaving(false); inFlight.current = false }
  }

  const fields = [
    { key: 'name', type: 'text', autoComplete: 'name', maxLength: 80, required: true },
    { key: 'email', type: 'email', autoComplete: 'email', maxLength: 180, required: true },
    { key: 'phone', type: 'tel', autoComplete: 'tel', maxLength: 50 },
    { key: 'street', type: 'text', autoComplete: 'street-address', maxLength: 250 },
    { key: 'zip_code', type: 'text', autoComplete: 'postal-code', maxLength: 32 },
    { key: 'city', type: 'text', autoComplete: 'address-level2', maxLength: 120 },
  ] as const

  return (
    <section aria-labelledby="personal-title" className="min-w-0 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-7">
      <div className="mb-6 flex min-w-0 items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-[var(--violet)]"><UserRound aria-hidden="true" size={24} /></span>
        <div className="min-w-0">
          <h2 id="personal-title" className="break-words text-xl font-bold text-[var(--foreground)]">{t('personal_data')}</h2>
          <p className="mt-1 break-words text-sm leading-relaxed text-[var(--muted)]">{t('personal_intro')}</p>
        </div>
      </div>
      {birthDate && <dl className="mb-5 flex flex-wrap justify-between gap-2 rounded-xl bg-[var(--canvas)] px-4 py-3 text-sm"><dt className="text-[var(--muted)]">{registrationLabels(lang).birthday}</dt><dd className="font-semibold text-[var(--foreground)]">{birthDate}</dd></dl>}
      <form onSubmit={submit} noValidate aria-busy={saving}>
        <fieldset disabled={saving} className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map(field => (
            <div key={field.key} className={`min-w-0 ${field.key === 'street' ? 'sm:col-span-2' : ''}`}>
              <label htmlFor={`profile-${field.key}`} className="mb-2 block text-sm font-semibold text-[var(--foreground)]">{t(field.key)}</label>
              <input id={`profile-${field.key}`} name={field.key} type={field.type} autoComplete={field.autoComplete}
                maxLength={field.maxLength} required={field.key === 'name' || field.key === 'email'}
                value={draft[field.key] ?? ''}
                aria-describedby={field.key === 'email' ? 'profile-email-hint' : undefined}
                onChange={event => setDraft(current => ({ ...current, [field.key]: field.key === 'name' || field.key === 'email' ? event.target.value : event.target.value || null }))}
                className="block min-h-12 w-full min-w-0 max-w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-base text-[var(--foreground)] outline-none focus:border-[var(--violet)] focus:ring-2 focus:ring-[var(--violet)] disabled:bg-[var(--surface-muted)]" />
              {field.key === 'email' && <p id="profile-email-hint" className="mt-2 break-words text-xs leading-relaxed text-[var(--muted)]">{t('email_hint')}</p>}
            </div>
          ))}
        </fieldset>
        {pending && <p className="mt-4 break-words rounded-xl bg-amber-50 p-3 text-sm text-amber-900 [overflow-wrap:anywhere] dark:bg-amber-950 dark:text-amber-200">{t('pending_email', { email: pending })}</p>}
        <div className="mt-6 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          <button type="submit" disabled={saving} className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center gap-2 whitespace-normal rounded-xl bg-[var(--violet)] px-5 py-3 text-base font-bold text-[var(--surface)] hover:bg-[var(--violet)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:opacity-70">
            {saving ? <Loader2 size={18} aria-hidden="true" className="animate-spin" /> : <Check size={18} aria-hidden="true" />}
            <span>{saving ? t('saving') : t('save_details')}</span>
          </button>
        </div>
        <div className="mt-3 min-h-12 min-w-0 break-words text-sm leading-relaxed" role={failed ? 'alert' : 'status'} aria-live={failed ? 'assertive' : 'polite'} aria-atomic="true">
          <p className={failed ? 'text-red-700 dark:text-red-300' : 'text-emerald-800 dark:text-emerald-300'}>{notice ? t(notice) : saving ? t('saving_navigation') : ''}</p>
        </div>
      </form>
    </section>
  )
}
