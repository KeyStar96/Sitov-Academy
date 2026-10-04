import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

await test('new application objects have explicit grants; existing access is preserved', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role; create role supabase_admin superuser;
      grant usage,create on schema public to supabase_admin;
      alter default privileges for role postgres in schema public grant all on tables to anon,authenticated,service_role;
      alter default privileges for role postgres in schema public grant all on sequences to anon,authenticated,service_role;
      alter default privileges for role postgres in schema public grant execute on functions to anon,authenticated,service_role;
      create table public.sitov_existing(id bigint);
      create function public.sitov_existing_rpc() returns integer language sql as 'select 1';
    `)
    const sql = await readFile(new URL('../vps/81_sitov_explicit_api_default_privileges.sql', import.meta.url), 'utf8')
    await db.exec(sql)
    await db.exec(sql)
    for (const owner of ['postgres', 'supabase_admin']) {
      await db.exec(`set role ${owner};
        create table public.sitov_${owner}_private(id bigint);
        create sequence public.sitov_${owner}_sequence;
        create function public.sitov_${owner}_rpc() returns integer language sql as 'select 1'; reset role;`)
      for (const role of ['anon', 'authenticated']) {
        const { rows: [row] } = await db.query(`select
          has_table_privilege($1,$2,'SELECT') as table_access,
          has_sequence_privilege($1,$3,'USAGE') as sequence_access,
          has_function_privilege($1,$4,'EXECUTE') as function_access`,
        [role, `public.sitov_${owner}_private`, `public.sitov_${owner}_sequence`, `public.sitov_${owner}_rpc()`])
        assert.deepEqual(row, { table_access: false, sequence_access: false, function_access: false })
      }
      const { rows: [server] } = await db.query(`select has_table_privilege('service_role',$1,'SELECT') as allowed`, [`public.sitov_${owner}_private`])
      assert.equal(server.allowed, true)
    }
    const { rows: [existing] } = await db.query(`select has_table_privilege('authenticated','public.sitov_existing','SELECT') as table_access,
      has_function_privilege('authenticated','public.sitov_existing_rpc()','EXECUTE') as function_access`)
    assert.deepEqual(existing, { table_access: true, function_access: true })
  } finally { await db.close() }
})
