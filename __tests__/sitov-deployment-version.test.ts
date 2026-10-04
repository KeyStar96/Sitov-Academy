/** Deployment versions must follow releases, while ordinary local builds stay unversioned. */
const originalDeploymentId = process.env.SITOV_DEPLOYMENT_ID

beforeEach(() => {
  jest.resetModules()
  delete process.env.SITOV_DEPLOYMENT_ID
})

afterAll(() => {
  if (originalDeploymentId === undefined) delete process.env.SITOV_DEPLOYMENT_ID
  else process.env.SITOV_DEPLOYMENT_ID = originalDeploymentId
})

it('keeps Next defaults without a release ID, including an empty optional value', async () => {
  expect((await import('../next.config')).default.deploymentId).toBeUndefined()
  jest.resetModules()
  process.env.SITOV_DEPLOYMENT_ID = ''
  expect((await import('../next.config')).default.deploymentId).toBeUndefined()
})

it('uses the full release revision and changes when the release changes', async () => {
  const first = 'a123456789bc0000000000000000000000000000'
  const second = 'b123456789bc0000000000000000000000000000'
  process.env.SITOV_DEPLOYMENT_ID = first
  expect((await import('../next.config')).default.deploymentId).toBe(first)
  jest.resetModules()
  process.env.SITOV_DEPLOYMENT_ID = second
  expect((await import('../next.config')).default.deploymentId).toBe(second)
})
