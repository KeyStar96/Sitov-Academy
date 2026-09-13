import {
  decideAuthCallback,
  parseOtpType,
  readAuthCallbackSearch,
} from '@/lib/auth-callback'
import { safeInternalPath } from '@/lib/types/auth'

it.each(['/\n/attacker.example', '/\t/attacker.example', '/\\attacker.example', '//attacker.example'])('rejects URL parser redirect bypass %j', next => {
  expect(safeInternalPath(next, '/de/dashboard')).toBe('/de/dashboard')
})

describe('parseOtpType', () => {
  it('erkennt gültige GoTrue-Typen', () => {
    expect(parseOtpType('signup')).toBe('signup')
    expect(parseOtpType('recovery')).toBe('recovery')
    expect(parseOtpType('email')).toBe('email')
  })

  it('verwirft unbekannte Werte', () => {
    expect(parseOtpType('unbekannt')).toBeNull()
    expect(parseOtpType(null)).toBeNull()
  })
})

describe('readAuthCallbackSearch', () => {
  it('liest PKCE- und OTP-Parameter', () => {
    const search = readAuthCallbackSearch(
      new URLSearchParams(
        'code=pkce-code&token_hash=hash&type=signup&lang=de&next=/de/dashboard'
      )
    )

    expect(search).toEqual({
      code: 'pkce-code',
      token_hash: 'hash',
      token: null,
      type: 'signup',
      next: '/de/dashboard',
      lang: 'de',
      error: null,
    })
  })

  it('behandelt leere Werte wie fehlende', () => {
    const search = readAuthCallbackSearch(new URLSearchParams('code=&token_hash=  '))
    expect(search.code).toBeNull()
    expect(search.token_hash).toBeNull()
  })
})

describe('decideAuthCallback', () => {
  it('bevorzugt OTP/Token-Hash vor PKCE, damit der Link auf einem anderen Gerät greift', () => {
    const decision = decideAuthCallback({
      code: 'pkce-code',
      token_hash: 'hash',
      token: null,
      type: 'signup',
      next: null,
      lang: 'de',
      error: null,
    })

    expect(decision).toMatchObject({
      kind: 'accept',
      nextPath: '/de/dashboard',
      isRecovery: false,
      verify: { flow: 'otp', tokenHash: 'hash', type: 'signup' },
    })
  })

  it('tauscht einen PKCE-Code gegen eine Sitzung und leitet ins Dashboard', () => {
    const decision = decideAuthCallback({
      code: 'pkce-code',
      token_hash: null,
      token: null,
      type: null,
      next: null,
      lang: 'uk',
      error: null,
    })

    expect(decision).toMatchObject({
      kind: 'accept',
      lang: 'uk',
      nextPath: '/uk/dashboard',
      verify: { flow: 'pkce', code: 'pkce-code' },
    })
  })

  it('nimmt token als Token-Hash, wenn token_hash fehlt (ältere Vorlagen)', () => {
    const decision = decideAuthCallback({
      code: null,
      token_hash: null,
      token: 'legacy-token',
      type: 'email',
      next: null,
      lang: 'tr',
      error: null,
    })

    expect(decision).toMatchObject({
      kind: 'accept',
      nextPath: '/tr/dashboard',
      verify: { flow: 'otp', tokenHash: 'legacy-token', type: 'email' },
    })
  })

  it('leitet Recovery-OTP auf die Passwortvergabe', () => {
    const decision = decideAuthCallback({
      code: null,
      token_hash: 'hash',
      token: null,
      type: 'recovery',
      next: null,
      lang: 'de',
      error: null,
    })

    expect(decision).toMatchObject({
      kind: 'accept',
      isRecovery: true,
      nextPath: '/de/reset-password',
      verify: { flow: 'otp', type: 'recovery' },
    })
  })

  it('erkennt Recovery auch am next-Pfad, wenn type bei PKCE fehlt', () => {
    const decision = decideAuthCallback({
      code: 'pkce-code',
      token_hash: null,
      token: null,
      type: null,
      next: '/de/reset-password',
      lang: 'de',
      error: null,
    })

    expect(decision).toMatchObject({
      kind: 'accept',
      isRecovery: true,
      nextPath: '/de/reset-password',
      verify: { flow: 'pkce', code: 'pkce-code' },
    })
  })

  it('blockiert offene Weiterleitungen über next', () => {
    const decision = decideAuthCallback({
      code: 'pkce-code',
      token_hash: null,
      token: null,
      type: 'signup',
      next: 'https://fremde-seite.example',
      lang: 'de',
      error: null,
    })

    expect(decision.kind).toBe('accept')
    if (decision.kind === 'accept') {
      expect(decision.nextPath).toBe('/de/dashboard')
    }
  })

  it('weist Aufrufe ohne Token ab', () => {
    expect(
      decideAuthCallback({
        code: null,
        token_hash: null,
        token: null,
        type: null,
        next: null,
        lang: 'en',
        error: null,
      })
    ).toMatchObject({
      kind: 'reject',
      redirectPath: '/en/login',
      status: 'confirm_missing_params',
    })
  })

  it('weist vom Anbieter abgebrochene Vorgänge ab', () => {
    expect(
      decideAuthCallback({
        code: null,
        token_hash: 'hash',
        token: null,
        type: 'signup',
        next: null,
        lang: 'de',
        error: 'access_denied',
      })
    ).toMatchObject({
      kind: 'reject',
      redirectPath: '/de/login',
      status: 'confirm_failed',
    })
  })

  it('fällt bei unbekannter Sprache auf Deutsch zurück', () => {
    const decision = decideAuthCallback({
      code: 'pkce-code',
      token_hash: null,
      token: null,
      type: null,
      next: null,
      lang: 'xx',
      error: null,
    })

    expect(decision.kind).toBe('accept')
    if (decision.kind === 'accept') {
      expect(decision.lang).toBe('de')
      expect(decision.nextPath).toBe('/de/dashboard')
    }
  })
})
