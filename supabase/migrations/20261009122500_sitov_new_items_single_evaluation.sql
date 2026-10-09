-- Sitov Academy: evaluate new-content objects once per items request.
-- The outer RPC remains VOLATILE. Items and lesson labels intentionally share
-- one statement snapshot; authorization is freshly evaluated on every call.
-- Existing private guards, ACLs, first visits, seen receipts and history remain intact.
CREATE OR REPLACE FUNCTION public.get_learning_new_items(p_level text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); items jsonb; lessons jsonb;
BEGIN
 IF actor IS NULL THEN RETURN jsonb_build_object('error','not_authenticated','message','Authentication is required.'); END IF;
 IF p_level IS NULL OR length(p_level) NOT BETWEEN 1 AND 20 THEN RETURN jsonb_build_object('error','invalid_input','message','The request contains invalid data.'); END IF;
 WITH sitov_new_objects AS MATERIALIZED (
  SELECT n.kind,n.object_key FROM learning_private.new_objects() n WHERE n.level=p_level
 )
 SELECT
  (SELECT coalesce(jsonb_object_agg(g.kind,g.keys),'{}'::jsonb) FROM (
   SELECT n.kind::text kind,jsonb_agg(n.object_key ORDER BY n.object_key) keys
   FROM sitov_new_objects n GROUP BY n.kind) g),
  (SELECT coalesce(jsonb_object_agg(u.id::text,u.label),'{}'::jsonb) FROM public.learning_units u
   WHERE u.id::text IN(SELECT n.object_key FROM sitov_new_objects n WHERE n.kind='vocabulary_lesson'))
 INTO items,lessons;
 RETURN jsonb_build_object('success',true,'level',p_level,'items',items,'lessons',lessons);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error','request_failed','message','The request could not be completed.','sqlstate',SQLSTATE);
END $$;
