import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'

export const readPhase2Sql = name => readFile(new URL(`../../vps/${name}`, import.meta.url), 'utf8')
export const phase2Id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

/** Frozen pre-Phase-2 application schema with isolated Auth/Storage prerequisites.
 * This is a database test, not a deployment runner. Execute on the VPS under R7.
 * Storage network uploads are separately verified against the real Storage API.
 */
export async function createPhase2Database() {
  const db = new PGlite()
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE SCHEMA storage;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
      $$;
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.role',true),'')
      $$;
      CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,
        raw_user_meta_data jsonb DEFAULT '{}',raw_app_meta_data jsonb DEFAULT '{}');
      CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,owner uuid,
        public boolean DEFAULT false,file_size_limit bigint,allowed_mime_types text[],
        created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
      CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        bucket_id text REFERENCES storage.buckets(id),name text NOT NULL,owner uuid,
        owner_id text,metadata jsonb,user_metadata jsonb,version text,
        created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),
        last_accessed_at timestamptz DEFAULT now(),UNIQUE(bucket_id,name));
      CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
        SELECT (string_to_array(name,'/'))[1:greatest(array_length(string_to_array(name,'/'),1)-1,0)]
      $$;
      CREATE FUNCTION storage.filename(name text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
        SELECT (string_to_array(name,'/'))[array_length(string_to_array(name,'/'),1)]
      $$;
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA auth,storage TO anon,authenticated,service_role;
      GRANT ALL ON ALL TABLES IN SCHEMA auth,storage TO service_role;
      GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;
      GRANT SELECT ON storage.buckets TO authenticated;
      INSERT INTO storage.buckets(id,name,public) VALUES('pronunciation_audio','pronunciation_audio',false);
      DROP SCHEMA public;
    `)
    await db.exec(await readFile(new URL('../fixtures/phase2-baseline.sql', import.meta.url), 'utf8'))
    await db.exec("SET search_path=public; SET row_security=on; SET check_function_bodies=on;")
    return db
  } catch (error) {
    await db.close()
    throw error
  }
}

export async function phase2Actor(db, id, role = 'authenticated') {
  await db.exec('RESET ROLE')
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)", [id ?? '', role])
  await db.exec(`SET ROLE ${role === 'authenticated' ? 'authenticated' : role === 'anon' ? 'anon' : 'service_role'}`)
}
