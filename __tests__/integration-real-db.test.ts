/** @jest-environment node */
/** Explicit, read-only loopback smoke test. Normal test runs never load app env or connect. */
const selfHostedTest = process.env.RUN_SELF_HOSTED_INTEGRATION === '1' ? it : it.skip
selfHostedTest('reads the explicitly configured local Docker catalog without mutating customer data', async () => {
  const raw=process.env.SELF_HOSTED_TEST_URL
  const key=process.env.SELF_HOSTED_TEST_ANON_KEY
  if(!raw||!key)throw new Error('Explicit local test configuration required')
  const url=new URL(raw)
  if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw new Error('Integration tests require a loopback-only Docker endpoint')
  const {createClient}=await import('@supabase/supabase-js')
  const client=createClient<import('@/supabase/database.types').Database>(url.origin,key,{auth:{persistSession:false,autoRefreshToken:false}})
  const catalog=await client.from('courses').select('id,title').is('archived_at',null)
  expect(catalog.error).toBeNull()
  expect(catalog.data?.length).toBeGreaterThan(0)
  const privateData=await client.from('people').select('id')
  expect(privateData.error).not.toBeNull()
})
