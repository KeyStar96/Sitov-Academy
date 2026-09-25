import { createTranslator, type Translations, type Translator } from '@/lib/i18n-runtime'
import { PASSWORD_MIN_LENGTH, type AuthStatusCode } from '@/lib/types/auth'

/**
 * Texte für Anmeldung, Registrierung und Passwortverwaltung.
 *
 * Die Fallbacks hier sind das Sicherheitsnetz für fehlende Dictionary-Keys.
 * Gepflegt werden die Texte in `dictionaries/*.json` unter `auth`.
 *
 * Ton: kurze Sätze, direkte Anrede, keine Fachbegriffe. Die Zielgruppe ist im
 * besten Alter und liest die Meldungen unter Zeitdruck am Handy.
 */
export const AUTH_FALLBACKS = {
  // --- Anmeldung ---
  login_title: 'Willkommen zurück',
  login_subtitle: 'Noch kein Konto?',
  login_register_link: 'Jetzt kostenlos registrieren',
  login_submit: 'Anmelden',
  login_pending: 'Anmeldung läuft …',
  login_forgot_password: 'Passwort vergessen?',

  // --- Registrierung ---
  register_title: 'Konto erstellen',
  register_subtitle: 'Du hast schon ein Konto?',
  register_login_link: 'Hier anmelden',
  register_submit: 'Konto erstellen',
  register_pending: 'Konto wird erstellt …',

  // --- Formularfelder ---
  field_name: 'Vor- und Nachname',
  field_name_placeholder: 'z. B. Anna Müller',
  field_email: 'E-Mail-Adresse',
  field_email_placeholder: 'z. B. anna.mueller@web.de',
  field_password: 'Passwort',
  field_password_placeholder: 'Dein Passwort',
  field_password_new: 'Neues Passwort',
  field_password_hint: 'Mindestens {min} Zeichen.',
  field_native_language: 'Deine Erstsprache',
  field_native_language_placeholder: 'Bitte auswählen',
  native_language_russian: 'Russisch',
  native_language_turkish: 'Türkisch',
  native_language_ukrainian: 'Ukrainisch',
  native_language_english: 'Englisch',
  native_language_german: 'Deutsch',
  native_language_other: 'Andere',

  // --- Passwort vergessen ---
  forgot_title: 'Passwort vergessen?',
  forgot_description:
    'Gib deine E-Mail-Adresse ein. Wir senden dir einen Link, mit dem du ein neues Passwort festlegen kannst.',
  forgot_submit: 'Link zum Zurücksetzen senden',
  forgot_pending: 'E-Mail wird gesendet …',
  forgot_back_to_login: 'Zurück zur Anmeldung',

  // --- Neues Passwort setzen ---
  reset_title: 'Neues Passwort festlegen',
  reset_description: 'Bitte gib jetzt dein neues Passwort ein.',
  reset_submit: 'Passwort speichern',
  reset_pending: 'Passwort wird gespeichert …',

  // --- Bestätigungs-E-Mail erneut senden ---
  resend_title: 'Keine E-Mail erhalten?',
  resend_description:
    'Wir senden dir gern einen neuen Bestätigungslink. Gib dazu einfach deine E-Mail-Adresse ein.',
  resend_submit: 'Neuen Bestätigungslink senden',
  resend_pending: 'Link wird gesendet …',

  // --- Statusmeldungen ---
  signup_thanks: "Vielen Dank für deine Anmeldung!",
  status_signup_email_sent:
    'Der Admin prüft kurz deine Daten und schaltet dir danach die Funktionen frei. Bitte prüfe dein Postfach. Falls eine Bestätigung erforderlich ist, erhältst du einen Link. Hast du bereits ein Konto, melde dich an oder nutze „Passwort vergessen“.',
  status_signup_email_exists:
    'Für diese E-Mail-Adresse gibt es schon ein Konto. Bitte melde dich an oder setze dein Passwort zurück.',
  status_signup_invalid:
    'Bitte prüfe deine Eingaben. Das Passwort braucht mindestens {min} Zeichen.',
  status_signup_failed:
    'Die Registrierung hat leider nicht funktioniert. Bitte versuche es in ein paar Minuten noch einmal.',
  status_signup_email_failed:
    'Dein Konto ist angelegt, aber die Bestätigungs-E-Mail konnte gerade nicht gesendet werden. Bitte fordere unten einen neuen Bestätigungslink an.',
  status_signup_rate_limited:
    'Es gab zu viele Versuche in kurzer Zeit. Bitte warte einen Moment und versuche es dann erneut.',
  status_confirm_success:
    'Deine E-Mail-Adresse ist bestätigt und du bist angemeldet. Der Admin prüft kurz deine Daten und schaltet dir danach die Funktionen frei.',
  status_confirm_failed:
    'Dieser Bestätigungslink ist abgelaufen oder wurde bereits verwendet. Du kannst unten einen neuen Link anfordern.',
  status_confirm_missing_params:
    'Der Link war nicht vollständig. Bitte fordere unten einen neuen Bestätigungslink an.',
  status_login_invalid: 'Bitte gib deine E-Mail-Adresse und dein Passwort ein.',
  status_login_failed:
    'E-Mail-Adresse oder Passwort stimmt nicht. Bitte versuche es noch einmal.',
  status_login_unconfirmed:
    'Deine E-Mail-Adresse ist noch nicht bestätigt. Bitte öffne unsere E-Mail oder fordere unten einen neuen Link an.',
  status_login_rate_limited:
    'Es gab zu viele Anmeldeversuche. Bitte warte eine Minute und versuche es dann erneut.',
  status_logout_success: 'Du bist abgemeldet. Bis bald!',
  status_reset_email_sent:
    'Wenn es ein Konto mit dieser Adresse gibt, ist die E-Mail zum Zurücksetzen jetzt unterwegs.',
  status_reset_invalid: 'Bitte gib eine gültige E-Mail-Adresse ein.',
  status_reset_rate_limited:
    'Es wurden zu viele E-Mails angefordert. Bitte warte einen Moment.',
  status_password_updated: 'Dein neues Passwort ist gespeichert. Du kannst dich jetzt anmelden.',
  status_password_invalid: 'Das Passwort braucht mindestens {min} Zeichen.',
  status_signup_password_breached:
    'Dieses Passwort ist aus bekannten Datenlecks bekannt und deshalb nicht sicher. Bitte wähle ein anderes Passwort.',
  status_password_breached:
    'Dieses Passwort ist aus bekannten Datenlecks bekannt und deshalb nicht sicher. Bitte wähle ein anderes Passwort.',
  status_password_failed:
    'Das Passwort konnte nicht gespeichert werden. Bitte versuche es noch einmal.',
  status_password_session_missing:
    'Der Link zum Zurücksetzen ist abgelaufen. Bitte fordere unten einen neuen Link an.',
  status_resend_email_sent:
    'Wir haben dir einen neuen Bestätigungslink geschickt. Bitte schau in dein E-Mail-Postfach.',
  status_resend_invalid: 'Bitte gib eine gültige E-Mail-Adresse ein.',
  status_resend_rate_limited:
    'Es wurden zu viele E-Mails angefordert. Bitte warte einen Moment.',

  // --- Hinweise und Fehlerseiten ---
  spam_hint:
    'Die E-Mail kommt meist innerhalb einer Minute. Schau bitte auch im Ordner „Spam" oder „Werbung" nach.',
  error_title: 'Diese Seite konnte nicht geladen werden',
  error_description:
    'Da ist etwas schiefgegangen. Bitte versuche es noch einmal – deine Daten sind sicher.',
  error_retry: 'Erneut versuchen',
  loading: 'Wird geladen …',
} as const

export type AuthTranslationKey = keyof typeof AUTH_FALLBACKS

export function createAuthTranslator(translations: Translations): Translator<AuthTranslationKey> {
  return createTranslator(AUTH_FALLBACKS, translations)
}

/**
 * Übersetzt einen Statuscode und füllt dabei die Mindestlänge des Passworts.
 *
 * So steht die Zahl nur an einer Stelle im Code (`PASSWORD_MIN_LENGTH`) und
 * nicht in fünf Dictionaries.
 */
export function authStatusMessage(
  t: Translator<AuthTranslationKey>,
  status: AuthStatusCode
): string {
  return t(`status_${status}`, { min: PASSWORD_MIN_LENGTH })
}

/** Hinweis unter dem Passwortfeld, mit eingesetzter Mindestlänge. */
export function passwordHint(t: Translator<AuthTranslationKey>): string {
  return t('field_password_hint', { min: PASSWORD_MIN_LENGTH })
}

/** Liest die `auth`-Sektion aus einem Dictionary, ohne bei fehlender Sektion zu brechen. */
export function authTranslations(dictionary: unknown): Translations {
  if (typeof dictionary !== 'object' || dictionary === null) return {}
  const section = (dictionary as Record<string, unknown>).auth
  if (typeof section !== 'object' || section === null) return {}

  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(section as Record<string, unknown>)) {
    if (typeof value === 'string') result[key] = value
  }
  return result
}
