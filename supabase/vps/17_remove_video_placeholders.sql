-- User-requested removal of exactly the verified three A1.1 placeholders.
-- Never delete an uploaded file or a subsequently edited/replaced video.
WITH targets(id,label,source_url) AS (VALUES
 ('133379c3-b347-4226-bd70-b6c530e2c849'::uuid,'Nicos Weg - Folge 1: Hallo!','https://learngerman.dw.com/de/hallo/l-37250531'),
 ('b3034c99-e5c4-4214-845a-5a9fe0e0a518'::uuid,'Nicos Weg - Folge 2: Wie heißt du?','https://learngerman.dw.com/de/wie-heißt-du/l-37250532'),
 ('22b3247e-f35d-4f26-ac8a-031c6177dce7'::uuid,'Aussprache: Umlaute (In Vorbereitung)',NULL)
), removed AS (
 DELETE FROM public.learning_videos v USING public.learning_units u,targets t
 WHERE v.id=t.id AND v.unit_id=u.id AND u.id=t.id AND u.level='A1.1' AND u.trainer='videos'
 AND u.label=t.label AND v.title IS NULL AND v.source_url IS NOT DISTINCT FROM t.source_url
 AND v.storage_path IS NULL AND v.folder_id IS NULL
 RETURNING v.unit_id
)
DELETE FROM public.learning_units u USING removed r WHERE u.id=r.unit_id;
-- Idempotent: absent or changed targets are left alone on replay.
-- Rollback: restore the R8 dump into an isolated database, then copy ONLY the
-- deleted target IDs in learning_units, learning_videos and learning_unit_grants
-- back in FK order in one transaction (ON CONFLICT DO NOTHING). Never restore
-- the entire production database or overwrite current learner/content changes.
