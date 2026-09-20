-- Phase 5: atomic, retry-safe publication after a completed Storage/TUS upload.
-- Apply with migrate-local.py after verified PostgreSQL + Storage backup.
CREATE OR REPLACE FUNCTION public.complete_media_upload(p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE asset uuid; folder uuid; path text; mime text; size bigint; title text; filename text;
  target public.lms_media_folder; old_video public.learning_videos; old_presentation public.lms_presentation_asset;
BEGIN
 IF NOT business_private.is_staff() THEN
  RETURN jsonb_build_object('error','not_authorized','message','Staff access required.');
 END IF;
 asset:=(p_payload->>'asset_id')::uuid; folder:=(p_payload->>'folder_id')::uuid;
 path:=p_payload->>'storage_path'; mime:=p_payload->>'mime_type'; size:=(p_payload->>'file_size')::bigint;
 title:=btrim(p_payload->>'title'); filename:=btrim(p_payload->>'file_name');
 IF asset IS NULL OR folder IS NULL OR path IS NULL OR mime IS NULL OR size IS NULL OR size<=0 OR size>536870912
 OR title IS NULL OR length(title) NOT BETWEEN 1 AND 180 OR filename IS NULL OR length(filename) NOT BETWEEN 1 AND 255 THEN
  RETURN jsonb_build_object('error','invalid_input','message','Valid file metadata is required.');
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('media-asset:'||asset::text,0));
 SELECT * INTO target FROM public.lms_media_folder WHERE folder_id=folder FOR SHARE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found','message','Folder is unavailable.'); END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='course-assets' AND name=path
   AND (metadata->>'size')::bigint=size AND metadata->>'mimetype'=mime) THEN
  RETURN jsonb_build_object('error','invalid_input','message','The completed upload does not match its metadata.');
 END IF;
 -- Exact filename, MIME, path, object ID and size are also verified by the existing asset trigger.
 IF mime IN('video/mp4','video/webm') THEN
  SELECT * INTO old_video FROM public.learning_videos WHERE id=asset;
  IF FOUND THEN
   IF old_video.folder_id IS DISTINCT FROM folder OR old_video.storage_path IS DISTINCT FROM path OR old_video.file_size IS DISTINCT FROM size THEN
    RETURN jsonb_build_object('error','conflict','message','File identifier already exists.');
   END IF;
  ELSE
   INSERT INTO public.learning_units(id,level,trainer,label,is_active) VALUES(asset,target.level,'videos',title,true);
   INSERT INTO public.learning_videos(id,unit_id,folder_id,title,storage_path,file_size)
    VALUES(asset,asset,folder,title,path,size);
  END IF;
 ELSIF mime IN('application/pdf','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.apple.keynote') THEN
  SELECT * INTO old_presentation FROM public.lms_presentation_asset WHERE asset_id=asset;
  IF FOUND THEN
   IF old_presentation.folder_id IS DISTINCT FROM folder OR old_presentation.storage_path IS DISTINCT FROM path
     OR old_presentation.file_size IS DISTINCT FROM size OR old_presentation.mime_type IS DISTINCT FROM mime THEN
    RETURN jsonb_build_object('error','conflict','message','File identifier already exists.');
   END IF;
  ELSE
   INSERT INTO public.lms_presentation_asset(asset_id,folder_id,file_name,storage_path,mime_type,file_size)
    VALUES(asset,folder,filename,path,mime,size);
  END IF;
 ELSE RETURN jsonb_build_object('error','invalid_input','message','Unsupported media format.');
 END IF;
 RETURN jsonb_build_object('asset_id',asset);
EXCEPTION
 WHEN invalid_text_representation OR check_violation OR not_null_violation OR foreign_key_violation THEN
  RETURN jsonb_build_object('error','invalid_input','message','The completed upload does not match its metadata.');
 WHEN unique_violation THEN RETURN jsonb_build_object('error','conflict','message','File identifier already exists.');
 WHEN OTHERS THEN RETURN jsonb_build_object('error','request_failed','message','The upload could not be published.');
END $$;
REVOKE ALL ON FUNCTION public.complete_media_upload(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_media_upload(jsonb) TO authenticated;
-- Rollback: deploy the previous application, then DROP FUNCTION public.complete_media_upload(jsonb);
-- This removes only the additive API; uploaded files, metadata and existing APIs remain intact.
