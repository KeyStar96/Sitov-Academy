export const SITOV_LEARNING_SOURCE_LOCALES = ['en', 'ru', 'uk', 'tr'] as const
export type SitovLearningSourceLocale = typeof SITOV_LEARNING_SOURCE_LOCALES[number]

/** Interface language controls labels; this selects the actual translation input. */
export function sitovLearningSourceLocale(uiLanguage: string | null | undefined, nativeLanguage: string | null | undefined): SitovLearningSourceLocale | null {
  const candidate = uiLanguage === 'de' ? nativeLanguage : uiLanguage
  return SITOV_LEARNING_SOURCE_LOCALES.find(locale => locale === candidate) ?? null
}
