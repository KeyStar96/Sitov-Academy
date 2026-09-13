'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { uiLanguageSchema } from '@/lib/types/auth'
import { BackendError, checkDatabaseError, revalidateBackendPages, withBackendSession } from '@/lib/actions/backend'
import { personalDetailsSchema, profileContactSchema, type ProfileContact, type PersonalDetailsResult } from '@/lib/types/profile'
import type { BackendActionResult } from '@/lib/types/backend'
import { resolveLegacyProfile } from '@/lib/profile-legacy'
import { buildSiteUrl, getOutboundSiteUrl } from '@/lib/site-url'
import { safeUiLanguageNextPath } from '@/lib/locale-routing'

export async function updatePersonalDetails(input: unknown): Promise<BackendActionResult<PersonalDetailsResult>> {
  return withBackendSession(async ({ supabase, userId, user }) => {
    const { email, lang, ...details } = personalDetailsSchema.parse(input)
    if (email !== user.email?.toLowerCase()) await resolveLegacyProfile(user, true)
    const { data, error } = await supabase.from('people').update({display_name:details.name,phone:details.phone,street:details.street,postal_code:details.zip_code,city:details.city}).eq('auth_user_id', userId)
      .select('display_name, email, phone, street, postal_code, city').single()
    checkDatabaseError(error)
    if (!data) throw new BackendError('not_found')
    const result: PersonalDetailsResult = {
      profile: { name:data.display_name,email:data.email,phone:data.phone,street:data.street,zip_code:data.postal_code,city:data.city },
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

export async function updateProfileContact(input: unknown): Promise<BackendActionResult<ProfileContact>> {
  return withBackendSession(async ({ supabase, userId }) => {
    const fields = profileContactSchema.parse(input)
    const { data, error } = await supabase.from('people').update({phone:fields.phone,street:fields.street,postal_code:fields.zip_code,city:fields.city})
      .eq('auth_user_id', userId).select('phone, street, postal_code, city').single()
    checkDatabaseError(error)
    if (!data) throw new BackendError('not_found')
    revalidateBackendPages()
    return {phone:data.phone,street:data.street,zip_code:data.postal_code,city:data.city}
  })
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
        console.error('[profile] Oberflächensprache konnte nicht gespeichert werden', {
          code: error.code,
          message: error.message,
        })
      }
    }
  } catch (error) {
    console.error('[profile] Oberflächensprache: unerwarteter Fehler', {
      error: error instanceof Error ? error.message : 'unbekannt',
    })
  }

  if (!authenticated) {
    redirect(`/${lang}/login`)
  }

  revalidatePath('/', 'layout')
  redirect(safeUiLanguageNextPath(formData.get('next'), lang))
}
