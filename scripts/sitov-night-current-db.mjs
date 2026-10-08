import { createSitovBaseline92NativeDatabase, SitovNativeDatabase } from '../supabase/tests/helpers/sitov-night-current-native-db.mjs'
import { sitovCurrentPlan, sitovRightsSnapshot, sitovHistorySnapshot } from '../supabase/tests/helpers/sitov-night-current-db.mjs'

const mode=process.argv[2]
const args=process.argv.slice(3)
const option=name=>args[args.indexOf(name)+1]
if (!args.includes('--target') || option('--target')!=='baseline92')
 throw new Error('Explicit --target baseline92 required; canonical/integrated targets are unsupported')
const target=option('--target')
const database=args.includes('--database') ? option('--database') : 'sitov_night_fixture'
if (mode==='plan') console.log(JSON.stringify(await sitovCurrentPlan({target}),null,2))
else if (mode==='install') {
 const db=await createSitovBaseline92NativeDatabase({database,target,seed:!args.includes('--schema-only')})
 console.log(JSON.stringify({installed:true,plan:db.installPlan},null,2))
} else if (mode==='snapshot') {
 const db=new SitovNativeDatabase(database)
 const installation=(await db.query('SELECT * FROM sitov_qa_fixture.installation')).rows
 console.log(JSON.stringify({installation,rights:await sitovRightsSnapshot(db),history:await sitovHistorySnapshot(db)},null,2))
} else throw new Error('Use plan | install [--schema-only] | snapshot --target baseline92 [--database sitov_night_NAME].')
