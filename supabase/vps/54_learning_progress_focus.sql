-- Master 4 / Phase 11.3: Lernanalyse je Lernmodus und Problemwörter-Training.
-- Backup with migrate-local.py before applying. Requires 38, 39, 42 and 52.
-- Rollback: supabase/vps/rollback/54_learning_progress_focus.sql.
--
-- Rein additiv (Live-Kundendaten): neue Tabellen, neue Funktionen und zwei neue
-- Trigger. Kein bestehender Datensatz wird geändert oder gelöscht; die
-- Rückschau der Problemwörter liest nur vorhandene Fehlerzähler und Quittungen.
--
--   * learning_media_views: welches Medium (Video, Link, Unterlage) jemand an
--     welchem Berliner Kalendertag geöffnet hat. Bisher wurde das nirgends
--     gespeichert; die Mediathek-Kurve beginnt deshalb mit dieser Migration.
--   * vocabulary_focus_words: Problemwörter je Person — Wörter, die im
--     Vokabeltrainer wiederholt falsch waren, und Nomen, deren Artikel
--     wiederholt fehlte oder falsch war. Sie werden getrennt von der Lernbox
--     gespeichert und mit eigener Wiederholungsleiter trainiert (0 → 1 Tag →
--     3 Tage → 7 Tage → gemeistert). Die Lernbox (Leitner) bleibt unberührt.
--   * vocabulary_private.focus_receipts: jede Antwort im Problemwörter-Training
--     (idempotent über request_id) — Grundlage der Kurve „Problemwörter".
--   * get_learning_progress(): eine Auswertung für Lehrkraft und Lernende
--     (nur die eigene Person) mit Tageswerten je Modus, Gesamtständen und
--     Problemwörtern. Keine erfundenen Rückblicke: jeder Tageswert stammt aus
--     einer gespeicherten Antwort, Aufnahme oder Medien-Öffnung.

-- ── 1. Angeschaute Medien ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.learning_media_views(
 auth_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 day date NOT NULL,
 kind text NOT NULL CHECK(kind IN('video','link','presentation')),
 object_id uuid NOT NULL,
 level text NOT NULL,
 first_viewed_at timestamptz NOT NULL DEFAULT now(),
 last_viewed_at timestamptz NOT NULL DEFAULT now(),
 view_count integer NOT NULL DEFAULT 1 CHECK(view_count>0),
 PRIMARY KEY(auth_user_id,day,kind,object_id));
CREATE INDEX IF NOT EXISTS learning_media_views_object_idx ON public.learning_media_views(auth_user_id,kind,object_id);
COMMENT ON TABLE public.learning_media_views IS 'One row per learner, Berlin day and opened media object (Phase 11.3). Written only by record_media_view(); media rows may be deleted later, the view history stays.';
ALTER TABLE public.learning_media_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS learning_media_views_read ON public.learning_media_views;
CREATE POLICY learning_media_views_read ON public.learning_media_views FOR SELECT TO authenticated
 USING(auth_user_id=(SELECT auth.uid()) OR (SELECT business_private.is_staff()));
REVOKE ALL ON public.learning_media_views FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.learning_media_views TO authenticated;
GRANT ALL ON public.learning_media_views TO service_role;

-- Dieselben Leserechte wie die Mediathek (RLS von learning_videos und
-- lms_presentation_asset). Lehrkräfte öffnen Medien zur Kontrolle: nicht zählen.
CREATE OR REPLACE FUNCTION public.record_media_view(p_kind text,p_object_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); v_kind text; v_level text;
BEGIN
 IF actor IS NULL THEN RETURN jsonb_build_object('error','not_authenticated','message','Authentication is required.'); END IF;
 IF p_kind IS NULL OR p_kind NOT IN('video','presentation') OR p_object_id IS NULL THEN
  RETURN jsonb_build_object('error','invalid_input','message','The request contains invalid data.'); END IF;
 IF coalesce(identity_private.current_profile_role(),'') IN('teacher','admin') THEN
  RETURN jsonb_build_object('success',true,'recorded',false); END IF;
 IF p_kind='video' THEN
  SELECT CASE WHEN v.storage_path IS NULL THEN 'link' ELSE 'video' END,u.level INTO v_kind,v_level
  FROM public.learning_videos v JOIN public.learning_units u ON u.id=v.unit_id
  WHERE v.id=p_object_id
   AND ((v.storage_path IS NOT NULL AND v.unit_id=ANY(media_private.published_video_unit_ids()))
    OR (v.storage_path IS NULL AND learning_private.unit_allowed(v.unit_id)))
   AND (v.folder_id IS NULL OR media_private.folder_allowed(v.folder_id));
 ELSE
  SELECT 'presentation',f.level INTO v_kind,v_level
  FROM public.lms_presentation_asset a JOIN public.lms_media_folder f ON f.folder_id=a.folder_id
  WHERE a.asset_id=p_object_id AND media_private.folder_allowed(a.folder_id);
 END IF;
 IF v_kind IS NULL THEN RETURN jsonb_build_object('error','not_found','message','Media not found.'); END IF;
 INSERT INTO public.learning_media_views AS m(auth_user_id,day,kind,object_id,level)
 VALUES(actor,(now() AT TIME ZONE 'Europe/Berlin')::date,v_kind,p_object_id,v_level)
 ON CONFLICT(auth_user_id,day,kind,object_id) DO UPDATE SET view_count=m.view_count+1,last_viewed_at=now();
 RETURN jsonb_build_object('success',true,'recorded',true);
EXCEPTION WHEN OTHERS THEN
 RETURN jsonb_build_object('error','request_failed','message','The request could not be completed.','sqlstate',SQLSTATE);
END $$;
REVOKE ALL ON FUNCTION public.record_media_view(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_media_view(text,uuid) TO authenticated;

-- ── 2. Problemwörter ─────────────────────────────────────────────────────
-- status: watching = Fehler notiert, Schwelle noch nicht erreicht;
-- active = wird trainiert; mastered = viermal in Folge richtig über wachsende
-- Abstände; archived = Lernstand der Karte wurde zurückgesetzt (Archiv, R9).
CREATE TABLE IF NOT EXISTS public.vocabulary_focus_words(
 auth_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 card_id uuid NOT NULL REFERENCES public.learning_vocabulary_cards(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'watching' CHECK(status IN('watching','active','mastered','archived')),
 wrong_count integer NOT NULL DEFAULT 0 CHECK(wrong_count>=0),
 article_errors integer NOT NULL DEFAULT 0 CHECK(article_errors>=0),
 last_error_at timestamptz,
 flagged_at timestamptz,
 stage smallint NOT NULL DEFAULT 0 CHECK(stage BETWEEN 0 AND 4),
 due_at timestamptz,
 practice_count integer NOT NULL DEFAULT 0 CHECK(practice_count>=0),
 practice_correct integer NOT NULL DEFAULT 0 CHECK(practice_correct>=0),
 last_practiced_at timestamptz,
 mastered_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(auth_user_id,card_id));
CREATE INDEX IF NOT EXISTS vocabulary_focus_words_queue_idx ON public.vocabulary_focus_words(auth_user_id,status,due_at);
CREATE INDEX IF NOT EXISTS vocabulary_focus_words_card_idx ON public.vocabulary_focus_words(card_id);
COMMENT ON TABLE public.vocabulary_focus_words IS 'Problem words per learner (Phase 11.3): repeated wrong answers (>=3) or repeated article errors (>=2) in the vocabulary trainer. Separate spaced-repetition ladder; the Leitner box is not changed. Written only by database functions.';
ALTER TABLE public.vocabulary_focus_words ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vocabulary_focus_words_read ON public.vocabulary_focus_words;
CREATE POLICY vocabulary_focus_words_read ON public.vocabulary_focus_words FOR SELECT TO authenticated
 USING(auth_user_id=(SELECT auth.uid()) OR (SELECT business_private.is_staff()));
REVOKE ALL ON public.vocabulary_focus_words FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.vocabulary_focus_words TO authenticated;
GRANT ALL ON public.vocabulary_focus_words TO service_role;

CREATE TABLE IF NOT EXISTS vocabulary_private.focus_receipts(
 auth_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 card_id uuid NOT NULL REFERENCES public.learning_vocabulary_cards(id) ON DELETE CASCADE,
 format text NOT NULL CHECK(format IN('article','choice','build','type')),
 answer text NOT NULL CHECK(length(answer)<=400),
 is_correct boolean NOT NULL,
 response jsonb NOT NULL CHECK(jsonb_typeof(response)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(auth_user_id,request_id));
CREATE INDEX IF NOT EXISTS focus_receipts_recent_idx ON vocabulary_private.focus_receipts(auth_user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS focus_receipts_card_idx ON vocabulary_private.focus_receipts(card_id);
ALTER TABLE vocabulary_private.focus_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vocabulary_private.focus_receipts FROM PUBLIC,anon,authenticated;

-- Schwellen an einer Stelle: dieselbe Regel für Rückschau, Trigger und Anzeige.
CREATE OR REPLACE FUNCTION vocabulary_private.focus_threshold_reached(p_wrong integer,p_article integer)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(p_wrong,0)>=3 OR coalesce(p_article,0)>=2
$$;
REVOKE ALL ON FUNCTION vocabulary_private.focus_threshold_reached(integer,integer) FROM PUBLIC,anon,authenticated;

-- Jede falsche Antwort im Vokabeltrainer (Tippen, Selbsteinschätzung, Übertrag)
-- landet als Quittung in answer_receipts. Der Trigger zählt nur mit. Er darf
-- eine Antwort nie verhindern: jeder Fehler hier wird geschluckt und gemeldet.
CREATE OR REPLACE FUNCTION vocabulary_private.track_focus_word() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_card uuid; v_article integer; v_at timestamptz:=coalesce(NEW.created_at,now());
BEGIN
 IF coalesce(NEW.response->>'isCorrect','')<>'false' THEN RETURN NULL; END IF;
 SELECT p.card_id INTO v_card FROM public.vocabulary_direction_progress p WHERE p.id=NEW.progress_id AND p.auth_user_id=NEW.auth_user_id;
 IF v_card IS NULL THEN RETURN NULL; END IF;
 v_article:=CASE WHEN NEW.response->>'feedback' IN('article_missing','article_wrong') THEN 1 ELSE 0 END;
 INSERT INTO public.vocabulary_focus_words AS f(auth_user_id,card_id,wrong_count,article_errors,last_error_at)
 VALUES(NEW.auth_user_id,v_card,1,v_article,v_at)
 ON CONFLICT(auth_user_id,card_id) DO UPDATE SET
  -- Ein archiviertes Wort (Lernstand zurückgesetzt) beginnt neu zu zählen.
  wrong_count=CASE WHEN f.status='archived' THEN 1 ELSE f.wrong_count+1 END,
  article_errors=CASE WHEN f.status='archived' THEN excluded.article_errors ELSE f.article_errors+excluded.article_errors END,
  status=CASE WHEN f.status='archived' THEN 'watching' ELSE f.status END,
  flagged_at=CASE WHEN f.status='archived' THEN NULL ELSE f.flagged_at END,
  mastered_at=CASE WHEN f.status='archived' THEN NULL ELSE f.mastered_at END,
  stage=CASE WHEN f.status='archived' THEN 0 ELSE f.stage END,
  due_at=CASE WHEN f.status='archived' THEN NULL ELSE f.due_at END,
  last_error_at=greatest(f.last_error_at,excluded.last_error_at),updated_at=now();
 -- Schwelle erreicht, Rückfall eines gemeisterten Worts oder erneuter Fehler
 -- während des Trainings: zurück auf Stufe 0, sofort wieder fällig.
 UPDATE public.vocabulary_focus_words SET status='active',stage=0,due_at=v_at,
  flagged_at=CASE WHEN status='active' THEN flagged_at ELSE v_at END,updated_at=now()
 WHERE auth_user_id=NEW.auth_user_id AND card_id=v_card
  AND (status IN('active','mastered') OR vocabulary_private.focus_threshold_reached(wrong_count,article_errors));
 RETURN NULL;
EXCEPTION WHEN OTHERS THEN
 RAISE WARNING 'vocabulary_focus_tracking_failed %',SQLSTATE;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION vocabulary_private.track_focus_word() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS vocabulary_focus_track ON vocabulary_private.answer_receipts;
CREATE TRIGGER vocabulary_focus_track AFTER INSERT ON vocabulary_private.answer_receipts
 FOR EACH ROW EXECUTE FUNCTION vocabulary_private.track_focus_word();

-- Zurücksetzen (Lehrkraft, eigener Neustart, Lektion entfernen) löscht den
-- Lernstand der Karte. Das Problemwort wird archiviert, nicht gelöscht.
CREATE OR REPLACE FUNCTION vocabulary_private.archive_focus_words() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE public.vocabulary_focus_words f SET status='archived',due_at=NULL,updated_at=now()
 FROM (SELECT DISTINCT r.auth_user_id,r.card_id FROM removed r) gone
 WHERE f.auth_user_id=gone.auth_user_id AND f.card_id=gone.card_id AND f.status<>'archived'
  AND NOT EXISTS(SELECT 1 FROM public.vocabulary_direction_progress p WHERE p.auth_user_id=gone.auth_user_id AND p.card_id=gone.card_id);
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION vocabulary_private.archive_focus_words() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS vocabulary_focus_archive ON public.vocabulary_direction_progress;
CREATE TRIGGER vocabulary_focus_archive AFTER DELETE ON public.vocabulary_direction_progress
 REFERENCING OLD TABLE AS removed FOR EACH STATEMENT EXECUTE FUNCTION vocabulary_private.archive_focus_words();

-- Rückschau: vorhandene Fehlerzähler (lapses, beide Richtungen) und
-- Artikel-Rückmeldungen der Quittungen (seit Migration 30). Bereits in beiden
-- Richtungen gelernte Wörter werden nur notiert, nicht trainiert.
INSERT INTO public.vocabulary_focus_words(auth_user_id,card_id,status,wrong_count,article_errors,last_error_at,flagged_at,stage,due_at)
SELECT source.auth_user_id,source.card_id,
 CASE WHEN source.active THEN 'active' ELSE 'watching' END,source.wrong,source.article,source.last_error,
 CASE WHEN source.active THEN now() END,0,CASE WHEN source.active THEN now() END
FROM (
 SELECT c.auth_user_id,c.card_id,greatest(c.wrong,coalesce(a.errors,0)) wrong,coalesce(a.errors,0) article,
  coalesce(greatest(a.last_at,c.last_answered),a.last_at,c.last_answered) last_error,
  NOT (c.directions=2 AND c.learned) AND vocabulary_private.focus_threshold_reached(greatest(c.wrong,coalesce(a.errors,0)),coalesce(a.errors,0)) active
 FROM (SELECT p.auth_user_id,p.card_id,sum(p.lapses)::integer wrong,count(*) directions,bool_and(p.box_number=7) learned,max(p.last_answered_at) last_answered
  FROM public.vocabulary_direction_progress p GROUP BY p.auth_user_id,p.card_id) c
 LEFT JOIN (SELECT r.auth_user_id,p.card_id,count(*)::integer errors,max(r.created_at) last_at
  FROM vocabulary_private.answer_receipts r
  JOIN public.vocabulary_direction_progress p ON p.id=r.progress_id AND p.auth_user_id=r.auth_user_id
  WHERE r.response->>'feedback' IN('article_missing','article_wrong') GROUP BY r.auth_user_id,p.card_id) a
  ON a.auth_user_id=c.auth_user_id AND a.card_id=c.card_id
 WHERE c.wrong>0 OR coalesce(a.errors,0)>0
) source
WHERE EXISTS(SELECT 1 FROM public.profiles pr WHERE pr.id=source.auth_user_id)
ON CONFLICT DO NOTHING;

-- Musterlösung für das Problemwörter-Training: immer das Wort selbst (mit
-- Artikel), auch bei Satzkarten. Pluralformen wie im Vokabeltrainer.
CREATE OR REPLACE FUNCTION vocabulary_private.focus_answer_key(p_card_id uuid,OUT canonical text,OUT accepted text[])
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE card public.learning_vocabulary_cards; plural text;
BEGIN
 SELECT * INTO card FROM public.learning_vocabulary_cards WHERE id=p_card_id;
 canonical:=concat_ws(' ',nullif(nullif(card.article::text,'none'),''),btrim(card.word_de));
 accepted:=ARRAY[canonical];
 plural:=nullif(btrim(coalesce(card.plural,'')),'');
 IF card.article IS NOT NULL AND card.article::text<>'none' AND plural IS NOT NULL AND plural NOT IN('-','–','—') THEN
  accepted:=accepted||('die '||plural)||(canonical||' / die '||plural)||(canonical||', die '||plural);
 END IF;
END $$;
REVOKE ALL ON FUNCTION vocabulary_private.focus_answer_key(uuid) FROM PUBLIC,anon,authenticated;

-- Aufgabenformat je Stufe: vom Wiedererkennen über das Zusammensetzen zum
-- freien Schreiben. Artikel-Wörter üben den Artikel abwechselnd mit Schreiben.
CREATE OR REPLACE FUNCTION vocabulary_private.focus_format(p_stage integer,p_article_reason boolean,p_hard_reason boolean)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT (CASE WHEN p_article_reason AND p_hard_reason THEN ARRAY['article','choice','build','type']
  WHEN p_article_reason THEN ARRAY['article','type','article','type']
  ELSE ARRAY['choice','build','type','type'] END)[least(3,greatest(0,coalesce(p_stage,0)))+1]
$$;
REVOKE ALL ON FUNCTION vocabulary_private.focus_format(integer,boolean,boolean) FROM PUBLIC,anon,authenticated;

-- Die trainierbaren Problemwörter der angemeldeten Person: dieselben
-- Zugriffsregeln wie im Vokabeltrainer (Niveau, Modus, Lektionsauswahl) und
-- nur Karten, die noch in der eigenen Lernbox liegen.
CREATE OR REPLACE FUNCTION vocabulary_private.focus_scope(p_actor uuid,p_level text,p_allowed uuid[])
RETURNS TABLE(card_id uuid,status text,stage integer,due_at timestamptz,wrong_count integer,article_errors integer,
 mastered_at timestamptz,word text,article text,level text)
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT f.card_id,f.status,f.stage::integer,f.due_at,f.wrong_count,f.article_errors,f.mastered_at,btrim(c.word_de),c.article::text,u.level
 FROM public.vocabulary_focus_words f
 JOIN public.learning_vocabulary_cards c ON c.id=f.card_id
 JOIN public.learning_units u ON u.id=c.unit_id AND u.is_active AND u.trainer='vocabulary'
 WHERE f.auth_user_id=p_actor AND f.status IN('active','mastered') AND u.id=ANY(p_allowed)
  AND (p_level IS NULL OR u.level=p_level)
  AND EXISTS(SELECT 1 FROM public.vocabulary_direction_progress p WHERE p.auth_user_id=p_actor AND p.card_id=f.card_id)
$$;
REVOKE ALL ON FUNCTION vocabulary_private.focus_scope(uuid,text,uuid[]) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.get_vocabulary_focus(p_level text DEFAULT NULL,p_ui_language text DEFAULT 'en')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); allowed uuid[]; w record; items jsonb:='[]'; item jsonb; fmt text; noun boolean;
 article_reason boolean; hard_reason boolean; translation text; canonical text; options jsonb; letters text[]; tries integer;
 summary jsonb; words jsonb;
BEGIN
 IF actor IS NULL THEN RETURN jsonb_build_object('error','not_authenticated','message','Authentication is required.'); END IF;
 IF p_ui_language IS NULL OR p_ui_language NOT IN('en','ru','uk','tr') THEN
  RETURN jsonb_build_object('error','invalid_learning_language','message','Choose a learning language other than German.'); END IF;
 IF p_level IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.learning_levels WHERE code=p_level) THEN
  RETURN jsonb_build_object('error','not_found','message','Level not found.'); END IF;
 allowed:=learning_private.allowed_unit_ids();
 SELECT jsonb_build_object(
  'active',count(*) FILTER(WHERE s.status='active'),
  'due',count(*) FILTER(WHERE s.status='active' AND s.due_at<=now()),
  'mastered',count(*) FILTER(WHERE s.status='mastered'),
  'articleWords',count(*) FILTER(WHERE s.status='active' AND s.article_errors>=2 AND s.article IN('der','die','das')),
  'nextDueAt',min(s.due_at) FILTER(WHERE s.status='active' AND s.due_at>now()))
 INTO summary FROM vocabulary_private.focus_scope(actor,p_level,allowed) s;
 SELECT coalesce(jsonb_agg(jsonb_build_object('cardId',s.card_id,'word',s.word,'article',nullif(s.article,'none'),'level',s.level,
  'translation',vocabulary_private.card_translation(s.card_id,p_ui_language),'status',s.status,'stage',s.stage,'dueAt',s.due_at,
  'due',s.status='active' AND s.due_at<=now(),
  'wrongCount',s.wrong_count,'articleErrors',s.article_errors,'masteredAt',s.mastered_at,
  'reasons',to_jsonb(array_remove(ARRAY[
   CASE WHEN s.article_errors>=2 AND s.article IN('der','die','das') THEN 'article' END,
   CASE WHEN s.wrong_count>=3 OR NOT (s.article_errors>=2 AND s.article IN('der','die','das')) THEN 'hard' END],NULL)))
  ORDER BY s.status,s.due_at NULLS LAST,s.wrong_count DESC,s.word),'[]')
 INTO words FROM vocabulary_private.focus_scope(actor,p_level,allowed) s;

 FOR w IN SELECT * FROM vocabulary_private.focus_scope(actor,p_level,allowed) s
  WHERE s.status='active' AND s.due_at<=now() ORDER BY s.due_at,s.card_id LIMIT 12 LOOP
  translation:=nullif(btrim(coalesce(vocabulary_private.card_translation(w.card_id,p_ui_language),'')),'');
  CONTINUE WHEN translation IS NULL OR coalesce(w.word,'')='';
  noun:=coalesce(w.article IN('der','die','das'),false);
  article_reason:=noun AND w.article_errors>=2;
  hard_reason:=w.wrong_count>=3 OR NOT article_reason;
  fmt:=vocabulary_private.focus_format(w.stage,article_reason,hard_reason);
  IF fmt='article' AND NOT noun THEN fmt:='choice'; END IF;
  IF fmt='build' AND w.word!~'^[^[:space:]]{3,20}$' THEN fmt:='type'; END IF;
  options:=NULL; letters:=NULL;
  IF fmt='choice' THEN
   SELECT k.canonical INTO canonical FROM vocabulary_private.focus_answer_key(w.card_id) k;
   -- Drei Ablenker aus demselben Niveau, gleiche Wortart (Nomen mit Artikel oder nicht).
   SELECT jsonb_agg(value ORDER BY random()) INTO options FROM (
    SELECT canonical AS value
    UNION ALL
    (SELECT picked.value FROM (
     SELECT DISTINCT ON (lower(candidate.value)) candidate.value,candidate.r FROM (
      SELECT concat_ws(' ',nullif(c.article::text,'none'),btrim(c.word_de)) AS value,random() AS r
      FROM public.learning_vocabulary_cards c
      JOIN public.learning_units u ON u.id=c.unit_id AND u.is_active AND u.trainer='vocabulary'
      WHERE u.level=w.level AND u.id=ANY(allowed) AND c.id<>w.card_id
       AND lower(btrim(c.word_de))<>lower(w.word) AND coalesce(c.article::text IN('der','die','das'),false)=noun
       AND length(btrim(c.word_de)) BETWEEN 1 AND 60
      ORDER BY random() LIMIT 30) candidate
     WHERE lower(candidate.value)<>lower(canonical)
     ORDER BY lower(candidate.value),candidate.r) picked
    ORDER BY picked.r LIMIT 3)) choices;
   IF coalesce(jsonb_array_length(options),0)<4 THEN
    fmt:=CASE WHEN w.word~'^[^[:space:]]{3,20}$' THEN 'build' ELSE 'type' END; options:=NULL;
   END IF;
  END IF;
  IF fmt='build' THEN
   tries:=0;
   LOOP
    SELECT array_agg(ch ORDER BY random()) INTO letters FROM regexp_split_to_table(w.word,'') ch;
    tries:=tries+1;
    EXIT WHEN array_to_string(letters,'')<>w.word OR tries>=4;
   END LOOP;
  END IF;
  item:=jsonb_build_object('cardId',w.card_id,'format',fmt,'stage',w.stage,'level',w.level,'prompt',translation,'noun',noun,
   'reasons',to_jsonb(array_remove(ARRAY[CASE WHEN article_reason THEN 'article' END,CASE WHEN hard_reason THEN 'hard' END],NULL)));
  IF fmt='article' THEN item:=item||jsonb_build_object('word',w.word,'options',jsonb_build_array('der','die','das')); END IF;
  IF fmt='choice' THEN item:=item||jsonb_build_object('options',options); END IF;
  IF fmt='build' THEN item:=item||jsonb_build_object('letters',to_jsonb(letters),'article',CASE WHEN noun THEN w.article END); END IF;
  IF fmt='type' THEN item:=item||jsonb_build_object('firstLetter',left(w.word,1),'length',char_length(w.word)); END IF;
  items:=items||jsonb_build_array(item);
 END LOOP;
 RETURN jsonb_build_object('success',true,'level',p_level,'summary',summary,'words',words,'items',items);
EXCEPTION WHEN OTHERS THEN
 RETURN jsonb_build_object('error','request_failed','message','The request could not be completed.','sqlstate',SQLSTATE);
END $$;
REVOKE ALL ON FUNCTION public.get_vocabulary_focus(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_vocabulary_focus(text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_vocabulary_focus_answer(p_request_id uuid,p_card_id uuid,p_format text,p_answer text,p_ui_language text DEFAULT 'en')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); receipt vocabulary_private.focus_receipts; focus public.vocabulary_focus_words;
 card public.learning_vocabulary_cards; unit public.learning_units; key record; grade jsonb; feedback text;
 correct boolean; noun boolean; next_stage integer; next_status text; next_due timestamptz; response jsonb; answer text;
BEGIN
 IF actor IS NULL THEN RETURN jsonb_build_object('error','not_authenticated','message','Authentication is required.'); END IF;
 IF p_request_id IS NULL OR p_card_id IS NULL OR p_format IS NULL OR p_format NOT IN('article','choice','build','type') THEN
  RETURN jsonb_build_object('error','invalid_input','message','The request contains invalid data.'); END IF;
 IF p_ui_language IS NULL OR p_ui_language NOT IN('en','ru','uk','tr') THEN
  RETURN jsonb_build_object('error','invalid_learning_language','message','Choose a learning language other than German.'); END IF;
 answer:=btrim(coalesce(p_answer,''));
 IF answer='' OR length(answer)>400 THEN RETURN jsonb_build_object('error','answer_required','message','An answer is required.'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary-focus:'||actor::text,0));
 SELECT * INTO receipt FROM vocabulary_private.focus_receipts WHERE auth_user_id=actor AND request_id=p_request_id;
 IF FOUND THEN
  IF receipt.card_id<>p_card_id OR receipt.format<>p_format THEN
   RETURN jsonb_build_object('error','conflict','message','Reload and retry the request.'); END IF;
  RETURN receipt.response;
 END IF;
 SELECT * INTO focus FROM public.vocabulary_focus_words WHERE auth_user_id=actor AND card_id=p_card_id FOR UPDATE;
 IF NOT FOUND OR focus.status<>'active' THEN RETURN jsonb_build_object('error','not_found','message','This word is not in training.'); END IF;
 IF focus.due_at IS NULL OR focus.due_at>now() THEN RETURN jsonb_build_object('error','review_not_due','message','This review is not due yet.'); END IF;
 SELECT * INTO card FROM public.learning_vocabulary_cards WHERE id=p_card_id;
 SELECT * INTO unit FROM public.learning_units WHERE id=card.unit_id;
 IF NOT unit.is_active OR NOT learning_private.unit_allowed(unit.id) THEN
  RETURN jsonb_build_object('error','trainer_access_denied','message','The request is not authorized.'); END IF;
 SELECT k.canonical,k.accepted INTO key FROM vocabulary_private.focus_answer_key(card.id) k;
 noun:=card.article::text IN('der','die','das');
 IF p_format='article' THEN
  IF NOT noun THEN RETURN jsonb_build_object('error','invalid_input','message','The request contains invalid data.'); END IF;
  correct:=lower(answer)=card.article::text;
 ELSIF p_format='choice' THEN
  -- Auswahl: der angetippte Text; Groß-/Kleinschreibung entscheidet hier nicht.
  correct:=lower(learning_private.normalize_answer(answer))=lower(learning_private.normalize_answer(key.canonical));
 ELSIF p_format='build' THEN
  correct:=answer=btrim(card.word_de);
 ELSE
  grade:=learning_private.grade_answer(answer,key.accepted);
  PERFORM platform_private.require_rpc_success(grade);
  IF noun THEN feedback:=vocabulary_private.answer_article_feedback(answer,card.word_de,card.article::text,card.plural)::text; END IF;
  correct:=feedback IS NULL AND grade->>'status' IN('EXACT','SOFT_ERROR');
 END IF;
 IF correct THEN
  next_stage:=least(4,focus.stage+1);
  next_status:=CASE WHEN next_stage>=4 THEN 'mastered' ELSE 'active' END;
  next_due:=CASE WHEN next_stage>=4 THEN NULL ELSE vocabulary_private.review_day(CASE next_stage WHEN 1 THEN 1 WHEN 2 THEN 3 ELSE 7 END) END;
 ELSE
  -- Falsch: zurück auf Stufe 0 und in dieser Runde später noch einmal.
  next_stage:=0; next_status:='active'; next_due:=now();
 END IF;
 UPDATE public.vocabulary_focus_words SET stage=next_stage,status=next_status,due_at=next_due,
  mastered_at=CASE WHEN next_status='mastered' THEN now() ELSE mastered_at END,
  practice_count=practice_count+1,practice_correct=practice_correct+CASE WHEN correct THEN 1 ELSE 0 END,
  last_practiced_at=now(),updated_at=now()
 WHERE auth_user_id=actor AND card_id=card.id;
 response:=jsonb_build_object('success',true,'correct',correct,'format',p_format,'stage',next_stage,'status',next_status,'dueAt',next_due,
  'solution',jsonb_build_object('display',key.canonical,'word',btrim(card.word_de),'article',CASE WHEN noun THEN card.article::text END),
  'softError',CASE WHEN correct AND grade IS NOT NULL THEN grade->'reason' END,'feedback',feedback);
 INSERT INTO vocabulary_private.focus_receipts(auth_user_id,request_id,card_id,format,answer,is_correct,response)
 VALUES(actor,p_request_id,card.id,p_format,answer,correct,response);
 -- Training ist Lernzeit im Modus Vokabeln (Lerntage, Sitzungen, Lernanalyse).
 PERFORM learning_private.record_learning_event(actor,'vocabulary',unit.level,now());
 RETURN response;
EXCEPTION WHEN OTHERS THEN
 RETURN jsonb_build_object('error','request_failed','message','The request could not be completed.','sqlstate',SQLSTATE);
END $$;
REVOKE ALL ON FUNCTION public.submit_vocabulary_focus_answer(uuid,uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_vocabulary_focus_answer(uuid,uuid,text,text,text) TO authenticated;

-- ── 3. Lernanalyse je Modus ──────────────────────────────────────────────
-- Lehrkräfte lesen jede lernende Person, Lernende nur sich selbst
-- (p_student_id NULL). Tageswerte nach Berliner Kalendertag; der Zeitraum
-- umfasst 7 bis 90 Tage bis einschließlich heute.
CREATE OR REPLACE FUNCTION public.get_learning_progress(p_student_id uuid DEFAULT NULL,p_level text DEFAULT NULL,p_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); learner uuid; staff boolean; today date:=(now() AT TIME ZONE 'Europe/Berlin')::date;
 first_day date; range_start timestamptz; range_end timestamptz; scope text[];
 daily jsonb; vocabulary jsonb; focus jsonb; path jsonb; pronunciation jsonb; media jsonb;
BEGIN
 IF actor IS NULL THEN RETURN jsonb_build_object('error','not_authenticated','message','Authentication is required.'); END IF;
 staff:=business_private.is_staff();
 learner:=coalesce(p_student_id,actor);
 IF learner<>actor AND NOT staff THEN RETURN jsonb_build_object('error','not_authorized','message','Staff access required.'); END IF;
 IF p_days IS NULL OR p_days NOT BETWEEN 7 AND 90 THEN RETURN jsonb_build_object('error','invalid_input','message','Choose 7 to 90 days.'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=learner AND role='student') THEN
  RETURN jsonb_build_object('error','not_found','message','Student not found.'); END IF;
 IF p_level IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.learning_levels WHERE code=p_level) THEN
  RETURN jsonb_build_object('error','not_found','message','Level not found.'); END IF;
 first_day:=today-(p_days-1);
 range_start:=first_day::timestamp AT TIME ZONE 'Europe/Berlin';
 range_end:=(today+1)::timestamp AT TIME ZONE 'Europe/Berlin';
 -- Gesamtstände: gewähltes Niveau, sonst alle freigeschalteten Niveaus.
 scope:=CASE WHEN p_level IS NOT NULL THEN ARRAY[p_level]
  ELSE coalesce((SELECT array_agg(a.level) FROM public.student_level_access a WHERE a.auth_user_id=learner),ARRAY[]::text[]) END;

 WITH days AS (SELECT first_day+n AS day FROM generate_series(0,p_days-1) n),
 vocab AS (
  SELECT (r.created_at AT TIME ZONE 'Europe/Berlin')::date AS day,count(*) answers,
   count(*) FILTER(WHERE r.response->>'isCorrect'='true') correct
  FROM vocabulary_private.answer_receipts r
  JOIN public.vocabulary_direction_progress p ON p.id=r.progress_id AND p.auth_user_id=r.auth_user_id
  JOIN public.learning_vocabulary_cards c ON c.id=p.card_id JOIN public.learning_units u ON u.id=c.unit_id
  WHERE r.auth_user_id=learner AND r.created_at>=range_start AND r.created_at<range_end AND (p_level IS NULL OR u.level=p_level)
  GROUP BY 1),
 -- Ein Wort gilt als gelernt, sobald die zweite Richtung Phase 7 erreicht.
 -- Phase 7 ist endgültig; ohne Quittung (Altbestand) bleibt der Tag unbekannt.
 learned_directions AS (
  SELECT r.progress_id,min(r.created_at) learned_at FROM vocabulary_private.answer_receipts r
  WHERE r.auth_user_id=learner AND r.response->>'becameLearned'='true' GROUP BY r.progress_id),
 learned AS (
  SELECT (max(ld.learned_at) AT TIME ZONE 'Europe/Berlin')::date AS day
  FROM public.vocabulary_direction_progress p JOIN public.learning_vocabulary_cards c ON c.id=p.card_id
  JOIN public.learning_units u ON u.id=c.unit_id LEFT JOIN learned_directions ld ON ld.progress_id=p.id
  WHERE p.auth_user_id=learner AND p.box_number=7 AND (p_level IS NULL OR u.level=p_level)
  GROUP BY p.card_id HAVING count(*)=2 AND bool_and(ld.learned_at IS NOT NULL)),
 learned_days AS (SELECT day,count(*) learned FROM learned WHERE day>=first_day GROUP BY day),
 focus_days AS (
  SELECT (f.created_at AT TIME ZONE 'Europe/Berlin')::date AS day,count(*) answers,count(*) FILTER(WHERE f.is_correct) correct
  FROM vocabulary_private.focus_receipts f JOIN public.learning_vocabulary_cards c ON c.id=f.card_id JOIN public.learning_units u ON u.id=c.unit_id
  WHERE f.auth_user_id=learner AND f.created_at>=range_start AND f.created_at<range_end AND (p_level IS NULL OR u.level=p_level)
  GROUP BY 1),
 path_events AS (
  SELECT (receipt.created_at AT TIME ZONE 'Europe/Berlin')::date AS day,receipt.response->'grade'->>'status' IN('EXACT','SOFT_ERROR') correct
  FROM path_private.answer_receipts receipt JOIN public.path_practice_runs r ON r.id=receipt.run_id
  JOIN public.path_nodes n ON n.id=r.node_id JOIN public.learning_units u ON u.id=n.unit_id
  WHERE r.auth_user_id=learner AND receipt.created_at>=range_start AND receipt.created_at<range_end
   AND receipt.response->'grade'->>'status' IN('EXACT','SOFT_ERROR','INCORRECT') AND (p_level IS NULL OR u.level=p_level)
  UNION ALL
  SELECT (ans.answered_at AT TIME ZONE 'Europe/Berlin')::date,ans.result->>'status' IN('EXACT','SOFT_ERROR')
  FROM public.path_test_answers ans JOIN public.path_test_attempts a ON a.id=ans.attempt_id
  JOIN public.path_nodes n ON n.id=a.node_id JOIN public.learning_units u ON u.id=n.unit_id
  WHERE a.auth_user_id=learner AND ans.answered_at>=range_start AND ans.answered_at<range_end
   AND ans.result->>'status' IN('EXACT','SOFT_ERROR','INCORRECT') AND (p_level IS NULL OR u.level=p_level)),
 path_days AS (SELECT day,count(*) answers,count(*) FILTER(WHERE correct) correct FROM path_events GROUP BY day),
 station_days AS (
  SELECT (pr.completed_at AT TIME ZONE 'Europe/Berlin')::date AS day,count(*) stations
  FROM public.path_node_progress pr JOIN public.path_nodes n ON n.id=pr.node_id JOIN public.learning_units u ON u.id=n.unit_id
  WHERE pr.auth_user_id=learner AND pr.is_active AND pr.status='completed' AND pr.completed_at>=range_start AND pr.completed_at<range_end
   AND (p_level IS NULL OR u.level=p_level)
  GROUP BY 1),
 pron_events AS (
  SELECT (s.created_at AT TIME ZONE 'Europe/Berlin')::date AS day,true own
  FROM public.submissions s WHERE s.auth_user_id=learner AND s.type='audio'
   AND s.created_at>=range_start AND s.created_at<range_end AND (p_level IS NULL OR s.level=p_level)
  UNION ALL
  SELECT (m.created_at AT TIME ZONE 'Europe/Berlin')::date,m.sender_role='student'
  FROM public.pronunciation_messages m JOIN public.submissions s ON s.id=m.submission_id
  WHERE s.auth_user_id=learner AND m.created_at>=range_start AND m.created_at<range_end AND (p_level IS NULL OR s.level=p_level)
   AND ((m.sender_role='student' AND m.sender_id=learner AND m.audio_path IS NOT NULL) OR m.sender_role IN('teacher','admin'))),
 pron_days AS (SELECT day,count(*) FILTER(WHERE own) recordings,count(*) FILTER(WHERE NOT own) replies FROM pron_events GROUP BY day),
 media_days AS (
  SELECT v.day,count(*) views FROM public.learning_media_views v
  WHERE v.auth_user_id=learner AND v.day>=first_day AND v.day<=today AND (p_level IS NULL OR v.level=p_level) GROUP BY v.day),
 time_days AS (
  SELECT (ls.ended_at AT TIME ZONE 'Europe/Berlin')::date AS day,
   sum(ls.study_seconds) FILTER(WHERE ls.mode='vocabulary') vocabulary,
   sum(ls.study_seconds) FILTER(WHERE ls.mode='path') path,
   sum(ls.study_seconds) FILTER(WHERE ls.mode='pronunciation') pronunciation
  FROM public.learning_sessions ls
  WHERE ls.auth_user_id=learner AND ls.is_active AND ls.ended_at>=range_start AND ls.ended_at<range_end AND (p_level IS NULL OR ls.level=p_level)
  GROUP BY 1)
 SELECT jsonb_agg(jsonb_build_object('date',d.day,
  'vocabulary',jsonb_build_object('answers',coalesce(v.answers,0),'correct',coalesce(v.correct,0),'learned',coalesce(l.learned,0),'seconds',coalesce(t.vocabulary,0)),
  'focus',jsonb_build_object('answers',coalesce(f.answers,0),'correct',coalesce(f.correct,0)),
  'path',jsonb_build_object('answers',coalesce(pa.answers,0),'correct',coalesce(pa.correct,0),'stations',coalesce(st.stations,0),'seconds',coalesce(t.path,0)),
  'pronunciation',jsonb_build_object('recordings',coalesce(pr.recordings,0),'replies',coalesce(pr.replies,0),'seconds',coalesce(t.pronunciation,0)),
  'media',jsonb_build_object('views',coalesce(m.views,0))) ORDER BY d.day)
 INTO daily
 FROM days d LEFT JOIN vocab v ON v.day=d.day LEFT JOIN learned_days l ON l.day=d.day LEFT JOIN focus_days f ON f.day=d.day
 LEFT JOIN path_days pa ON pa.day=d.day LEFT JOIN station_days st ON st.day=d.day LEFT JOIN pron_days pr ON pr.day=d.day
 LEFT JOIN media_days m ON m.day=d.day LEFT JOIN time_days t ON t.day=d.day;

 -- Wortschatz: pro Wort zählt die niedrigere Phase beider Richtungen (wie 52),
 -- aber nur aktive Lektionen und nie eigene Wörter anderer Personen.
 WITH cards AS (
  SELECT c.id,CASE WHEN count(p.id)=0 THEN NULL WHEN count(p.id)=2 AND bool_and(p.box_number=7) THEN 7 ELSE least(6,min(p.box_number)) END phase
  FROM public.learning_vocabulary_cards c
  JOIN public.learning_units u ON u.id=c.unit_id AND u.is_active AND u.trainer='vocabulary'
   AND (u.owner_auth_user_id IS NULL OR u.owner_auth_user_id=learner)
  LEFT JOIN public.vocabulary_direction_progress p ON p.card_id=c.id AND p.auth_user_id=learner
  WHERE u.level=ANY(scope) GROUP BY c.id),
 buckets AS (SELECT n phase,count(c.id) count FROM generate_series(1,7) n LEFT JOIN cards c ON c.phase=n GROUP BY n)
 SELECT jsonb_build_object('totalWords',(SELECT count(*) FROM cards),'inBox',(SELECT count(phase) FROM cards),
  'learnedWords',(SELECT count(*) FROM cards WHERE phase=7),
  -- Alle je gelernten Wörter (auch in Niveaus außerhalb des Bereichs) für die Summenkurve.
  'learnedTotal',(SELECT count(*) FROM (SELECT p.card_id FROM public.vocabulary_direction_progress p
    JOIN public.learning_vocabulary_cards c ON c.id=p.card_id JOIN public.learning_units u ON u.id=c.unit_id
    WHERE p.auth_user_id=learner AND (p_level IS NULL OR u.level=p_level) GROUP BY p.card_id HAVING count(*)=2 AND bool_and(p.box_number=7)) x),
  'overallPercent',(SELECT CASE WHEN count(*)=0 THEN 0 ELSE round(coalesce(sum(phase),0)::numeric/(count(*)*7)*100) END FROM cards),
  'buckets',(SELECT jsonb_agg(jsonb_build_object('key',CASE WHEN phase=7 THEN to_jsonb('learned'::text) ELSE to_jsonb(phase) END,'count',count) ORDER BY phase) FROM buckets))
 INTO vocabulary;

 -- Problemwörter: Lehrkräfte sehen keine eigenen Wörter der Lernenden (privat).
 WITH scoped AS (
  SELECT f.*,btrim(c.word_de) word,nullif(c.article::text,'none') article,u.level,u.owner_auth_user_id IS NOT NULL owned
  FROM public.vocabulary_focus_words f JOIN public.learning_vocabulary_cards c ON c.id=f.card_id
  JOIN public.learning_units u ON u.id=c.unit_id AND u.trainer='vocabulary'
  WHERE f.auth_user_id=learner AND f.status IN('active','mastered') AND (p_level IS NULL OR u.level=p_level)
   AND EXISTS(SELECT 1 FROM public.vocabulary_direction_progress p WHERE p.auth_user_id=learner AND p.card_id=f.card_id))
 SELECT jsonb_build_object(
  'active',(SELECT count(*) FROM scoped WHERE status='active'),
  'due',(SELECT count(*) FROM scoped WHERE status='active' AND due_at<=now()),
  'mastered',(SELECT count(*) FROM scoped WHERE status='mastered'),
  'articleWords',(SELECT count(*) FROM scoped WHERE status='active' AND article_errors>=2 AND article IN('der','die','das')),
  'words',coalesce((SELECT jsonb_agg(jsonb_build_object('cardId',s.card_id,'word',s.word,'article',s.article,'level',s.level,
    'status',s.status,'stage',s.stage,'dueAt',s.due_at,'due',s.status='active' AND s.due_at<=now(),'wrongCount',s.wrong_count,'articleErrors',s.article_errors,
    'practiceCount',s.practice_count,'practiceCorrect',s.practice_correct,'masteredAt',s.mastered_at)
    ORDER BY s.status,s.wrong_count+s.article_errors DESC,s.word)
   FROM (SELECT * FROM scoped WHERE NOT (staff AND learner<>actor AND owned) ORDER BY status,wrong_count+article_errors DESC,word LIMIT 40) s),'[]'))
 INTO focus;

 WITH nodes AS (
  SELECT n.id,n.kind,u.id unit_id FROM public.path_nodes n JOIN public.learning_units u ON u.id=n.unit_id AND u.is_path AND u.is_active
  WHERE n.is_active AND u.level=ANY(scope)),
 done AS (
  SELECT DISTINCT pr.node_id FROM public.path_node_progress pr JOIN nodes ON nodes.id=pr.node_id
  WHERE pr.auth_user_id=learner AND pr.is_active AND pr.status='completed'
  UNION
  SELECT DISTINCT a.node_id FROM public.path_test_attempts a JOIN nodes ON nodes.id=a.node_id
  WHERE a.auth_user_id=learner AND a.is_active AND a.status='completed' AND a.passed),
 tests AS (
  SELECT a.completed_at,a.percentage,a.passed,coalesce(n.title,n.topic) title
  FROM public.path_test_attempts a JOIN public.path_nodes n ON n.id=a.node_id JOIN public.learning_units u ON u.id=n.unit_id
  WHERE a.auth_user_id=learner AND a.status='completed' AND a.completed_at>=range_start AND a.completed_at<range_end
   AND (p_level IS NULL OR u.level=p_level)
  ORDER BY a.completed_at DESC LIMIT 20)
 SELECT jsonb_build_object('totalStations',(SELECT count(*) FROM nodes),'completedStations',(SELECT count(*) FROM done),
  'totalUnits',(SELECT count(DISTINCT unit_id) FROM nodes),
  'completedUnits',(SELECT count(DISTINCT n.unit_id) FROM done JOIN nodes n ON n.id=done.node_id WHERE n.kind='test'),
  'tests',coalesce((SELECT jsonb_agg(jsonb_build_object('completedAt',t.completed_at,'percentage',round(t.percentage),'passed',coalesce(t.passed,false),'title',t.title) ORDER BY t.completed_at) FROM tests t),'[]'))
 INTO path;

 WITH texts AS (
  SELECT r.id FROM public.learning_reading_texts r
  JOIN public.learning_units u ON u.id=r.unit_id AND u.trainer='pronunciation' AND u.is_active AND u.owner_auth_user_id IS NULL
  WHERE u.level=ANY(scope)),
 recordings AS (SELECT s.id,s.prompt_id,s.created_at FROM public.submissions s
  WHERE s.auth_user_id=learner AND s.type='audio' AND (p_level IS NULL OR s.level=p_level))
 SELECT jsonb_build_object('totalTexts',(SELECT count(*) FROM texts),
  'practicedTexts',(SELECT count(DISTINCT rec.prompt_id) FROM recordings rec JOIN texts ON texts.id=rec.prompt_id),
  'recordings',(SELECT count(*) FROM recordings)+(SELECT count(*) FROM public.pronunciation_messages m JOIN recordings rec ON rec.id=m.submission_id
    WHERE m.sender_role='student' AND m.sender_id=learner AND m.audio_path IS NOT NULL),
  'awaitingReply',(SELECT count(*) FROM recordings rec WHERE NOT EXISTS(SELECT 1 FROM public.pronunciation_messages reply
    WHERE reply.submission_id=rec.id AND reply.sender_role IN('teacher','admin')
     AND reply.created_at>=coalesce((SELECT max(m.created_at) FROM public.pronunciation_messages m WHERE m.submission_id=rec.id
      AND m.sender_role='student' AND m.audio_path IS NOT NULL),rec.created_at))))
 INTO pronunciation;

 -- Verfügbare Medien der Niveaus im Bereich (Ordner-Videos, Links, Unterlagen).
 WITH available AS (
  SELECT v.id,v.title,CASE WHEN v.storage_path IS NULL THEN 'link' ELSE 'video' END kind
  FROM public.learning_videos v JOIN public.learning_units u ON u.id=v.unit_id AND u.is_active
  WHERE u.level=ANY(scope) AND (v.folder_id IS NULL OR EXISTS(SELECT 1 FROM public.lms_media_folder f WHERE f.folder_id=v.folder_id AND f.level=u.level))
  UNION ALL
  SELECT a.asset_id,a.file_name,'presentation' FROM public.lms_presentation_asset a JOIN public.lms_media_folder f ON f.folder_id=a.folder_id
  WHERE f.level=ANY(scope)),
 seen AS (
  SELECT v.kind,v.object_id,max(v.last_viewed_at) last_viewed_at,sum(v.view_count) views
  FROM public.learning_media_views v WHERE v.auth_user_id=learner AND (p_level IS NULL OR v.level=p_level) GROUP BY v.kind,v.object_id)
 SELECT jsonb_build_object('totalMedia',(SELECT count(*) FROM available),
  'viewedMedia',(SELECT count(*) FROM available a WHERE EXISTS(SELECT 1 FROM seen s WHERE s.object_id=a.id AND s.kind=a.kind)),
  'recent',coalesce((SELECT jsonb_agg(jsonb_build_object('kind',r.kind,'title',r.title,'viewedAt',r.last_viewed_at,'views',r.views) ORDER BY r.last_viewed_at DESC)
   FROM (SELECT s.kind,coalesce(v.title,p.file_name) title,s.last_viewed_at,s.views FROM seen s
    LEFT JOIN public.learning_videos v ON v.id=s.object_id AND s.kind IN('video','link')
    LEFT JOIN public.lms_presentation_asset p ON p.asset_id=s.object_id AND s.kind='presentation'
    WHERE coalesce(v.title,p.file_name) IS NOT NULL ORDER BY s.last_viewed_at DESC LIMIT 8) r),'[]'))
 INTO media;

 RETURN jsonb_build_object('success',true,'studentId',learner,'level',p_level,'days',p_days,'today',today,'timezone','Europe/Berlin',
  'daily',daily,'vocabulary',vocabulary,'focus',focus,'path',path,'pronunciation',pronunciation,'media',media);
EXCEPTION WHEN OTHERS THEN
 RETURN jsonb_build_object('error','request_failed','message','Learning progress could not be loaded.','sqlstate',SQLSTATE);
END $$;
REVOKE ALL ON FUNCTION public.get_learning_progress(uuid,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_learning_progress(uuid,text,integer) TO authenticated;

-- Regression guards (R10, maschinenlesbar).
DO $migration$
BEGIN
 IF has_table_privilege('authenticated','public.learning_media_views','INSERT')
  OR has_table_privilege('authenticated','public.vocabulary_focus_words','INSERT')
  OR has_table_privilege('authenticated','public.vocabulary_focus_words','UPDATE')
  OR has_table_privilege('authenticated','public.vocabulary_focus_words','DELETE')
  OR has_table_privilege('anon','public.vocabulary_focus_words','SELECT')
  OR has_table_privilege('anon','public.learning_media_views','SELECT') THEN
  RAISE EXCEPTION 'phase11_tables_writable' USING ERRCODE='42501';
 END IF;
 IF has_function_privilege('anon','public.get_learning_progress(uuid,text,integer)','EXECUTE')
  OR has_function_privilege('anon','public.get_vocabulary_focus(text,text)','EXECUTE')
  OR has_function_privilege('anon','public.submit_vocabulary_focus_answer(uuid,uuid,text,text,text)','EXECUTE')
  OR has_function_privilege('anon','public.record_media_view(text,uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'phase11_functions_public' USING ERRCODE='42501';
 END IF;
END $migration$;

NOTIFY pgrst, 'reload schema';
