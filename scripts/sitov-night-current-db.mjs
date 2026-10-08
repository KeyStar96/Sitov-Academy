import { createSitovCurrentNativeDatabase, SitovNativeDatabase } from '../supabase/tests/helpers/sitov-night-current-native-db.mjs'
import { sitovCurrentPlan, sitovRightsSnapshot, sitovHistorySnapshot } from '../supabase/tests/helpers/sitov-night-current-db.mjs'

const mode=process.argv[2]
if (mode==='plan') console.log(JSON.stringify(await sitovCurrentPlan(),null,2))
else if (mode==='install') {
 const db=await createSitovCurrentNativeDatabase({seed:!process.argv.includes('--schema-only')})
 console.log(JSON.stringify({installed:true,plan:db.installPlan},null,2))
} else if (mode==='snapshot') {
 const db=new SitovNativeDatabase()
 console.log(JSON.stringify({rights:await sitovRightsSnapshot(db),history:await sitovHistorySnapshot(db)},null,2))
} else throw new Error('Use plan | install [--schema-only] | snapshot. Dedicated synthetic socket only.')
