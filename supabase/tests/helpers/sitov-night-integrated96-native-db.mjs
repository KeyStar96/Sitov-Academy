import { readFile } from 'node:fs/promises'
import { sitovCurrentPlan, sitovVerifyPinnedContent } from './sitov-night-current-db.mjs'
import { createSitovBaseline92NativeDatabase } from './sitov-night-current-native-db.mjs'

const directory = new URL('../fixtures/sitov-night-integrated96/', import.meta.url)
export const sitovIntegrated96PlanSha256 = '031cbc61c33f3365992d070591ce67952f5bae7833e23bd6478680aed6102963'

/** Frozen combined target is separate from the unchanged baseline92 installer. */
export async function sitovLoadIntegrated96() {
 const raw = await readFile(new URL('plan.json',directory),'utf8')
 sitovVerifyPinnedContent(raw,sitovIntegrated96PlanSha256,'integrated96 plan')
 const plan=JSON.parse(raw),baseline=await sitovCurrentPlan({target:'baseline92'})
 if(plan.target!=='sitov-night-integrated96-v1'||plan.through!==96||
  plan.baselineSchemaSha256!==baseline.schemaSha256||plan.baselineLookupsSha256!==baseline.lookupSha256||
  plan.overlays.length!==4||plan.overlays.some((item,index)=>item.through!==93+index||!/^[0-9]{14}_sitov_[a-z_]+\.sql$/.test(item.name)))
  throw new Error('Invalid integrated96 target')
 const overlays=[]
 for(const item of plan.overlays)overlays.push(sitovVerifyPinnedContent(await readFile(new URL(item.name,directory),'utf8'),item.sha256,item.name))
 return {plan,overlays}
}

export async function createSitovIntegrated96NativeDatabase(options={}) {
 const {plan,overlays}=await sitovLoadIntegrated96() // Verify every byte before connecting.
 const db=await createSitovBaseline92NativeDatabase({...options,target:'baseline92'})
 db.beforeOverlayHistory = options.captureBefore ? await options.captureBefore(db) : null
 for(const sql of overlays) await db.exec(`BEGIN; ${sql} COMMIT;`)
 await db.exec(`INSERT INTO sitov_qa_fixture.installation VALUES('${plan.target}','${plan.sourceIntegrationSha}',
  '${plan.canonicalSha256}','${plan.baselineLookupsSha256}',96)`)
 db.installPlan=plan
 return db
}
