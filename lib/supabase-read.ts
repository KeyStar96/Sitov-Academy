import 'server-only'

/** A stable ORDER BY is required from callers. Never silently truncate a catalog or progress list at PostgREST's row limit. */
export async function readAllRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { code?: string; message?: string } | null }>): Promise<T[]> {
  const rows: T[] = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await page(offset, offset + 499)
    if (error) throw new Error(`Database read failed: ${error.code ?? 'unavailable'}`)
    rows.push(...(data ?? []))
    if (!data || data.length < 500) return rows
  }
}
