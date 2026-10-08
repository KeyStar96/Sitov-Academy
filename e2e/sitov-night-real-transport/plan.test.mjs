import test from 'node:test'
import assert from 'node:assert/strict'
import { sitovComposePlan,sitovGuardPlan,sitovGuardFacts,sitovImages,sitovStagePrivate } from '../helpers/sitov-night-real-transport-plan.mjs'
const facts=()=>({captured_at:new Date().toISOString(),memory_mib:{MemAvailable:3200},docker_disk_free_bytes:10*1024**3,listening_tcp_ports:[],images:Object.values(sitovImages).map(x=>({requested:x.tag,id:x.id,arch:'amd64'}))})
test('exact cached isolated plan is bounded to 960MiB/2CPU; remote publishes no host ports',()=>{
 assert.deepEqual(sitovGuardPlan(sitovComposePlan()),{memory_mib:960,cpus:2});sitovGuardFacts(facts())
 assert.equal(sitovComposePlan().services.gateway.ports,undefined)
})
test('low/missing/stale headroom, occupied port and changed image fail closed',()=>{
 for(const mutate of [f=>f.memory_mib.MemAvailable=3071,f=>delete f.memory_mib.MemAvailable,
  f=>f.captured_at='2000-01-01T00:00:00Z',f=>f.listening_tcp_ports=[19483],f=>f.images[0].id='sha256:wrong']) {
  const f=facts();mutate(f);assert.throws(()=>sitovGuardFacts(f))
 }
})
test('public/prod network, broad ports, privileged/external storage and excess resources rejected',()=>{
 for(const mutate of [p=>p.networks.isolated.internal=false,p=>p.networks.isolated.name='eknmzxvqilojjicinatnllbt',
  p=>p.services.gateway.ports=['0.0.0.0:19483:8000'],p=>p.services.db.privileged=true,
  p=>p.volumes.pgdata.external=true,p=>p.services.db.mem_limit=1024**3,p=>p.services.db.cpus=3,
  p=>p.services.db.env_file=['/production.env']]) {
  const p=sitovComposePlan();mutate(p);assert.throws(()=>sitovGuardPlan(p))
 }
})
test('secrets cannot be staged into tracked repository or relative output',async()=>{
 await assert.rejects(sitovStagePrivate('relative',facts()),/Private S5/)
 await assert.rejects(sitovStagePrivate('/tmp/visible-repo',facts()),/Private S5/)
})
