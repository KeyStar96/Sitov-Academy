import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPhase2Database, phase2Actor, phase2Id as id, readPhase2Sql } from './helpers/phase2-db.mjs'

const staff=id(101), unlocked=id(102), locked=id(103), folder=id(110), quotaFolder=id(111)
const unit=id(120), otherUnit=id(121), inactiveUnit=id(122), course=id(130)
const videoA=id(140), videoB=id(141), presentation=id(142), legacyVideo=id(143)
const bytes=40*1024*1024, maxFile=512*1024*1024, levelQuota=20*1024*1024*1024
const videoPath=video=>`A1.1/${folder}/videos/${video}.mp4`
const presentationPath=`A1.1/${folder}/presentations/${presentation}.pdf`
const constraintError=error=>['23502','23503','23514'].includes(error.code)
const errorResult=(result,code)=>{
  assert.equal(result.error,code)
  assert.equal(typeof result.message,'string')
  assert.ok(result.message.length>0)
}

// Metadata/RLS/quota tests execute only on the VPS. Actual HTTP/TUS uploads and
// simultaneous PostgreSQL sessions require separate real-service verification.
await test('Phase 2 media permissions, upload metadata, quotas and course exceptions',async t=>{
  const db=await createPhase2Database()
  try {
    await db.exec('BEGIN;'+await readPhase2Sql('02_identity_alignment.sql')+'COMMIT;')
    const migration=await readPhase2Sql('01_critical_fixes.sql')
    await db.exec('BEGIN;'+migration+'COMMIT;')
    await db.exec(`INSERT INTO locales VALUES('de'),('ru'); INSERT INTO cefr_levels VALUES('A1');
      INSERT INTO learning_levels(code,cefr_level,sort_order) VALUES('A1.1','A1',1),('A1.2','A1',2);
      INSERT INTO learning_trainers VALUES('vocabulary'),('exercises'),('pronunciation'),('videos');`)
    for(const [actor,role] of [[staff,'teacher'],[unlocked,'student'],[locked,'student']]) {
      await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())',[actor,`${actor}@example.test`])
      await db.query("INSERT INTO profiles(id,role,native_language,ui_language) VALUES($1,$2,'ru','ru')",[actor,role])
    }
    await db.query("INSERT INTO student_level_access(auth_user_id,level) VALUES($1,'A1.1')",[unlocked])
    await db.query("INSERT INTO courses(id,slug,title,type,category,level,unit_price) VALUES($1,'media-course','Medienkurs','online','german','A1.1',2.5)",[course])
    await db.query("INSERT INTO learning_units(id,level,trainer,label,is_active) VALUES($1,'A1.1','videos','Zwei Videos',true),($2,'A1.2','videos','Anderes Level',true),($3,'A1.1','videos','Entwurf',false)",[unit,otherUnit,inactiveUnit])
    await phase2Actor(db,staff)
    await db.query("INSERT INTO lms_media_folder(folder_id,level,course_id,title) VALUES($1,'A1.1',$2,'Unterricht'),($3,'A1.2',NULL,'Quota-Test')",[folder,course,quotaFolder])
    const put=async(path,size=bytes,mimetype='video/mp4',objectId=undefined)=>{
      if(objectId) return db.query("INSERT INTO storage.objects(id,bucket_id,name,metadata) VALUES($1,'course-assets',$2,$3)",[objectId,path,JSON.stringify({size,mimetype})])
      return db.query("INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('course-assets',$1,$2)",[path,JSON.stringify({size,mimetype})])
    }

    await t.test('private bucket accepts two uploaded videos sharing one unit and folder and retains URL sources',async()=>{
      const bucket=(await db.query("SELECT * FROM storage.buckets WHERE id='course-assets'")).rows[0]
      assert.equal(bucket.public,false)
      assert.equal(Number(bucket.file_size_limit),maxFile)
      for(const video of [videoA,videoB]) {
        await put(videoPath(video))
        await db.query('INSERT INTO learning_videos(id,unit_id,folder_id,title,storage_path,file_size) VALUES($1,$2,$3,$4,$5,$6)',[video,unit,folder,`Video ${video}`,videoPath(video),bytes])
      }
      await put(presentationPath,2000,'application/pdf')
      await db.query("INSERT INTO lms_presentation_asset(asset_id,folder_id,file_name,storage_path,mime_type,file_size) VALUES($1,$2,'Unterricht.pdf',$3,'application/pdf',2000)",[presentation,folder,presentationPath])
      await db.query("INSERT INTO learning_videos(id,unit_id,source_url) VALUES($1,$2,'https://example.test/existing-video')",[legacyVideo,unit])
      assert.equal((await db.query('SELECT count(*)::int n FROM learning_videos WHERE folder_id=$1 AND unit_id=$2',[folder,unit])).rows[0].n,2)
      assert.equal((await db.query('SELECT source_url FROM learning_videos WHERE id=$1',[legacyVideo])).rows[0].source_url,'https://example.test/existing-video')
      await assert.rejects(db.query('INSERT INTO learning_videos(unit_id) VALUES($1)',[unit]),constraintError)
      await db.query('INSERT INTO learning_videos(unit_id) VALUES($1)',[inactiveUnit])
      await assert.rejects(db.query('UPDATE learning_units SET is_active=true WHERE id=$1',[inactiveUnit]),constraintError)
    })
    await t.test('PowerPoint and Keynote MIME values remain real strings and metadata timestamps update',async()=>{
      for(const [suffix,mime,asset] of [
        ['pptx','application/vnd.openxmlformats-officedocument.presentationml.presentation',id(147)],
        ['key','application/vnd.apple.keynote',id(148)],
      ]) {
        const path=`A1.1/${folder}/presentations/${asset}.${suffix}`
        await put(path,1000,mime)
        await db.query('INSERT INTO lms_presentation_asset(asset_id,folder_id,file_name,storage_path,mime_type,file_size) VALUES($1,$2,$3,$4,$5,1000)',[asset,folder,`Unterricht.${suffix}`,path,mime])
        assert.equal((await db.query('SELECT mime_type FROM lms_presentation_asset WHERE asset_id=$1',[asset])).rows[0].mime_type,mime)
        await db.query("UPDATE lms_presentation_asset SET updated_at='2000-01-01',sort_order=2 WHERE asset_id=$1",[asset])
        assert.ok(new Date((await db.query('SELECT updated_at FROM lms_presentation_asset WHERE asset_id=$1',[asset])).rows[0].updated_at)>new Date('2000-01-02'))
        await db.query('DELETE FROM storage.objects WHERE name=$1',[path])
        await db.query('DELETE FROM lms_presentation_asset WHERE asset_id=$1',[asset])
      }
      await db.query("UPDATE lms_media_folder SET updated_at='2000-01-01',sort_order=2 WHERE folder_id=$1",[folder])
      assert.ok(new Date((await db.query('SELECT updated_at FROM lms_media_folder WHERE folder_id=$1',[folder])).rows[0].updated_at)>new Date('2000-01-02'))
    })
    await t.test('existing CMS RPC preserves uploaded sources and rejects invalid updates atomically',async()=>{
      const payload={unit:{level:'A1.1',label:'Zwei Videos',is_active:true},fields:{title:'Via CMS gespeichert'}}
      const save=value=>db.query("SELECT save_learning_content('videos',$1,$2) result",[JSON.stringify(value),videoA])
      assert.deepEqual((await save(payload)).rows[0].result,{id:videoA})
      assert.deepEqual((await db.query('SELECT title,storage_path,file_size FROM learning_videos WHERE id=$1',[videoA])).rows[0],{title:'Via CMS gespeichert',storage_path:videoPath(videoA),file_size:bytes})
      errorResult((await save({...payload,fields:{title:'Nicht speichern',file_size:bytes+1}})).rows[0].result,'invalid_input')
      assert.equal((await db.query('SELECT title FROM learning_videos WHERE id=$1',[videoA])).rows[0].title,'Via CMS gespeichert')
      await phase2Actor(db,unlocked)
      errorResult((await save(payload)).rows[0].result,'not_authorized')
      await phase2Actor(db,staff)
    })
    await t.test('students only see released levels and linked files and cannot mutate media',async()=>{
      const pending=`A1.1/${folder}/videos/${id(145)}.mp4`
      await put(pending)
      await phase2Actor(db,locked)
      for(const table of ['lms_media_folder','lms_presentation_asset','learning_videos','storage.objects']) {
        assert.equal((await db.query(`SELECT * FROM ${table}`)).rows.length,0,table)
      }
      await phase2Actor(db,unlocked)
      assert.deepEqual((await db.query('SELECT folder_id FROM lms_media_folder')).rows,[{folder_id:folder}])
      assert.equal((await db.query('SELECT * FROM lms_presentation_asset')).rows.length,1)
      assert.equal((await db.query('SELECT * FROM learning_videos')).rows.length,3)
      assert.deepEqual((await db.query('SELECT name FROM storage.objects ORDER BY name')).rows.map(row=>row.name),[presentationPath,videoPath(videoA),videoPath(videoB)].sort())
      await assert.rejects(db.query("INSERT INTO lms_media_folder(level,title) VALUES('A1.1','Forged')"),error=>error.code==='42501')
      await assert.rejects(put(`A1.1/${folder}/videos/${id(146)}.mp4`),error=>error.code==='42501')
      assert.equal((await db.query("UPDATE lms_media_folder SET title='Forged' WHERE folder_id=$1 RETURNING folder_id",[folder])).rows.length,0)
      assert.equal((await db.query('DELETE FROM storage.objects WHERE name=$1 RETURNING id',[videoPath(videoA)])).rows.length,0)
      await phase2Actor(db,staff)
      await db.query('DELETE FROM storage.objects WHERE name=$1',[pending])
      await db.query("SELECT set_student_trainer_access($1,'A1.1','videos',false,NULL,false)",[unlocked])
      await phase2Actor(db,unlocked)
      assert.equal((await db.query('SELECT * FROM learning_videos')).rows.length,0)
      assert.deepEqual((await db.query('SELECT name FROM storage.objects')).rows,[{name:presentationPath}])
      await phase2Actor(db,staff)
      await db.query("SELECT set_student_trainer_access($1,'A1.1','videos',true,NULL,false)",[unlocked])
    })
    await t.test('staff writes must use the correct level, folder, asset id, type and exact size',async()=>{
      for(const path of [
        `A1.2/${folder}/videos/${id(150)}.mp4`,
        `A1.1/${id(999)}/videos/${id(150)}.mp4`,
        `A1.1/${folder}/videos/${id(150)}.pdf`,
        `A1.1/${folder}/presentations/${id(150)}.mp4`,
        `A1.1/${folder}/videos/../${id(150)}.mp4`,
      ]) await assert.rejects(put(path),error=>['42501','23514'].includes(error.code))
      await assert.rejects(db.query('UPDATE learning_videos SET file_size=NULL WHERE id=$1',[videoA]),constraintError)
      await assert.rejects(db.query('UPDATE learning_videos SET file_size=file_size+1 WHERE id=$1',[videoA]),constraintError)
      await assert.rejects(db.query('UPDATE learning_videos SET unit_id=$1 WHERE id=$2',[otherUnit,videoA]),constraintError)
      await assert.rejects(db.query("UPDATE lms_presentation_asset SET mime_type='video/mp4' WHERE asset_id=$1",[presentation]),constraintError)
      await assert.rejects(db.query('UPDATE learning_videos SET storage_path=$1 WHERE id=$2',[videoPath(id(151)),videoA]),constraintError)
      await assert.rejects(db.query("UPDATE lms_media_folder SET level='A1.2' WHERE folder_id=$1",[folder]),constraintError)
      const wrongVideo=id(152), wrongVideoPath=videoPath(wrongVideo)
      await put(wrongVideoPath,1000,'application/pdf')
      try {
        await assert.rejects(db.query("INSERT INTO learning_videos(id,unit_id,folder_id,title,storage_path,file_size) VALUES($1,$2,$3,'Wrong MIME',$4,1000)",[wrongVideo,unit,folder,wrongVideoPath]),constraintError)
      } finally {
        await db.query('DELETE FROM learning_videos WHERE id=$1',[wrongVideo])
        await db.query('DELETE FROM storage.objects WHERE name=$1',[wrongVideoPath])
      }
    })
    await t.test('20 GiB boundary, overwrite accounting and 512 MiB file limit are enforced',async()=>{
      const quotaPath=n=>`A1.2/${quotaFolder}/videos/${id(500+n)}.mp4`
      for(let n=0;n<40;n++) await put(quotaPath(n),maxFile)
      await assert.rejects(put(quotaPath(40),1),error=>error.code==='PT413'&&JSON.parse(error.message).error==='level_quota_exceeded')
      await db.query("UPDATE storage.objects SET metadata=jsonb_set(metadata,'{size}',$1::jsonb) WHERE name=$2",[String(maxFile),quotaPath(0)])
      await db.query("UPDATE storage.objects SET metadata=jsonb_set(metadata,'{size}',$1::jsonb) WHERE name=$2",[String(maxFile-1),quotaPath(0)])
      await put(quotaPath(40),1)
      await assert.rejects(put(quotaPath(41),maxFile+1),error=>error.code==='PT413'&&JSON.parse(error.message).error==='file_too_large')
      const usage=(await db.query('SELECT media_storage_usage() result')).rows[0].result
      assert.equal(Number(usage.levels.find(row=>row.level==='A1.2').bytes),levelQuota)
      assert.equal(Number(usage.levels.find(row=>row.level==='A1.2').limit_bytes),levelQuota)
      assert.equal(Number(usage.total_bytes),levelQuota+2*bytes+2000)
      await phase2Actor(db,unlocked)
      errorResult((await db.query('SELECT media_storage_usage() result')).rows[0].result,'not_authorized')
      await phase2Actor(db,staff)
    })
    await t.test('course exception RPCs authorize staff, validate bounds and return structured errors',async()=>{
      const save=reason=>db.query("SELECT save_course_exception($1,'2026-10-15',$2) result",[course,reason])
      await phase2Actor(db,unlocked)
      errorResult((await save('Ausfall')).rows[0].result,'not_authorized')
      errorResult((await db.query('SELECT delete_course_exception($1) result',[id(990)])).rows[0].result,'not_authorized')
      await phase2Actor(db,staff)
      errorResult((await save(' ')).rows[0].result,'invalid_input')
      errorResult((await save('x'.repeat(251))).rows[0].result,'invalid_input')
      errorResult((await db.query("SELECT save_course_exception($1,'2026-10-15','Ausfall') result",[id(990)])).rows[0].result,'not_found')
      const first=(await save('Krankheit')).rows[0].result
      assert.ok(first.id)
      const repeated=(await save('Fortbildung')).rows[0].result
      assert.equal(repeated.id,first.id)
      assert.equal((await db.query('SELECT reason FROM course_exceptions WHERE id=$1',[first.id])).rows[0].reason,'Fortbildung')
      await assert.rejects(db.query("INSERT INTO course_exceptions(course_id,date,reason) VALUES($1,'2026-10-16','Direkt')",[course]),error=>error.code==='42501')
      assert.deepEqual((await db.query('SELECT delete_course_exception($1) result',[first.id])).rows[0].result,{deleted:true})
      errorResult((await db.query('SELECT delete_course_exception($1) result',[first.id])).rows[0].result,'not_found')
    })
    await t.test('folder removal cannot orphan files that staff can no longer reach',async()=>{
      const pendingFolder=id(160), changedFolder=id(161), pendingPath=`A1.1/${pendingFolder}/videos/${id(162)}.mp4`
      await db.query("INSERT INTO lms_media_folder(folder_id,level,title) VALUES($1,'A1.1','In progress')",[pendingFolder])
      await put(pendingPath,1000)
      try {
        await assert.rejects(db.query('UPDATE lms_media_folder SET folder_id=$1 WHERE folder_id=$2',[changedFolder,pendingFolder]),constraintError)
      } finally {
        // Fixture-owner cleanup also handles a deliberately failing guard test.
        await db.exec('RESET ROLE')
        await db.query('DELETE FROM storage.objects WHERE name=$1',[pendingPath])
        await db.query('DELETE FROM lms_media_folder WHERE folder_id=ANY($1::uuid[])',[[pendingFolder,changedFolder]])
        await phase2Actor(db,staff)
      }
      await assert.rejects(db.query('DELETE FROM lms_media_folder WHERE folder_id=$1',[folder]),constraintError)
      assert.equal((await db.query('SELECT * FROM lms_media_folder WHERE folder_id=$1',[folder])).rows.length,1)
      assert.equal((await db.query('SELECT * FROM storage.objects WHERE name=$1',[videoPath(videoA)])).rows.length,1)
      // Storage API completion is simulated by removing only the fixture rows;
      // production deletes files through the Storage API before these metadata.
      for(const path of [videoPath(videoA),videoPath(videoB),presentationPath]) await db.query('DELETE FROM storage.objects WHERE name=$1',[path])
      await db.query('DELETE FROM learning_videos WHERE folder_id=$1',[folder])
      await db.query('DELETE FROM lms_media_folder WHERE folder_id=$1',[folder])
      assert.equal((await db.query('SELECT * FROM lms_presentation_asset WHERE asset_id=$1',[presentation])).rows.length,0)
      assert.equal((await db.query('SELECT * FROM learning_videos WHERE id=$1',[legacyVideo])).rows.length,1)
    })
    await t.test('repeat migration preserves quota metadata and keeps privileged helpers private',async()=>{
      await db.exec('RESET ROLE')
      await db.exec('BEGIN;'+migration+'COMMIT;')
      const secured=(await db.query("SELECT has_schema_privilege('anon','media_private','USAGE') anonymous_schema,has_function_privilege('anon','public.media_storage_usage()','EXECUTE') anonymous_usage,has_function_privilege('authenticated','business_private.save_course_exception(uuid,date,text)','EXECUTE') direct_private_write")).rows[0]
      assert.deepEqual(secured,{anonymous_schema:false,anonymous_usage:false,direct_private_write:false})
      assert.equal((await db.query("SELECT count(*)::int n FROM storage.objects WHERE bucket_id='course-assets'")).rows[0].n,41)
      assert.equal((await db.query("SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='media_private' AND prosecdef AND NOT ('search_path=\"\"'=ANY(coalesce(proconfig,ARRAY[]::text[])))")).rows[0].n,0)
    })
  } finally { await db.close() }
})
