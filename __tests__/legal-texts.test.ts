/** @jest-environment node */
import fs from 'fs'
import path from 'path'

const LOCALES = ['de', 'en', 'ru', 'uk', 'tr']
const read = (locale: string) =>
  JSON.parse(fs.readFileSync(path.join(process.cwd(), 'dictionaries', `${locale}.json`), 'utf-8'))

describe('Rechtstexte', () => {
  it.each(LOCALES)('%s: kein Verweis auf die seit 20.07.2025 abgeschaltete OS-Plattform', locale => {
    // Verordnung (EU) 2024/3228: Ein Link auf die nicht mehr existierende
    // Plattform gilt als irreführend und ist abmahnfähig.
    expect(JSON.stringify(read(locale))).not.toMatch(/ec\.europa\.eu\/consumers\/odr/)
  })

  it.each(LOCALES)('%s: Hosting bei STRATO, Domain und Postfach bei IONOS', locale => {
    const hosting = read(locale).privacy.sections[1].content.join(' ')
    expect(hosting).toContain('STRATO GmbH, Otto-Ostrowski-Straße 7, 10249 Berlin')
    expect(hosting).toContain('https://www.strato.de/datenschutz/')
    expect(hosting).toContain('IONOS SE')
    expect(hosting).not.toMatch(/DSGVO-konform|GDPR-compliant|GDPR uyumlu/)
  })

  it.each(LOCALES)('%s: Abschnitt 8 ohne Nummernlücke', locale => {
    const numbers = read(locale).privacy.sections[7].content
      .map((line: string) => /^8\.(\d+) /.exec(line)?.[1])
      .filter(Boolean)
      .map(Number)
    expect(numbers).toEqual(numbers.map((_: number, index: number) => index + 1))
  })
})
