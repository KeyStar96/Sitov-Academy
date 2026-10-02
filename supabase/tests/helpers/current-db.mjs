import { createLearningPathDatabase, apply } from './learning-path-db.mjs'

export { actor, id, student, teacher, outsider, exerciseUnit, vocabularyUnit, result, apply } from './learning-path-db.mjs'

/** Every VPS migration after the learning path (36 … 53), in runner order. */
export const currentMigrations = [
  '36_migrate_old_grammar_progress.sql', '37_vocabulary_carryover.sql', '38_learning_sessions.sql',
  '39_teacher_dashboard.sql', '40_level_access_verified_email.sql', '41_mail_notifications.sql',
  '42_learning_new.sql', '43_path_open_tests.sql', '44_path_task_help.sql', '45_path_test_review.sql',
  '46_mail_reminder_kind.sql', '47_mail_preferences.sql', '48_certificate_csv_schema.sql',
  '49_certificate_csv_workflow.sql', '50_certificate_eligibility_guards.sql', '51_certificate_pdf_issuance.sql',
  '52_independent_trainer_analytics.sql', '53_course_cancellation_billing.sql',
]

export const currentFeatureMigrations = ['54_learning_progress_focus.sql', '55_preserve_course_outages_focus_access.sql', '56_answer_typographic_punctuation.sql', '57_pronunciation_moderation_profile_deletion.sql', '58_path_authored_wrong_forms.sql']

/** Isolated PGlite database at the reviewed application schema (01 … 58).
 * `beforeLatest` installs fixtures that must exist before the migration under
 * test, e.g. to prove that a backfill preserves and reads live-like rows.
 */
export async function createCurrentDatabase({ beforeLatest, latest = currentFeatureMigrations } = {}) {
  const db = await createLearningPathDatabase()
  try {
    for (const migration of currentMigrations) {
      try { await apply(db, [migration]) } catch (error) {
        error.message = `${migration}: ${error.message}`
        delete error.query
        throw error
      }
    }
    if (beforeLatest) await beforeLatest(db)
    for (const migration of latest) {
      try { await apply(db, [migration]) } catch (error) {
        error.message = `${migration}: ${error.message}`
        delete error.query
        throw error
      }
    }
    return db
  } catch (error) {
    await db.close()
    throw error
  }
}
