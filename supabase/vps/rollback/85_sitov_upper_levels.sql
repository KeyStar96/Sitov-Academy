-- Remove the unreleased levels B2.1, B2.2, C1.1 and C1.2 again. Content that already uses one
-- of them blocks the rollback through its foreign key: archive or delete that content first.
DO $patch$
DECLARE definition text;
 released constant text:=$old$NOT IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2')$old$;
 extended constant text:=$new$NOT IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2','C1.1','C1.2')$new$;
BEGIN
 SELECT pg_get_functiondef('path_private.valid_seed_shape(jsonb)'::regprocedure) INTO definition;
 IF position(extended IN definition)>0 THEN EXECUTE replace(definition,extended,released); END IF;
END $patch$;

DELETE FROM public.learning_levels WHERE code IN('B2.1','B2.2','C1.1','C1.2');
UPDATE public.learning_levels SET sort_order=7 WHERE code='B2' AND sort_order=9;
UPDATE public.learning_levels SET sort_order=8 WHERE code='C1' AND sort_order=12;

NOTIFY pgrst,'reload schema';
