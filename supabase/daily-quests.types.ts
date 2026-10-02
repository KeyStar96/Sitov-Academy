import type { Database, Json } from './database.types'

type QuestRow = {
  id: string; template_key: string; level: Database['public']['Enums']['cefr_code']; version: number;
  category: string; fallback_word_de: string; fallback_article: string; content: Json;
  is_active: boolean; created_at: string; updated_at: string;
}
type AssignmentRow = {
  id: string; auth_user_id: string; quest_date: string; template_id: string | null; snapshot: Json;
  status: string; completed_step_ids: string[]; created_at: string;
  completed_at: string | null; skipped_at: string | null;
}
/** SQL grants still control writes; these types describe the public catalog. */
export type DailyQuestTables = {
  daily_quests: {
    Row: QuestRow;
    Insert: Pick<QuestRow, 'template_key' | 'level' | 'category' | 'content'> & Partial<Omit<QuestRow, 'template_key' | 'level' | 'category' | 'content'>>;
    Update: Partial<QuestRow>;
    Relationships: [{ foreignKeyName: 'daily_quests_level_fkey'; columns: ['level']; isOneToOne: false; referencedRelation: 'cefr_levels'; referencedColumns: ['code'] }];
  };
  daily_quest_assignments: {
    Row: AssignmentRow;
    Insert: Pick<AssignmentRow, 'auth_user_id' | 'quest_date' | 'snapshot'> & Partial<Omit<AssignmentRow, 'auth_user_id' | 'quest_date' | 'snapshot'>>;
    Update: Partial<AssignmentRow>;
    Relationships: [
      { foreignKeyName: 'daily_quest_assignments_auth_user_id_fkey'; columns: ['auth_user_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
      { foreignKeyName: 'daily_quest_assignments_template_id_fkey'; columns: ['template_id']; isOneToOne: false; referencedRelation: 'daily_quests'; referencedColumns: ['id'] }
    ];
  };
}
