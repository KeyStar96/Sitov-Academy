/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/utils/supabase/admin', () => ({ createAdminClient: jest.fn() }))

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { currentUserHasContentAccess } from '@/lib/access/server'
import type { SitovContentRef } from '@/lib/access/sitov-commercial'

const storedUnit = '01da78e3-726f-a505-a9d6-fbb907ccb31f'
const normalUnit = '00000000-0000-4000-8000-000000000011'
const ref: SitovContentRef = { kind: 'verb', id: 'sitov-verb-sein' }

function setup({ unitId = storedUnit, signedIn = true, authError = false,
  metadata = true, parent = true, catalogError = false,
  items = [ref] as SitovContentRef[], presentation = false,
}: { unitId?: unknown; signedIn?: boolean; authError?: boolean; metadata?: boolean;
  parent?: boolean; catalogError?: boolean; items?: SitovContentRef[]; presentation?: boolean } = {}) {
  const query = (data: unknown) => ({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data, error: null }) })
  const contentQuery = query(metadata ? { unit_id: unitId } : null)
  const unitQuery = query(parent ? { level: 'A1.1', trainer: 'verbs' } : null)
  const presentationQuery = query(presentation ? { folder: { level: 'A1.2' } } : null)
  const admin = { from: jest.fn((table: string) => table === 'learning_units' ? unitQuery
    : table === 'lms_presentation_asset' ? presentationQuery : contentQuery) }
  const client = { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: signedIn ? { id: 'sitov-actor' } : null }, error: authError ? { message: 'denied' } : null }) },
    rpc: jest.fn().mockResolvedValue({ data: { units: [{ items }] }, error: catalogError ? { message: 'denied' } : null }) }
  jest.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>)
  jest.mocked(createAdminClient).mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>)
  return { client, admin, contentQuery, unitQuery, presentationQuery }
}

beforeEach(() => jest.clearAllMocks())

it.each([storedUnit, normalUnit, '01da78e3-726f-a505-19d6-fbb907ccb31f'])('authorizes a canonical stored unit %s only through the current exact item catalog', async unitId => {
  const { client, admin, contentQuery, unitQuery } = setup({ unitId })
  expect(await currentUserHasContentAccess(ref)).toBe(true)
  expect(client.auth.getUser).toHaveBeenCalledTimes(1)
  expect(admin.from.mock.calls.map(([table]) => table)).toEqual(['sitov_verb_catalog', 'learning_units'])
  expect(contentQuery.select).toHaveBeenCalledWith('unit_id')
  expect(contentQuery.eq).toHaveBeenCalledWith('id', ref.id)
  expect(unitQuery.select).toHaveBeenCalledWith('level,trainer')
  expect(unitQuery.eq).toHaveBeenCalledWith('id', unitId)
  expect(client.rpc).toHaveBeenCalledWith('get_sitov_access_catalog', { p_level: 'A1.1', p_trainer: 'verbs' })
})

it('rechecks a revocation after a prior successful lookup and denies siblings and other kinds', async () => {
  const { client } = setup()
  expect(await currentUserHasContentAccess(ref)).toBe(true)
  for (const items of [[], [{ ...ref, id: 'sitov-verb-haben' }], [{ ...ref, kind: 'exercise' as const }]]) {
    client.rpc.mockResolvedValueOnce({ data: { units: [{ items }] }, error: null })
    expect(await currentUserHasContentAccess(ref)).toBe(false)
  }
  expect(client.auth.getUser).toHaveBeenCalledTimes(4)
  expect(client.rpc).toHaveBeenCalledTimes(4)
})

it.each(['bad-string', '01da78e3726fa505a9d6fbb907ccb31f', '01da78e3-726f-a505-a9d6-fbb907ccb31g', '', null, 1])('denies malformed canonical metadata %p before requesting the access catalog', async unitId => {
  const { client, admin } = setup({ unitId })
  expect(await currentUserHasContentAccess(ref)).toBe(false)
  expect(admin.from).not.toHaveBeenCalledWith('learning_units')
  expect(client.rpc).not.toHaveBeenCalled()
})

it.each([{ metadata: false }, { parent: false }, { catalogError: true }])('denies unknown content/parent and catalog errors: %p', async options => {
  const { client } = setup(options)
  expect(await currentUserHasContentAccess(ref)).toBe(false)
  if (!options.catalogError) expect(client.rpc).not.toHaveBeenCalled()
})

it.each([{ signedIn: false }, { authError: true }])('denies missing or failed authentication before privileged lookup: %p', async options => {
  setup(options)
  expect(await currentUserHasContentAccess(ref)).toBe(false)
  expect(createAdminClient).not.toHaveBeenCalled()
})

it('preserves the independent unitless presentation lookup and exact current catalog authorization', async () => {
  const presentationRef: SitovContentRef = { kind: 'presentation', id: 'sitov-presentation' }
  const { admin, presentationQuery, client } = setup({ presentation: true, items: [presentationRef] })
  expect(await currentUserHasContentAccess(presentationRef)).toBe(true)
  expect(admin.from).toHaveBeenCalledTimes(1)
  expect(presentationQuery.eq).toHaveBeenCalledWith('asset_id', presentationRef.id)
  expect(client.rpc).toHaveBeenCalledWith('get_sitov_access_catalog', { p_level: 'A1.2', p_trainer: 'videos' })
  client.rpc.mockResolvedValueOnce({ data: { units: [{ items: [] }] }, error: null })
  expect(await currentUserHasContentAccess(presentationRef)).toBe(false)
})
