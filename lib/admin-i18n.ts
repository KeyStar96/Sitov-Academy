import germanDictionary from '@/dictionaries/de.json'
import { createTranslator, type Translations, type Translator } from '@/lib/i18n-runtime'

export const ADMIN_FALLBACKS = germanDictionary.admin

export type AdminTranslationKey = Extract<keyof typeof ADMIN_FALLBACKS, string>

export type AdminTranslations = Translations

export type AdminTranslator = Translator<AdminTranslationKey>

export function createAdminTranslator(translations: AdminTranslations): AdminTranslator {
  return createTranslator(ADMIN_FALLBACKS, translations)
}
