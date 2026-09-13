import Link from 'next/link'
import type { Metadata } from 'next'
import { resetPassword } from '@/app/actions/auth'
import AuthForm from '@/components/auth/AuthForm'
import AuthShell from '@/components/auth/AuthShell'
import AuthStatusMessage from '@/components/auth/AuthStatusMessage'
import { authStatusMessage, authTranslations, createAuthTranslator } from '@/lib/auth-i18n'
import { getDictionary } from '@/lib/dictionary'
import { parseAuthStatus } from '@/lib/types/auth'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function ForgotPasswordPage({
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

  return (
    <AuthShell lang={lang} title={t('forgot_title')} description={t('forgot_description')}>
      {status && <AuthStatusMessage status={status} message={authStatusMessage(t, status)} />}

      <AuthForm
        action={resetPassword}
        lang={lang}
        submitLabel={t('forgot_submit')}
        pendingLabel={t('forgot_pending')}
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

      <div className="border-t-2 border-slate-200 pt-4 dark:border-slate-800">
        <Link
          href={`/${lang}/login`}
          className="inline-flex min-h-14 items-center text-lg font-semibold text-[var(--accent)] underline decoration-2 underline-offset-4 hover:text-[var(--foreground)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          {t('forgot_back_to_login')}
        </Link>
      </div>
    </AuthShell>
  )
}
