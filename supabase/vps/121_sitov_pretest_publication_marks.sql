-- Sitov Academy: remember a verified pretest publication until its inputs change.
-- current_pretest() ran the complete publication proof (definition hash, authoring
-- check, every question audio object and its timings, reference recording) for
-- each text of every catalogue, release and unit request: about 75 ms per text on
-- the live data, seconds per page. Definitions, approvals and audio proofs are
-- immutable; only the reading text and the stored audio objects can change later.
-- A mark records "publication_ready() held and none of those rows changed since".
-- Without a mark the complete proof still decides, exactly as before.
-- A later migration that replaces one of the proof functions must clear the marks.
CREATE TABLE IF NOT EXISTS sitov_pronunciation_private.sitov_publication_marks(
 definition_id uuid PRIMARY KEY REFERENCES sitov_pronunciation_private.pretest_definitions(id) ON DELETE CASCADE,
 verified_at timestamptz NOT NULL DEFAULT clock_timestamp());
ALTER TABLE sitov_pronunciation_private.sitov_publication_marks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sitov_pronunciation_private.sitov_publication_marks FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX IF NOT EXISTS sitov_pretest_question_audio_proofs_path ON sitov_pronunciation_private.pretest_question_audio_proofs(path);
CREATE INDEX IF NOT EXISTS sitov_pretest_approvals_reference ON sitov_pronunciation_private.pretest_approvals(reference_bucket,reference_path);

-- Activation is only possible through guard_definition(), which has just run the
-- complete proof for the new row; deactivation ends the mark.
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.sitov_mark_publication() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NEW.active THEN
  INSERT INTO sitov_pronunciation_private.sitov_publication_marks(definition_id) VALUES(NEW.id) ON CONFLICT DO NOTHING;
 ELSE
  DELETE FROM sitov_pronunciation_private.sitov_publication_marks WHERE definition_id=NEW.id;
 END IF;
 RETURN NULL;END $$;
DROP TRIGGER IF EXISTS sitov_publication_mark ON sitov_pronunciation_private.pretest_definitions;
CREATE TRIGGER sitov_publication_mark AFTER INSERT OR UPDATE ON sitov_pronunciation_private.pretest_definitions
 FOR EACH ROW EXECUTE FUNCTION sitov_pronunciation_private.sitov_mark_publication();

-- Any change or removal of a referenced audio object or of the reading text
-- returns the affected definitions to the complete proof.
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.sitov_unmark_publication_audio() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 DELETE FROM sitov_pronunciation_private.sitov_publication_marks m WHERE m.definition_id IN(
  SELECT p.definition_id FROM sitov_pronunciation_private.pretest_question_audio_proofs p WHERE OLD.bucket_id='audio_cache' AND p.path=OLD.name
  UNION ALL SELECT a.definition_id FROM sitov_pronunciation_private.pretest_approvals a WHERE a.reference_bucket=OLD.bucket_id AND a.reference_path=OLD.name);
 RETURN NULL;END $$;
DROP TRIGGER IF EXISTS sitov_publication_unmark ON storage.objects;
CREATE TRIGGER sitov_publication_unmark AFTER UPDATE OR DELETE ON storage.objects
 FOR EACH ROW EXECUTE FUNCTION sitov_pronunciation_private.sitov_unmark_publication_audio();
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.sitov_unmark_publication_text() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 DELETE FROM sitov_pronunciation_private.sitov_publication_marks m WHERE m.definition_id IN(
  SELECT d.id FROM sitov_pronunciation_private.pretest_definitions d WHERE d.text_id=OLD.id);
 RETURN NULL;END $$;
DROP TRIGGER IF EXISTS sitov_publication_unmark ON public.learning_reading_texts;
CREATE TRIGGER sitov_publication_unmark AFTER UPDATE OR DELETE ON public.learning_reading_texts
 FOR EACH ROW EXECUTE FUNCTION sitov_pronunciation_private.sitov_unmark_publication_text();

-- Runs the complete proof for active definitions without a mark, for example
-- after reviewed audio was imported again. The proof holds the rows it reads
-- FOR SHARE, so a concurrent audio change waits and then removes the new mark.
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.sitov_mark_publications() RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE d sitov_pronunciation_private.pretest_definitions;marked integer:=0;BEGIN
 FOR d IN SELECT x.* FROM sitov_pronunciation_private.pretest_definitions x WHERE x.active
  AND NOT EXISTS(SELECT 1 FROM sitov_pronunciation_private.sitov_publication_marks m WHERE m.definition_id=x.id) ORDER BY x.id LOOP
  IF sitov_pronunciation_private.publication_ready(d.id,d.text_id,d.text_version,d.test_version,d.definition) THEN
   INSERT INTO sitov_pronunciation_private.sitov_publication_marks(definition_id) VALUES(d.id) ON CONFLICT DO NOTHING;
   marked:=marked+1;
  END IF;
 END LOOP;
 RETURN marked;END $$;
REVOKE ALL ON FUNCTION sitov_pronunciation_private.sitov_mark_publication(),sitov_pronunciation_private.sitov_unmark_publication_audio(),
 sitov_pronunciation_private.sitov_unmark_publication_text(),sitov_pronunciation_private.sitov_mark_publications() FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION sitov_pronunciation_private.current_pretest(p_text uuid) RETURNS sitov_pronunciation_private.pretest_definitions LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT d FROM sitov_pronunciation_private.pretest_definitions d JOIN public.learning_reading_texts r ON r.id=d.text_id WHERE d.text_id=p_text AND d.active AND d.text_version=sitov_pronunciation_private.pretest_hash(r.sentence_de)
 AND (EXISTS(SELECT 1 FROM sitov_pronunciation_private.sitov_publication_marks m WHERE m.definition_id=d.id)
  OR sitov_pronunciation_private.publication_ready(d.id,d.text_id,d.text_version,d.test_version,d.definition)) $$;

-- Start from a clean state on every application: nothing is trusted that the
-- current functions have not proved.
DELETE FROM sitov_pronunciation_private.sitov_publication_marks;
SELECT sitov_pronunciation_private.sitov_mark_publications();
NOTIFY pgrst,'reload schema';
