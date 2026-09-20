-- Add hint column
ALTER TABLE public.exercises ADD COLUMN hint jsonb;

-- Migrate hint_ru and hint_tr to the new hint column
UPDATE public.exercises
SET hint = jsonb_build_object(
  'ru', hint_ru,
  'tr', hint_tr
)
WHERE hint_ru IS NOT NULL OR hint_tr IS NOT NULL;

-- Drop old hint columns
ALTER TABLE public.exercises DROP COLUMN hint_ru;
ALTER TABLE public.exercises DROP COLUMN hint_tr;

-- Migrate explanation inside content to be localized
UPDATE public.exercises
SET content = jsonb_set(
  content,
  '{explanation}',
  jsonb_build_object('de', content->>'explanation')
)
WHERE content->>'explanation' IS NOT NULL AND jsonb_typeof(content->'explanation') = 'string';

-- Migrate smart_hint inside content to be localized
UPDATE public.exercises
SET content = jsonb_set(
  content,
  '{smart_hint}',
  jsonb_build_object('de', content->>'smart_hint')
)
WHERE content->>'smart_hint' IS NOT NULL AND jsonb_typeof(content->'smart_hint') = 'string';
