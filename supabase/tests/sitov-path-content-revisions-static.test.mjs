import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sql=readFileSync(new URL('../vps/114_sitov_path_content_revisions.sql',import.meta.url),'utf8');
const migration=readFileSync(new URL('../migrations/20261009200400_sitov_path_content_revisions.sql',import.meta.url),'utf8');
const old=readFileSync(new URL('../vps/44_path_task_help.sql',import.meta.url),'utf8');
const audio=readFileSync(new URL('../vps/72_sitov_prepared_path_publication.sql',import.meta.url),'utf8');
test('canonical and VPS migration bytes match',()=>assert.equal(sql,migration));
test('all patch anchors match the actual reviewed function source exactly once',()=>{
 for(const match of sql.matchAll(/anchor:=\$a\$([\s\S]*?)\$a\$/g)){
  assert.equal(old.split(match[1]).length-1,1,match[1]);
 }
 assert.ok(audio.includes('-- sitov-prepared-path-publication-v1'));
 assert.ok(sql.includes("strpos(definition,'-- sitov-prepared-path-publication-v1')=0"));
});
test('source-only contract never mutates learner tables or replaces learner RPCs',()=>{
 assert.doesNotMatch(sql,/(?:UPDATE|INSERT INTO|DELETE FROM|TRUNCATE)\s+(?:public\.|path_private\.)?(?:practice_items|test_items|practice_runs|test_runs|answers|user_exercise_progress|node_progress|recordings|receipts)\b/i);
 assert.doesNotMatch(sql,/CREATE OR REPLACE FUNCTION (?:public|path_private)\.(?:submit_path|finish_path|start_path|grade)/);
 assert.ok(sql.includes('DEFERRABLE INITIALLY DEFERRED'));
});
test('service boundary checks actual invoking role; private storage has no app grant',()=>{
 assert.ok(sql.includes("IF role_name<>'service_role'"));
 assert.doesNotMatch(sql,/auth\.jwt|raw_user_meta_data|set_config/);
 assert.doesNotMatch(sql,/GRANT (?:SELECT|INSERT|UPDATE|DELETE|ALL) ON (?:TABLE )?path_private\.sitov_content/);
 assert.ok(sql.includes('BEFORE UPDATE OR DELETE OR TRUNCATE'));
});
test('receipt replay precedes current CAS and stores the entire exact payload',()=>{
 assert.ok(sql.indexOf('RETURN existing.result')<sql.indexOf('before_hash:=path_private.sitov_revision_hash(old)'));
 assert.ok(sql.includes('existing.payload IS DISTINCT FROM p_items'));
 assert.ok(sql.includes('VALUES(p_request_id,p_items,result)'));
 assert.ok(sql.includes("'path-catalog:'||level_code"));
});
test('rollback keeps revision history and source protections',()=>{
 const rollback=readFileSync(new URL('../vps/rollback/114_sitov_path_content_revisions.sql',import.meta.url),'utf8');
 assert.doesNotMatch(rollback,/\b(?:DROP|DELETE|TRUNCATE|UPDATE)\s/i);
 assert.ok(rollback.includes('REVOKE ALL ON FUNCTION public.sitov_revise_path_content'));
});
