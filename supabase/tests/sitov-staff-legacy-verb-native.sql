-- Sitov Academy: synthetic native counterexamples; no production/session proof.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout='8s';
SET LOCAL application_name='sitov_S1_epoch32_fixture';
CREATE TEMP TABLE sitov_checks(label text PRIMARY KEY,passed boolean NOT NULL);
CREATE TEMP TABLE sitov_cases AS SELECT row_number()OVER(ORDER BY c.id)::int n,c.id verb,u.id unit FROM public.sitov_verb_catalog c JOIN public.learning_units u ON u.id=c.unit_id WHERE c.level='A1.1' AND u.level=c.level ORDER BY c.id LIMIT 8;
DO $$BEGIN IF (SELECT count(*) FROM sitov_cases)<>8 THEN RAISE EXCEPTION 'sitov_fixture_catalog_missing';END IF;END$$;
UPDATE public.learning_units u SET level=CASE c.n WHEN 1 THEN 'B2.1' WHEN 2 THEN 'B2.2' WHEN 3 THEN 'B2' WHEN 4 THEN 'C1' WHEN 5 THEN 'C1.1' ELSE 'A1.1' END,is_active=(c.n<>6),trainer=CASE WHEN c.n=8 THEN 'exercises'::public.trainer_code ELSE 'verbs'::public.trainer_code END,label=CASE WHEN c.n=8 THEN 'Sitov Academy synthetic trainer mismatch' ELSE u.label END FROM sitov_cases c WHERE u.id=c.unit;
UPDATE public.sitov_verb_catalog v SET level=CASE c.n WHEN 1 THEN 'B2.1' WHEN 2 THEN 'B2.2' WHEN 3 THEN 'B2' WHEN 4 THEN 'C1' WHEN 5 THEN 'C1.1' WHEN 7 THEN 'A1.2' ELSE 'A1.1' END FROM sitov_cases c WHERE v.id=c.verb;
INSERT INTO sitov_access_private.students(student_id,vip_enabled)VALUES('00000000-0000-4000-8000-000000000107',true);
INSERT INTO sitov_access_private.orders(id,student_id,level,request_id,status,provider,provider_confirmation_verified,amount_minor,currency)VALUES('00000000-0000-4000-8000-000000009901','00000000-0000-4000-8000-000000000104','B2.1','00000000-0000-4000-8000-000000009902','paid','stripe',true,100,'EUR');
INSERT INTO sitov_access_private.purchases(order_id)VALUES('00000000-0000-4000-8000-000000009901');
INSERT INTO sitov_access_private.students(student_id,trial)SELECT '00000000-0000-4000-8000-000000000102',jsonb_build_object('version',1,'rules',jsonb_build_array(jsonb_build_object('level','B2.2','trainer','verbs','unit_ids',jsonb_build_array(unit),'items',jsonb_build_array(jsonb_build_object('unit_id',unit,'refs',jsonb_build_array(jsonb_build_object('kind','verb','id',verb))))))) FROM sitov_cases WHERE n=2;
INSERT INTO sitov_access_private.students(student_id,trial)SELECT '00000000-0000-4000-8000-000000000103',jsonb_build_object('version',1,'rules',jsonb_build_array(jsonb_build_object('level','B2.1','trainer','verbs','unit_ids',jsonb_build_array(unit),'items',NULL)))FROM sitov_cases WHERE n=1;
CREATE TEMP TABLE sitov_student_before(actor uuid,rights jsonb);
DO $$DECLARE uid uuid;BEGIN
 FOR uid IN SELECT id FROM public.profiles WHERE role='student' LOOP
  PERFORM set_config('request.jwt.claim.sub',uid::text,true);PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
  INSERT INTO sitov_student_before SELECT uid,jsonb_agg(jsonb_build_array(c.n,learning_private.unit_allowed(c.unit),sitov_verb_private.verb_allowed(uid,c.verb))ORDER BY c.n)FROM sitov_cases c;
 END LOOP;
END$$;
CREATE TEMP TABLE sitov_function_before AS SELECT p.oid,pg_get_functiondef(p.oid) definition,to_jsonb(p)-'prosrc' metadata FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prokind='f' AND n.nspname NOT IN('pg_catalog','information_schema');
CREATE TEMP TABLE sitov_policy_before AS SELECT to_jsonb(p) value FROM pg_policies p;
-- SITOV113_FIRST_APPLICATION
CREATE TEMP TABLE sitov_function_once AS SELECT p.oid,pg_get_functiondef(p.oid) definition,to_jsonb(p)metadata FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prokind='f' AND n.nspname NOT IN('pg_catalog','information_schema');
-- SITOV113_SECOND_APPLICATION
INSERT INTO sitov_checks SELECT 'only_two_bodies_metadata_acl_preserved',count(*)FILTER(WHERE pg_get_functiondef(p.oid)<>b.definition)=2 AND bool_and(pg_get_functiondef(p.oid)=b.definition OR p.oid IN('sitov_access_private.legacy_unit_allowed(uuid,uuid)'::regprocedure,'sitov_access_private.item_allowed(uuid,text,text)'::regprocedure)) AND bool_and((to_jsonb(p)-'prosrc')=b.metadata) FROM sitov_function_before b JOIN pg_proc p ON p.oid=b.oid;
INSERT INTO sitov_checks SELECT 'second_apply_idempotent',bool_and(pg_get_functiondef(p.oid)=b.definition AND to_jsonb(p)=b.metadata) FROM sitov_function_once b JOIN pg_proc p ON p.oid=b.oid;
INSERT INTO sitov_checks SELECT 'policies_unchanged',NOT EXISTS((SELECT value FROM sitov_policy_before EXCEPT SELECT to_jsonb(p)FROM pg_policies p)UNION ALL(SELECT to_jsonb(p)FROM pg_policies p EXCEPT SELECT value FROM sitov_policy_before));
DO $$DECLARE row record;got jsonb;BEGIN
 FOR row IN SELECT * FROM sitov_student_before LOOP
  PERFORM set_config('request.jwt.claim.sub',row.actor::text,true);PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',row.actor,'role','authenticated')::text,true);
  SELECT jsonb_agg(jsonb_build_array(c.n,learning_private.unit_allowed(c.unit),sitov_verb_private.verb_allowed(row.actor,c.verb))ORDER BY c.n)INTO got FROM sitov_cases c;
  IF got<>row.rights THEN RAISE EXCEPTION 'sitov_student_rights_changed';END IF;
 END LOOP;
END$$;
INSERT INTO sitov_checks VALUES('all_student_fixture_paths_unchanged',true);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000107',true),set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000107","role":"authenticated"}',true);
INSERT INTO sitov_checks SELECT 'student_vip_positive',learning_private.unit_allowed(unit)AND sitov_verb_private.verb_allowed(auth.uid(),verb)FROM sitov_cases WHERE n=1;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000104',true),set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000104","role":"authenticated"}',true);
INSERT INTO sitov_checks SELECT 'student_paid_verified_positive',learning_private.unit_allowed(unit)AND sitov_verb_private.verb_allowed(auth.uid(),verb)FROM sitov_cases WHERE n=1;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true),set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated"}',true);
INSERT INTO sitov_checks SELECT 'student_partial_trial_granular',NOT learning_private.unit_allowed(unit)AND sitov_verb_private.verb_allowed(auth.uid(),verb)FROM sitov_cases WHERE n=2;
INSERT INTO sitov_checks SELECT 'student_foreign_actor_denied',NOT sitov_access_private.actor_allowed('00000000-0000-4000-8000-000000000107');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000103',true),set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}',true);
INSERT INTO sitov_checks SELECT 'student_full_trial_positive',learning_private.unit_allowed(unit)AND sitov_verb_private.verb_allowed(auth.uid(),verb)FROM sitov_cases WHERE n=1;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000106',true),set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000106","role":"authenticated"}',true);
INSERT INTO sitov_checks SELECT 'teacher_case_'||n,learning_private.unit_allowed(unit)=(n IN(1,2,6,7,8)) AND sitov_verb_private.verb_allowed(auth.uid(),verb)=(n IN(1,2)) FROM sitov_cases;
INSERT INTO sitov_checks SELECT 'unknown_ids_denied',NOT learning_private.unit_allowed('00000000-0000-4000-8000-000000009999')AND NOT sitov_verb_private.verb_allowed(auth.uid(),'sitov-absent');
INSERT INTO sitov_checks SELECT 'nonverb_staff_unchanged',sitov_access_private.item_allowed(auth.uid(),'vocabulary_card','00000000-0000-4000-8000-000000000301');
UPDATE public.learning_units SET owner_auth_user_id='00000000-0000-4000-8000-000000000104',label='Eigene Wörter' WHERE id='00000000-0000-4000-8000-000000000212';
INSERT INTO sitov_checks SELECT 'foreign_owner_denied',NOT learning_private.unit_allowed('00000000-0000-4000-8000-000000000212');
UPDATE public.profiles SET sitov_mfa_required=true WHERE id='00000000-0000-4000-8000-000000000106';
INSERT INTO sitov_checks SELECT 'teacher_mfa_exemption',sitov_access_private.staff()AND NOT sitov_security_private.sitov_staff_mfa_required();
UPDATE public.profiles SET role='admin',sitov_mfa_required=true WHERE id='00000000-0000-4000-8000-000000000106';
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000106","role":"authenticated","aal":"aal1"}',true);
INSERT INTO sitov_checks SELECT 'admin_mfa_denied',NOT sitov_access_private.actor_allowed(auth.uid())AND NOT sitov_verb_private.verb_allowed(auth.uid(),verb)FROM sitov_cases WHERE n=1;
INSERT INTO auth.mfa_factors(user_id,status,factor_type)VALUES('00000000-0000-4000-8000-000000000106','verified','totp');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000106","role":"authenticated","aal":"aal2"}',true);
INSERT INTO sitov_checks SELECT 'admin_mfa_canonical_allow',sitov_access_private.actor_allowed(auth.uid())AND sitov_verb_private.verb_allowed(auth.uid(),verb)FROM sitov_cases WHERE n=2;
INSERT INTO sitov_checks SELECT 'admin_mfa_noncanonical_deny',NOT sitov_verb_private.verb_allowed(auth.uid(),verb)FROM sitov_cases WHERE n=3;
DO $$DECLARE bad text;BEGIN SELECT string_agg(label,',')INTO bad FROM sitov_checks WHERE NOT passed;IF bad IS NOT NULL THEN RAISE EXCEPTION 'sitov_staff_113_failed: %',bad;END IF;END$$;
SELECT jsonb_build_object('sitovStaff113Passed',true,'checks',(SELECT count(*)FROM sitov_checks),'studentActors',(SELECT count(*)FROM sitov_student_before));
ROLLBACK;
