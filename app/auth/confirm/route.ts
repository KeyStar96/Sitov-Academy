import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { decideAuthCallback, readAuthCallbackSearch } from '@/lib/auth-callback'
import { buildAuthRedirectUrl, originFromHeaders } from '@/lib/site-url'
import type { AuthStatusCode } from '@/lib/types/auth'

/**
 * Einstiegspunkt für alle Links aus Auth-E-Mails (Bestätigung, Passwort-Reset,
 * E-Mail-Wechsel) und für den PKCE-Callback von GoTrue.
 *
 * Die Verzweigung PKCE vs. OTP liegt in `lib/auth-callback.ts`. Diese Route
 * führt sie aus und leitet anschließend über `NEXT_PUBLIC_SITE_URL` weiter –
 * nie über eine hartcodierte localhost-Adresse. Lokale Requests bleiben auf
 * dem Request-Host, damit Session-Cookies und Playwright greifen.
 *
 * Nach erfolgreicher Bestätigung geht es direkt ins geschützte Dashboard
 * (`/{lang}/dashboard`). Recovery-Links landen auf der Passwortvergabe.
 *
 * Diese Route darf nie über die Middleware umgeleitet werden: Eine
 * Weiterleitung würde die Einmal-Token aus der Query verlieren. Siehe
 * `isLocaleExempt` in `lib/locale-routing.ts`.
 */

function requestOrigin(request: NextRequest): string | null {
  return originFromHeaders(
    request.headers.get('x-forwarded-host'),
    request.headers.get('x-forwarded-proto'),
    request.headers.get('host')
  )
}

function redirectTo(request: NextRequest, path: string, status?: AuthStatusCode): NextResponse {
  const origin = requestOrigin(request)
  const target = status
    ? buildAuthRedirectUrl(origin, path, { status })
    : buildAuthRedirectUrl(origin, path)
  return NextResponse.redirect(target)
}

export async function GET(request: NextRequest) {
  const decision = decideAuthCallback(readAuthCallbackSearch(request.nextUrl.searchParams))

  if (decision.kind === 'reject') {
    if (decision.status === 'confirm_missing_params') {
      console.error("[auth/confirm] Aufruf ohne Token")
    } else {
      console.error("[auth/confirm] Anbieter hat den Vorgang abgebrochen")
    }
    return redirectTo(request, decision.redirectPath, decision.status)
  }

  try {
    const supabase = await createClient()
    const { error } =
      decision.verify.flow === 'pkce'
        ? await supabase.auth.exchangeCodeForSession(decision.verify.code)
        : await supabase.auth.verifyOtp({
            type: decision.verify.type,
            token_hash: decision.verify.tokenHash,
          })

    if (error) {
      console.error("[auth/confirm] Verifizierung fehlgeschlagen")
      const failPath = decision.isRecovery
        ? `/${decision.lang}/forgot-password`
        : `/${decision.lang}/login`
      const failStatus: AuthStatusCode = decision.isRecovery
        ? 'password_session_missing'
        : 'confirm_failed'
      return redirectTo(request, failPath, failStatus)
    }

    return redirectTo(request, decision.nextPath, decision.isRecovery ? undefined : 'confirm_success')
  } catch (error) {
    console.error("[auth/confirm] Unerwarteter Fehler")
    const failPath = decision.isRecovery
      ? `/${decision.lang}/forgot-password`
      : `/${decision.lang}/login`
    const failStatus: AuthStatusCode = decision.isRecovery
      ? 'password_session_missing'
      : 'confirm_failed'
    return redirectTo(request, failPath, failStatus)
  }
}
