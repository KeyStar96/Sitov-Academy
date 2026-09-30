import type { Tables } from '@/supabase/database.types'

/**
 * Zeilen der Tabelle `teacher_student_notes` (früheres „Schwarzes Brett“).
 * Die Oberfläche und die Speicher-Action sind seit Phase 11.2 entfernt; die
 * vorhandenen Datensätze bleiben unverändert in der Datenbank erhalten.
 */
export type TeacherStudentNote = Tables<'teacher_student_notes'>
