import { createPhase1Database } from './phase1-db.mjs'
import { apply } from './phase3-db.mjs'

export { actor, id, student, teacher, outsider, exerciseUnit, vocabularyUnit, result } from './phase1-db.mjs'
export { apply } from './phase3-db.mjs'

export const learningPathMigrations = [
  '33_path_exercise_types.sql',
  '34_path_content_contract.sql',
  '35_path_learning.sql',
]

/** Isolated PostgreSQL (PGlite) application database with no curriculum import.
 * Enum prerequisites have their own committed transaction, just as in the VPS
 * runner. Callers may install tiny fixtures before Phase 3 to test preservation.
 */
export async function createLearningPathDatabase({ beforePathMigrations } = {}) {
  const db = await createPhase1Database()
  try {
    await apply(db, ['31_vocabulary_target_forms.sql'])
    await apply(db, ['32_last_active_level.sql'])
    if (beforePathMigrations) await beforePathMigrations(db)
    for (const migration of learningPathMigrations) {
      try { await apply(db, [migration]) } catch (error) {
        error.message = `${migration}: ${error.message}`
        // PGlite includes the entire migration as query; keep the precise SQL
        // location/diagnostics without flooding a failed assertion with 50 KB.
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
