/** Shared by secure scoring and visual feedback; contains no solutions or server dependencies. */
export function normalizeSimulationFormAnswer(value: string, fieldIdOrLabel = ''): string {
  const normalized = value.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE')
  const field = fieldIdOrLabel.toLocaleLowerCase('de-DE')
  if (field === 'sitov-time' || field.includes('uhrzeit')) {
    const time = normalized.replace(/uhr/g, '').replace(/\s+/g, '').match(/^(\d{1,2})(?:[:.](\d{2}))?$/)
    if (time && Number(time[1]) <= 23 && Number(time[2] ?? '00') <= 59) return `${Number(time[1])}:${time[2] ?? '00'}`
  }
  return normalized
}
