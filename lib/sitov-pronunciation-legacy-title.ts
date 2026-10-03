import sitovLegacyTitles from './sitov-pronunciation-legacy-titles.json'

/** Old recordings keep the title of the exact historical text they contain. */
export function sitovPronunciationConversationTitle(promptId: string | null, readingText: string | null, currentTitle: string | null): string | null {
  const legacy = promptId && sitovLegacyTitles[promptId as keyof typeof sitovLegacyTitles]
  return legacy && readingText === legacy.text ? legacy.title : currentTitle
}
