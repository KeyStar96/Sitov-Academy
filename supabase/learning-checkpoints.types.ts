import type { Json } from './database.types'
type CheckpointRow = { auth_user_id: string; kind: string; level: string; state: Json; revision: number; updated_at: string }
export type LearningCheckpointTables = {
  sitov_learning_checkpoints: {
    Row: CheckpointRow;
    Insert: Pick<CheckpointRow, 'auth_user_id' | 'kind' | 'level'> & Partial<Omit<CheckpointRow, 'auth_user_id' | 'kind' | 'level'>>;
    Update: Partial<CheckpointRow>;
    Relationships: [
      { foreignKeyName: 'sitov_learning_checkpoints_auth_user_id_fkey'; columns: ['auth_user_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
      { foreignKeyName: 'sitov_learning_checkpoints_level_fkey'; columns: ['level']; isOneToOne: false; referencedRelation: 'learning_levels'; referencedColumns: ['code'] }
    ];
  };
}
