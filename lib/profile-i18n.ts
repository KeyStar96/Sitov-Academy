import germanDictionary from '@/dictionaries/de.json'
import { createTranslator, type Translations, type Translator } from '@/lib/i18n-runtime'

export const PROFILE_FALLBACKS = germanDictionary.profile

export type ProfileTranslationKey = Extract<keyof typeof PROFILE_FALLBACKS, string>

export type ProfileTranslations = Translations

export type ProfileTranslator = Translator<ProfileTranslationKey>

export function createProfileTranslator(translations: ProfileTranslations): ProfileTranslator {
  return createTranslator(PROFILE_FALLBACKS, translations)
}

const NATIVE_LANGUAGE_KEYS: Record<string, ProfileTranslationKey> = {
  ru: 'lang_russian',
  tr: 'lang_turkish',
  uk: 'lang_ukrainian',
  en: 'lang_english',
  de: 'lang_german',
}

export function translateNativeLanguage(
  t: ProfileTranslator,
  value: string | null | undefined
): string {
  if (!value) return t('not_specified')
  const key = NATIVE_LANGUAGE_KEYS[value]
  return key ? t(key) : t('not_specified')
}
