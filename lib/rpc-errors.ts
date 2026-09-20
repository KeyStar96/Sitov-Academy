/** Database RPC failures are JSONB values even when HTTP/PostgREST succeeded. */
export function getRpcError(value: unknown): { error: string; message: string; sqlstate?: string } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const result = value as Record<string, unknown>
  if (typeof result.error !== 'string' || typeof result.message !== 'string') return null
  return { error: result.error, message: result.message,
    ...(typeof result.sqlstate === 'string' ? { sqlstate: result.sqlstate } : {}) }
}
