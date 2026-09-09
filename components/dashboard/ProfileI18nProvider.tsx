'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { PROFILE_FALLBACKS, createProfileTranslator, type ProfileTranslations } from '@/lib/profile-i18n'
const ProfileI18nContext = createContext<ProfileTranslations>(PROFILE_FALLBACKS)
export function ProfileI18nProvider({ translations, children }: { translations: ProfileTranslations; children: ReactNode }) {
  return <ProfileI18nContext.Provider value={translations}>{children}</ProfileI18nContext.Provider>
}
export function useProfileTranslator() { return createProfileTranslator(useContext(ProfileI18nContext)) }
