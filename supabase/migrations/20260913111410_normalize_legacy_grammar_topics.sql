-- Align the two preserved legacy exercises with their canonical topic titles.
UPDATE public.exercises SET topic='Sein und sich vorstellen'
WHERE level='A1.1' AND lesson='A1.1 · 01' AND topic='Verbkonjugation (sein)';
UPDATE public.exercises SET topic='Artikel im Nominativ'
WHERE level='A1.1' AND lesson='A1.1 · 03' AND topic='Artikel';
