jest.mock('server-only',()=>({}),{virtual:true})
import {execFileSync} from 'node:child_process'
import {sitovBillingSettingsSchema} from '@/lib/access/sitov-billing-staff'
const native=process.env.SITOV_NIGHT_NATIVE==='1'?test:test.skip
native('actual pinned92+93 billing DTO/CAS/disabled acknowledgements and student denial',()=>{
 const script=String.raw`
 import {readFile} from 'node:fs/promises';
 import {SitovNativeDatabase,createSitovCurrentNativeDatabase} from './supabase/tests/helpers/sitov-night-current-native-db.mjs';
 import {sitovUsers} from './supabase/tests/helpers/sitov-night-current-db.mjs';
 const admin=new SitovNativeDatabase(),database='sitov_night_billing_'+process.pid;admin.raw('CREATE DATABASE '+database);let db;
 try {
  db=await createSitovCurrentNativeDatabase({database});await db.actor(null,'postgres');
  await db.exec("UPDATE profiles SET sitov_mfa_required=false WHERE id='"+sitovUsers.teacher+"'");
  await db.exec(await readFile('./supabase/vps/93_sitov_commercial_access.sql','utf8'));
  await db.actor(sitovUsers.teacher);const value=async(sql,args=[])=>(await db.query(sql,args)).rows[0].result;
  const initial=await value('SELECT get_sitov_billing_settings() result');
  const priced=await value('SELECT set_sitov_product_price($1,$2,$3,$4) result',['A1.1',250,'EUR',0]);
  const conflict=await value('SELECT set_sitov_product_price($1,$2,$3,$4) result',['A1.1',500,'EUR',0]);
  const blocked=await value('SELECT set_sitov_billing_enabled(true,0) result');
  const off=await value('SELECT set_sitov_billing_enabled(false,0) result');
  const current=await value('SELECT get_sitov_billing_settings() result');
  await db.actor(sitovUsers.outsider);const denied=await value('SELECT set_sitov_product_price($1,$2,$3,$4) result',['A1.1',500,'EUR',1]);
  console.log(JSON.stringify({initial,priced,conflict,blocked,off,current,denied}));
 } finally {await db?.close();admin.raw('DROP DATABASE '+database)}
 `
 const result=JSON.parse(execFileSync(process.execPath,['--input-type=module','-'],{input:script,encoding:'utf8',cwd:process.cwd(),stdio:['pipe','pipe','pipe']}).trim())
 expect(sitovBillingSettingsSchema.safeParse(result.initial).success).toBe(true)
 expect(result.initial.products.every((p:{amount_minor:null;currency:null})=>p.amount_minor===null&&p.currency===null)).toBe(true)
 expect(result.priced).toEqual({success:true,revision:1});expect(result.conflict.error).toBe('revision_conflict')
 expect(result.blocked).toEqual({error:'provider_not_configured',missing:['provider_adapter']})
 expect(result.off).toEqual({success:true,revision:1,enabled:false});expect(sitovBillingSettingsSchema.safeParse(result.current).success).toBe(true)
 expect(result.current.products.find((p:{level:string})=>p.level==='A1.1')).toEqual({level:'A1.1',amount_minor:250,currency:'EUR',revision:1})
 expect(result.current.enabled).toBe(false);expect(result.denied.error).toBe('forbidden')
})
