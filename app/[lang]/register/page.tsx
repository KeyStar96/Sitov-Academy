import Link from 'next/link'
import type { Metadata } from 'next'
import { signup } from '@/app/actions/auth'
import AuthForm from '@/components/auth/AuthForm'
import AuthShell from '@/components/auth/AuthShell'
import AuthStatusMessage from '@/components/auth/AuthStatusMessage'
import {
  authStatusMessage,
  authTranslations,
  createAuthTranslator,
  passwordHint,
} from '@/lib/auth-i18n'
import { getDictionary } from '@/lib/dictionary'
import { parseAuthStatus, PASSWORD_MIN_LENGTH } from '@/lib/types/auth'
import { registrationLabels } from '@/lib/admin-registration-i18n'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { lang } = await params
  const resolvedSearchParams = await searchParams
  const status = parseAuthStatus(resolvedSearchParams?.status)

  const dictionary = await getDictionary(lang)
  const t = createAuthTranslator(authTranslations(dictionary))
  const learning = registrationLabels(lang)

  return (
    <AuthShell
      lang={lang}
      title={t('register_title')}
      description={
        <>
          {t('register_subtitle')}{' '}
          <Link
            href={`/${lang}/login`}
            className="font-semibold text-[var(--accent)] underline decoration-2 underline-offset-4 hover:text-[var(--foreground)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            {t('register_login_link')}
          </Link>
        </>
      }
    >
      {status && <AuthStatusMessage status={status} message={authStatusMessage(t, status)} />}
      <p className="rounded-2xl bg-[var(--canvas)] p-4 text-sm leading-relaxed text-[var(--muted)]">{learning.auth_existing}</p>

      <AuthForm
        action={signup}
        lang={lang}
        submitLabel={t('register_submit')}
        pendingLabel={t('register_pending')}
        fields={[
          {
            name: 'name',
            label: t('field_name'),
            type: 'text',
            placeholder: t('field_name_placeholder'),
            autoComplete: 'name',
          },
          {
            name: 'email',
            label: t('field_email'),
            type: 'email',
            placeholder: t('field_email_placeholder'),
            autoComplete: 'email',
          },
          {
            name: 'native_language',
            label: t('field_native_language'),
            type: 'select',
            placeholder: t('field_native_language_placeholder'),
            // Die Werte müssen dem CHECK-Constraint auf `profiles.native_language`
            // entsprechen, sonst scheitert der Trigger beim Anlegen des Profils.
            // Aus der Erstsprache leitet der Trigger `handle_new_user` zugleich
            // die Start-Oberflächensprache (`ui_language`) ab.
            options: [
              { value: 'Russisch', label: t('native_language_russian') },
              { value: 'Türkisch', label: t('native_language_turkish') },
              { value: 'Ukrainisch', label: t('native_language_ukrainian') },
              { value: 'Englisch', label: t('native_language_english') },
              { value: 'Deutsch', label: t('native_language_german') },
            ],
          },
          {
            name: 'password',
            label: t('field_password'),
            type: 'password',
            placeholder: t('field_password_placeholder'),
            autoComplete: 'new-password',
            minLength: PASSWORD_MIN_LENGTH,
            hint: passwordHint(t),
          },
        ]}
      />

      <p className="text-base text-slate-600 dark:text-slate-400">{t('spam_hint')}</p>
    </AuthShell>
  )
}
