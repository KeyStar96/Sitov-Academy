jest.mock('server-only', () => ({}), { virtual: true })
import { requireSitovStaffMfa, SitovStaffMfaRequiredError } from '@/lib/sitov-staff-mfa'

type SitovClient = Parameters<typeof requireSitovStaffMfa>[0]

it('checks required administrator sessions against the database before privileged work', async () => {
  const rpc = jest.fn().mockResolvedValue({ data: { required: true, satisfied: true }, error: null })
  const client = { rpc } as unknown as SitovClient
  await requireSitovStaffMfa(client, { role: 'admin', sitov_mfa_required: true })
  expect(rpc).toHaveBeenCalledWith('sitov_staff_mfa_status')
  rpc.mockResolvedValue({ data: { required: true, satisfied: false }, error: null })
  await expect(requireSitovStaffMfa(client, { role: 'admin', sitov_mfa_required: true })).rejects.toBeInstanceOf(SitovStaffMfaRequiredError)
  rpc.mockResolvedValue({ data: null, error: { message: 'offline' } })
  await expect(requireSitovStaffMfa(client, { role: 'admin', sitov_mfa_required: true })).rejects.toBeInstanceOf(SitovStaffMfaRequiredError)
})

it('does not restrict learners, password-only teachers or administrators before staged enrollment', async () => {
  const rpc = jest.fn()
  const client = { rpc } as unknown as SitovClient
  await requireSitovStaffMfa(client, { role: 'student', sitov_mfa_required: true })
  await requireSitovStaffMfa(client, { role: 'teacher', sitov_mfa_required: false })
  await requireSitovStaffMfa(client, { role: 'teacher', sitov_mfa_required: true })
  await requireSitovStaffMfa(client, { role: 'admin', sitov_mfa_required: false })
  expect(rpc).not.toHaveBeenCalled()
})
