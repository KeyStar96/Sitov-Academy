import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { sitovPrerequisites, sitovBaseline, sitovCurrentPlan, sitovLoadInstallTarget } from './sitov-night-current-db.mjs'

const socket = '/tmp/sitov-night-2026-10-08-pg'
const port = '55438'
const psql = '/opt/homebrew/opt/postgresql@17/bin/psql'
const literal = value => value == null ? 'NULL' : typeof value === 'boolean' ? String(value)
 : typeof value === 'number' && Number.isFinite(value) ? String(value)
 : `'${(typeof value === 'object' ? JSON.stringify(value) : String(value)).replaceAll("'","''")}'`

/** Every operation is constrained to M's socket-only synthetic instance. */
export class SitovNativeDatabase {
 constructor(database = 'sitov_night_fixture') {
  if (!/^sitov_night_[a-z0-9_]+$/.test(database)) throw new Error('Synthetic database name required')
  this.database = database
  this.role = 'postgres'
  this.claims = {}
 }
 raw(sql) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('PG')))
  try {
   return execFileSync(psql,['-X','-w','-qAt','-h',socket,'-p',port,'-d',this.database,'-v','ON_ERROR_STOP=1'],
    {input:sql,encoding:'utf8',env,maxBuffer:16*1024*1024,stdio:['pipe','pipe','pipe']}).trim()
  } catch (error) {
   throw new Error(`Native SQL failed: ${String(error.stderr ?? error.message).trim()}`)
  }
 }
 async exec(sql) {
  this.raw(`SET ROLE ${this.role}; SET search_path=public; SET row_security=on;
   SELECT set_config('request.jwt.claims',${literal(this.claims)},false);
   SELECT set_config('request.jwt.claim.sub',${literal(this.claims.sub ?? '')},false);\n${sql}`)
 }
 async query(sql, params = []) {
  const bound = sql.replace(/\$(\d+)/g,(_,index) => literal(params[Number(index)-1]))
  const output = this.raw(`SET ROLE ${this.role}; SET search_path=public; SET row_security=on;
   SELECT set_config('request.jwt.claims',${literal(this.claims)},false);
   SELECT set_config('request.jwt.claim.sub',${literal(this.claims.sub ?? '')},false);
   SELECT coalesce(jsonb_agg(sitov_result),'[]'::jsonb) FROM (${bound}) sitov_result;`)
  return { rows: JSON.parse(output.split('\n').at(-1)) }
 }
 async actor(uid, role = 'authenticated', extraClaims = {}) {
  if (!['anon','authenticated','service_role','postgres'].includes(role)) throw new Error('Unsupported fixture role')
  this.role=role
  this.claims={role,...(uid ? {sub:uid} : {}),...extraClaims}
 }
 async close() {}
}

export async function createSitovBaseline92NativeDatabase({database='sitov_night_fixture',seed=true,target='baseline92'}={}) {
 const plan = await sitovCurrentPlan({target})
 const {schema,lookups} = await sitovLoadInstallTarget({target})
 const db = new SitovNativeDatabase(database)
 const safety = JSON.parse(db.raw(`SELECT json_build_object('listen',current_setting('listen_addresses'),
  'version',current_setting('server_version_num'),'tables',(SELECT count(*) FROM information_schema.tables
  WHERE table_schema NOT IN('pg_catalog','information_schema')))`))
 if (safety.listen !== '' || Number(safety.version)<170000 || safety.tables!==0)
  throw new Error('Fixture install requires an empty database on the dedicated socket-only PostgreSQL17 instance')
 const marker = '-- PostgreSQL database dump complete'
 if (schema.split(marker).length !== 2) throw new Error('Canonical snapshot boundary changed')
 // The normalized snapshot creates final enum labels directly, so no ALTER TYPE
 // value is consumed before commit. Legacy migrations are inventoried, not replayed.
 db.raw(`BEGIN; ${await readFile(sitovPrerequisites,'utf8')} DROP SCHEMA public; SET ROLE postgres;
  ${schema.replace(marker,`${marker}\n${lookups}`)} COMMIT;
  SET check_function_bodies=on; SET row_security=on; SET search_path=public;`)
 // Exact e22 snapshot already includes effective 90/91/92. No mutable overlays.
 await db.exec(`CREATE SCHEMA sitov_qa_fixture;
  REVOKE ALL ON SCHEMA sitov_qa_fixture FROM PUBLIC,anon,authenticated;
  CREATE TABLE sitov_qa_fixture.installation(target text PRIMARY KEY,source_sha text NOT NULL,
   schema_sha256 text NOT NULL,lookup_sha256 text NOT NULL,reviewed_through integer NOT NULL);
  INSERT INTO sitov_qa_fixture.installation VALUES(${literal(plan.target)},${literal(plan.sourceSha)},
   ${literal(plan.schemaSha256)},${literal(plan.lookupSha256)},${plan.through});`)
 // Auth-owned triggers are outside the application-only dump. Invoke the real
 // application provisioner rather than fabricating profiles in test code.
 await db.exec(`CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION business_private.provision_profile();`)
 if (seed) await db.exec(`BEGIN; ${await readFile(sitovBaseline,'utf8')} COMMIT;`)
 db.installPlan=plan
 return db
}

// Compatibility alias: this always installs baseline92, never the live canonical.
export const createSitovCurrentNativeDatabase = createSitovBaseline92NativeDatabase
