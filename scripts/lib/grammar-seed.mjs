import { createHash } from 'node:crypto'

const quote = value => value == null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`
const stableId = value => {
  const hex = createHash('sha256').update(value).digest('hex')
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`
}
const german = value => typeof value === 'string' ? value : value?.de ?? null

/** Author-manuscript import. Existing content and translations remain untouched. */
export function grammarSeedSql(records) {
  if (!records.length || new Set(records.map(row => row.id)).size !== records.length) throw new Error('Unique exercise IDs required')
  const units = [...new Map(records.map(row => [`${row.level}:${row.lesson}`, row])).values()]
  const unitValues = units.map((row, index) => `(${[stableId(`sitov-grammar-unit:${row.level}:${row.lesson}`), row.level, 'exercises', row.lesson].map(quote).join(',')},${index + 1})`)
  const values = records.map(row => {
    const { smart_hint, explanation, ...content } = row.content
    return `(${[row.id, row.level, row.lesson, row.topic, row.type, JSON.stringify(content), german(smart_hint), german(explanation)].map(quote).join(',')})`
  })
  return `-- Generated from the original author manuscript; canonical tables only.
-- Import in one transaction. Insert-only: teacher edits, other translations and progress survive.
BEGIN;
INSERT INTO public.learning_units(id,level,trainer,label,sort_order) VALUES
${unitValues.join(',\n')}
ON CONFLICT DO NOTHING;
WITH source(id,level,lesson,topic,type,content,smart_hint,explanation) AS (VALUES
${values.join(',\n')}
), inserted AS (
 INSERT INTO public.learning_exercises(id,unit_id,topic,type,content)
 SELECT s.id::uuid,(SELECT u.id FROM public.learning_units u WHERE u.level=s.level AND u.trainer='exercises' AND u.label=s.lesson),s.topic,s.type,s.content::jsonb
 FROM source s ON CONFLICT(id) DO NOTHING RETURNING id
)
INSERT INTO public.grammar_translations(exercise_id,locale,smart_hint,explanation)
SELECT s.id::uuid,'de',s.smart_hint,s.explanation FROM source s JOIN inserted i ON i.id=s.id::uuid;
COMMIT;
`
}
