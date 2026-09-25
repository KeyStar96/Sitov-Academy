import Link from 'next/link'
import type { Metadata } from 'next'
import { login, resendConfirmation } from '@/app/actions/auth'
import AuthForm from '@/components/auth/AuthForm'
import AuthShell from '@/components/auth/AuthShell'
import AuthStatusMessage from '@/components/auth/AuthStatusMessage'
import { authStatusMessage, authTranslations, createAuthTranslator } from '@/lib/auth-i18n'
import { getDictionary } from '@/lib/dictionary'
import { parseAuthStatus, type AuthStatusCode } from '@/lib/types/auth'
import { registrationLabels } from '@/lib/admin-registration-i18n'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  // Anmeldeseiten gehören nicht in den Suchindex.
  robots: { index: false, follow: false },
}

/**
 * Status, bei denen ein neuer Bestätigungslink der eigentliche Ausweg ist.
 * Nur dann wird das zweite Formular gezeigt – sonst lenkt es ab.
 */
const RESEND_STATUS: readonly AuthStatusCode[] = [
  'login_unconfirmed',
  'confirm_failed',
  'confirm_missing_params',
]

export default async function LoginPage({
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

  const showResend = status !== null && RESEND_STATUS.includes(status)

  return (
    <AuthShell
      lang={lang}
      title={t('login_title')}
      description={
        <>
          {t('login_subtitle')}{' '}
          <Link
            href={`/${lang}/register`}
            className="font-semibold text-[var(--accent-text)] underline decoration-2 underline-offset-4 hover:text-[var(--foreground)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            {t('login_register_link')}
          </Link>
        </>
      }
    >
      {status && <AuthStatusMessage status={status} message={authStatusMessage(t, status)}
        title={status === 'signup_email_sent' || status === 'confirm_success' ? t('signup_thanks') : undefined} />}
      <p className="rounded-2xl bg-[var(--canvas)] p-4 text-sm leading-relaxed text-[var(--muted)]">{learning.auth_existing}</p>

      <AuthForm
        action={login}
        lang={lang}
        submitLabel={t('login_submit')}
        pendingLabel={t('login_pending')}
        fields={[
          {
            name: 'email',
            label: t('field_email'),
            type: 'email',
            placeholder: t('field_email_placeholder'),
            autoComplete: 'email',
          },
          {
            name: 'password',
            label: t('field_password'),
            type: 'password',
            placeholder: t('field_password_placeholder'),
            autoComplete: 'current-password',
          },
        ]}
      />

      <div className="border-t-2 border-slate-200 pt-4 dark:border-slate-800">
        <Link
          href={`/${lang}/forgot-password`}
          className="inline-flex min-h-14 items-center text-lg font-semibold text-[var(--accent-text)] underline decoration-2 underline-offset-4 hover:text-[var(--foreground)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          {t('login_forgot_password')}
        </Link>
      </div>

      {showResend && (
        <section
          aria-label={t('resend_title')}
          className="space-y-4 rounded-2xl border-2 border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/50"
        >
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {t('resend_title')}
            </h2>
            <p className="text-lg text-slate-700 dark:text-slate-300">
              {t('resend_description')}
            </p>
          </div>

          <AuthForm
            action={resendConfirmation}
            lang={lang}
            submitLabel={t('resend_submit')}
            pendingLabel={t('resend_pending')}
            fields={[
              {
                name: 'email',
                label: t('field_email'),
                type: 'email',
                placeholder: t('field_email_placeholder'),
                autoComplete: 'email',
              },
            ]}
          />

          <p className="text-base text-slate-600 dark:text-slate-400">{t('spam_hint')}</p>
        </section>
      )}
    </AuthShell>
  )
}
