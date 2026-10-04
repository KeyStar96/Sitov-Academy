import type { Json } from './database.types'
type Table<Row, Required extends keyof Row> = { Row: Row; Insert: Pick<Row, Required> & Partial<Row>; Update: Partial<Row>; Relationships: [] }
export type ExamAttemptRow = { id:string; student_id:string; task_id:string; task_version:number; unit_id:string; answer:Json; correct:boolean|null; helped:boolean; feedback_viewed:boolean; seconds:number; mode:'practice'|'checkpoint'; variant:number; request_id:string; feedback:Json; created_at:string }
export type ExamSubmissionRow = { id:string; student_id:string; task_id:string; task_version:number; unit_id:string; request_id:string; explicit_submit:boolean; kind:'writing'|'speaking'; helped:boolean; text_content:string; media_path:string|null; photo_path:string|null; teacher_id:string|null; status:'draft'|'submitted'|'reviewed'; previous_id:string|null; reflection:string|null; created_at:string }
export type ExamFeedbackRow = { id:string; submission_id:string; teacher_id:string; text_content:string; strengths:string; priorities:Json; revision:string; rating:'practice'|'assisted'|'independent'; rubric:Json; created_at:string }
export type ExamProductionRow = { audio_id:string; script_hash:string; raw_path:string|null; prepared_path:string|null; raw_filename:string|null; prepared_filename:string|null; status:'briefing'|'script_review'|'ready_to_record'|'awaiting_recording'|'uploaded'|'reviewed'|'published'; created_by:string; reviewed_by:string|null; word_timings:Json|null; review_note:string|null; reviewed_at:string|null; published_at:string|null; updated_at:string }
export type ExamPreparationTables = {
 sitov_exam_upload_tickets:Table<{path:string;student_id:string;kind:'speaking'|'photo';created_at:string;simulation_run_id:string|null},'path'|'student_id'|'kind'>
 sitov_exam_profiles:Table<{student_id:string;profile_id:string;updated_at:string},'student_id'>
 sitov_exam_teacher_assignments:Table<{student_id:string;teacher_id:string;response_days:number;assigned_by:string;updated_at:string},'student_id'|'teacher_id'|'assigned_by'>
 sitov_exam_attempts:Table<ExamAttemptRow,'student_id'|'task_id'|'task_version'|'unit_id'|'answer'|'mode'|'request_id'>
 sitov_exam_hints:Table<{student_id:string;task_id:string;task_version:number;created_at:string},'student_id'|'task_id'|'task_version'>
 sitov_exam_submissions:Table<ExamSubmissionRow,'student_id'|'task_id'|'task_version'|'unit_id'|'kind'>
 sitov_exam_feedback:Table<ExamFeedbackRow,'submission_id'|'teacher_id'|'text_content'|'strengths'|'revision'|'rating'>
 sitov_exam_unlocks:Table<{student_id:string;module_id:string;kind:'teacher'|'fallback';reason:string;created_by:string;created_at:string},'student_id'|'module_id'|'kind'|'reason'|'created_by'>
 sitov_exam_audio_productions:Table<ExamProductionRow,'audio_id'|'script_hash'|'created_by'>
}
