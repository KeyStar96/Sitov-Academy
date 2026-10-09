-- Operational rollback disables new authoring only. Keep immutable archives,
-- receipts, import protection and scoped help protection for any applied data.
-- Content restoration must itself be a reviewed CAS revision, never a DELETE.
REVOKE ALL ON FUNCTION public.sitov_revise_path_content(uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
