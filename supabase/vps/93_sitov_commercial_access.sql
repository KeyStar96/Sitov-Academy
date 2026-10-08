-- Sitov Academy commercial core. Additive only: no legacy grants or content rewritten.
-- DRAFT partial enforcement: source/unit guards and restrictive item scopes; selected-item scoring RPC ports still gated.
CREATE SCHEMA IF NOT EXISTS sitov_access_private;
REVOKE ALL ON SCHEMA sitov_access_private FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA sitov_access_private TO authenticated;

CREATE TABLE IF NOT EXISTS sitov_access_private.students (
 student_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 vip_enabled boolean NOT NULL DEFAULT false,
 trial jsonb NOT NULL DEFAULT '{"version":1,"rules":[]}',
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 changed_by uuid REFERENCES public.profiles(id), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sitov_access_private.billing_settings (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 enabled boolean NOT NULL DEFAULT false, provider text NOT NULL DEFAULT 'none' CHECK(provider IN('none','stripe')),
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 CHECK(NOT enabled OR provider<>'none')
);
INSERT INTO sitov_access_private.billing_settings(singleton) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS sitov_access_private.products (
 level text PRIMARY KEY REFERENCES public.learning_levels(code),
 amount_minor bigint CHECK(amount_minor>0), currency text CHECK(currency ~ '^[A-Z]{3}$'),
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 CHECK((amount_minor IS NULL)=(currency IS NULL))
);
INSERT INTO sitov_access_private.products(level)
 SELECT code FROM public.learning_levels WHERE code IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2','C1.1','C1.2')
 ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS sitov_access_private.orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), student_id uuid NOT NULL REFERENCES public.profiles(id),
 level text NOT NULL REFERENCES sitov_access_private.products(level), request_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'created' CHECK(status IN('created','pending','paid','failed','cancelled','refunded')),
 provider text NOT NULL DEFAULT 'none' CHECK(provider IN('none','stripe')),
 provider_confirmation_verified boolean NOT NULL DEFAULT false,
 amount_minor bigint NOT NULL CHECK(amount_minor>0), currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(student_id,request_id),
 CHECK(NOT provider_confirmation_verified OR provider<>'none'),
 CHECK(status<>'paid' OR provider_confirmation_verified)
);
CREATE TABLE IF NOT EXISTS sitov_access_private.purchases (
 order_id uuid PRIMARY KEY REFERENCES sitov_access_private.orders(id),
 active boolean NOT NULL DEFAULT true
);
ALTER TABLE sitov_access_private.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE sitov_access_private.billing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sitov_access_private.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sitov_access_private.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sitov_access_private.purchases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA sitov_access_private FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION sitov_access_private.staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND coalesce(identity_private.current_profile_role(),'') IN('teacher','admin')
 AND sitov_security_private.sitov_staff_mfa_satisfied()
$$;
CREATE OR REPLACE FUNCTION sitov_access_private.actor_allowed(p_student uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND ((auth.uid()=p_student AND (coalesce(identity_private.current_profile_role(),'') NOT IN('teacher','admin') OR sitov_access_private.staff())) OR sitov_access_private.staff())
$$;
CREATE OR REPLACE FUNCTION sitov_access_private.purchased(p_student uuid,p_level text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT sitov_access_private.actor_allowed(p_student) AND EXISTS(
 SELECT 1 FROM sitov_access_private.purchases g JOIN sitov_access_private.orders o ON o.id=g.order_id
 WHERE o.student_id=p_student AND o.level=p_level AND g.active AND o.status='paid' AND o.provider_confirmation_verified)
$$;

-- Canonical metadata resolved from existing catalogs. No writable shadow catalog.
CREATE OR REPLACE FUNCTION sitov_access_private.resolve_item(p_kind text,p_item_id text)
RETURNS TABLE(unit_id uuid,level text,trainer text,owner_id uuid,published boolean,legacy_media boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH refs AS (
 SELECT c.unit_id,false media FROM public.learning_vocabulary_cards c WHERE p_kind='vocabulary_card' AND c.id::text=p_item_id
 UNION ALL SELECT e.unit_id,false FROM public.learning_exercises e WHERE p_kind='exercise' AND e.id::text=p_item_id AND e.node_id IS NULL
 UNION ALL SELECT e.unit_id,false FROM public.learning_exercises e WHERE p_kind='path_task' AND e.id::text=p_item_id AND e.node_id IS NOT NULL AND e.path_is_active
 UNION ALL SELECT r.unit_id,false FROM public.learning_reading_texts r WHERE p_kind='reading_text' AND r.id::text=p_item_id
 UNION ALL SELECT v.unit_id,v.storage_path IS NOT NULL AND v.folder_id IS NOT NULL FROM public.learning_videos v
 WHERE p_kind='video' AND v.id::text=p_item_id AND (v.folder_id IS NULL OR EXISTS(
 SELECT 1 FROM public.lms_media_folder f JOIN public.learning_units u ON u.id=v.unit_id WHERE f.folder_id=v.folder_id AND f.level=u.level))
 UNION ALL SELECT v.unit_id,false FROM public.sitov_verb_catalog v WHERE p_kind='verb' AND v.id=p_item_id
 UNION ALL SELECT n.unit_id,false FROM public.path_nodes n WHERE p_kind='path_node' AND n.id::text=p_item_id AND n.is_active
 ) SELECT u.id,u.level,u.trainer::text,u.owner_auth_user_id,u.is_active,r.media FROM refs r JOIN public.learning_units u ON u.id=r.unit_id
 UNION ALL SELECT NULL::uuid,f.level,'videos',NULL::uuid,true,true FROM public.lms_presentation_asset a
 JOIN public.lms_media_folder f ON f.folder_id=a.folder_id WHERE p_kind='presentation' AND a.asset_id::text=p_item_id
$$;

CREATE OR REPLACE FUNCTION sitov_access_private.trial_item_allowed(p_student uuid,p_kind text,p_item_id text,p_unit uuid,p_level text,p_trainer text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p_unit IS NOT NULL AND EXISTS(SELECT 1 FROM sitov_access_private.students s,
 LATERAL jsonb_array_elements(s.trial->'rules') rule
 WHERE s.student_id=p_student AND rule->>'level'=p_level AND rule->>'trainer'=p_trainer
 AND (rule->'unit_ids'='null'::jsonb OR rule->'unit_ids' @> to_jsonb(ARRAY[p_unit::text]))
 AND (rule->'items'='null'::jsonb OR EXISTS(SELECT 1 FROM jsonb_array_elements(rule->'items') bucket
 WHERE bucket->>'unit_id'=p_unit::text AND (bucket->'refs'='null'::jsonb OR bucket->'refs' @>
 jsonb_build_array(jsonb_build_object('kind',p_kind,'id',p_item_id))))))
$$;
CREATE OR REPLACE FUNCTION sitov_access_private.item_allowed(p_student uuid,p_kind text,p_item_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT sitov_access_private.actor_allowed(p_student) AND EXISTS(
 SELECT 1 FROM sitov_access_private.resolve_item(p_kind,p_item_id) i JOIN public.profiles p ON p.id=p_student
 LEFT JOIN public.learning_trainer_grants g ON g.auth_user_id=p.id AND g.level=i.level AND g.trainer::text=i.trainer
 WHERE (i.owner_id IS NULL OR i.owner_id=p.id) AND (p.role IN('teacher','admin') OR (p.role='student'
 AND (i.published OR i.owner_id=p.id) AND i.level IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2','C1.1','C1.2')
 AND NOT(i.trainer='verbs' AND i.level IN('C1.1','C1.2')) AND (
 EXISTS(SELECT 1 FROM sitov_access_private.students s WHERE s.student_id=p.id AND s.vip_enabled)
 OR sitov_access_private.purchased(p.id,i.level)
 OR (EXISTS(SELECT 1 FROM public.student_level_access l WHERE l.auth_user_id=p.id AND l.level=i.level)
 AND (i.legacy_media OR (coalesce(g.enabled,true) AND (i.owner_id=p.id OR g.unit_mode IS DISTINCT FROM 'selected'
 OR EXISTS(SELECT 1 FROM public.learning_unit_grants x WHERE x.auth_user_id=p.id AND x.level=i.level AND x.trainer::text=i.trainer AND x.unit_id=i.unit_id)))))
 OR (i.owner_id IS NULL AND sitov_access_private.trial_item_allowed(p.id,p_kind,p_item_id,i.unit_id,i.level,i.trainer))
 ))))
$$;

CREATE OR REPLACE FUNCTION sitov_access_private.validate_trial(p_manifest jsonb) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb;b jsonb;ref jsonb;v jsonb;seen text[]:='{}';key text;BEGIN
 IF p_manifest IS NULL OR jsonb_typeof(p_manifest)<>'object' OR p_manifest->'version'<>'1'::jsonb
 OR NOT(p_manifest ?& ARRAY['version','rules']) OR (p_manifest-ARRAY['version','rules'])<>'{}'::jsonb
 OR jsonb_typeof(p_manifest->'rules')<>'array' OR jsonb_array_length(p_manifest->'rules')>50 THEN RETURN false;END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p_manifest->'rules') LOOP
  IF jsonb_typeof(r)<>'object' OR NOT(r ?& ARRAY['level','trainer','unit_ids','items'])
  OR (r-ARRAY['level','trainer','unit_ids','items'])<>'{}'::jsonb
  OR jsonb_typeof(r->'level')<>'string' OR jsonb_typeof(r->'trainer')<>'string'
  OR r->>'level' NOT IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2','C1.1','C1.2')
  OR r->>'trainer' NOT IN('vocabulary','exercises','pronunciation','videos','verbs')
  OR r->>'trainer'='verbs' AND r->>'level' IN('C1.1','C1.2') THEN RETURN false;END IF;
  key:=(r->>'level')||':'||(r->>'trainer');IF key=ANY(seen) THEN RETURN false;END IF;seen:=array_append(seen,key);
  IF r->'unit_ids'<>'null'::jsonb THEN
   IF jsonb_typeof(r->'unit_ids')<>'array' OR jsonb_array_length(r->'unit_ids')>1000 THEN RETURN false;END IF;
   IF (SELECT count(*)<>count(DISTINCT value) FROM jsonb_array_elements(r->'unit_ids')) THEN RETURN false;END IF;
   FOR v IN SELECT value FROM jsonb_array_elements(r->'unit_ids') LOOP
    IF jsonb_typeof(v)<>'string' OR NOT EXISTS(SELECT 1 FROM public.learning_units u WHERE u.id::text=(v#>>'{}')
    AND u.level=r->>'level' AND u.trainer::text=r->>'trainer' AND u.is_active AND u.owner_auth_user_id IS NULL) THEN RETURN false;END IF;
   END LOOP;
  END IF;
  IF r->'items'='null'::jsonb THEN CONTINUE;END IF;
  IF jsonb_typeof(r->'items')<>'array' OR jsonb_array_length(r->'items')>1000 THEN RETURN false;END IF;
  IF (SELECT count(*)<>count(DISTINCT value->>'unit_id') FROM jsonb_array_elements(r->'items')) THEN RETURN false;END IF;
  FOR b IN SELECT value FROM jsonb_array_elements(r->'items') LOOP
   IF jsonb_typeof(b)<>'object' OR NOT(b ?& ARRAY['unit_id','refs']) OR (b-ARRAY['unit_id','refs'])<>'{}'::jsonb
   OR NOT EXISTS(SELECT 1 FROM public.learning_units u WHERE u.id::text=b->>'unit_id' AND u.level=r->>'level'
   AND u.trainer::text=r->>'trainer' AND u.is_active AND u.owner_auth_user_id IS NULL)
   OR (r->'unit_ids'<>'null'::jsonb AND NOT(r->'unit_ids' @> jsonb_build_array(b->>'unit_id'))) THEN RETURN false;END IF;
   IF b->'refs'='null'::jsonb THEN CONTINUE;END IF;
   IF jsonb_typeof(b->'refs')<>'array' OR jsonb_array_length(b->'refs')>1000 THEN RETURN false;END IF;
   IF (SELECT count(*)<>count(DISTINCT value) FROM jsonb_array_elements(b->'refs')) THEN RETURN false;END IF;
   FOR ref IN SELECT value FROM jsonb_array_elements(b->'refs') LOOP
    IF jsonb_typeof(ref)<>'object' OR NOT(ref ?& ARRAY['kind','id']) OR (ref-ARRAY['kind','id'])<>'{}'::jsonb
    OR jsonb_typeof(ref->'kind')<>'string' OR jsonb_typeof(ref->'id')<>'string'
    OR NOT EXISTS(SELECT 1 FROM sitov_access_private.resolve_item(ref->>'kind',ref->>'id') i WHERE i.unit_id::text=b->>'unit_id'
    AND i.level=r->>'level' AND i.trainer=r->>'trainer' AND i.published AND i.owner_id IS NULL) THEN RETURN false;END IF;
   END LOOP;
  END LOOP;
 END LOOP;RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.set_sitov_student_vip(p_student uuid,p_enabled boolean,p_expected_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE rev bigint;BEGIN
 IF NOT sitov_access_private.staff() THEN RETURN jsonb_build_object('error','forbidden');END IF;
 IF p_enabled IS NULL OR p_expected_revision IS NULL OR p_expected_revision<0 OR NOT EXISTS(
 SELECT 1 FROM public.profiles WHERE id=p_student AND role='student') THEN RETURN jsonb_build_object('error','invalid_input');END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-access:'||p_student::text,0));
 INSERT INTO sitov_access_private.students(student_id) VALUES(p_student) ON CONFLICT DO NOTHING;
 SELECT revision INTO rev FROM sitov_access_private.students WHERE student_id=p_student FOR UPDATE;
 IF rev<>p_expected_revision THEN RETURN jsonb_build_object('error','revision_conflict');END IF;
 UPDATE sitov_access_private.students SET vip_enabled=p_enabled,revision=revision+1,changed_by=auth.uid(),updated_at=clock_timestamp() WHERE student_id=p_student;
 RETURN jsonb_build_object('success',true,'revision',rev+1,'vip_enabled',p_enabled);
END $$;
CREATE OR REPLACE FUNCTION public.set_sitov_student_trial(p_student uuid,p_manifest jsonb,p_expected_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE rev bigint;BEGIN
 IF NOT sitov_access_private.staff() THEN RETURN jsonb_build_object('error','forbidden');END IF;
 IF p_expected_revision IS NULL OR p_expected_revision<0 OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_student AND role='student')
 OR NOT sitov_access_private.validate_trial(p_manifest) THEN RETURN jsonb_build_object('error','invalid_input');END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-access:'||p_student::text,0));
 INSERT INTO sitov_access_private.students(student_id) VALUES(p_student) ON CONFLICT DO NOTHING;
 SELECT revision INTO rev FROM sitov_access_private.students WHERE student_id=p_student FOR UPDATE;
 IF rev<>p_expected_revision THEN RETURN jsonb_build_object('error','revision_conflict');END IF;
 UPDATE sitov_access_private.students SET trial=p_manifest,revision=revision+1,changed_by=auth.uid(),updated_at=clock_timestamp() WHERE student_id=p_student;
 RETURN jsonb_build_object('success',true,'revision',rev+1);
END $$;
CREATE OR REPLACE FUNCTION public.get_sitov_access_context(p_student uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE student uuid:=coalesce(p_student,auth.uid());BEGIN
 IF NOT sitov_access_private.actor_allowed(student) THEN RETURN jsonb_build_object('error','forbidden');END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=student) THEN RETURN jsonb_build_object('error','not_found');END IF;
 RETURN jsonb_build_object('vip_enabled',coalesce((SELECT vip_enabled FROM sitov_access_private.students WHERE student_id=student),false),
 'trial',coalesce((SELECT trial FROM sitov_access_private.students WHERE student_id=student),'{"version":1,"rules":[]}'::jsonb),
 'revision',coalesce((SELECT revision FROM sitov_access_private.students WHERE student_id=student),0),
 'purchased_levels',(SELECT coalesce(jsonb_agg(level ORDER BY level),'[]'::jsonb) FROM sitov_access_private.products WHERE sitov_access_private.purchased(student,level)));
END $$;
CREATE OR REPLACE FUNCTION public.get_sitov_billing_settings() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT sitov_access_private.staff() THEN RETURN jsonb_build_object('error','forbidden');END IF;
 RETURN (SELECT jsonb_build_object('enabled',enabled,'provider',provider,'revision',revision,
 'configuration_ready',false,'missing',jsonb_build_array('provider_adapter'),
 'products',(SELECT jsonb_agg(to_jsonb(p) ORDER BY level) FROM sitov_access_private.products p)) FROM sitov_access_private.billing_settings);
END $$;
CREATE OR REPLACE FUNCTION public.set_sitov_billing_enabled(p_enabled boolean,p_expected_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s sitov_access_private.billing_settings%ROWTYPE;BEGIN
 IF NOT sitov_access_private.staff() THEN RETURN jsonb_build_object('error','forbidden');END IF;
 IF p_enabled IS NULL OR p_expected_revision IS NULL THEN RETURN jsonb_build_object('error','invalid_input');END IF;
 SELECT * INTO s FROM sitov_access_private.billing_settings FOR UPDATE;
 IF s.revision<>p_expected_revision THEN RETURN jsonb_build_object('error','revision_conflict');END IF;
 IF p_enabled THEN RETURN jsonb_build_object('error','provider_not_configured','missing',jsonb_build_array('provider_adapter'));END IF;
 UPDATE sitov_access_private.billing_settings SET enabled=false,revision=revision+1;
 RETURN jsonb_build_object('success',true,'revision',s.revision+1,'enabled',false);
END $$;
CREATE OR REPLACE FUNCTION public.set_sitov_product_price(p_level text,p_amount_minor bigint,p_currency text,p_expected_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE rev bigint;BEGIN
 IF NOT sitov_access_private.staff() THEN RETURN jsonb_build_object('error','forbidden');END IF;
 IF p_amount_minor IS NULL OR p_amount_minor<=0 OR p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$' OR p_expected_revision IS NULL
 THEN RETURN jsonb_build_object('error','invalid_input');END IF;
 SELECT revision INTO rev FROM sitov_access_private.products WHERE level=p_level FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','invalid_input');END IF;
 IF rev<>p_expected_revision THEN RETURN jsonb_build_object('error','revision_conflict');END IF;
 UPDATE sitov_access_private.products SET amount_minor=p_amount_minor,currency=p_currency,revision=revision+1 WHERE level=p_level;
 RETURN jsonb_build_object('success',true,'revision',rev+1);
END $$;
CREATE OR REPLACE FUNCTION public.start_sitov_checkout(p_level text,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error','unauthenticated');END IF;
 IF p_request_id IS NULL OR NOT EXISTS(SELECT 1 FROM sitov_access_private.products WHERE level=p_level)
 THEN RETURN jsonb_build_object('error','invalid_input');END IF;
 IF NOT(SELECT enabled FROM sitov_access_private.billing_settings) THEN RETURN jsonb_build_object('error','payment_disabled');END IF;
 -- No provider implementation in this release: never create an order, redirect or entitlement.
 RETURN jsonb_build_object('error','provider_not_configured');
END $$;

REVOKE ALL ON FUNCTION sitov_access_private.staff(),sitov_access_private.actor_allowed(uuid),
 sitov_access_private.purchased(uuid,text),sitov_access_private.resolve_item(text,text),
 sitov_access_private.trial_item_allowed(uuid,text,text,uuid,text,text),sitov_access_private.item_allowed(uuid,text,text),
 sitov_access_private.validate_trial(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION sitov_access_private.item_allowed(uuid,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.set_sitov_student_vip(uuid,boolean,bigint),public.set_sitov_student_trial(uuid,jsonb,bigint),
 public.get_sitov_access_context(uuid),public.get_sitov_billing_settings(),public.set_sitov_billing_enabled(boolean,bigint),
 public.set_sitov_product_price(text,bigint,text,bigint),public.start_sitov_checkout(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_sitov_student_vip(uuid,boolean,bigint),public.set_sitov_student_trial(uuid,jsonb,bigint),
 public.get_sitov_access_context(uuid),public.get_sitov_billing_settings(),public.set_sitov_billing_enabled(boolean,bigint),
 public.set_sitov_product_price(text,bigint,text,bigint),public.start_sitov_checkout(text,uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS sitov_access_private.guard_backups(signature text PRIMARY KEY,definition text NOT NULL);
ALTER TABLE sitov_access_private.guard_backups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sitov_access_private.guard_backups FROM PUBLIC,anon,authenticated;
INSERT INTO sitov_access_private.guard_backups(signature,definition)
SELECT signature,pg_get_functiondef(to_regprocedure(signature)) FROM unnest(ARRAY[
 'trainer_access_private.allowed(text,text)','trainer_access_private.unit_allowed(text,text,text)',
 'learning_private.unit_allowed(uuid)','learning_private.allowed_unit_ids()']) signature
WHERE to_regprocedure(signature) IS NOT NULL ON CONFLICT DO NOTHING;

-- Guarded source integration. Selected-item trial cannot enter old unit-only
-- SECURITY DEFINER scoring RPCs until their individual item ports are wired.
CREATE OR REPLACE FUNCTION sitov_access_private.legacy_unit_allowed(p_student uuid,p_unit uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.learning_units u JOIN public.profiles p ON p.id=p_student
 LEFT JOIN public.learning_trainer_grants g ON g.auth_user_id=p.id AND g.level=u.level AND g.trainer=u.trainer
 WHERE u.id=p_unit AND (u.owner_auth_user_id IS NULL OR u.owner_auth_user_id=p.id)
 AND (p.role IN('teacher','admin') OR (u.level IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2','C1.1','C1.2')
 AND NOT(u.trainer='verbs' AND u.level IN('C1.1','C1.2')) AND (u.is_active OR u.owner_auth_user_id=p.id)
 AND EXISTS(SELECT 1 FROM public.student_level_access a WHERE a.auth_user_id=p.id AND a.level=u.level)
 AND coalesce(g.enabled,true) AND (u.owner_auth_user_id=p.id OR g.unit_mode IS DISTINCT FROM 'selected'
 OR EXISTS(SELECT 1 FROM public.learning_unit_grants x WHERE x.auth_user_id=p.id AND x.unit_id=u.id AND x.level=u.level AND x.trainer=u.trainer)))))
$$;
CREATE OR REPLACE FUNCTION sitov_access_private.unit_allowed(p_student uuid,p_unit uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT sitov_access_private.actor_allowed(p_student) AND EXISTS(SELECT 1 FROM public.learning_units u JOIN public.profiles p ON p.id=p_student
 WHERE u.id=p_unit AND (u.owner_auth_user_id IS NULL OR u.owner_auth_user_id=p.id)
 AND (sitov_access_private.legacy_unit_allowed(p_student,p_unit)
 OR (p.role='student' AND (u.is_active OR u.owner_auth_user_id=p.id)
 AND u.level IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2','C1.1','C1.2')
 AND NOT(u.trainer='verbs' AND u.level IN('C1.1','C1.2')) AND (
 EXISTS(SELECT 1 FROM sitov_access_private.students s WHERE s.student_id=p.id AND s.vip_enabled)
 OR sitov_access_private.purchased(p.id,u.level)
 OR (u.owner_auth_user_id IS NULL AND EXISTS(SELECT 1 FROM sitov_access_private.students s,
 LATERAL jsonb_array_elements(s.trial->'rules') r WHERE s.student_id=p.id AND r->>'level'=u.level AND r->>'trainer'=u.trainer::text
 AND (r->'unit_ids'='null'::jsonb OR r->'unit_ids' @> to_jsonb(ARRAY[u.id::text]))
 AND (r->'items'='null'::jsonb OR EXISTS(SELECT 1 FROM jsonb_array_elements(r->'items') b
 WHERE b->>'unit_id'=u.id::text AND b->'refs'='null'::jsonb))))))))
$$;
CREATE OR REPLACE FUNCTION sitov_access_private.level_allowed(p_student uuid,p_level text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT sitov_access_private.actor_allowed(p_student) AND p_level IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2','C1.1','C1.2')
 AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_student AND (p.role IN('teacher','admin')
 OR EXISTS(SELECT 1 FROM public.student_level_access a WHERE a.auth_user_id=p.id AND a.level=p_level)
 OR EXISTS(SELECT 1 FROM sitov_access_private.students s WHERE s.student_id=p.id AND (s.vip_enabled OR EXISTS(
 SELECT 1 FROM jsonb_array_elements(s.trial->'rules') r WHERE r->>'level'=p_level
 AND r->'unit_ids'<>'[]'::jsonb AND (r->'items'='null'::jsonb OR EXISTS(
 SELECT 1 FROM jsonb_array_elements(r->'items') b WHERE (b->'refs'='null'::jsonb OR b->'refs'<>'[]'::jsonb)
 AND (r->'unit_ids'='null'::jsonb OR r->'unit_ids' @> jsonb_build_array(b->>'unit_id'))))))) OR sitov_access_private.purchased(p.id,p_level)))
$$;
CREATE OR REPLACE FUNCTION trainer_access_private.allowed(p_level text,p_trainer text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT sitov_access_private.actor_allowed(auth.uid()) AND p_level IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2','C1.1','C1.2')
 AND p_trainer IN('vocabulary','exercises','pronunciation','videos','verbs') AND NOT(p_trainer='verbs' AND p_level IN('C1.1','C1.2'))
 AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND (p.role IN('teacher','admin')
 OR sitov_access_private.purchased(p.id,p_level) OR EXISTS(SELECT 1 FROM sitov_access_private.students s WHERE s.student_id=p.id AND s.vip_enabled)
 OR (EXISTS(SELECT 1 FROM public.student_level_access a WHERE a.auth_user_id=p.id AND a.level=p_level)
 AND coalesce((SELECT g.enabled FROM public.learning_trainer_grants g WHERE g.auth_user_id=p.id AND g.level=p_level AND g.trainer::text=p_trainer),true))))
$$;
CREATE OR REPLACE FUNCTION trainer_access_private.unit_allowed(p_level text,p_trainer text,p_unit text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.learning_units u WHERE u.id::text=p_unit AND u.level=p_level AND u.trainer::text=p_trainer
 AND sitov_access_private.unit_allowed(auth.uid(),u.id))
$$;
CREATE OR REPLACE FUNCTION learning_private.unit_allowed(p_unit_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT sitov_access_private.unit_allowed(auth.uid(),p_unit_id) $$;
CREATE OR REPLACE FUNCTION learning_private.allowed_unit_ids() RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(array_agg(id),'{}'::uuid[]) FROM public.learning_units WHERE sitov_access_private.unit_allowed(auth.uid(),id)
$$;
CREATE OR REPLACE FUNCTION public.get_sitov_access_catalog(p_level text,p_trainer text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT sitov_access_private.actor_allowed(auth.uid()) THEN RETURN jsonb_build_object('error','forbidden');END IF;
 IF p_level NOT IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2','C1.1','C1.2')
 OR p_trainer NOT IN('vocabulary','exercises','pronunciation','videos','verbs') THEN RETURN jsonb_build_object('error','invalid_input');END IF;
 RETURN (WITH refs AS (
 SELECT 'vocabulary_card' kind,id::text id FROM public.learning_vocabulary_cards
 UNION ALL SELECT CASE WHEN node_id IS NULL THEN 'exercise' ELSE 'path_task' END,id::text FROM public.learning_exercises
 UNION ALL SELECT 'reading_text',id::text FROM public.learning_reading_texts
 UNION ALL SELECT 'video',id::text FROM public.learning_videos
 UNION ALL SELECT 'verb',id FROM public.sitov_verb_catalog
 UNION ALL SELECT 'path_node',id::text FROM public.path_nodes
 UNION ALL SELECT 'presentation',asset_id::text FROM public.lms_presentation_asset
 ),items AS (SELECT r.kind,r.id,i.unit_id,i.published FROM refs r CROSS JOIN LATERAL sitov_access_private.resolve_item(r.kind,r.id) i
 WHERE i.level=p_level AND i.trainer=p_trainer AND (i.owner_id IS NULL OR i.owner_id=auth.uid()) AND sitov_access_private.item_allowed(auth.uid(),r.kind,r.id)),
 units AS (SELECT i.unit_id,coalesce(u.label,'') label,jsonb_agg(jsonb_build_object('kind',i.kind,'id',i.id,'label',coalesce(u.label,''),'published',i.published) ORDER BY i.kind,i.id) items
 FROM items i LEFT JOIN public.learning_units u ON u.id=i.unit_id GROUP BY i.unit_id,u.label)
 SELECT jsonb_build_object('version',1,'level',p_level,'trainer',p_trainer,'units',coalesce(jsonb_agg(jsonb_build_object('id',unit_id,'label',label,'items',items) ORDER BY unit_id),'[]'::jsonb)) FROM units);
END $$;
REVOKE ALL ON FUNCTION sitov_access_private.legacy_unit_allowed(uuid,uuid),sitov_access_private.unit_allowed(uuid,uuid),sitov_access_private.level_allowed(uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_sitov_access_catalog(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_sitov_access_catalog(text,text) TO authenticated;

-- RESTRICTIVE policies compose with existing publication/pedagogy checks.
DROP POLICY IF EXISTS sitov_commercial_item_scope ON public.learning_vocabulary_cards;
CREATE POLICY sitov_commercial_item_scope ON public.learning_vocabulary_cards AS RESTRICTIVE FOR SELECT TO authenticated
 USING(sitov_access_private.item_allowed(auth.uid(),'vocabulary_card',id::text));
DROP POLICY IF EXISTS sitov_commercial_item_scope ON public.learning_exercises;
CREATE POLICY sitov_commercial_item_scope ON public.learning_exercises AS RESTRICTIVE FOR SELECT TO authenticated
 USING(sitov_access_private.item_allowed(auth.uid(),CASE WHEN node_id IS NULL THEN 'exercise' ELSE 'path_task' END,id::text));
DROP POLICY IF EXISTS sitov_commercial_item_scope ON public.learning_reading_texts;
CREATE POLICY sitov_commercial_item_scope ON public.learning_reading_texts AS RESTRICTIVE FOR SELECT TO authenticated
 USING(sitov_access_private.item_allowed(auth.uid(),'reading_text',id::text));
DROP POLICY IF EXISTS sitov_commercial_item_scope ON public.learning_videos;
CREATE POLICY sitov_commercial_item_scope ON public.learning_videos AS RESTRICTIVE FOR SELECT TO authenticated
 USING(sitov_access_private.item_allowed(auth.uid(),'video',id::text));
