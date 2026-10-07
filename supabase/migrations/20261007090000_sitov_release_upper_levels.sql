-- Sitov Academy: B2.1, B2.2, C1.1 and C1.2 are released to learners (structure: migration 85).
-- A level is now visible, grantable and usable like A1.1 … B1.2: the level rows become active and
-- every student level list of the access functions accepts them. Content is not part of this
-- migration; trainers without content show their empty state.
-- C1.1 and C1.2 have no verb trainer (no new verbs on C1): the verb functions accept B2.1 and
-- B2.2 only. There the trainer repeats every verb up to B1.2; the stored coarse contexts B2 and
-- C1 keep their explicit staff grant.
UPDATE public.learning_levels SET is_active=true WHERE code IN('B2.1','B2.2','C1.1','C1.2') AND NOT is_active;

-- Function-only changes: each definition keeps its owner, privileges and attributes. A definition
-- that carries neither the released nor the extended list has drifted and stops the migration.
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
  IF to_regprocedure(target.signature) IS NULL THEN RAISE EXCEPTION 'sitov_level_release_function_missing: %',target.signature; END IF;
  definition:=pg_get_functiondef(to_regprocedure(target.signature));
  IF position(target.extended IN definition)=0 THEN
   IF position(target.released IN definition)=0 THEN RAISE EXCEPTION 'sitov_level_release_contract_changed: %',target.signature; END IF;
   EXECUTE replace(definition,target.released,target.extended);
  END IF;
 END LOOP;
END $patch$;

NOTIFY pgrst,'reload schema';
