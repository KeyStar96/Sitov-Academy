-- Preserve existing grants. Future application objects require explicit API grants
-- and RLS in their authoring migration; no automatic client access on creation.
-- PUBLIC's default function EXECUTE is global, so a schema-only REVOKE cannot
-- remove it. Revoke that default for both application DDL owners explicitly.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all privileges on functions from anon, authenticated;
alter default privileges for role postgres
  revoke execute on functions from public;

alter default privileges for role supabase_admin in schema public
  revoke all privileges on tables from anon, authenticated;
alter default privileges for role supabase_admin in schema public
  revoke all privileges on sequences from anon, authenticated;
alter default privileges for role supabase_admin in schema public
  revoke all privileges on functions from anon, authenticated;
alter default privileges for role supabase_admin
  revoke execute on functions from public;

-- Leave vendor-owned auth/storage/realtime schemas and existing objects intact.
-- Include service_role explicitly for new server-only public objects.
alter default privileges for role supabase_admin in schema public
  grant all privileges on tables to service_role;
alter default privileges for role supabase_admin in schema public
  grant all privileges on sequences to service_role;
alter default privileges for role supabase_admin in schema public
  grant execute on functions to service_role;
