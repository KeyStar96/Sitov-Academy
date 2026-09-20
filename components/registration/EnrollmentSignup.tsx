'use client'
import { useState } from 'react'
import Link from 'next/link'
import { signup } from '@/app/actions/auth'
import AuthForm from '@/components/auth/AuthForm'
import { identityLabels } from '@/lib/registration-identity-i18n'
import { PASSWORD_MIN_LENGTH } from '@/lib/types/auth'

/** Only rendered after enrollment has succeeded: signup failure never retries a booking. */
export default function EnrollmentSignup({ lang, name, email }: { lang: string; name: string; email: string }) {
  const [open, setOpen] = useState(false)
  const t = identityLabels(lang)
  return <section className="my-8 w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-left text-[var(--foreground)]">
    <h4 className="text-xl font-bold">{t.signup}</h4><p className="my-3 leading-relaxed">{t.signupIntro}</p>
    {open ? <>
      <p className="mb-4 break-all font-semibold">{email}</p><p className="mb-5 text-sm leading-relaxed">{t.signupSecurity}</p>
      <AuthForm action={signup} lang={lang} hiddenFields={{ display_name: name.trim().slice(0, 80), email }} submitLabel={t.create} pendingLabel={t.creating} fields={[
        { name: 'native_language', label: t.native, type: 'select', placeholder: '—', options: [
          { value: 'ru', label: 'Русский' }, { value: 'tr', label: 'Türkçe' }, { value: 'uk', label: 'Українська' }, { value: 'en', label: 'English' }, { value: 'de', label: 'Deutsch' },
        ] },
        { name: 'password', label: t.password, type: 'password', autoComplete: 'new-password', minLength: PASSWORD_MIN_LENGTH, hint: t.passwordHint },
      ]} />
      <button type="button" onClick={() => setOpen(false)} className="mt-3 min-h-12 underline">{t.later}</button>
    </> : <button type="button" onClick={() => setOpen(true)} className="min-h-12 rounded-xl bg-[var(--foreground)] px-5 py-3 font-semibold text-[var(--background)]">{t.create}</button>}
    <Link href={`/${lang}/login`} className="mt-3 block min-h-12 py-3 underline">{t.existing}</Link>
  </section>
}
