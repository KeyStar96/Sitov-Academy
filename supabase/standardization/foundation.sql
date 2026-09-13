-- Natural lookup codes are stable; all independently managed entities use UUIDs.
CREATE TABLE public.locales (
 code text PRIMARY KEY CHECK(code ~ '^[a-z]{2}$')
);
INSERT INTO public.locales(code) VALUES ('de'),('en'),('ru'),('uk'),('tr');
ALTER TABLE public.locales ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.locales FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.locales TO anon,authenticated;
GRANT ALL ON public.locales TO service_role;
CREATE POLICY locales_read ON public.locales FOR SELECT TO anon,authenticated USING(true);
