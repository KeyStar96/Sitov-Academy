#!/usr/bin/env python3
"""Read-only Phase 4 query plans on the VPS; output contains no learner UUIDs."""
import re, subprocess
DB='supabase-db-eknmzxvqilojjicinatnllbt'
queries={
 'due_session': "SELECT * FROM public.vocabulary_direction_progress WHERE auth_user_id=auth.uid() AND next_review_date<=now() AND box_number<7 ORDER BY id LIMIT 500",
 'assessment_progress': "SELECT card_id,box_number,direction,next_review_date FROM public.vocabulary_direction_progress WHERE auth_user_id=auth.uid() ORDER BY id LIMIT 500",
 'learned_directions': "SELECT card_id,direction FROM public.vocabulary_direction_progress WHERE auth_user_id=auth.uid() AND box_number=7",
 'session_cursor': "SELECT last_card_id FROM public.vocabulary_learning_state WHERE auth_user_id=auth.uid()",
 'session_catalog': "SELECT v.*, row_to_json(u) AS unit, (SELECT json_agg(t) FROM public.vocabulary_translations t WHERE t.card_id=v.id) AS translations FROM public.learning_vocabulary_cards v JOIN public.learning_units u ON u.id=v.unit_id WHERE u.level='A1.1' ORDER BY v.id LIMIT 500",
}
# Choose the learner with most persisted directions, without printing identity.
setup="""BEGIN READ ONLY;
DO $$ BEGIN PERFORM set_config('request.jwt.claim.sub',coalesce((SELECT auth_user_id::text FROM public.vocabulary_direction_progress GROUP BY auth_user_id ORDER BY count(*) DESC LIMIT 1),'00000000-0000-4000-8000-000000000001'),true); END $$;
SET LOCAL ROLE authenticated;
SET LOCAL statement_timeout='20s';
"""
for name,query in queries.items():
 result=subprocess.run(['docker','exec','-i',DB,'psql','-X','-U','supabase_admin','-d','postgres','-At','-v','ON_ERROR_STOP=1'],input=setup+'EXPLAIN (ANALYZE, BUFFERS) '+query+';\nROLLBACK;',text=True,capture_output=True,check=True)
 print('## '+name+'\n'+re.sub(r'[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}','[learner-id]',result.stdout,flags=re.I))
