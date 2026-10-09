import 'server-only'

const sitovNetworkCodes = new Set(['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_SOCKET'])
const sitovErrorClasses = new Set(['Error', 'TypeError', 'RangeError', 'SyntaxError', 'URIError', 'AbortError', 'TimeoutError', 'ZodError'])

function sitovCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (sitovNetworkCodes.has(value)) return `network:${value}`
  if (value.length === 8 && /^PGRST[0-9]{3}$/u.test(value)) return `postgrest:${value}`
  if (value.length === 5 && /^(?:[0-9]{2}|0[A-Z]|2[A-Z]|3[A-Z]|F0|HV|P0|XX)[0-9A-Z]{3}$/u.test(value)) return `sqlstate:${value}`
  return null
}

/** Bounded discriminators only. Never inspect/serialize messages, details, URLs or stacks. */
export function sitovServerFailure(error: unknown): string {
  try {
    if (!error || typeof error !== 'object') return 'unknown'
    const row = error as { code?: unknown; sqlstate?: unknown; cause?: unknown; name?: unknown }
    const code = sitovCode(row.code) ?? sitovCode(row.sqlstate)
    if (code) return code
    if (row.cause && typeof row.cause === 'object') {
      const causeCode = (row.cause as { code?: unknown }).code
      if (typeof causeCode === 'string' && sitovNetworkCodes.has(causeCode)) return `network:${causeCode}`
    }
    return typeof row.name === 'string' && sitovErrorClasses.has(row.name) ? `class:${row.name}` : 'unknown'
  } catch { return 'unknown' }
}

export type SitovReadSource = 'read' | 'verb_catalog' | 'verb_box' | 'verb_progress'
/** Carry only sanitized provenance through the shared read boundary; no raw cause retained. */
export class SitovServerReadError extends Error {
  readonly failure: string
  readonly source: SitovReadSource
  constructor(error: unknown, source: SitovReadSource = 'read') {
    super('Database read failed')
    this.name = 'SitovServerReadError'
    this.failure = sitovServerFailure(error)
    this.source = ['verb_catalog', 'verb_box', 'verb_progress'].includes(source) ? source : 'read'
  }
}
