import type { Json } from './database.types'
type Table<Row, Required extends keyof Row> = { Row: Row; Insert: Pick<Row, Required> & Partial<Row>; Update: Partial<Row>; Relationships: [] }
export type SimulationRunRow = {
 id:string;student_id:string;level:string;provider:string;mode:'practice'|'exam';status:'active'|'completed';
 started_at:string;expires_at:string;completed_at:string|null;revision:number;generation:number;start_request_id:string;start_request_hash:string;server_snapshot:Json
}
export type ExamSimulationTables = {
 sitov_simulation_feature_grants:Table<{student_id:string;granted_by:string;granted_at:string},'student_id'|'granted_by'>
 sitov_simulation_learning_state:Table<{student_id:string;generation:number;reset_pending:string|null},'student_id'>
 sitov_simulation_level_grants:Table<{student_id:string;level:string;granted_by:string;granted_at:string},'student_id'|'level'|'granted_by'>
 sitov_simulation_runs:Table<SimulationRunRow,'id'|'student_id'|'level'|'provider'|'mode'|'status'|'started_at'|'expires_at'|'start_request_id'|'start_request_hash'|'server_snapshot'>
 sitov_simulation_receipts:Table<{student_id:string;request_id:string;run_id:string;kind:'answer'|'finish'|'review';payload_hash:string;created_at:string},'student_id'|'request_id'|'run_id'|'kind'|'payload_hash'>
}
export type ExamSimulationFunctions = {
 sitov_begin_simulation_reset:{Args:{p_student_id:string;p_staff_id:string;p_request_id:string};Returns:Json}
 sitov_finish_simulation_reset:{Args:{p_job_id:string;p_staff_id:string};Returns:boolean}
 sitov_store_simulation_change:{Args:{p_run_id:string;p_student_id:string;p_revision:number;p_snapshot:Json;p_request_id:string;p_kind:string;p_payload_hash:string};Returns:Json}
}
