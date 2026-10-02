'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { uiLanguageSchema } from '@/lib/types/auth'
import { BackendError, checkDatabaseError, revalidateBackendPages, withBackendSession } from '@/lib/actions/backend'
import { personalDetailsSchema, profileContactSchema, type ProfileContact, type PersonalDetailsResult } from '@/lib/types/profile'
import type { BackendActionResult } from '@/lib/types/backend'
import { resolveVerifiedPerson } from '@/lib/profile-person'
import { buildSiteUrl, getOutboundSiteUrl } from '@/lib/site-url'
import { safeUiLanguageNextPath } from '@/lib/locale-routing'
import { runConfirmedDelete } from '@/lib/confirmed-delete'
import { deleteOwnProfileSchema, type DeleteOwnProfileInput, type ProfileDeletionResult } from '@/lib/types/profile-deletion'

export async function updatePersonalDetails(input: unknown): Promise<BackendActionResult<PersonalDetailsResult>> {
  return withBackendSession(async ({ supabase, userId, user }) => {
    const { email, lang, ...details } = personalDetailsSchema.parse(input)
    if (email !== user.email?.toLowerCase()) await resolveVerifiedPerson(user)
    const { data, error } = await supabase.from('people').update({display_name:details.display_name,phone:details.phone,street:details.street,postal_code:details.postal_code,city:details.city}).eq('auth_user_id', userId)
      .select('display_name, email, phone, street, postal_code, city').single()
    checkDatabaseError(error)
    if (!data) throw new BackendError('not_found')
    const result: PersonalDetailsResult = {
      profile: { display_name:data.display_name,email:data.email,phone:data.phone,street:data.street,postal_code:data.postal_code,city:data.city },
      pendingEmail: user.new_email || null,
      emailChange: user.new_email ? 'pending' : 'unchanged',
    }
    if (email !== user.email?.toLowerCase() && email !== user.new_email?.toLowerCase()) {
      // Separate systems cannot form one transaction. A failed email request
      // must not roll back the UI for contact details already saved successfully.
      try {
        const redirectTo = buildSiteUrl(await getOutboundSiteUrl(), '/auth/callback', {
          lang, next: `/${lang}/dashboard/profile`,
        })
        const updated = await supabase.auth.updateUser({ email }, { emailRedirectTo: redirectTo })
        if (updated.error || !updated.data.user) result.emailChange = 'failed'
        else {
          result.profile.email = updated.data.user.email ?? data.email
          result.pendingEmail = updated.data.user.new_email || null
          result.emailChange = result.profile.email.toLowerCase() === email ? 'updated' : 'pending'
          if (result.emailChange === 'pending') result.pendingEmail = email
        }
      } catch { result.emailChange = 'failed' }
    }
    revalidateBackendPages()
    return result
  })
}

/** Die drei optionalen Mail-Arten und ihre Spalte (Migrationen 41 und 47). */
export type MailPreference = 'pronunciation' | 'new_content' | 'reminders'

/**
 * Schalter für optionale E-Mails im Profil: Antwort der Lehrkraft in der
 * Aussprache, neue Lerninhalte (Niveau freigeschaltet) und Lern-Erinnerungen.
 * Die Person darf nur diese Spalten ihres eigenen Profils ändern (Spaltenrecht
 * und RLS); ob eine Mail entsteht oder versendet wird, prüft die Datenbank.
 * Pflicht-Mails (Konto, Registrierung, Kursanmeldung) haben keinen Schalter.
 */
export async function setMailPreference(preference: MailPreference, enabled: boolean): Promise<{ success: boolean }> {
  if (typeof enabled !== 'boolean' || !['pronunciation', 'new_content', 'reminders'].includes(preference)) return { success: false }
  const update = preference === 'pronunciation' ? { notify_pronunciation_feedback: enabled }
    : preference === 'new_content' ? { notify_new_content: enabled } : { notify_learning_reminders: enabled }
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false }
    const { data, error } = await supabase.from('profiles').update(update).eq('id', user.id)
      .select('notify_pronunciation_feedback,notify_new_content,notify_learning_reminders').single()
    const saved = data && (preference === 'pronunciation' ? data.notify_pronunciation_feedback
      : preference === 'new_content' ? data.notify_new_content : data.notify_learning_reminders)
    if (error || saved !== enabled) { console.error('[profile] Benachrichtigung konnte nicht gespeichert werden'); return { success: false } }
    revalidatePath('/[lang]/dashboard/profile', 'page')
    return { success: true }
  } catch { console.error('[profile] Benachrichtigung: unerwarteter Fehler'); return { success: false } }
}

/** Schalter „E-Mail, wenn meine Lehrkraft in der Aussprache antwortet" (Migration 41). */
export async function setPronunciationMailPreference(enabled: boolean): Promise<{ success: boolean }> {
  return setMailPreference('pronunciation', enabled)
}

export async function updateProfileContact(input: unknown): Promise<BackendActionResult<ProfileContact>> {
  return withBackendSession(async ({ supabase, userId }) => {
    const fields = profileContactSchema.parse(input)
    const { data, error } = await supabase.from('people').update({phone:fields.phone,street:fields.street,postal_code:fields.postal_code,city:fields.city})
      .eq('auth_user_id', userId).select('phone, street, postal_code, city').single()
    checkDatabaseError(error)
    if (!data) throw new BackendError('not_found')
    revalidateBackendPages()
    return {phone:data.phone,street:data.street,postal_code:data.postal_code,city:data.city}
  })
}

/**
 * Löscht das eigene Lernplattform-Profil endgültig: Anmeldekonto, Lernstände,
 * Aufnahmen und Gespräche. Die Person (`people`) mit Adresse, Buchungen und
 * Rechnungen bleibt erhalten – die Akademie braucht sie z. B. für offene
 * Rechnungen. Die Identität kommt aus der Sitzung, nie aus dem Formular.
 *
 * Nur ein Fehlschlag kehrt zum Aufrufer zurück. Nach dem Löschen wird die
 * Sitzung beendet und – wie in `auth.ts` außerhalb von `try` – zur Anmeldung
 * weitergeleitet.
 */
export async function deleteOwnProfile(lang: string, input: DeleteOwnProfileInput): Promise<ProfileDeletionResult> {
  const safeLang = uiLanguageSchema.parse(lang)
  const parsed = deleteOwnProfileSchema.safeParse(input)
  if (!parsed.success) return { success: false, reason: 'invalid_input' }
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return { success: false, reason: 'not_authenticated' }
    const result = await runConfirmedDelete(() => supabase.rpc('delete_own_learning_profile', { p_confirmation: parsed.data.confirmation }))
    if (!result.success) { console.error('[profile] Profil konnte nicht gelöscht werden'); return result }
    // The account no longer exists; this only clears the session cookies.
    try { await supabase.auth.signOut({ scope: 'local' }) }
    catch { console.error('[profile] Abmeldung nach dem Löschen fehlgeschlagen') }
  } catch {
    console.error('[profile] Profil löschen: unerwarteter Fehler')
    return { success: false, reason: 'delete_failed' }
  }
  try { revalidatePath('/', 'layout') }
  catch { console.error('[profile] Routen-Cache nach dem Löschen nicht aktualisiert') }
  redirect(`/${safeLang}/login?status=profile_deleted`)
}

/**
 * Ändert die Oberflächensprache des angemeldeten Nutzers (`profiles.ui_language`)
 * und leitet auf denselben Bildschirm in der neuen Sprache um. Ohne `next`
 * bleibt das Ziel das Profil. Ein gesetztes `next` darf nur Dashboard- oder
 * Admin-Pfade enthalten.
 *
 * Wie in `auth.ts` wird `redirect()` bewusst außerhalb von `try` aufgerufen:
 * Next.js signalisiert die Weiterleitung über eine Ausnahme, die ein
 * umschließendes `catch` sonst verschlucken würde.
 */
export async function updateUiLanguage(formData: FormData): Promise<void> {
  const lang = uiLanguageSchema.parse(formData.get('ui_language') ?? undefined)
  let authenticated = false

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      authenticated = true
      const { error } = await supabase
        .from('profiles')
        .update({ ui_language: lang })
        .eq('id', user.id)

      if (error) {
        console.error("[profile] Oberflächensprache konnte nicht gespeichert werden")
      }
    }
  } catch (error) {
    console.error("[profile] Oberflächensprache: unerwarteter Fehler")
  }

  if (!authenticated) {
    redirect(`/${lang}/login`)
  }

  revalidatePath('/', 'layout')
  redirect(safeUiLanguageNextPath(formData.get('next'), lang))
}
