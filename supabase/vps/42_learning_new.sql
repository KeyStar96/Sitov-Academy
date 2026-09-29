-- Backup with migrate-local.py before applying. 41 must have committed first.
-- Rollback: supabase/vps/rollback/42_learning_new.sql.
--
-- Phase 6.1: „Neu"-System mit Gesehen-Quittungen.
--
-- Bisher kannte nur die Mediathek ein „neu" (erstellt in den letzten 14 Tagen),
-- unabhängig von der Person. Jetzt gilt pro Person:
--
--   Ein Objekt ist NEU, wenn es für die Person sichtbar ist (dieselben
--   Zugriffsregeln wie beim Lesen: Niveau, Trainer, Lektionsauswahl, Sperren),
--   sie es noch nicht geöffnet hat und es NACH ihrem ersten Besuch dieses
--   Niveaus angelegt wurde. Ein Niveau ist neu, wenn es nach dem ersten Besuch
--   der Person im Lernraum freigeschaltet wurde und noch nicht geöffnet ist;
--   ein Modus (Trainer), wenn er nach diesem Besuch wieder eingeschaltet wurde.
--
--   * learning_first_visits: Grundlinie je Person ('room') und je geöffnetem
--     Niveau. Alles, was vor der Grundlinie existierte, ist nie neu. Bei der
--     Migration erhalten alle bestehenden Personen die Grundlinie „jetzt":
--     Bestandsobjekte gelten als gesehen. Ein frisches Konto bekommt die
--     Grundlinie beim ersten Aufruf; vorher freigeschaltete Niveaus sind nicht
--     neu.
--   * learning_seen_receipts: Quittung (Person, Art, Objekt, Zeitpunkt). Sie
--     entsteht beim Öffnen eines Objekts, nicht beim Anzeigen einer Liste.
--   * get_learning_new_counts(): ALLE Zähler (je Niveau und Modus) in einem
--     Aufruf für Startseite, Modus-Dock und untere Leiste.
--   * get_learning_new_items(p_level): Objekt-Schlüssel je Art für die
--     Kennzeichen an Kacheln und Karten eines Niveaus.
--   * mark_learning_seen(p_kind,p_object_key): Quittung setzen (idempotent).
--
-- Nicht erfasst (bewusst): Das spätere Einblenden einer Lektion durch die
-- Lektionsauswahl der Lehrkraft und das Aktivieren einer zuvor inaktiven
-- Lektion. Es gibt dafür keinen Zeitstempel; „neu" folgt dem Anlegen.

DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='learning_seen_kind') THEN
  CREATE TYPE public.learning_seen_kind AS ENUM('level','vocabulary_lesson','path','special_branch','pronunciation_text','media_folder','video','presentation','trainer');
 END IF;
END $$;

ALTER TABLE public.student_level_access ADD COLUMN IF NOT EXISTS granted_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.learning_trainer_grants ADD COLUMN IF NOT EXISTS enabled_at timestamptz;
ALTER TABLE public.learning_units ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
COMMENT ON COLUMN public.student_level_access.granted_at IS 'When the level was unlocked for the learner (Phase 6.1 „Neu"). Rows that existed before migration 42 carry the migration time.';
COMMENT ON COLUMN public.learning_trainer_grants.enabled_at IS 'Set when a disabled trainer is switched on again. NULL: never re-enabled, so the trainer came with the level.';
COMMENT ON COLUMN public.learning_units.created_at IS 'Creation time (Phase 6.1 „Neu"). Units that existed before migration 42 carry the migration time.';

CREATE OR REPLACE FUNCTION learning_private.stamp_trainer_enabled() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF new.enabled AND NOT old.enabled THEN new.enabled_at:=now(); END IF;
 RETURN new;
END $$;
DROP TRIGGER IF EXISTS stamp_trainer_enabled ON public.learning_trainer_grants;
CREATE TRIGGER stamp_trainer_enabled BEFORE UPDATE OF enabled ON public.learning_trainer_grants
 FOR EACH ROW EXECUTE FUNCTION learning_private.stamp_trainer_enabled();

CREATE TABLE IF NOT EXISTS public.learning_first_visits (
 auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 scope text NOT NULL CHECK(scope='room' OR length(scope) BETWEEN 1 AND 20),
 first_visit_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(auth_user_id,scope)
);
CREATE TABLE IF NOT EXISTS public.learning_seen_receipts (
 auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 kind public.learning_seen_kind NOT NULL,
 object_key text NOT NULL CHECK(length(object_key) BETWEEN 1 AND 80),
 seen_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(auth_user_id,kind,object_key)
);
ALTER TABLE public.learning_first_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_seen_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.learning_first_visits,public.learning_seen_receipts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.learning_first_visits,public.learning_seen_receipts TO authenticated;
GRANT ALL ON public.learning_first_visits,public.learning_seen_receipts TO service_role;
DROP POLICY IF EXISTS own_read ON public.learning_first_visits;
CREATE POLICY own_read ON public.learning_first_visits FOR SELECT TO authenticated USING (auth_user_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS own_read ON public.learning_seen_receipts;
CREATE POLICY own_read ON public.learning_seen_receipts FOR SELECT TO authenticated USING (auth_user_id=(SELECT auth.uid()));
COMMENT ON TABLE public.learning_first_visits IS 'Baseline per learner (scope room) and per opened level: nothing created before it is ever „new". Written only by the database functions of Phase 6.1.';
COMMENT ON TABLE public.learning_seen_receipts IS 'Seen receipts: learner, kind, object, time. Set when an object is opened, never when a list is shown. Written only by mark_learning_seen.';

-- Bestand ist bei der Migration gesehen: Grundlinie „jetzt" für alle bestehenden Personen und ihre Niveaus.
INSERT INTO public.learning_first_visits(auth_user_id,scope,first_visit_at)
SELECT p.id,'room',clock_timestamp() FROM public.profiles p
WHERE EXISTS(SELECT 1 FROM auth.users u WHERE u.id=p.id)
ON CONFLICT DO NOTHING;
INSERT INTO public.learning_first_visits(auth_user_id,scope,first_visit_at)
SELECT a.auth_user_id,a.level,clock_timestamp() FROM public.student_level_access a
WHERE EXISTS(SELECT 1 FROM auth.users u WHERE u.id=a.auth_user_id)
ON CONFLICT DO NOTHING;

-- Alle neuen Objekte der angemeldeten Person. `covered`: das Objekt liegt in einem noch
-- ungeöffneten neuen Ordner bzw. Pfad und zählt erst, wenn dieser geöffnet ist.
CREATE OR REPLACE FUNCTION learning_private.new_objects()
RETURNS TABLE(level text,mode text,kind public.learning_seen_kind,object_key text,covered boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); room timestamptz; allowed uuid[]; published uuid[];
BEGIN
 IF actor IS NULL OR coalesce(identity_private.current_profile_role(),'') IN('teacher','admin') THEN RETURN; END IF;
 SELECT v.first_visit_at INTO room FROM public.learning_first_visits v WHERE v.auth_user_id=actor AND v.scope='room';
 IF room IS NULL THEN RETURN; END IF;
 allowed:=learning_private.allowed_unit_ids();
 published:=media_private.published_video_unit_ids();
 RETURN QUERY
 WITH lv AS MATERIALIZED (
   SELECT a.level lvl,a.granted_at,b.first_visit_at base,
          EXISTS(SELECT 1 FROM public.learning_seen_receipts r WHERE r.auth_user_id=actor AND r.kind='level' AND r.object_key=a.level) opened
     FROM public.student_level_access a
     JOIN public.learning_levels l ON l.code=a.level AND l.is_active
     LEFT JOIN public.learning_first_visits b ON b.auth_user_id=actor AND b.scope=a.level
    WHERE a.auth_user_id=actor),
  seen AS MATERIALIZED (SELECT r.kind k,r.object_key key FROM public.learning_seen_receipts r WHERE r.auth_user_id=actor),
  levels_new AS (
   SELECT lv.lvl,NULL::text m,'level'::public.learning_seen_kind k,lv.lvl key,false cov
     FROM lv WHERE lv.granted_at>room AND NOT lv.opened),
  trainers_new AS (
   SELECT lv.lvl,CASE g.trainer::text WHEN 'vocabulary' THEN 'vocabulary' WHEN 'exercises' THEN 'path' WHEN 'pronunciation' THEN 'pronunciation' ELSE 'media' END,
          'trainer'::public.learning_seen_kind,lv.lvl||':'||g.trainer::text,false
     FROM lv JOIN public.learning_trainer_grants g ON g.auth_user_id=actor AND g.level=lv.lvl
    WHERE g.enabled AND g.enabled_at>room AND NOT (lv.granted_at>room AND NOT lv.opened)
      AND trainer_access_private.allowed(lv.lvl,g.trainer::text)
      AND NOT EXISTS(SELECT 1 FROM seen s WHERE s.k='trainer' AND s.key=lv.lvl||':'||g.trainer::text)),
  lessons_new AS (
   SELECT lv.lvl,'vocabulary'::text,'vocabulary_lesson'::public.learning_seen_kind,u.id::text,false
     FROM lv JOIN public.learning_units u ON u.level=lv.lvl AND u.trainer='vocabulary' AND u.owner_auth_user_id IS NULL AND u.is_active
    WHERE lv.base IS NOT NULL AND u.created_at>lv.base AND u.id=ANY(allowed)
      AND NOT EXISTS(SELECT 1 FROM seen s WHERE s.k='vocabulary_lesson' AND s.key=u.id::text)),
  paths_new AS MATERIALIZED (
   SELECT lv.lvl,u.id
     FROM lv JOIN public.learning_units u ON u.level=lv.lvl AND u.trainer='exercises' AND u.is_path AND u.is_active
    WHERE lv.base IS NOT NULL AND u.created_at>lv.base AND u.id=ANY(allowed) AND path_private.unit_available(u.id)
      AND NOT EXISTS(SELECT 1 FROM seen s WHERE s.k='path' AND s.key=u.id::text)),
  branches_new AS (
   SELECT lv.lvl,'path'::text,'special_branch'::public.learning_seen_kind,n.id::text,EXISTS(SELECT 1 FROM paths_new pn WHERE pn.id=n.unit_id)
     FROM lv JOIN public.learning_units u ON u.level=lv.lvl AND u.trainer='exercises' AND u.is_path AND u.is_active
     JOIN public.path_nodes n ON n.unit_id=u.id AND n.kind='special' AND n.is_active
    WHERE lv.base IS NOT NULL AND n.created_at>lv.base AND u.id=ANY(allowed) AND path_private.node_available(n.id)
      AND NOT EXISTS(SELECT 1 FROM seen s WHERE s.k='special_branch' AND s.key=n.id::text)),
  texts_new AS (
   SELECT lv.lvl,'pronunciation'::text,'pronunciation_text'::public.learning_seen_kind,r.id::text,false
     FROM lv JOIN public.learning_units u ON u.level=lv.lvl AND u.trainer='pronunciation' AND u.owner_auth_user_id IS NULL AND u.is_active
     JOIN public.learning_reading_texts r ON r.unit_id=u.id
    WHERE lv.base IS NOT NULL AND r.created_at>lv.base AND u.id=ANY(allowed)
      AND learning_private.german_text_allowed(r.sentence_de) AND learning_private.german_text_allowed(r.focus)
      AND NOT EXISTS(SELECT 1 FROM seen s WHERE s.k='pronunciation_text' AND s.key=r.id::text)),
  folders_new AS MATERIALIZED (
   SELECT lv.lvl,f.folder_id
     FROM lv JOIN public.lms_media_folder f ON f.level=lv.lvl
    WHERE lv.base IS NOT NULL AND f.created_at>lv.base AND media_private.folder_allowed(f.folder_id)
      AND NOT EXISTS(SELECT 1 FROM seen s WHERE s.k='media_folder' AND s.key=f.folder_id::text)),
  videos_new AS (
   SELECT lv.lvl,'media'::text,'video'::public.learning_seen_kind,v.id::text,v.folder_id IS NOT NULL AND EXISTS(SELECT 1 FROM folders_new fn WHERE fn.folder_id=v.folder_id)
     FROM lv JOIN public.learning_units u ON u.level=lv.lvl AND u.trainer='videos' AND u.is_active
     JOIN public.learning_videos v ON v.unit_id=u.id
    WHERE lv.base IS NOT NULL AND v.created_at>lv.base
      AND ((v.storage_path IS NOT NULL AND v.file_size IS NOT NULL AND u.id=ANY(published)) OR (v.storage_path IS NULL AND v.source_url IS NOT NULL AND u.id=ANY(allowed)))
      AND (v.folder_id IS NULL OR media_private.folder_allowed(v.folder_id))
      AND NOT EXISTS(SELECT 1 FROM seen s WHERE s.k='video' AND s.key=v.id::text)),
  assets_new AS (
   SELECT lv.lvl,'media'::text,'presentation'::public.learning_seen_kind,a.asset_id::text,EXISTS(SELECT 1 FROM folders_new fn WHERE fn.folder_id=a.folder_id)
     FROM lv JOIN public.lms_media_folder f ON f.level=lv.lvl
     JOIN public.lms_presentation_asset a ON a.folder_id=f.folder_id
    WHERE lv.base IS NOT NULL AND a.created_at>lv.base AND media_private.folder_allowed(f.folder_id)
      AND NOT EXISTS(SELECT 1 FROM seen s WHERE s.k='presentation' AND s.key=a.asset_id::text))
 SELECT * FROM levels_new
 UNION ALL SELECT * FROM trainers_new
 UNION ALL SELECT * FROM lessons_new
 UNION ALL SELECT pn.lvl,'path','path'::public.learning_seen_kind,pn.id::text,false FROM paths_new pn
 UNION ALL SELECT * FROM branches_new
 UNION ALL SELECT * FROM texts_new
 UNION ALL SELECT fn.lvl,'media','media_folder'::public.learning_seen_kind,fn.folder_id::text,false FROM folders_new fn
 UNION ALL SELECT * FROM videos_new
 UNION ALL SELECT * FROM assets_new;
END $$;
REVOKE ALL ON FUNCTION learning_private.new_objects() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.get_learning_new_counts() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); levels jsonb; visited jsonb;
BEGIN
 IF actor IS NULL THEN RETURN jsonb_build_object('error','not_authenticated','message','Authentication is required.'); END IF;
 -- Der erste Aufruf im Lernraum legt die Grundlinie fest: davor Freigeschaltetes ist nicht neu.
 INSERT INTO public.learning_first_visits(auth_user_id,scope) VALUES(actor,'room') ON CONFLICT DO NOTHING;
 SELECT coalesce(jsonb_object_agg(g.level,g.entry),'{}'::jsonb) INTO levels FROM (
  SELECT n.level,jsonb_build_object(
    'level',bool_or(n.kind='level'),
    'total',count(*),
    'modes',jsonb_build_object(
      'vocabulary',count(*) FILTER(WHERE n.mode='vocabulary' AND n.kind<>'trainer'),
      'path',count(*) FILTER(WHERE n.mode='path' AND n.kind<>'trainer'),
      'pronunciation',count(*) FILTER(WHERE n.mode='pronunciation' AND n.kind<>'trainer'),
      'media',count(*) FILTER(WHERE n.mode='media' AND n.kind<>'trainer')),
    'modeNew',jsonb_build_object(
      'vocabulary',coalesce(bool_or(n.mode='vocabulary' AND n.kind='trainer'),false),
      'path',coalesce(bool_or(n.mode='path' AND n.kind='trainer'),false),
      'pronunciation',coalesce(bool_or(n.mode='pronunciation' AND n.kind='trainer'),false),
      'media',coalesce(bool_or(n.mode='media' AND n.kind='trainer'),false))) entry
    FROM learning_private.new_objects() n WHERE NOT n.covered GROUP BY n.level) g;
 -- Niveaus mit Grundlinie: nur dort kann Inhalt „neu" sein; die Oberfläche meldet den ersten Besuch weiterer Niveaus.
 SELECT coalesce(jsonb_agg(v.scope ORDER BY v.scope),'[]'::jsonb) INTO visited FROM public.learning_first_visits v WHERE v.auth_user_id=actor AND v.scope<>'room';
 RETURN jsonb_build_object('success',true,'any',levels<>'{}'::jsonb,'levels',levels,'visited',visited);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error','request_failed','message','The request could not be completed.','sqlstate',SQLSTATE);
END $$;

CREATE OR REPLACE FUNCTION public.get_learning_new_items(p_level text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); items jsonb; lessons jsonb;
BEGIN
 IF actor IS NULL THEN RETURN jsonb_build_object('error','not_authenticated','message','Authentication is required.'); END IF;
 IF p_level IS NULL OR length(p_level) NOT BETWEEN 1 AND 20 THEN RETURN jsonb_build_object('error','invalid_input','message','The request contains invalid data.'); END IF;
 SELECT coalesce(jsonb_object_agg(g.kind,g.keys),'{}'::jsonb) INTO items FROM (
  SELECT n.kind::text kind,jsonb_agg(n.object_key ORDER BY n.object_key) keys
    FROM learning_private.new_objects() n WHERE n.level=p_level GROUP BY n.kind) g;
 -- Vokabel-Lektionen erscheinen in der Oberfläche unter ihrem Namen: Name je neuer Lektion mitgeben.
 SELECT coalesce(jsonb_object_agg(u.id::text,u.label),'{}'::jsonb) INTO lessons FROM public.learning_units u
  WHERE u.id::text IN(SELECT n.object_key FROM learning_private.new_objects() n WHERE n.level=p_level AND n.kind='vocabulary_lesson');
 RETURN jsonb_build_object('success',true,'level',p_level,'items',items,'lessons',lessons);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error','request_failed','message','The request could not be completed.','sqlstate',SQLSTATE);
END $$;

CREATE OR REPLACE FUNCTION public.mark_learning_seen(p_kind text,p_object_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); v_kind public.learning_seen_kind; v_marked integer:=0;
BEGIN
 IF actor IS NULL THEN RETURN jsonb_build_object('error','not_authenticated','message','Authentication is required.'); END IF;
 IF p_object_key IS NULL OR length(p_object_key) NOT BETWEEN 1 AND 80 THEN RETURN jsonb_build_object('error','invalid_input','message','The request contains invalid data.'); END IF;
 BEGIN v_kind:=p_kind::public.learning_seen_kind;
 EXCEPTION WHEN invalid_text_representation THEN RETURN jsonb_build_object('error','invalid_input','message','The request contains invalid data.'); END;
 INSERT INTO public.learning_first_visits(auth_user_id,scope) VALUES(actor,'room') ON CONFLICT DO NOTHING;
 -- Quittung nur für Objekte, die gerade wirklich neu sind: die Tabelle wächst nicht mit jedem Klick.
 INSERT INTO public.learning_seen_receipts(auth_user_id,kind,object_key)
 SELECT actor,n.kind,n.object_key FROM learning_private.new_objects() n WHERE n.kind=v_kind AND n.object_key=p_object_key
 ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS v_marked=ROW_COUNT;
 -- Ein Niveau zu öffnen ist der erste Besuch dieses Niveaus: ab jetzt zählt später Veröffentlichtes als neu.
 IF v_kind='level' AND EXISTS(SELECT 1 FROM public.student_level_access a WHERE a.auth_user_id=actor AND a.level=p_object_key) THEN
  INSERT INTO public.learning_first_visits(auth_user_id,scope) VALUES(actor,p_object_key) ON CONFLICT DO NOTHING;
 END IF;
 RETURN jsonb_build_object('success',true,'marked',v_marked>0);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error','request_failed','message','The request could not be completed.','sqlstate',SQLSTATE);
END $$;

REVOKE ALL ON FUNCTION public.get_learning_new_counts(),public.get_learning_new_items(text),public.mark_learning_seen(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_learning_new_counts(),public.get_learning_new_items(text),public.mark_learning_seen(text,text) TO authenticated;
