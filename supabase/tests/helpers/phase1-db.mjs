import { createPhase3Database, apply } from './phase3-db.mjs'
export { actor, id, student, teacher, outsider, exerciseUnit, vocabularyUnit, result } from './phase3-db.mjs'

// Current ordered application functions, including 07 readiness, 22 intervals,
// 23 own translations and 29 notifications. 08 has psql CONCURRENTLY commands;
// its indexes are verified by the real clone migration run, not this PGlite DB.
export const previousMigrations = [
 '07_content_quality.sql','09_progress_aggregate.sql','10_rls_performance.sql','11_teacher_analytics.sql',
 '12_media_upload.sql','13_mail_exception_kind.sql','14_mail_exceptions.sql','15_grading_helper_permissions.sql',
 '16_uploaded_video_visibility.sql','17_remove_video_placeholders.sql','18_vocabulary_self_rating.sql',
 '19_vocabulary_self_rating_fix.sql','20_vocabulary_learner_mode.sql','21_vocabulary_sentence_learner_choice.sql',
 '22_vocabulary_phase6_rules.sql','23_vocabulary_own_words.sql','24_learning_activity_days.sql',
 '25_vocabulary_lesson_switch.sql','26_mail_signup_kind.sql','27_staff_signup_notification.sql',
 '28_mail_level_access_kind.sql','29_student_level_access_notification.sql',
]
export const applyCurrent = db => apply(db, ['30_fair_answer_grading.sql'])
export async function createPhase1Database(options = {}) {
 const db = await createPhase3Database(options)
 try {
  // Match the production Auth prerequisite omitted from the frozen baseline.
  await db.exec("ALTER TABLE auth.users ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(); UPDATE auth.users SET created_at=now()-interval '30 days'")
  // Each real migration commits separately, including enum prerequisite files.
  for (const migration of previousMigrations) await apply(db, [migration])
  if (options.beforeFairGrading) await options.beforeFairGrading(db)
  await applyCurrent(db)
  return db
 } catch (error) { await db.close(); throw error }
}
