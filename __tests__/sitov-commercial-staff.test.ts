jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
import { createClient } from '@/utils/supabase/server'
import { readSitovStaffAccess, readSitovStaffCatalog, writeSitovStaffAccess } from '@/lib/access/sitov-commercial-staff'
const id = '00000000-0000-4000-8000-000000000107', actor = '00000000-0000-4000-8000-000000000106'
const state = { vip_enabled: false, trial: { version: 1, rules: [] }, purchased_levels: [], revision: 3 }
function setup({ role = 'teacher', signedIn = true, mfa = true, target = 'student', response = state as unknown }: { role?: string; signedIn?: boolean; mfa?: boolean; target?: string; response?: unknown } = {}) {
  const chain = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { role, sitov_mfa_required: role === 'admin' }, error: null }), maybeSingle: jest.fn().mockResolvedValue({ data: { role: target }, error: null }) }
  const rpc = jest.fn(async (name: string) => ({ data: name === 'sitov_staff_mfa_status' ? { satisfied: mfa } : response, error: null }))
  const client = { from: jest.fn().mockReturnValue(chain), rpc, auth: { getUser: jest.fn().mockResolvedValue({ data: { user: signedIn ? { id: actor } : null }, error: null }) } }
  jest.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>)
  return client
}
beforeEach(() => jest.clearAllMocks())
it.each([{ signedIn: false }, { role: 'student' }, { role: 'admin', mfa: false }, { target: 'teacher' }])('rejects unauthorized staff/target before access RPC: %p', async options => {
  const client = setup(options)
  expect(await readSitovStaffAccess(id)).toEqual({ ok: false, error: 'forbidden' })
  expect(client.rpc.mock.calls.some(([name]) => name === 'get_sitov_access_context')).toBe(false)
})
it('loads a strict current DTO through verified cookies and rejects leaked fields', async () => {
  const client = setup()
  expect(await readSitovStaffAccess(id)).toEqual({ ok: true, data: state })
  expect(client.auth.getUser).toHaveBeenCalled()
  setup({ response: { ...state, answers: ['secret'] } })
  expect(await readSitovStaffAccess(id)).toEqual({ ok: false, error: 'unavailable' })
})
it('VIP revoke calls only its revision-bound RPC and does not alter role or legacy grants', async () => {
  const client = setup({ response: { success: true, revision: 4 } })
  expect(await writeSitovStaffAccess({ kind: 'vip', studentId: id, enabled: false, revision: 3 })).toEqual({ ok: true, data: { revision: 4 } })
  expect(client.rpc).toHaveBeenCalledWith('set_sitov_student_vip', { p_student: id, p_enabled: false, p_expected_revision: 3 })
  expect(client.from.mock.calls.every(([table]) => table === 'profiles')).toBe(true)
})
it('empty selected trial is preserved exactly; CAS conflict stays explicit', async () => {
  const client = setup({ response: { error: 'revision_conflict' } })
  const manifest = { version: 1, rules: [{ level: 'A1.1', trainer: 'vocabulary', unit_ids: [], items: [] }] }
  expect(await writeSitovStaffAccess({ kind: 'trial', studentId: id, manifest, revision: 3 })).toEqual({ ok: false, error: 'revision_conflict' })
  expect(client.rpc).toHaveBeenCalledWith('set_sitov_student_trial', { p_student: id, p_manifest: manifest, p_expected_revision: 3 })
})
it('rejects forged extra scope/role, unsafe revisions, malformed state and wrong catalog container', async () => {
  const client = setup()
  expect((await writeSitovStaffAccess({ kind: 'vip', studentId: id, enabled: true, revision: 3, role: 'admin' })).ok).toBe(false)
  expect((await writeSitovStaffAccess({ kind: 'vip', studentId: id, enabled: true, revision: -1 })).ok).toBe(false)
  expect(client.rpc).not.toHaveBeenCalled()
  setup({ response: { version: 1, level: 'A2.1', trainer: 'vocabulary', units: [] } })
  expect((await readSitovStaffCatalog({ level: 'A1.1', trainer: 'vocabulary' })).ok).toBe(false)
})
it('returns denied-to-student metadata via staff catalog without solutions or audio', async () => {
  const catalog = { version: 1, level: 'A1.1', trainer: 'vocabulary', units: [{ id, label: 'Lektion', items: [{ kind: 'vocabulary_card', id, label: 'Haus', published: true }] }] }
  const client = setup({ response: catalog })
  expect(await readSitovStaffCatalog({ level: 'A1.1', trainer: 'vocabulary' })).toEqual({ ok: true, data: catalog })
  expect(client.rpc).toHaveBeenCalledWith('get_sitov_access_catalog', { p_level: 'A1.1', p_trainer: 'vocabulary' })
})

it('uses real vocabulary headwords only for IDs returned by the authorized staff catalog', async () => {
  const catalog={version:1,level:'A1.1',trainer:'vocabulary',units:[{id,label:'Lektion',items:[{kind:'vocabulary_card',id,label:'Lektion',published:true}]}]}
  const client=setup({response:catalog}), profileChain=client.from('profiles')
  const cards={select:jest.fn().mockReturnThis(),in:jest.fn().mockResolvedValue({data:[{id,word_de:'Haus'}],error:null})}
  client.from.mockImplementation((table:string)=>table==='learning_vocabulary_cards'?cards:profileChain)
  const result=await readSitovStaffCatalog({level:'A1.1',trainer:'vocabulary'})
  expect(result.ok && result.data.units[0].items[0].label).toBe('Haus')
  expect(cards.select).toHaveBeenCalledWith('id,word_de')
  expect(cards.in).toHaveBeenCalledWith('id',[id])
})
