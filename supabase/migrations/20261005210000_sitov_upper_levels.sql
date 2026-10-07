-- Sitov Academy: the fine-grained levels B2.1, B2.2, C1.1 and C1.2 exist as structure only.
-- They are inactive: no learner sees or receives them (student access keeps its own level
-- lists), no next-level, checkpoint, carry-over or daily-quest rule considers them. Staff can
-- prepare content; the learning path import accepts their seeds. Releasing a level later means
-- is_active=true here plus the access lists (lib/access/levels.ts and the student allowlists).
INSERT INTO public.cefr_levels(code) VALUES('B2'),('C1') ON CONFLICT DO NOTHING;

-- The coarse verb contexts B2 and C1 stay behind their sublevels: … B1.2, B2.1, B2.2, B2, C1.1, C1.2, C1, C2.
-- Their order relative to every existing level is unchanged. sort_order is unique, so the
-- positions are freed from the top down; production also carries the coarse level C2 at 9.
UPDATE public.learning_levels SET sort_order=13 WHERE code='C2' AND sort_order=9;
UPDATE public.learning_levels SET sort_order=12 WHERE code='C1' AND sort_order=8;
UPDATE public.learning_levels SET sort_order=9 WHERE code='B2' AND sort_order=7;
INSERT INTO public.learning_levels(code,cefr_level,sort_order,is_active) VALUES
 ('B2.1','B2',7,false),('B2.2','B2',8,false),('C1.1','C1',10,false),('C1.2','C1',11,false)
ON CONFLICT(code) DO NOTHING;

-- The path import validated a fixed level list (migration 44). Function-only change.
DO $patch$
DECLARE definition text;
 released constant text:=$old$NOT IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2')$old$;
 extended constant text:=$new$NOT IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2','C1.1','C1.2')$new$;
BEGIN
 SELECT pg_get_functiondef('path_private.valid_seed_shape(jsonb)'::regprocedure) INTO definition;
 IF position(extended IN definition)=0 THEN
  IF position(released IN definition)=0 THEN RAISE EXCEPTION 'sitov_path_seed_level_contract_changed'; END IF;
  EXECUTE replace(definition,released,extended);
 END IF;
END $patch$;

NOTIFY pgrst,'reload schema';
