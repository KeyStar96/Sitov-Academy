-- Offer "Deutsch Level 3" again: the course returns to the catalogue and the registration.
UPDATE public.courses SET archived_at=NULL,updated_at=now() WHERE slug='deutsch-level-3' AND archived_at IS NOT NULL;
