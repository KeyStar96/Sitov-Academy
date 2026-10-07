-- Take B2.1, B2.2, C1.1 and C1.2 back from learners: the levels become inactive again and the
-- access functions return to the lists of A1.1 … B1.2. Stored grants, content and progress stay.
DO $patch$
DECLARE
 target record; definition text;
 six constant text:=$l$'A1.1','A1.2','A2.1','A2.2','B1.1','B1.2')$l$;
 ten constant text:=$l$'A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2','C1.1','C1.2')$l$;
 verb_six constant text:=$l$'A1.1','A1.2','A2.1','A2.2','B1.1','B1.2') AND EXISTS(SELECT 1 FROM public.student_level_access$l$;
 verb_eight constant text:=$l$'A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2') AND EXISTS(SELECT 1 FROM public.student_level_access$l$;
 coarse constant text:=$l$'B1.1','B1.2','B2','C1')$l$;
 coarse_extended constant text:=$l$'B1.1','B1.2','B2.1','B2.2','B2','C1')$l$;
BEGIN
 FOR target IN SELECT * FROM (VALUES
  ('trainer_access_private.allowed(text,text)',six,ten),
  ('sitov_verb_private.media_allowed(text)',six,ten),
  ('sitov_pronunciation_private.readiness(text,uuid)',six,ten),
  ('sitov_pronunciation_private.set_access(uuid,text,text)',six,ten),
  ('public.sitov_import_vocabulary_seed(jsonb,boolean)',six,ten),
  ('sitov_verb_private.level_allowed(uuid,text)',verb_six,verb_eight),
  ('sitov_verb_private.level_allowed(uuid,text)',coarse,coarse_extended),
  ('sitov_verb_private.tense_allowed(text,text,text)',coarse,coarse_extended),
  ('public.get_learning_progress(uuid,text,integer)',coarse,coarse_extended)
 ) AS patch(signature,released,extended) LOOP
  IF to_regprocedure(target.signature) IS NULL THEN CONTINUE; END IF;
  definition:=pg_get_functiondef(to_regprocedure(target.signature));
  IF position(target.extended IN definition)>0 THEN EXECUTE replace(definition,target.extended,target.released); END IF;
 END LOOP;
END $patch$;

UPDATE public.learning_levels SET is_active=false WHERE code IN('B2.1','B2.2','C1.1','C1.2') AND is_active;

NOTIFY pgrst,'reload schema';
