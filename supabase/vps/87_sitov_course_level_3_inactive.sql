-- Sitov Academy: the course "Deutsch Level 3" is currently not offered.
-- A course is switched inactive through courses.archived_at (course CMS: "Inaktiv"): the catalogue
-- policy hides it from the home page and the registration, validate_course_selections refuses new
-- registrations, and the monthly plan no longer carries it over. Bookings, invoices and history
-- stay untouched; clearing archived_at offers the course again.
UPDATE public.courses SET archived_at=now(),updated_at=now() WHERE slug='deutsch-level-3' AND archived_at IS NULL;
