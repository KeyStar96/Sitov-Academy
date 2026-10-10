-- Sitov Academy: CREATE OR REPLACE retained the legacy postgres owner, while
-- migration 94's upload_tickets belongs to the canonical supabase_admin migrator.
-- SELECT FOR UPDATE needs UPDATE authority; keep it inside the existing definer.
-- Preserve the function body, fixed search_path and existing API EXECUTE grants.
ALTER FUNCTION pronunciation_private.create_submission(uuid,text) OWNER TO supabase_admin;
