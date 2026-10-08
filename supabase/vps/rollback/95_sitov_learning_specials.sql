-- Disable API only. Preserve definitions, learner queues, tests and request receipts.
REVOKE ALL ON FUNCTION public.sitov_special_operation(text,uuid,uuid,text,integer,uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION sitov_special_private.operation(text,uuid,uuid,text,integer,uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sitov_special_staff_catalog(uuid) FROM PUBLIC,anon,authenticated;
