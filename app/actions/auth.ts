'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { rateLimit } from '@/lib/ratelimit'
import { buildSiteUrl, getOutboundSiteUrl } from '@/lib/site-url'
import { resolveLegacyProfile } from '@/lib/profile-legacy'
import {
  emailOnlySchema,
  loginSchema,
  signupSchema,
  uiLanguageSchema,
  updatePasswordSchema,
  type AuthStatusCode,
} from '@/lib/types/auth'

/**
 * Server Actions für Anmeldung, Registrierung und Passwortverwaltung.
 *
 * Zwei Regeln prägen den Aufbau dieser Datei:
 *
 *  1. `redirect()` wird ausschließlich außerhalb von `try`-Blöcken aufgerufen.
 *     Next.js signalisiert eine Weiterleitung über eine geworfene Ausnahme –
 *     ein umschließendes `catch` würde sie abfangen und der Nutzer bliebe auf
 *     einer leeren Seite stehen.
 *  2. Nach außen gehen nur kurze Statuskennungen (`?status=...`), niemals
 *     Meldungen aus der Datenbank oder von Supabase. Übersetzt wird erst in der
 *     Oberfläche.
 */

/** Wie viele Versuche pro Zeitfenster je Absender erlaubt sind. */
const RATE_LIMITS = {
  login: { limit: 10, window: '5 m' },
  signup: { limit: 5, window: '15 m' },
  email: { limit: 3, window: '15 m' },
} as const

function readLanguage(formData: FormData): string {
  return uiLanguageSchema.parse(formData.get('lang') ?? undefined)
}

/**
 * Kennung für die Ratenbegrenzung. Netlify liefert die echte Client-IP in
 * `x-nf-client-connection-ip`; `x-forwarded-for` ist der allgemeine Fallback.
 */
async function requestIdentifier(scope: keyof typeof RATE_LIMITS): Promise<string> {
  try {
    const headerList = await headers()
    const ip =
      headerList.get('x-nf-client-connection-ip') ??
      headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      headerList.get('x-real-ip') ??
      'unbekannt'
    return `auth:${scope}:${ip}`
  } catch {
    return `auth:${scope}:unbekannt`
  }
}

async function isRateLimited(scope: keyof typeof RATE_LIMITS): Promise<boolean> {
  try {
    const identifier = await requestIdentifier(scope)
    const { limit, window } = RATE_LIMITS[scope]
    const result = await rateLimit(identifier, limit, window)
    return !result.success
  } catch (error) {
    // Eine gestörte Ratenbegrenzung darf niemanden aussperren.
    console.error('[auth] Ratenbegrenzung nicht verfügbar', {
      scope,
      error: error instanceof Error ? error.message : 'unbekannt',
    })
    return false
  }
}

/**
 * Baut die Adresse, auf die Supabase nach dem Klick in der E-Mail weiterleitet.
 *
 * Alle Auth-Links laufen über `/auth/confirm`. Diese Route liegt außerhalb der
 * Sprachpfade und ist von den Sprach-Weiterleitungen der Middleware
 * ausgenommen, damit die Einmal-Token nicht verloren gehen.
 */
async function authCallbackUrl(lang: string, next?: string): Promise<string> {
  const siteUrl = await getOutboundSiteUrl()
  const params: Record<string, string> = { lang }
  if (next) params.next = next
  return buildSiteUrl(siteUrl, '/auth/confirm', params)
}

export async function login(formData: FormData) {
  const lang = readLanguage(formData)
  let status: AuthStatusCode | null = null
  // Nach erfolgreichem Login wird die Oberfläche auf die im Profil gespeicherte
  // Sprache (`ui_language`, initial aus der Erstsprache abgeleitet) umgestellt.
  // Fällt auf die Formularsprache zurück, falls das Profil nicht lesbar ist.
  let targetLang = lang

  try {
    const parsed = loginSchema.safeParse({
      email: formData.get('email'),
      password: formData.get('password'),
    })

    if (!parsed.success) {
      status = 'login_invalid'
    } else if (await isRateLimited('login')) {
      status = 'login_rate_limited'
    } else {
      const supabase = await createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      })

      if (error) {
        // Eine unbestätigte Adresse ist kein Tippfehler – dafür gibt es einen
        // eigenen Hinweis mit dem Weg zu einem neuen Bestätigungslink.
        status =
          error.code === 'email_not_confirmed' ? 'login_unconfirmed' : 'login_failed'

        if (error.code !== 'email_not_confirmed' && error.code !== 'invalid_credentials') {
          console.error('[auth] Anmeldung fehlgeschlagen', {
            code: error.code,
            message: error.message,
          })
        }
      } else if (data.user) {
        try { await resolveLegacyProfile(data.user) }
        catch { console.error('[auth] Verified profile association unavailable') }
        // Oberflächensprache aus dem Profil laden (getrennter try/catch: ein
        // Fehler hier darf die erfolgreiche Anmeldung nicht scheitern lassen).
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('ui_language')
            .eq('id', data.user.id)
            .single()

          if (profile?.ui_language) {
            targetLang = uiLanguageSchema.parse(profile.ui_language)
          }
        } catch (profileError) {
          console.error('[auth] Oberflächensprache konnte nicht geladen werden', {
            error: profileError instanceof Error ? profileError.message : 'unbekannt',
          })
        }
      }
    }
  } catch (error) {
    console.error('[auth] Anmeldung unerwartet abgebrochen', {
      error: error instanceof Error ? error.message : 'unbekannt',
    })
    status = 'login_failed'
  }

  if (status) {
    redirect(`/${lang}/login?status=${status}`)
  }

  revalidatePath('/', 'layout')
  redirect(`/${targetLang}/dashboard`)
}

export async function signup(formData: FormData) {
  const lang = readLanguage(formData)
  let status: AuthStatusCode = 'signup_email_sent'

  try {
    const parsed = signupSchema.safeParse({
      name: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password'),
      native_language: formData.get('native_language'),
    })

    if (!parsed.success) {
      status = 'signup_invalid'
    } else if (await isRateLimited('signup')) {
      status = 'signup_rate_limited'
    } else {
      const supabase = await createClient()
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: await authCallbackUrl(lang),
          data: {
            name: parsed.data.name,
            // Wird vom Trigger `handle_new_user` in `profiles` übernommen.
            native_language: parsed.data.native_language,
            ui_language: lang,
          },
        },
      })

      if (error) {
        console.error('[auth] Registrierung fehlgeschlagen', {
          code: error.code,
          message: error.message,
        })
        status = error.code === 'user_already_exists' ? 'signup_email_sent' : 'signup_failed'
      } else if (data.user && data.user.identities?.length === 0) {
        // A public signup form must not disclose existing student addresses.
        status = 'signup_email_sent'
      }
    }
  } catch (error) {
    console.error('[auth] Registrierung unerwartet abgebrochen', {
      error: error instanceof Error ? error.message : 'unbekannt',
    })
    status = 'signup_failed'
  }

  const target = status === 'signup_email_sent' ? 'login' : 'register'
  redirect(`/${lang}/${target}?status=${status}`)
}

export async function logout(lang: string = 'de') {
  const safeLang = uiLanguageSchema.parse(lang)

  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
  } catch (error) {
    console.error('[auth] Abmeldung fehlgeschlagen', {
      error: error instanceof Error ? error.message : 'unbekannt',
    })
  }

  revalidatePath('/', 'layout')
  redirect(`/${safeLang}/login?status=logout_success`)
}

export async function resetPassword(formData: FormData) {
  const lang = readLanguage(formData)
  let status: AuthStatusCode = 'reset_email_sent'

  try {
    const parsed = emailOnlySchema.safeParse({ email: formData.get('email') })

    if (!parsed.success) {
      status = 'reset_invalid'
    } else if (await isRateLimited('email')) {
      status = 'reset_rate_limited'
    } else {
      const supabase = await createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
        redirectTo: await authCallbackUrl(lang, `/${lang}/reset-password`),
      })

      if (error) {
        console.error('[auth] Passwort-Reset konnte nicht angefordert werden', {
          code: error.code,
          message: error.message,
        })
      }
      // Die Meldung bleibt in jedem Fall gleich. Ein Unterschied zwischen
      // „gesendet" und „unbekannte Adresse" würde verraten, welche Adressen
      // registriert sind.
    }
  } catch (error) {
    console.error('[auth] Passwort-Reset unerwartet abgebrochen', {
      error: error instanceof Error ? error.message : 'unbekannt',
    })
  }

  redirect(`/${lang}/forgot-password?status=${status}`)
}

/** Sendet den Bestätigungslink erneut – für abgelaufene oder verlorene E-Mails. */
export async function resendConfirmation(formData: FormData) {
  const lang = readLanguage(formData)
  let status: AuthStatusCode = 'resend_email_sent'

  try {
    const parsed = emailOnlySchema.safeParse({ email: formData.get('email') })

    if (!parsed.success) {
      status = 'resend_invalid'
    } else if (await isRateLimited('email')) {
      status = 'resend_rate_limited'
    } else {
      const supabase = await createClient()
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: parsed.data.email,
        options: { emailRedirectTo: await authCallbackUrl(lang) },
      })

      if (error) {
        console.error('[auth] Bestätigungslink konnte nicht erneut gesendet werden', {
          code: error.code,
          message: error.message,
        })
      }
      // Auch hier bewusst dieselbe Meldung für jede Adresse.
    }
  } catch (error) {
    console.error('[auth] Erneutes Senden unerwartet abgebrochen', {
      error: error instanceof Error ? error.message : 'unbekannt',
    })
  }

  redirect(`/${lang}/login?status=${status}`)
}

export async function updatePassword(formData: FormData) {
  const lang = readLanguage(formData)
  let status: AuthStatusCode | null = null

  try {
    const parsed = updatePasswordSchema.safeParse({ password: formData.get('password') })

    if (!parsed.success) {
      status = 'password_invalid'
    } else {
      const supabase = await createClient()

      // Der Recovery-Link erzeugt eine Sitzung. Fehlt sie, ist der Link
      // abgelaufen oder wurde in einem anderen Browser geöffnet.
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        status = 'password_session_missing'
      } else {
        const { error } = await supabase.auth.updateUser({ password: parsed.data.password })

        if (error) {
          console.error('[auth] Passwort konnte nicht gespeichert werden', {
            code: error.code,
            message: error.message,
          })
          status = 'password_failed'
        }
      }
    }
  } catch (error) {
    console.error('[auth] Passwortänderung unerwartet abgebrochen', {
      error: error instanceof Error ? error.message : 'unbekannt',
    })
    status = 'password_failed'
  }

  if (status) {
    redirect(`/${lang}/reset-password?status=${status}`)
  }

  // Nach der Änderung bewusst abmelden: Der Nutzer bestätigt sein neues
  // Passwort einmal aktiv und weiß danach sicher, dass es funktioniert.
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
  } catch (error) {
    console.error('[auth] Abmeldung nach Passwortänderung fehlgeschlagen', {
      error: error instanceof Error ? error.message : 'unbekannt',
    })
  }

  revalidatePath('/', 'layout')
  redirect(`/${lang}/login?status=password_updated`)
}
