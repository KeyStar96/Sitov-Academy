import { createPhase2Database, phase2Actor, phase2Id, readPhase2Sql } from './phase2-db.mjs'
export { phase2Actor as actor, phase2Id as id }
export const student=phase2Id(1), teacher=phase2Id(2), outsider=phase2Id(3), exerciseUnit=phase2Id(10), vocabularyUnit=phase2Id(11)
export const result=async(db,sql,params=[]) => (await db.query(sql,params)).rows[0].result
export const apply=async(db,names=['06_soft_errors.sql']) => db.exec('BEGIN;'+(await Promise.all(names.map(readPhase2Sql))).join('\n')+'COMMIT;')
/** Current application database, including all Phase 2 migrations. Execute on VPS. */
export async function createPhase3Database({beforeSoftErrors}={}) {
 const db=await createPhase2Database()
 try {
  await db.exec(`INSERT INTO locales VALUES('de'),('en'),('ru'),('uk'),('tr'); INSERT INTO cefr_levels VALUES('A1');
   INSERT INTO learning_levels(code,cefr_level,sort_order) VALUES('A1.1','A1',1);
   INSERT INTO learning_trainers VALUES('vocabulary'),('exercises'),('pronunciation'),('videos');`)
  for(const [uid,role] of [[student,'student'],[teacher,'teacher'],[outsider,'student']]) {
   await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())',[uid,`${uid}@example.test`])
   await db.query("INSERT INTO profiles(id,role,native_language,ui_language) VALUES($1,$2,'ru','ru')",[uid,role])
   await db.query('INSERT INTO people(auth_user_id,display_name,email) VALUES($1,$2,$3)',[uid,role,`${uid}@example.test`])
  }
  for(const [unit,trainer] of [[exerciseUnit,'exercises'],[vocabularyUnit,'vocabulary']])
   await db.query("INSERT INTO learning_units(id,level,trainer,label) VALUES($1,'A1.1',$2,'Lektion 1')",[unit,trainer])
  await db.query("INSERT INTO student_level_access VALUES($1,'A1.1')",[student])
  await apply(db,['02_identity_alignment.sql','03_registration_identity.sql','01_critical_fixes.sql','04_normalization.sql','05_rpc_errors.sql'])
  if(beforeSoftErrors) await beforeSoftErrors(db)
  await apply(db)
  return db
 } catch(error) { await db.close(); throw error }
}
