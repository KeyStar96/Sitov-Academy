import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8')
const registry=JSON.parse(read('lib/audio/models/sitov-qwen-male-de/approved-variants.json'))
const sql=read('supabase/vps/115_sitov_prepared_audio_variants.sql')
test('SQL seven text/hash/tag bindings exactly match the narrow registry',()=>{
 const bindings=[...sql.matchAll(/\('([^']+)','([a-f0-9]{64})','(sitov-audio-repair-20261010-v1)'\)/g)].map(([,text,textSha256,variant])=>({text,textSha256,variant}))
 assert.deepEqual(bindings,registry.variants);assert.equal(bindings.length,7)
 for(const row of bindings)assert.equal(row.textSha256,createHash('sha256').update(row.text.normalize('NFC')).digest('hex'))
 assert.match(sql,/v\.source_text=spoken AND v\.text_sha256=/)
 assert.match(sql,/,"variant":/)
 const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>[k,canonical(v)])):value
 const profile=JSON.parse(read('lib/audio/models/sitov-qwen-male-de/config.json'))
 const fingerprint=createHash('sha256').update(JSON.stringify(canonical(profile))).digest('hex')
 assert.ok(sql.includes("fingerprint constant text:='"+fingerprint+"'"))
 assert.ok(sql.includes('"voice":"'+profile.voice+'"'))
 assert.ok(sql.includes('"leadIn":'+profile.output.leadInSeconds))

})
test('migration mirror/schema tail/runner ordering are exact and no old objects are written',()=>{
 assert.equal(sql,read('supabase/migrations/20261010003600_sitov_prepared_audio_variants.sql'))
 assert.ok(read('supabase/schema.sql').endsWith(sql))
 const runner=read('deploy/vps/migrate-local.py');assert.match(runner,/ORDER.append\('114_sitov_path_content_revisions.sql'\)\nORDER.append\('115_sitov_prepared_audio_variants.sql'\)/)
 assert.doesNotMatch(sql,/\b(?:UPDATE|INSERT INTO|DELETE FROM)\s+(?:storage|public|sitov_pronunciation_private|path_private)\./i)
 assert.match(sql,/FROM PUBLIC,anon,authenticated,service_role/)
})
test('prepared proof patch changes only the reviewed old address-construction block',()=>{
 const old=sql.match(/previous constant text:=\$old\$([\s\S]*?)\$old\$/)[1]
 const replacement=sql.match(/current_identity constant text:=\$new\$([\s\S]*?)\$new\$/)[1]
 const original=read('supabase/vps/70_sitov_prepared_own_vocabulary.sql')
 assert.equal(original.split(old).length,2)
 const patched=original.replace(old,replacement);assert.equal(patched.replace(replacement,old),original)
 assert.match(replacement,/sitov_canonical_german_audio_path\(spoken\)/)
 for(const marker of ['prepared_audio_required','textSha256','profileFingerprint','wordTimings','FOR SHARE','audio/mpeg','2097152','previous_end'])assert.equal(patched.split(marker).length,original.split(marker).length)
 assert.match(sql,/sitov_audio_metadata/);assert.match(sql,/sitov_audio_variant_identity_contract_changed/)
})
test('94–114 consumers obtain prepared addresses through the shared proof helper',()=>{
 for(const file of ['94_sitov_pronunciation_pretests.sql','95_sitov_learning_specials.sql','104_sitov_special_staff_publication.sql','114_sitov_path_content_revisions.sql']){
  const body=read('supabase/vps/'+file);assert.match(body,/vocabulary_private.sitov_prepared_german_audio_url\(/);assert.doesNotMatch(body,/sha256\(convert_to\(preimage/)
 }
 assert.match(read('supabase/vps/115_sitov_prepared_audio_variants.rollback.sql'),/RAISE EXCEPTION 'sitov_audio_variant_joint_restore_required'/)
})
