import { readAllRows } from '@/lib/supabase-read'
import { SitovServerReadError } from '@/lib/sitov-server-failure'
jest.mock('server-only', () => ({}), { virtual: true })
it('reads complete ordered pages and keeps the 500-row boundary', async () => {
  const page = jest.fn().mockResolvedValueOnce({ data: Array.from({ length: 500 }, (_, id) => ({ id })), error: null })
    .mockResolvedValueOnce({ data: [{ id: 500 }], error: null })
  expect(await readAllRows(page)).toHaveLength(501)
  expect(page.mock.calls).toEqual([[0, 499], [500, 999]])
})
it('never returns a partial catalog and retains only sanitized database provenance', async () => {
  const page = jest.fn().mockResolvedValueOnce({ data: Array(500).fill({ id: 'private' }), error: null })
    .mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'private token', details: 'private SQL' } })
  try { await readAllRows(page, 'verb_catalog'); throw new Error('must reject') }
  catch (error) {
    expect(error).toBeInstanceOf(SitovServerReadError)
    expect(error).toMatchObject({ message: 'Database read failed', source: 'verb_catalog', failure: 'postgrest:PGRST202' })
    expect(error).not.toHaveProperty('cause')
    expect(JSON.stringify(error)).not.toContain('private')
  }
})
it('carries transport provenance without retaining a raw cause', async () => {
  const page = jest.fn().mockRejectedValue(Object.assign(new TypeError('private URL'), { cause: { code: 'ETIMEDOUT', hostname: 'private' } }))
  await expect(readAllRows(page, 'verb_progress')).rejects.toMatchObject({ source: 'verb_progress', failure: 'network:ETIMEDOUT', message: 'Database read failed' })
})
it('rejects a hostile database code without placing it in the thrown message', async () => {
  await expect(readAllRows(async () => ({ data: null, error: { code: 'secret-token\n42501', message: 'private' } })))
    .rejects.toMatchObject({ source: 'read', failure: 'unknown', message: 'Database read failed' })
})
