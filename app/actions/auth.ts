'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { rateLimit } from '@/lib/ratelimit'
import { getClientIp } from '@/lib/client-ip'
import { buildSiteUrl, getOutboundSiteUrl } from '@/lib/site-url'
import { resolveVerifiedPerson } from '@/lib/profile-person'
import {
  emailOnlySchema,
  isBreachedPasswordError,
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

/**
 * Wie viele Versuche pro Zeitfenster erlaubt sind.
 *
 * `account` ist ein ZWEITER, vom Absender unabhängiger Eimer je Zieladresse.
 * Ein kombinierter Schlüssel `ip:email` würde nicht helfen: Ein Angreifer mit
 * 200 Adressen bekäme weiterhin 200 getrennte Eimer gegen dasselbe Postfach.
 * Erst ein reiner Konto-Eimer begrenzt verteiltes Credential-Stuffing.
 */
type RateLimitRule = { limit: number; window: string; account?: { limit: number; window: string } }
const RATE_LIMITS: Record<'login' | 'signup' | 'email', RateLimitRule> = {
  login: { limit: 10, window: '5 m', account: { limit: 12, window: '15 m' } },
  signup: { limit: 5, window: '15 m' },
  email: { limit: 3, window: '15 m', account: { limit: 4, window: '60 m' } },
}

function readLanguage(formData: FormData): string {
  return uiLanguageSchema.parse(formData.get('lang') ?? undefined)
}


/**
 * Kennung für die Ratenbegrenzung.
 */
async function requestIdentifier(scope: keyof typeof RATE_LIMITS): Promise<string> {
  try {
    const ip = await getClientIp()
    return `auth:${scope}:${ip}`
  } catch {
    return `auth:${scope}:unbekannt`
  }
}

/** Gleiche Adresse, andere Schreibweise oder Leerraum: derselbe Eimer. */
function accountIdentifier(scope: keyof typeof RATE_LIMITS, email: string): string {
  return `auth:${scope}:account:${email.trim().toLowerCase()}`
}

/**
 * Begrenzt Absender UND Zielkonto. `rateLimit()` hasht die Kennung vor dem
 * Speichern (lib/ratelimit.ts), die Adresse liegt also nie im Klartext.
 */
async function isRateLimited(scope: keyof typeof RATE_LIMITS, email?: string): Promise<boolean> {
  try {
    const identifier = await requestIdentifier(scope)
    const { limit, window, account } = RATE_LIMITS[scope]
    const [source, target] = await Promise.all([
      rateLimit(identifier, limit, window),
      account && email
        ? rateLimit(accountIdentifier(scope, email), account.limit, account.window)
        : Promise.resolve({ success: true } as const),
    ])
    return !source.success || !target.success
  } catch (error) {
    // SECURITY: Fail-Closed. Wenn der Rate-Limiter (PostgreSQL) ausfällt,
    // dürfen keine Authentifizierungsanfragen (Brute-Force) durchgehen.
    console.error("[auth] Ratenbegrenzung nicht verfügbar, Anfragen werden blockiert")
    return true
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
  // Sprache (`ui_language`, initial aus der Registrierungssprache) umgestellt.
  // Fällt auf die Formularsprache zurück, falls das Profil nicht lesbar ist.
  let targetLang = lang

  try {
    const parsed = loginSchema.safeParse({
      email: formData.get('email'),
      password: formData.get('password'),
    })

    if (!parsed.success) {
      status = 'login_invalid'
    } else if (await isRateLimited('login', parsed.data.email)) {
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
          console.error("[auth] Anmeldung fehlgeschlagen")
        }
      } else if (data.user) {
        try { await resolveVerifiedPerson(data.user) }
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
          console.error("[auth] Oberflächensprache konnte nicht geladen werden")
        }
      }
    }
  } catch (error) {
    console.error("[auth] Anmeldung unerwartet abgebrochen")
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
      display_name: formData.get('display_name'),
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
            display_name: parsed.data.display_name,
            // Wird vom Trigger `provision_profile` in `profiles` übernommen.
            native_language: parsed.data.native_language,
            // Auf der deutschen Seite gilt die Muttersprache als Oberfläche:
            // Deutsch sperrt die Trainer (sie brauchen eine Übersetzungssprache),
            // und wer versehentlich auf `/de` landet, soll nicht mit einer
            // Oberfläche starten, die er nicht versteht.
            ui_language: lang === 'de' ? parsed.data.native_language : lang,
          },
        },
      })

      if (error) {
        console.error("[auth] Registrierung fehlgeschlagen")
        // Supabase legt den Zugang an und versucht erst danach, die
        // Bestätigungsmail zu senden. Scheitert nur der Versand
        // (`unexpected_failure`, z. B. wenn der lokale SMTP-Dienst kurz nicht
        // erreichbar ist), existiert das Konto bereits – ein erneuter Versuch
        // liefe in „user_already_exists" und eine Meldung „E-Mail gesendet",
        // obwohl keine kam. Deshalb ein eigener, handlungsweisender Status, der
        // zum erneuten Anfordern des Links führt, statt in eine Sackgasse.
        status =
          error.code === 'user_already_exists' ? 'signup_email_sent'
          : error.code === 'unexpected_failure' ? 'signup_email_failed'
          // Passwort aus einem bekannten Datenleck: konkret sagen, was zu tun ist.
          : isBreachedPasswordError(error) ? 'signup_password_breached'
          : 'signup_failed'
      } else if (data.user && data.user.identities?.length === 0) {
        // A public signup form must not disclose existing student addresses.
        status = 'signup_email_sent'
      }
    }
  } catch (error) {
    console.error("[auth] Registrierung unerwartet abgebrochen")
    status = 'signup_failed'
  }

  // Das Konto existiert nach „email_sent" und „email_failed" bereits; beide
  // gehören zur Anmeldeseite, wo der Bestätigungslink erneut angefordert wird.
  const target = status === 'signup_email_sent' || status === 'signup_email_failed' ? 'login' : 'register'
  redirect(`/${lang}/${target}?status=${status}`)
}

export async function logout(lang: string = 'de') {
  const safeLang = uiLanguageSchema.parse(lang)

  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
  } catch (error) {
    console.error("[auth] Abmeldung fehlgeschlagen")
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
    } else if (await isRateLimited('email', parsed.data.email)) {
      status = 'reset_rate_limited'
    } else {
      const supabase = await createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
        redirectTo: await authCallbackUrl(lang, `/${lang}/reset-password`),
      })

      if (error) {
        console.error("[auth] Passwort-Reset konnte nicht angefordert werden")
      }
      // Die Meldung bleibt in jedem Fall gleich. Ein Unterschied zwischen
      // „gesendet" und „unbekannte Adresse" würde verraten, welche Adressen
      // registriert sind.
    }
  } catch (error) {
    console.error("[auth] Passwort-Reset unerwartet abgebrochen")
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
    } else if (await isRateLimited('email', parsed.data.email)) {
      status = 'resend_rate_limited'
    } else {
      const supabase = await createClient()
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: parsed.data.email,
        options: { emailRedirectTo: await authCallbackUrl(lang) },
      })

      if (error) {
        console.error("[auth] Bestätigungslink konnte nicht erneut gesendet werden")
      }
      // Auch hier bewusst dieselbe Meldung für jede Adresse.
    }
  } catch (error) {
    console.error("[auth] Erneutes Senden unerwartet abgebrochen")
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
          console.error("[auth] Passwort konnte nicht gespeichert werden")
          status = isBreachedPasswordError(error) ? 'password_breached' : 'password_failed'
        }
      }
    }
  } catch (error) {
    console.error("[auth] Passwortänderung unerwartet abgebrochen")
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
    console.error("[auth] Abmeldung nach Passwortänderung fehlgeschlagen")
  }

  revalidatePath('/', 'layout')
  redirect(`/${lang}/login?status=password_updated`)
}
