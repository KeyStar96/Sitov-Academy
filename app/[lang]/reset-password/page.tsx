import Link from 'next/link'
import type { Metadata } from 'next'
import { updatePassword } from '@/app/actions/auth'
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
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

/**
 * Vergabe eines neuen Passworts nach dem Klick im Recovery-Link.
 *
 * Der Link führt über `/auth/confirm`, wo aus dem Einmal-Token eine Sitzung
 * wird. Fehlt diese Sitzung hier, ist der Link abgelaufen oder wurde in einem
 * anderen Browser geöffnet. Dann zeigen wir statt eines Formulars, das
 * zwangsläufig fehlschlägt, direkt den Weg zu einem neuen Link.
 */
export default async function ResetPasswordPage({
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

  let hasRecoverySession = false
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    hasRecoverySession = user !== null
  } catch (error) {
    console.error("[reset-password] Sitzung konnte nicht geprüft werden")
  }

  return (
    <AuthShell
      lang={lang}
      title={t('reset_title')}
      description={hasRecoverySession ? t('reset_description') : undefined}
    >
      {status && <AuthStatusMessage status={status} message={authStatusMessage(t, status)} />}

      {hasRecoverySession ? (
        <AuthForm
          action={updatePassword}
          lang={lang}
          submitLabel={t('reset_submit')}
          pendingLabel={t('reset_pending')}
          fields={[
            {
              name: 'password',
              label: t('field_password_new'),
              type: 'password',
              placeholder: t('field_password_placeholder'),
              autoComplete: 'new-password',
              minLength: PASSWORD_MIN_LENGTH,
              hint: passwordHint(t),
            },
          ]}
        />
      ) : (
        <div className="space-y-5">
          {!status && (
            <AuthStatusMessage
              status="password_session_missing"
              message={authStatusMessage(t, 'password_session_missing')}
            />
          )}

          <Link
            href={`/${lang}/forgot-password`}
            className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-[var(--accent-strong)] px-6 text-xl font-bold text-[var(--accent-foreground)] shadow-md transition-colors hover:bg-[var(--accent-strong-hover)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)]"
          >
            {t('forgot_submit')}
          </Link>

          <Link
            href={`/${lang}/login`}
            className="inline-flex min-h-14 items-center text-lg font-semibold text-[var(--accent-text)] underline decoration-2 underline-offset-4 hover:text-[var(--foreground)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            {t('forgot_back_to_login')}
          </Link>
        </div>
      )}
    </AuthShell>
  )
}
