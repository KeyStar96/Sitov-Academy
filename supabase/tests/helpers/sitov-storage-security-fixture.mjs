export const user='00000000-0000-4000-8000-000000000001'
export const other='00000000-0000-4000-8000-000000000002'
export const bootstrap=`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA storage; CREATE SCHEMA learning_reset_private; CREATE SCHEMA sitov_exam_private; CREATE SCHEMA sitov_simulation_private;
 CREATE TABLE public.profiles(id uuid PRIMARY KEY,role text);
 INSERT INTO public.profiles VALUES('${user}','student'),('${other}','student');
 CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,metadata jsonb,UNIQUE(bucket_id,name));
 CREATE TABLE public.sitov_exam_upload_tickets(path text PRIMARY KEY,student_id uuid REFERENCES public.profiles(id),kind text,created_at timestamptz DEFAULT clock_timestamp(),simulation_run_id uuid);
 CREATE TABLE learning_reset_private.jobs(auth_user_id uuid,completed_at timestamptz);
 CREATE FUNCTION learning_reset_private.assert_writable(uuid) RETURNS void LANGUAGE sql AS 'SELECT';
 CREATE FUNCTION sitov_simulation_private.preserve_media(uuid,text) RETURNS boolean LANGUAGE sql AS 'SELECT false';
 CREATE FUNCTION sitov_exam_private.guard_storage_upload() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RETURN NEW; END';
 CREATE TRIGGER sitov_exam_storage_reset_guard BEFORE INSERT OR UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION sitov_exam_private.guard_storage_upload();
 GRANT USAGE ON SCHEMA storage TO authenticated,service_role;
 GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated,service_role;
 GRANT SELECT ON public.profiles TO service_role;
 GRANT ALL ON public.sitov_exam_upload_tickets TO service_role;
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 CREATE POLICY own_paths ON storage.objects TO authenticated USING(name LIKE '${user}/%') WITH CHECK(name LIKE '${user}/%');`
