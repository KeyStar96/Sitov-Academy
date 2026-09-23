/**
 * Fotos der Lehrkräfte für Briefkasten und Sprachnachrichten.
 *
 * Es gibt (noch) keine Profilbilder in der Datenbank; das Porträt von der
 * Startseite der Akademie wird über den Anzeigenamen zugeordnet. Wer keinen
 * Eintrag hat, bekommt Initialen — nie ein fremdes Gesicht.
 */
const PORTRAITS: readonly { match: RegExp; src: string }[] = [
  { match: /^(anastasia|nastja|nastya)\b/i, src: '/Bilder/Nastja.png' },
]

export function teacherPortrait(name: string | null | undefined): string | null {
  const trimmed = name?.trim()
  if (!trimmed) return null
  return PORTRAITS.find(entry => entry.match.test(trimmed))?.src ?? null
}

/** Vorname für die persönliche Ansprache („Post von Anastasia"). */
export function teacherFirstName(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0]
  return first || null
}

export function teacherInitials(name: string | null | undefined): string {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? []
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0]?.slice(0, 2) ?? '').toUpperCase()
}
