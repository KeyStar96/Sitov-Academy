import 'server-only'
import { SitovServerReadError, type SitovReadSource } from '@/lib/sitov-server-failure'

/** A stable ORDER BY is required from callers. Never silently truncate a catalog or progress list at PostgREST's row limit. */
export async function readAllRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { code?: string; message?: string } | null }>, source: SitovReadSource = 'read'): Promise<T[]> {
  const rows: T[] = []
  for (let offset = 0; ; offset += 500) {
    let result: Awaited<ReturnType<typeof page>>
    try { result = await page(offset, offset + 499) }
    catch (error) { throw new SitovServerReadError(error, source) }
    const { data, error } = result
    if (error) throw new SitovServerReadError(error, source)
    rows.push(...(data ?? []))
    if (!data || data.length < 500) return rows
  }
}
