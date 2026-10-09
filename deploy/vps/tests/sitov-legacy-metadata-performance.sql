-- Sitov Academy: populated synthetic commercial cases on real users, all rolled back.
-- Native claims are not signed HTTP sessions or real MFA evidence.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout='8s';
SET LOCAL lock_timeout='2s';
DO $sitov$
DECLARE actor record; other_id uuid; staff_actor record; target record; empty_id uuid:=gen_random_uuid(); sitov_order uuid:=gen_random_uuid();
BEGIN
 SELECT u.id,u.role,u.raw_app_meta_data INTO actor FROM auth.users u JOIN public.profiles p ON p.id=u.id WHERE p.role='student' ORDER BY u.id LIMIT 1;
 SELECT id INTO other_id FROM public.profiles WHERE role='student' AND id<>actor.id ORDER BY id LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub',actor.id::text,true);PERFORM set_config('request.jwt.claim.role',actor.role,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor.id,'role',actor.role,'app_metadata',actor.raw_app_meta_data)::text,true);
 SELECT u.id,u.level,u.label,(SELECT c.id FROM public.learning_vocabulary_cards c WHERE c.unit_id=u.id ORDER BY c.id LIMIT 1)card1,
 (SELECT c.id FROM public.learning_vocabulary_cards c WHERE c.unit_id=u.id ORDER BY c.id OFFSET 1 LIMIT 1)card2 INTO target
 FROM public.learning_units u WHERE u.trainer='vocabulary' AND u.owner_auth_user_id IS NULL AND u.is_active
 AND NOT EXISTS(SELECT 1 FROM public.student_level_access l WHERE l.auth_user_id=actor.id AND l.level=u.level)
 AND (SELECT count(*) FROM public.learning_vocabulary_cards c WHERE c.unit_id=u.id)>=2 ORDER BY u.id LIMIT 1;
 SELECT id INTO other_id FROM public.profiles p WHERE p.role='student' AND p.id<>actor.id AND NOT EXISTS(SELECT 1 FROM public.learning_units u WHERE u.owner_auth_user_id=p.id AND u.level=target.level) ORDER BY id LIMIT 1;
 IF target.id IS NULL OR other_id IS NULL THEN RAISE EXCEPTION 'sitov_fixture_actual_targets_missing';END IF;
 INSERT INTO sitov_access_private.students(student_id)VALUES(actor.id) ON CONFLICT(student_id)DO UPDATE SET vip_enabled=false,trial='{"version":1,"rules":[]}';
 IF sitov_access_private.vocabulary_unit_visible(target.id) OR target.id=ANY(learning_private.allowed_unit_ids()) OR sitov_access_private.actor_allowed(other_id) THEN RAISE EXCEPTION 'sitov_fixture_base_or_actor';END IF;
 UPDATE sitov_access_private.students SET vip_enabled=true WHERE student_id=actor.id;
 IF NOT sitov_access_private.vocabulary_unit_visible(target.id) OR NOT target.id=ANY(learning_private.allowed_unit_ids()) THEN RAISE EXCEPTION 'sitov_fixture_vip';END IF;
 INSERT INTO public.learning_units(id,level,trainer,label,sort_order,is_active)VALUES(empty_id,target.level,'vocabulary','Sitov Academy rollback fixture',999999,true);
 IF sitov_access_private.vocabulary_unit_visible(empty_id) THEN RAISE EXCEPTION 'sitov_fixture_empty';END IF;
 UPDATE public.learning_units SET owner_auth_user_id=other_id,label='Eigene Wörter' WHERE id=target.id;
 IF sitov_access_private.vocabulary_unit_visible(target.id) OR target.id=ANY(learning_private.allowed_unit_ids()) THEN RAISE EXCEPTION 'sitov_fixture_foreign_owner';END IF;
 UPDATE public.learning_units SET owner_auth_user_id=NULL,label=target.label WHERE id=target.id;
 UPDATE sitov_access_private.students SET vip_enabled=false WHERE student_id=actor.id;
 INSERT INTO sitov_access_private.orders(id,student_id,level,request_id,status,provider,provider_confirmation_verified,amount_minor,currency)
 VALUES(sitov_order,actor.id,target.level,gen_random_uuid(),'paid','stripe',true,100,'EUR');
 INSERT INTO sitov_access_private.purchases(order_id)VALUES(sitov_order);
 IF NOT sitov_access_private.vocabulary_unit_visible(target.id) OR NOT target.id=ANY(learning_private.allowed_unit_ids()) THEN RAISE EXCEPTION 'sitov_fixture_paid';END IF;
 UPDATE sitov_access_private.purchases SET active=false WHERE purchases.order_id=sitov_order;
 IF sitov_access_private.vocabulary_unit_visible(target.id) OR target.id=ANY(learning_private.allowed_unit_ids()) THEN RAISE EXCEPTION 'sitov_fixture_inactive';END IF;
 UPDATE sitov_access_private.orders SET status='pending',provider_confirmation_verified=false WHERE id=sitov_order;
 UPDATE sitov_access_private.purchases SET active=true WHERE purchases.order_id=sitov_order;
 IF sitov_access_private.vocabulary_unit_visible(target.id) OR target.id=ANY(learning_private.allowed_unit_ids()) THEN RAISE EXCEPTION 'sitov_fixture_unverified';END IF;
 DELETE FROM sitov_access_private.purchases WHERE purchases.order_id=sitov_order;DELETE FROM sitov_access_private.orders WHERE id=sitov_order;
 UPDATE sitov_access_private.students SET trial=jsonb_build_object('version',1,'rules',jsonb_build_array(jsonb_build_object('level',target.level,'trainer','vocabulary','unit_ids',jsonb_build_array(target.id),'items',NULL))) WHERE student_id=actor.id;
 IF NOT sitov_access_private.vocabulary_unit_visible(target.id) OR NOT target.id=ANY(learning_private.allowed_unit_ids()) THEN RAISE EXCEPTION 'sitov_fixture_full_trial';END IF;
 UPDATE sitov_access_private.students SET trial=jsonb_build_object('version',1,'rules',jsonb_build_array(jsonb_build_object('level',target.level,'trainer','vocabulary','unit_ids',jsonb_build_array(target.id),'items',jsonb_build_array(jsonb_build_object('unit_id',target.id,'refs',jsonb_build_array(jsonb_build_object('kind','vocabulary_card','id',target.card1))))))) WHERE student_id=actor.id;
 IF NOT sitov_access_private.vocabulary_unit_visible(target.id) OR target.id=ANY(learning_private.allowed_unit_ids()) OR NOT sitov_access_private.item_allowed(actor.id,'vocabulary_card',target.card1::text) OR sitov_access_private.item_allowed(actor.id,'vocabulary_card',target.card2::text) THEN RAISE EXCEPTION 'sitov_fixture_partial_trial';END IF;
 UPDATE sitov_access_private.students SET trial='{"version":1,"rules":[]}' WHERE student_id=actor.id;
 INSERT INTO public.student_level_access(auth_user_id,level)VALUES(actor.id,target.level)ON CONFLICT DO NOTHING;
 INSERT INTO public.learning_trainer_grants(auth_user_id,level,trainer,enabled,unit_mode)VALUES(actor.id,target.level,'vocabulary',false,'selected')ON CONFLICT(auth_user_id,level,trainer)DO UPDATE SET enabled=false,unit_mode='selected';
 IF sitov_access_private.vocabulary_unit_visible(target.id) OR target.id=ANY(learning_private.allowed_unit_ids()) THEN RAISE EXCEPTION 'sitov_fixture_disabled';END IF;
 UPDATE public.learning_trainer_grants SET enabled=true WHERE auth_user_id=actor.id AND level=target.level AND trainer='vocabulary';
 DELETE FROM public.learning_unit_grants WHERE auth_user_id=actor.id AND level=target.level AND trainer='vocabulary';
 IF sitov_access_private.vocabulary_unit_visible(target.id) OR target.id=ANY(learning_private.allowed_unit_ids()) THEN RAISE EXCEPTION 'sitov_fixture_selected_missing';END IF;
 INSERT INTO public.learning_unit_grants(auth_user_id,level,trainer,unit_id)VALUES(actor.id,target.level,'vocabulary',target.id)ON CONFLICT DO NOTHING;
 IF NOT sitov_access_private.vocabulary_unit_visible(target.id) OR NOT target.id=ANY(learning_private.allowed_unit_ids()) THEN RAISE EXCEPTION 'sitov_fixture_selected_granted';END IF;
 SELECT u.id,u.role,u.raw_app_meta_data INTO staff_actor FROM auth.users u JOIN public.profiles p ON p.id=u.id WHERE p.role='teacher' ORDER BY u.id LIMIT 1;
 IF staff_actor.id IS NULL THEN RAISE EXCEPTION 'sitov_fixture_teacher_missing';END IF;
 PERFORM set_config('request.jwt.claim.sub',staff_actor.id::text,true);PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',staff_actor.id,'role',staff_actor.role,'app_metadata',staff_actor.raw_app_meta_data)::text,true);
 UPDATE public.profiles SET sitov_mfa_required=true WHERE id=staff_actor.id;
END
$sitov$;
DO $sitov$ BEGIN
 IF sitov_access_private.staff() THEN RAISE EXCEPTION 'sitov_fixture_staff_without_mfa';END IF;
END $sitov$;
SELECT 'sitov_legacy_metadata_fixture_ok';
ROLLBACK;
