import { ACCESS_LEVELS } from '@/lib/access/levels'
import { getCatalogPrompts, mergePronunciationPrompts } from '@/lib/pronunciation-catalog'
import { CEFR_FAMILIES, cefrFamilyFromLevel, isCefrFamily } from '@/lib/pronunciation-prompts'

describe('cefrFamilyFromLevel', () => {
  it('mappt feingranulare Routen-Niveaus auf die CEFR-Familie', () => {
    expect(cefrFamilyFromLevel('A1.1')).toBe('A1')
    expect(cefrFamilyFromLevel('A1.2')).toBe('A1')
    expect(cefrFamilyFromLevel('A2.1')).toBe('A2')
    expect(cefrFamilyFromLevel('B1.2')).toBe('B1')
  })

  it('akzeptiert grobe CEFR-Stufen unverändert', () => {
    expect(cefrFamilyFromLevel('B2')).toBe('B2')
    expect(cefrFamilyFromLevel('c1')).toBe('C1')
    expect(cefrFamilyFromLevel('C2')).toBe('C2')
  })

  it('gibt bei unbekannten Werten null zurück', () => {
    expect(cefrFamilyFromLevel('')).toBeNull()
    expect(cefrFamilyFromLevel('D1')).toBeNull()
    expect(cefrFamilyFromLevel('foo')).toBeNull()
  })
})

describe('isCefrFamily', () => {
  it('erkennt nur A1–C2', () => {
    expect(isCefrFamily('A1')).toBe(true)
    expect(isCefrFamily('C2')).toBe(true)
    expect(isCefrFamily('A1.1')).toBe(false)
    expect(isCefrFamily('X')).toBe(false)
  })
})

describe('getCatalogPrompts', () => {
  it('liefert für jedes Dashboard-Niveau mindestens acht eigene Sätze', () => {
    for (const level of ACCESS_LEVELS) {
      const prompts = getCatalogPrompts(level)
      expect(prompts.length).toBeGreaterThanOrEqual(8)
      expect(new Set(prompts.map((prompt) => prompt.sentenceDe)).size).toBe(prompts.length)
    }
  })

  it('unterscheidet A1.1 von A1.2', () => {
    const beginner = getCatalogPrompts('A1.1').map((prompt) => prompt.sentenceDe)
    const advanced = getCatalogPrompts('A1.2').map((prompt) => prompt.sentenceDe)
    expect(beginner).not.toEqual(advanced)
    expect(beginner[0]).toContain('Guten Tag')
  })

  it('deckt alle CEFR-Familien A1–C2 ab', () => {
    for (const family of CEFR_FAMILIES) {
      expect(getCatalogPrompts(family).length).toBeGreaterThanOrEqual(8)
    }
  })
})

describe('mergePronunciationPrompts', () => {
  it('übernimmt Audio-URLs aus der Datenbank bei gleichem Satz', () => {
    const catalog = getCatalogPrompts('A1.1')
    const first = catalog[0]
    if (!first) throw new Error('Katalog A1.1 darf nicht leer sein.')

    const merged = mergePronunciationPrompts(catalog, [
      {
        ...first,
        id: 'db-1',
        audioUrl: 'https://example.com/anna.mp3',
      },
    ])

    const updated = merged.find((prompt) => prompt.sentenceDe === first.sentenceDe)
    expect(updated?.id).toBe('db-1')
    expect(updated?.audioUrl).toBe('https://example.com/anna.mp3')
  })

  it('hängt zusätzliche Datenbanksätze an', () => {
    const catalog = getCatalogPrompts('B2')
    const extra = {
      id: 'db-extra',
      cefrLevel: 'B2' as const,
      sentenceDe: 'Das ist ein zusätzlicher Lehrersatz.',
      focus: 'z',
      audioUrl: null,
      sortOrder: 99, lesson: 'Lektion 1',
    }
    const merged = mergePronunciationPrompts(catalog, [extra])
    expect(merged.some((prompt) => prompt.id === 'db-extra')).toBe(true)
    expect(merged.length).toBe(catalog.length + 1)
  })
})
