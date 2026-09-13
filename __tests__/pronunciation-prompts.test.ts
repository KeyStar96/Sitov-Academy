import { cefrFamilyFromLevel, isCefrFamily } from '@/lib/pronunciation-prompts'

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
