import { execFileSync } from 'node:child_process'
import { randomBytes, createHmac } from 'node:crypto'
import { mkdir, writeFile, readFile, stat, realpath } from 'node:fs/promises'
import { resolve, isAbsolute, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

export const sitovNamespace='sitov-night-20261008-qa'
export const sitovGatewayPort=19483
export const sitovImages={
 db:{tag:'supabase/postgres:15.19.0.003',id:'sha256:bce4f0725a10d80bb16e01d678db8d40dd09223d18562125902e2682dd74ecdb'},
 auth:{tag:'supabase/gotrue:v2.186.0',id:'sha256:f2112b9289422f205df4ea15b8b550d425ae42528ea54521faa32cc7b62490de'},
 storage:{tag:'supabase/storage-api:v1.44.2',id:'sha256:4f0eb90b935c676914ed0609c2c7d47cddb3f336155726bb2d5542617d4afdfa'},
 rest:{tag:'postgrest/postgrest:v14.6',id:'sha256:7afcb0447b7849f6875bba4a0c603d79b1e2e44aec97af123bf9a0a2ccfeae52'},
 gateway:{tag:'kong/kong:3.9.1',id:'sha256:6addf50e6bd8d578314cb9ce4f2d2d1e3781d2edecef59f707e00c6e05d384f5'},
}
export const sitovInspectionPython=`import subprocess,json,datetime
images=${JSON.stringify(Object.values(sitovImages).map(x=>x.tag))}
result={'captured_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'images':[]}
for tag in images:
 d=json.loads(subprocess.check_output(['docker','image','inspect',tag],text=True))[0]
 result['images'].append({'requested':tag,'id':d['Id'],'arch':d['Architecture'],'user':d['Config'].get('User'),'env_names':sorted(x.split('=',1)[0] for x in d['Config'].get('Env',[]))})
result['memory_mib']={line.split(':')[0]:int(line.split()[1])//1024 for line in open('/proc/meminfo') if line.startswith(('MemTotal:','MemAvailable:'))}
result['docker_disk_free_bytes']=int(subprocess.check_output(['df','-B1','--output=avail','/var/lib/docker'],text=True).splitlines()[-1])
result['listening_tcp_ports']=sorted(set(int(line.split()[3].rsplit(':',1)[1]) for line in subprocess.check_output(['ss','-H','-ltn'],text=True).splitlines()))
print(json.dumps(result,indent=2))
`

export function sitovInspectRemote() {
 return JSON.parse(execFileSync('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=10','sitov-academy','python3','-'],
  {input:sitovInspectionPython,encoding:'utf8',stdio:['pipe','pipe','pipe']}))
}
export function sitovGuardFacts(facts,now=Date.now()) {
 const age=now-Date.parse(facts.captured_at)
 if (!Number.isFinite(age)||age<0||age>120000) throw new Error('Fresh inspection within 120s required')
 if (!(facts.memory_mib?.MemAvailable>=3072)) throw new Error('At least 3GiB fresh available memory required')
 if (!(facts.docker_disk_free_bytes>=4*1024**3)) throw new Error('At least 4GiB free Docker disk required')
 if (facts.listening_tcp_ports.includes(sitovGatewayPort)) throw new Error('Loopback gateway port occupied')
 for(const image of Object.values(sitovImages))
  if (!facts.images.some(x=>x.requested===image.tag&&x.id===image.id&&x.arch==='amd64')) throw new Error('Cached immutable image mismatch')
}
export function sitovComposePlan() {
 const limits={db:[384,0.75],auth:[128,0.25],rest:[64,0.25],storage:[256,0.5],gateway:[128,0.25]}
 const services=Object.fromEntries(Object.entries(limits).map(([name,[memory,cpu]])=>[name,{
  image:sitovImages[name].id,pull_policy:'never',container_name:`${sitovNamespace}-${name}`,
  labels:{'sitov.qa.namespace':sitovNamespace},restart:'no',networks:['isolated'],
  mem_limit:memory*1024**2,memswap_limit:memory*1024**2,cpus:cpu,pids_limit:256,
  env_file:[`./${name}.env`],logging:{driver:'none'},
 }]))
 services.db.volumes=['pgdata:/var/lib/postgresql/data']
 services.db.command=['postgres','-D','/etc/postgresql','-c','max_connections=40','-c','shared_buffers=64MB']
 services.storage.volumes=['files:/var/lib/storage']
 services.gateway.volumes=['./kong.json:/etc/kong/kong.json:ro']
 services.gateway.ports=[`127.0.0.1:${sitovGatewayPort}:8000`]
 const labels={'sitov.qa.namespace':sitovNamespace}
 return {name:sitovNamespace,services,networks:{isolated:{name:`${sitovNamespace}-isolated`,internal:true,labels}},
  volumes:{pgdata:{name:`${sitovNamespace}-pgdata`,labels},files:{name:`${sitovNamespace}-files`,labels}}}
}
export function sitovGuardPlan(plan) {
 if(plan.name!==sitovNamespace) throw new Error('Exact QA namespace required')
 if(plan.networks.isolated.internal!==true||plan.networks.isolated.external) throw new Error('Internal private network required')
 let memory=0,cpu=0
 for(const [name,service] of Object.entries(plan.services)) {
  if(service.image!==sitovImages[name]?.id||service.pull_policy!=='never') throw new Error('Immutable cached images only')
  if(service.container_name!==`${sitovNamespace}-${name}`||service.labels['sitov.qa.namespace']!==sitovNamespace) throw new Error('Exact names and labels required')
  if(JSON.stringify(service.networks)!=='["isolated"]'||service.network_mode||service.privileged) throw new Error('Isolated network only')
  memory+=service.mem_limit;cpu+=service.cpus
  if(service.memswap_limit!==service.mem_limit) throw new Error('No additional swap allowance')
  if(service.ports?.some(p=>p!==`127.0.0.1:${sitovGatewayPort}:8000`)) throw new Error('Loopback gateway binding only')
 }
 if(memory>1024**3||cpu>2) throw new Error('Maximum aggregate 1GiB / 2CPU')
 for(const [name,volume] of Object.entries(plan.volumes))
  if(volume.external||volume.name!==`${sitovNamespace}-${name}`||volume.labels['sitov.qa.namespace']!==sitovNamespace) throw new Error('Private labelled volumes only')
 if(JSON.stringify(plan)!==JSON.stringify(sitovComposePlan())) throw new Error('Exact reviewed blueprint required')
 return {memory_mib:memory/1024**2,cpus:cpu}
}
const jwt=(secret,role)=>{
 const pack=x=>Buffer.from(JSON.stringify(x)).toString('base64url')
 const message=pack({alg:'HS256',typ:'JWT'})+'.'+pack({iss:'supabase',role,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+172800})
 return message+'.'+createHmac('sha256',secret).update(message).digest('base64url')
}
export async function sitovStagePrivate(out,facts) {
 sitovGuardFacts(facts)
 if(!isAbsolute(out)||!resolve(out).includes('/.git/sitov-orchestration/SITOV-NIGHT-2026-10-08/S5/')) throw new Error('Private S5 coordination directory outside tracked files required')
 const root=out.slice(0,out.indexOf('/S5/')+3)
 const parent=await realpath(dirname(out)),actualRoot=await realpath(root)
 if(!actualRoot.includes('/.git/sitov-orchestration/')||(parent!==actualRoot&&!parent.startsWith(actualRoot+'/'))) throw new Error('Private root symlink escape rejected')
 await mkdir(out,{mode:0o700}) // refuse existing directory; never overwrite secrets
 if((await stat(out)).mode&0o077) throw new Error('Private directory mode 0700 required')
 const plan=sitovComposePlan();sitovGuardPlan(plan)
 const secret=randomBytes(48).toString('hex'),password=randomBytes(32).toString('hex')
 const anon=jwt(secret,'anon'),service=jwt(secret,'service_role')
 const files={
  'compose.json':JSON.stringify(plan,null,2),
  'inspection.json':JSON.stringify(facts,null,2),'inspect.py':sitovInspectionPython,
  'db.env':`POSTGRES_PASSWORD=${password}\nPOSTGRES_DB=postgres\nPOSTGRES_USER=postgres\nJWT_SECRET=${secret}\nJWT_EXP=172800\nPGDATA=/var/lib/postgresql/data\n`,
  'auth.env':`GOTRUE_API_HOST=0.0.0.0\nGOTRUE_API_PORT=9999\nAPI_EXTERNAL_URL=http://127.0.0.1:${sitovGatewayPort}\nGOTRUE_SITE_URL=http://127.0.0.1:3143\nGOTRUE_DB_DRIVER=postgres\nGOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin:${password}@db:5432/postgres\nGOTRUE_JWT_SECRET=${secret}\nGOTRUE_JWT_EXP=172800\nGOTRUE_JWT_AUD=authenticated\nGOTRUE_JWT_ADMIN_ROLES=service_role\nGOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated\nGOTRUE_EXTERNAL_EMAIL_ENABLED=true\nGOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED=false\nGOTRUE_MAILER_AUTOCONFIRM=true\nGOTRUE_EXTERNAL_PHONE_ENABLED=false\nGOTRUE_SMTP_HOST=\n`,
  'rest.env':`PGRST_DB_URI=postgres://authenticator:${password}@db:5432/postgres\nPGRST_DB_SCHEMAS=public\nPGRST_DB_ANON_ROLE=anon\nPGRST_JWT_SECRET=${secret}\nPGRST_DB_USE_LEGACY_GUCS=false\nPGRST_DB_POOL=5\n`,
  'storage.env':`DATABASE_URL=postgres://supabase_storage_admin:${password}@db:5432/postgres\nPOSTGREST_URL=http://rest:3000\nAUTH_JWT_SECRET=${secret}\nANON_KEY=${anon}\nSERVICE_KEY=${service}\nSTORAGE_BACKEND=file\nFILE_STORAGE_BACKEND_PATH=/var/lib/storage\nFILE_SIZE_LIMIT=5242880\nTENANT_ID=${sitovNamespace}\nREGION=local\nGLOBAL_S3_BUCKET=${sitovNamespace}\nIS_MULTITENANT=false\nDATABASE_POOL_MAX=5\nNODE_OPTIONS=--max-old-space-size=160\n`,
  'gateway.env':'KONG_DATABASE=off\nKONG_DECLARATIVE_CONFIG=/etc/kong/kong.json\nKONG_PROXY_LISTEN=0.0.0.0:8000\nKONG_ADMIN_LISTEN=off\nKONG_NGINX_WORKER_PROCESSES=1\nKONG_PROXY_ACCESS_LOG=off\nKONG_PROXY_ERROR_LOG=/dev/null\n',
  'kong.json':JSON.stringify({_format_version:'3.0',services:[
   {name:'auth',url:'http://auth:9999/',routes:[{name:'auth',paths:['/auth/v1'],strip_path:true}]},
   {name:'rest',url:'http://rest:3000/',routes:[{name:'rest',paths:['/rest/v1'],strip_path:true}]},
   {name:'storage',url:'http://storage:5000/',routes:[{name:'storage',paths:['/storage/v1'],strip_path:true}]},
  ]},null,2),
  'new-roles.sql':`\\set ON_ERROR_STOP on\nALTER USER authenticator WITH PASSWORD '${password}';\nALTER USER supabase_auth_admin WITH PASSWORD '${password}';\nALTER USER supabase_storage_admin WITH PASSWORD '${password}';\nGRANT anon,authenticated,service_role TO authenticator;\nALTER DATABASE postgres SET "app.settings.jwt_secret"='${secret}';\nALTER DATABASE postgres SET "app.settings.jwt_exp"='172800';\n`,
  'test-keys.json':JSON.stringify({url:`http://127.0.0.1:${sitovGatewayPort}`,anon,service,syntheticUserPassword:randomBytes(24).toString('hex')},null,2),
 }
 for(const name of ['guard.py','create.sh','cleanup.py','install-bundle.py'])
  files[name]=await readFile(new URL(`../sitov-night-real-transport/${name}`,import.meta.url),'utf8')
 for(const [name,content] of Object.entries(files)) await writeFile(resolve(out,name),content,{mode:0o600,flag:'wx'})
 return {directory:out,files:Object.keys(files),namespace:sitovNamespace,...sitovGuardPlan(plan),secretsPrinted:false,remoteMutation:false}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
 const [mode,arg]=process.argv.slice(2)
 if(mode==='inspect') {
  const facts=sitovInspectRemote();if(arg) await writeFile(arg,JSON.stringify(facts,null,2)+'\n');else console.log(JSON.stringify(facts,null,2))
 } else if(mode==='stage') console.log(JSON.stringify(await sitovStagePrivate(arg,sitovInspectRemote()),null,2))
 else if(mode==='plan') console.log(JSON.stringify({namespace:sitovNamespace,limits:sitovGuardPlan(sitovComposePlan()),compose:sitovComposePlan()},null,2))
 else throw new Error('inspect [metadata.json] | stage ABS_PRIVATE_S5_DIR | plan. No remote mutation commands.')
}
