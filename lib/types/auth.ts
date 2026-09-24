import { z } from 'zod'

/**
 * Typen und Validierung für die Anmeldung, Registrierung und Passwortverwaltung.
 *
 * Statusmeldungen werden als kurze Kennung über die URL geführt (`?status=...`)
 * und erst in der Oberfläche übersetzt. Vorher stand der deutsche Fließtext in
 * der URL – der ließ sich nicht übersetzen, und die Seite hat am Wort
 * „erfolgreich" geraten, ob eine Meldung positiv war.
 */

export const AUTH_STATUS_CODES = [
  'signup_email_sent',
  'signup_email_exists',
  'signup_invalid',
  'signup_failed',
  'signup_email_failed',
  'signup_rate_limited',
  'signup_password_breached',
  'confirm_success',
  'confirm_failed',
  'confirm_missing_params',
  'login_invalid',
  'login_failed',
  'login_unconfirmed',
  'login_rate_limited',
  'logout_success',
  'reset_email_sent',
  'reset_invalid',
  'reset_rate_limited',
  'password_updated',
  'password_invalid',
  'password_failed',
  'password_session_missing',
  'password_breached',
  'resend_email_sent',
  'resend_invalid',
  'resend_rate_limited',
] as const

export type AuthStatusCode = (typeof AUTH_STATUS_CODES)[number]

/** Meldungen, die eine erfolgreiche Aktion bestätigen. */
const POSITIVE_STATUS_CODES: ReadonlySet<AuthStatusCode> = new Set<AuthStatusCode>([
  'signup_email_sent',
  'confirm_success',
  'logout_success',
  'reset_email_sent',
  'password_updated',
  'resend_email_sent',
])

export function isAuthStatusCode(value: unknown): value is AuthStatusCode {
  return typeof value === 'string' && (AUTH_STATUS_CODES as readonly string[]).includes(value)
}

/** Wandelt einen beliebigen Query-Wert in einen bekannten Statuscode oder `null`. */
export function parseAuthStatus(value: string | string[] | undefined): AuthStatusCode | null {
  const candidate = Array.isArray(value) ? value[0] : value
  return isAuthStatusCode(candidate) ? candidate : null
}

export type AuthStatusTone = 'success' | 'error'

export function toneForAuthStatus(status: AuthStatusCode): AuthStatusTone {
  return POSITIVE_STATUS_CODES.has(status) ? 'success' : 'error'
}

/**
 * Supabase Auth lehnt Passwörter aus bekannten Datenlecks ab (HaveIBeenPwned,
 * `GOTRUE_PASSWORD_HIBP_ENABLED`): `weak_password` mit dem Grund `pwned`.
 * Andere `weak_password`-Gründe bleiben beim allgemeinen Fehler.
 */
export function isBreachedPasswordError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { code, reasons } = error as { code?: unknown; reasons?: unknown }
  return code === 'weak_password' && Array.isArray(reasons) && reasons.includes('pwned')
}

/**
 * Mindestlänge für Passwörter. Bewusst über dem Supabase-Standard von sechs
 * Zeichen; die Prüfung greift nur bei Neuvergabe, bestehende Zugänge bleiben
 * gültig.
 */
export const PASSWORD_MIN_LENGTH = 8

/** ISO language codes; translated labels belong to the UI. */
export const NATIVE_LANGUAGES = ['ru', 'tr', 'uk', 'en', 'de'] as const
export type NativeLanguage = (typeof NATIVE_LANGUAGES)[number]

const emailField = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .email()
  .transform(value => value.toLowerCase())

const passwordField = z.string().min(PASSWORD_MIN_LENGTH).max(72)

/** Sprachkürzel der Oberfläche. Fällt bei Unbekanntem auf Deutsch zurück. */
export const uiLanguageSchema = z
  .enum(['de', 'en', 'uk', 'ru', 'tr'])
  .catch('de')

export const loginSchema = z.object({
  email: emailField,
  // Beim Anmelden wird die Länge nicht geprüft: Bestehende Zugänge können
  // kürzere Passwörter haben, und eine Längenmeldung würde verraten, dass die
  // Adresse existiert.
  password: z.string().min(1).max(72),
})

export const signupSchema = z.object({
  display_name: z.string().trim().min(2).max(80),
  email: emailField,
  password: passwordField,
  native_language: z.enum(NATIVE_LANGUAGES),
})

export const emailOnlySchema = z.object({
  email: emailField,
})

export const updatePasswordSchema = z.object({
  password: passwordField,
})

export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>
export type EmailOnlyInput = z.infer<typeof emailOnlySchema>
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>

/**
 * Prüft einen Ziel-Pfad aus der URL, bevor weitergeleitet wird.
 *
 * Erlaubt sind nur anwendungsinterne Pfade. Ohne diese Prüfung könnte ein
 * manipulierter Bestätigungslink (`?next=https://fremde-seite`) den Nutzer nach
 * dem Anmelden auf eine fremde Seite schicken.
 */
export function safeInternalPath(value: string | null, fallback: string): string {
  if (!value) return fallback
  if (!value.startsWith('/')) return fallback
  // `//host` und `/\host` werden vom Browser als absolute Adresse gelesen.
  if (value.startsWith('//') || /[\u0000-\u001f\u007f\\]/.test(value)) return fallback
  return value
}
