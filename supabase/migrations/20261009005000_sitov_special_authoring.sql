-- Sitov Academy: bounded source-bound CREATE-only inactive author port. No publication or audio claims.
INSERT INTO sitov_special_private.sources(source_ref,source_sha256,level,evidence_uri,active)
VALUES('sitov.source.a11.wohnung.artikel.pdf.v1','d59dd2bb1f019e6f9945347e69320245a18881ac53769de9a6a7328a38a8d507','A1.1',
'obsidian:Teacher/Lernpfad /Specials/A1_1 Specials/Arbeitsblatt_A1_1_Lektion4_Artikel_mit_Loesungen_RU.pdf',false)
ON CONFLICT(source_ref) DO NOTHING;
CREATE TABLE IF NOT EXISTS sitov_special_private.author_receipts (
 actor_id uuid NOT NULL REFERENCES public.profiles(id),request_id uuid NOT NULL,payload jsonb NOT NULL,response jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(actor_id,request_id)
);
CREATE TABLE IF NOT EXISTS sitov_special_private.authored_drafts (
 definition_id uuid PRIMARY KEY REFERENCES sitov_special_private.definitions(id),actor_id uuid NOT NULL REFERENCES public.profiles(id),
 source_sha256 text NOT NULL,anchor_version text NOT NULL,payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sitov_special_private.author_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sitov_special_private.authored_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sitov_special_private.author_receipts,sitov_special_private.authored_drafts FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS sitov_author_receipt_immutable ON sitov_special_private.author_receipts;
CREATE TRIGGER sitov_author_receipt_immutable BEFORE UPDATE OR DELETE ON sitov_special_private.author_receipts
 FOR EACH ROW EXECUTE FUNCTION sitov_special_private.immutable_definition();
DROP TRIGGER IF EXISTS sitov_author_draft_immutable ON sitov_special_private.authored_drafts;
CREATE TRIGGER sitov_author_draft_immutable BEFORE UPDATE OR DELETE ON sitov_special_private.authored_drafts
 FOR EACH ROW EXECUTE FUNCTION sitov_special_private.immutable_definition();
CREATE OR REPLACE FUNCTION sitov_special_private.author_anchor_version(p_unit uuid,p_anchor uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT encode(sha256(convert_to(jsonb_build_object('unit',jsonb_build_object('id',u.id,'level',u.level,'source',u.path_source_id,'active',u.is_active,'path',u.is_path),
 'anchor',to_jsonb(n))::text,'UTF8')),'hex') FROM public.learning_units u JOIN public.path_nodes n ON n.unit_id=u.id
 WHERE u.id=p_unit AND n.id=p_anchor $$;
CREATE OR REPLACE FUNCTION public.sitov_special_author_context(p_unit_id uuid,p_anchor_id uuid,p_source_ref text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RETURN sitov_special_private.error('authentication_required');END IF;
 IF NOT sitov_access_private.staff() THEN RETURN sitov_special_private.error('not_found');END IF;
 IF p_source_ref IS DISTINCT FROM 'sitov.source.a11.wohnung.artikel.pdf.v1' OR NOT EXISTS(
 SELECT 1 FROM public.learning_units u JOIN public.path_nodes n ON n.unit_id=u.id JOIN sitov_special_private.sources s ON s.source_ref=p_source_ref
 WHERE u.id=p_unit_id AND n.id=p_anchor_id AND u.id='f72f211a-9d44-41a2-af18-87976effe62d'::uuid AND n.id='9f92ad82-cb5c-40cf-86d3-87b17b75c5bb'::uuid
 AND u.owner_auth_user_id IS NULL AND u.is_path AND u.is_active AND u.level='A1.1' AND u.path_source_id='P4'
 AND n.kind='practice' AND n.source_id='P4-N1' AND n.is_active AND 'P4-G1'=ANY(n.goals) AND s.level=u.level
 AND s.source_sha256='d59dd2bb1f019e6f9945347e69320245a18881ac53769de9a6a7328a38a8d507'
 AND s.evidence_uri='obsidian:Teacher/Lernpfad /Specials/A1_1 Specials/Arbeitsblatt_A1_1_Lektion4_Artikel_mit_Loesungen_RU.pdf') THEN RETURN sitov_special_private.error('not_found');END IF;
 RETURN jsonb_build_object('ok',true,'data',jsonb_build_object('unitId',p_unit_id,'anchorNodeId',p_anchor_id,'sourceRef',p_source_ref,
 'sourceSha256','d59dd2bb1f019e6f9945347e69320245a18881ac53769de9a6a7328a38a8d507','anchorVersion',sitov_special_private.author_anchor_version(p_unit_id,p_anchor_id),
 'specialExists',EXISTS(SELECT 1 FROM public.path_nodes WHERE unit_id=p_unit_id AND source_id='sitov-special-a11-artikel-nominativ-v1')));
END $$;
CREATE OR REPLACE FUNCTION public.sitov_special_author_create(p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();unit uuid;anchor uuid;request uuid;node uuid:=gen_random_uuid();def uuid:=gen_random_uuid();ctx jsonb;
 item jsonb;snap jsonb;ev jsonb;lang text;tr jsonb;part record;total integer:=0;ord integer:=0;pool jsonb:='[]';version text;response jsonb;saved sitov_special_private.author_receipts;
BEGIN
 IF actor IS NULL THEN RETURN sitov_special_private.error('authentication_required');END IF;
 IF NOT sitov_access_private.staff() THEN RETURN sitov_special_private.error('not_found');END IF;
 IF NOT path_private.only_keys(p_input,ARRAY['requestId','unitId','anchorNodeId','sourceRef','sourceSha256','expectedAnchorVersion','specialSourceId','title','topic','goalId','blueprint','items'])
 OR (SELECT count(*) FROM jsonb_object_keys(p_input))<>12 OR octet_length(p_input::text)>800000
 OR p_input->>'specialSourceId' IS DISTINCT FROM 'sitov-special-a11-artikel-nominativ-v1'
 OR p_input->>'goalId' IS DISTINCT FROM 'P4-G1' OR NOT path_private.valid_text(p_input->'title',200)
 OR NOT path_private.valid_text(p_input->'topic',200) OR NOT path_private.german_task_allowed(jsonb_build_object('question',p_input->'title','instruction',p_input->'topic'))
 OR jsonb_typeof(p_input->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p_input->'items') NOT BETWEEN 20 AND 100
 OR jsonb_typeof(p_input->'blueprint') IS DISTINCT FROM 'object' THEN RETURN sitov_special_private.error('invalid_input');END IF;
 unit:=(p_input->>'unitId')::uuid;anchor:=(p_input->>'anchorNodeId')::uuid;request:=(p_input->>'requestId')::uuid;
 IF request IS NULL OR unit IS NULL OR anchor IS NULL THEN RETURN sitov_special_private.error('invalid_input');END IF;
 -- Actor/request lock makes uncertain retry deterministic; unit lock serializes competing new node writes.
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||':'||request::text,101));
 PERFORM 1 FROM public.learning_units WHERE id=unit FOR UPDATE;
 PERFORM 1 FROM public.path_nodes WHERE id=anchor AND unit_id=unit FOR UPDATE;
 PERFORM 1 FROM sitov_special_private.sources WHERE source_ref=p_input->>'sourceRef' FOR SHARE;
 PERFORM 1 FROM public.profiles WHERE id=actor FOR SHARE;
 IF NOT sitov_access_private.staff() THEN RETURN sitov_special_private.error('not_found');END IF;
 ctx:=public.sitov_special_author_context(unit,anchor,p_input->>'sourceRef');
 IF ctx->>'ok' IS DISTINCT FROM 'true' THEN RETURN ctx;END IF;
 IF p_input->>'sourceSha256' IS DISTINCT FROM ctx#>>'{data,sourceSha256}' THEN RETURN sitov_special_private.error('source_conflict');END IF;
 IF p_input->>'expectedAnchorVersion' IS DISTINCT FROM ctx#>>'{data,anchorVersion}' THEN RETURN sitov_special_private.error('stale_revision');END IF;
 SELECT * INTO saved FROM sitov_special_private.author_receipts WHERE actor_id=actor AND request_id=request;
 IF FOUND THEN IF saved.payload=p_input THEN RETURN saved.response;ELSE RETURN sitov_special_private.error('request_conflict');END IF;END IF;
 IF ctx#>>'{data,specialExists}'='true' THEN RETURN sitov_special_private.error('already_exists');END IF;
 IF jsonb_array_length(p_input->'items')<>(SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(p_input->'items'))
 OR jsonb_array_length(p_input->'items')<>(SELECT count(DISTINCT value->>'stableId') FROM jsonb_array_elements(p_input->'items'))
 OR jsonb_array_length(p_input->'items')<>(SELECT count(DISTINCT jsonb_build_object('type',value#>'{snapshot,type}','content',value#>'{snapshot,content}')) FROM jsonb_array_elements(p_input->'items')) THEN RETURN sitov_special_private.error('invalid_input');END IF;
 FOR part IN SELECT key,value FROM jsonb_each_text(p_input->'blueprint') LOOP
  IF part.value !~ '^[1-9]$|^10$' OR length(part.key)>120 OR
  (SELECT count(*) FROM jsonb_array_elements(p_input->'items') i WHERE i->>'stratum'=part.key)<2*part.value::integer THEN RETURN sitov_special_private.error('invalid_input');END IF;
  total:=total+part.value::integer;
 END LOOP;
 IF total<>10 THEN RETURN sitov_special_private.error('invalid_input');END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_input->'items') LOOP
  snap:=item->'snapshot';ev:=item->'sourceEvidence';
  IF NOT path_private.only_keys(item,ARRAY['id','stableId','stratum','snapshot','sourceEvidence']) OR (SELECT count(*) FROM jsonb_object_keys(item))<>5
  OR item->>'stratum' IS NULL OR item->>'stratum' NOT IN('masculine','feminine','neuter')
  OR item->>'stableId' !~ '^sitov-special-a11-artikel-nominativ-v1-item-[0-9]{3}$'
  OR NOT path_private.only_keys(snap,ARRAY['id','type','content','goal_id','translations']) OR (SELECT count(*) FROM jsonb_object_keys(snap))<>5
  OR item->>'id' IS DISTINCT FROM snap->>'id' OR snap->>'goal_id' IS DISTINCT FROM 'P4-G1'
  OR snap->>'type' NOT IN('multiple_choice','fill_in_blank','sentence_building') OR NOT (p_input->'blueprint') ? (item->>'stratum')
  OR NOT path_private.valid_content((snap->>'type')::public.exercise_type,snap->'content')
  OR NOT path_private.only_keys(ev,ARRAY['sourceRef','sourceSha256','task','solution','adaptation','rationale']) OR (SELECT count(*) FROM jsonb_object_keys(ev))<>6
  OR NOT path_private.only_keys(ev->'rationale',ARRAY['noun','article','case','number','gender','fictionalCharacters']) OR (SELECT count(*) FROM jsonb_object_keys(ev->'rationale'))<>6
  OR NOT path_private.valid_text(ev#>'{rationale,noun}',200) OR NOT path_private.valid_text(ev->'adaptation')
  OR ev->>'sourceRef' IS DISTINCT FROM p_input->>'sourceRef' OR ev->>'sourceSha256' IS DISTINCT FROM p_input->>'sourceSha256'
  OR NOT coalesce(ev#>>'{task,page}' IN('1','2'),false) OR NOT coalesce(ev#>>'{solution,page}' IN('5','6'),false)
  OR NOT path_private.only_keys(ev->'task',ARRAY['page','exercise','item','span']) OR (SELECT count(*) FROM jsonb_object_keys(ev->'task'))<>4
  OR NOT path_private.only_keys(ev->'solution',ARRAY['page','exercise','item','span']) OR (SELECT count(*) FROM jsonb_object_keys(ev->'solution'))<>4
  OR NOT path_private.valid_text(ev#>'{task,exercise}',100) OR NOT path_private.valid_text(ev#>'{solution,exercise}',100)
  OR NOT coalesce(ev#>>'{task,item}' ~ '^[1-9][0-9]{0,2}$',false) OR NOT coalesce(ev#>>'{solution,item}' ~ '^[1-9][0-9]{0,2}$',false)
  OR ev#>>'{rationale,case}' IS DISTINCT FROM 'Nominativ' OR ev#>>'{rationale,number}' IS DISTINCT FROM 'singular'
  OR ev#>>'{rationale,gender}' IS DISTINCT FROM item->>'stratum'
  OR lower(ev#>>'{solution,span}') IS DISTINCT FROM lower(snap#>>'{content,correct_answer}')
  OR ev#>>'{rationale,article}' IS DISTINCT FROM lower(snap#>>'{content,correct_answer}')
  OR NOT path_private.valid_text(ev#>'{task,span}') OR NOT path_private.valid_text(ev#>'{solution,span}')
  OR NOT path_private.only_keys(snap->'translations',ARRAY['de','en','ru','uk','tr']) OR (SELECT count(*) FROM jsonb_object_keys(snap->'translations'))<>5
  OR jsonb_typeof(ev#>'{rationale,fictionalCharacters}') IS DISTINCT FROM 'array' OR jsonb_array_length(ev#>'{rationale,fictionalCharacters}')<>0
  THEN RETURN sitov_special_private.error('invalid_input');END IF;
  IF EXISTS(SELECT 1 FROM public.learning_exercises WHERE id=(item->>'id')::uuid) THEN RETURN sitov_special_private.error('item_conflict');END IF;
  FOREACH lang IN ARRAY ARRAY['de','en','ru','uk','tr'] LOOP
   tr:=snap->'translations'->lang;
   IF NOT path_private.only_keys(tr,ARRAY['instruction','hint','explanation','prompt']) OR (SELECT count(*) FROM jsonb_object_keys(tr))<>4
   OR NOT path_private.valid_text(tr->'explanation') OR EXISTS(SELECT 1 FROM jsonb_each(tr) t WHERE t.value<>'null'::jsonb AND jsonb_typeof(t.value)<>'string') THEN RETURN sitov_special_private.error('invalid_input');END IF;
  END LOOP;
 END LOOP;
 INSERT INTO public.path_nodes(id,unit_id,source_id,kind,sort_order,title,topic,goals,anchor_node_id,is_active,created_by)
 SELECT node,unit,p_input->>'specialSourceId','special',coalesce(max(sort_order),0)+1,p_input->>'title',p_input->>'topic',ARRAY['P4-G1'],anchor,false,actor FROM public.path_nodes WHERE unit_id=unit;
 FOR item IN SELECT value FROM jsonb_array_elements(p_input->'items') LOOP
  snap:=item->'snapshot';ord:=ord+1;
  INSERT INTO public.learning_exercises(id,unit_id,node_id,goal_id,sort_order,topic,type,content,source_ref,path_is_active)
  VALUES((item->>'id')::uuid,unit,node,'P4-G1',ord,p_input->>'topic',(snap->>'type')::public.exercise_type,snap->'content',item->>'stableId',true);
  FOREACH lang IN ARRAY ARRAY['de','en','ru','uk','tr'] LOOP
   tr:=snap->'translations'->lang;
   INSERT INTO public.grammar_translations(exercise_id,locale,instruction,hint,explanation,prompt)
   VALUES((item->>'id')::uuid,lang,tr->>'instruction',tr->>'hint',tr->>'explanation',tr->>'prompt');
  END LOOP;
  pool:=pool||jsonb_build_array(jsonb_build_object('id',item->>'id','stratum',item->>'stratum','snapshot',path_private.snapshot((item->>'id')::uuid)));
 END LOOP;
 INSERT INTO sitov_special_private.definitions(id,node_id,version,source_ref,blueprint,pool,published,editorial_proof,audio_import_proof,created_by)
 VALUES(def,node,NULL,p_input->>'sourceRef',p_input->'blueprint',pool,false,NULL,NULL,actor) RETURNING definitions.version INTO version;
 INSERT INTO sitov_special_private.authored_drafts VALUES(def,actor,p_input->>'sourceSha256',p_input->>'expectedAnchorVersion',p_input,now());
 response:=jsonb_build_object('ok',true,'data',jsonb_build_object('nodeId',node,'unitId',unit,'anchorNodeId',anchor,'definitionId',def,'definitionVersion',version,
 'sourceRef',p_input->>'sourceRef','sourceSha256',p_input->>'sourceSha256','itemIds',(SELECT jsonb_agg(value->'id') FROM jsonb_array_elements(p_input->'items')),'active',false,'published',false));
 INSERT INTO sitov_special_private.author_receipts(actor_id,request_id,payload,response) VALUES(actor,request,p_input,response);
 RETURN response;
EXCEPTION WHEN data_exception OR check_violation OR not_null_violation THEN RETURN sitov_special_private.error('invalid_input');
 WHEN unique_violation THEN RETURN sitov_special_private.error('item_conflict');
END $$;
REVOKE ALL ON FUNCTION sitov_special_private.author_anchor_version(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sitov_special_author_context(uuid,uuid,text),public.sitov_special_author_create(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sitov_special_author_context(uuid,uuid,text),public.sitov_special_author_create(jsonb) TO authenticated;
