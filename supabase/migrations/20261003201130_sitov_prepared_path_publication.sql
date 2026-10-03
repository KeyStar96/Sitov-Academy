-- Apply after 20261003195521. Both staff and service seed imports use this
-- reviewed inner catalog writer. No curriculum, IDs or progress are rewritten.
DO $path_publication$
DECLARE definition text; before_text text; after_text text;
BEGIN
 definition := pg_get_functiondef('path_private.import_path_catalog(jsonb,uuid)'::regprocedure);
 IF strpos(definition,'-- sitov-prepared-path-publication-v1')=0 THEN
  before_text := $before$ RETURN jsonb_build_object('unit_id',unit,'node_count',node_count,'exercise_count',exercise_count);$before$;
  after_text := $after$ -- sitov-prepared-path-publication-v1
 -- Public wrappers authorize staff/the actual service role before this helper.
 -- Verify after existing shape/quality/pool validation and before commit; the
 -- wrapper exception block rolls back the entire import on an audio miss.
 -- ExerciseClient currently plays only fill-in-blank and multiple-choice.
 -- Include retained old rows too: its legacy query does not filter path flags.
 FOR exercise IN SELECT to_jsonb(e) FROM public.learning_exercises e
  WHERE e.unit_id=unit AND e.type IN('fill_in_blank','multiple_choice') LOOP
  PERFORM learning_private.sitov_require_prepared_learning_audio('exercises',exercise,'[]'::jsonb,unit);
 END LOOP;
 RETURN jsonb_build_object('unit_id',unit,'node_count',node_count,'exercise_count',exercise_count);$after$;
  IF strpos(definition,before_text)=0 THEN
   RAISE EXCEPTION 'sitov_audio_path_publication_source_drift' USING ERRCODE='23514';
  END IF;
  EXECUTE replace(definition,before_text,after_text);
 END IF;

 -- Keep the installed path error allow-list, shape and all existing domain
 -- codes. Add one explicit, safe operator response shared by both RPCs.
 definition := pg_get_functiondef('path_private.error(text,text)'::regprocedure);
 IF strpos(definition,'-- sitov-prepared-path-error-v1')=0 THEN
  before_text := $before$ SELECT jsonb_build_object('error',CASE WHEN p_message=ANY($before$;
  after_text := $after$ -- sitov-prepared-path-error-v1
 SELECT CASE WHEN p_message='prepared_audio_required' THEN jsonb_build_object(
  'error','prepared_audio_required','sqlstate',p_state,
  'message','Prepare the German audio locally and import the verified recordings before retrying the seed import.')
 ELSE jsonb_build_object('error',CASE WHEN p_message=ANY($after$;
  IF strpos(definition,before_text)=0 THEN
   RAISE EXCEPTION 'sitov_audio_path_error_source_drift' USING ERRCODE='23514';
  END IF;
  definition := replace(definition,before_text,after_text);
  before_text := $before$ END,'sqlstate',p_state);$before$;
  after_text := $after$ END,'sqlstate',p_state) END;$after$;
  IF strpos(definition,before_text)=0 THEN
   RAISE EXCEPTION 'sitov_audio_path_error_result_source_drift' USING ERRCODE='23514';
  END IF;
  EXECUTE replace(definition,before_text,after_text);
 END IF;
END $path_publication$;
