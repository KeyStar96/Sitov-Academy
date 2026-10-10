#!/usr/bin/env python3
"""Sitov Academy offline full-row Parent/Objective CAS SQL preparer.

No database client, connection, subprocess or network capability. Input v1:
{version:1,nodes:[{before:{node:{...},translations:[five full rows]},after:...}],
 objectives:[{before:{unit_id,id,area,description,...},after:...}]}.
Unknown row fields must be present unchanged on both sides. Input must come from
complete authoritative rows, not business projections. SHA pins those bytes;
it does not certify their provenance or editorial approval.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import uuid

MAX_BYTES = 2_000_000
MAX_OBJECTIVES = 16
LOCALES = {'de', 'en', 'ru', 'uk', 'tr'}
NODE_FIELDS = {'id', 'unit_id', 'source_id', 'kind', 'sort_order', 'title',
               'topic', 'merkkarte', 'goals', 'anchor_node_id', 'test_size',
               'is_active', 'created_by', 'created_at', 'updated_at'}


def require(ok, message):
    if not ok:
        raise ValueError(message)


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True,
                      separators=(',', ':'), allow_nan=False)


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, 'duplicate JSON key')
        result[key] = value
    return result


def identifier(value):
    require(isinstance(value, str), 'UUID must be text')
    try:
        parsed = uuid.UUID(value)
    except (ValueError, AttributeError) as exc:
        raise ValueError('invalid UUID') from exc
    require(str(parsed) == value, 'UUID must be canonical lowercase')
    return value


def text(value, nullable=False):
    require((nullable and value is None) or
            (isinstance(value, str) and 0 < len(value) <= 100_000 and '\x00' not in value),
            'invalid text')


def delta(before, after, allowed):
    require(isinstance(before, dict) and isinstance(after, dict), 'full rows required')
    require(before.keys() == after.keys(), 'missing or new row field')
    changed = {key for key in before if before[key] != after[key]}
    require(changed <= allowed, 'protected or unknown field changed')
    return changed


def translations(rows, node_id):
    require(isinstance(rows, list) and len(rows) == 5, 'exactly five translations required')
    found = {}
    for row in rows:
        require(isinstance(row, dict) and {'node_id', 'locale', 'title', 'rule'} <= row.keys(),
                'full translation required')
        require(identifier(row['node_id']) == node_id, 'moved translation')
        require(isinstance(row['locale'], str) and row['locale'] in LOCALES
                and row['locale'] not in found, 'duplicate or invalid locale')
        text(row['title']); text(row['rule'], nullable=True)
        found[row['locale']] = row
    return found


def validate(payload):
    require(isinstance(payload, dict) and set(payload) == {'version', 'nodes', 'objectives'},
            'invalid envelope or identifier field')
    require(type(payload['version']) is int and payload['version'] == 1, 'invalid version')
    require(isinstance(payload['nodes'], list) and len(payload['nodes']) <= 100,
            'node bound exceeded')
    require(isinstance(payload['objectives'], list) and len(payload['objectives']) <= MAX_OBJECTIVES,
            'objective bound exceeded')
    require(payload['nodes'] or payload['objectives'], 'empty operation')
    ids, objective_keys = set(), set()
    for item in payload['nodes']:
        require(isinstance(item, dict) and set(item) == {'before', 'after'}, 'invalid node item')
        for side in ('before', 'after'):
            require(isinstance(item[side], dict) and set(item[side]) == {'node', 'translations'},
                    'full node and translations required')
            n = item[side]['node']
            require(isinstance(n, dict) and NODE_FIELDS <= n.keys(), 'incomplete node row')
            identifier(n['id']); identifier(n['unit_id'])
            text(n['title']); text(n['topic'])
            require(n['merkkarte'] is None or isinstance(n['merkkarte'], dict), 'invalid card')
        old, new = item['before']['node'], item['after']['node']
        require(old['id'] not in ids, 'duplicate node UUID'); ids.add(old['id'])
        changed = bool(delta(old, new, {'title', 'topic', 'merkkarte'}))
        a = translations(item['before']['translations'], old['id'])
        b = translations(item['after']['translations'], new['id'])
        for locale in sorted(LOCALES):
            changed = bool(delta(a[locale], b[locale], {'title', 'rule'})) or changed
        require(changed, 'no-op node')
    for item in payload['objectives']:
        require(isinstance(item, dict) and set(item) == {'before', 'after'}, 'invalid objective item')
        for side in ('before', 'after'):
            row = item[side]
            require(isinstance(row, dict) and {'unit_id', 'id', 'area', 'description'} <= row.keys(),
                    'full objective row required')
            identifier(row['unit_id'])
            require(isinstance(row['id'], str) and
                    re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,99}', row['id']), 'invalid objective identifier')
            text(row['description'])
        old, new = item['before'], item['after']
        key = (old['unit_id'], old['id'])
        require(key not in objective_keys, 'duplicate objective'); objective_keys.add(key)
        require(delta(old, new, {'description'}), 'no-op objective')
    # Reject non-finite numbers, unpaired surrogates and PostgreSQL-invalid NUL
    # anywhere, including deeply nested cards and unknown preserved fields.
    encoded = canonical(payload).encode('utf-8')
    require(b'\\u0000' not in encoded and b'\x00' not in encoded, 'NUL forbidden')
    require(len(encoded) <= MAX_BYTES, 'payload too large')
    return payload


def load(path, expected_sha):
    require(isinstance(expected_sha, str) and re.fullmatch('[a-f0-9]{64}', expected_sha),
            'explicit SHA256 required')
    with Path(path).open('rb') as stream:
        raw = stream.read(MAX_BYTES + 1)
    require(len(raw) <= MAX_BYTES, 'input too large')
    require(hashlib.sha256(raw).hexdigest() == expected_sha, 'input SHA mismatch')
    payload = json.loads(raw, object_pairs_hook=unique_object,
                         parse_constant=lambda _: (_ for _ in ()).throw(ValueError('non-finite JSON')))
    return validate(payload)


SQL_BODY = r"""
DECLARE
 p jsonb := SITOV_PAYLOAD;
 item jsonb; tr jsonb; actual jsonb; expected jsonb; n_id uuid;
 affected_nodes uuid[]; changed_count integer; started_at timestamptz:=clock_timestamp();
BEGIN
 IF NOT coalesce((SELECT rolsuper OR rolbypassrls FROM pg_catalog.pg_roles WHERE rolname=current_user),false) THEN
  RAISE EXCEPTION 'sitov_parent_privileged_review_actor_required' USING ERRCODE='42501'; END IF;
 SELECT coalesce(array_agg((v#>>'{before,node,id}')::uuid ORDER BY v#>>'{before,node,id}'),'{}'::uuid[])
 INTO affected_nodes FROM jsonb_array_elements(p->'nodes') v;
 -- Table locks exclude phantoms (translations, moved exercises, new histories,
 -- definitions) and DDL. Waiting is bounded; no table contents are aggregated.
 LOCK TABLE public.learning_units,public.path_nodes,public.path_node_translations,public.path_objectives,
  public.learning_exercises,path_private.sitov_content_revisions,
  sitov_special_private.definitions IN SHARE ROW EXCLUSIVE MODE;
 PERFORM n.id FROM public.path_nodes n WHERE n.id=ANY(affected_nodes) ORDER BY n.id FOR UPDATE;
 PERFORM t.node_id FROM public.path_node_translations t WHERE t.node_id=ANY(affected_nodes)
  ORDER BY t.node_id,t.locale FOR UPDATE;
 PERFORM o.unit_id FROM public.path_objectives o JOIN jsonb_array_elements(p->'objectives') v
  ON o.unit_id=(v#>>'{before,unit_id}')::uuid AND o.id=v#>>'{before,id}'
  ORDER BY o.unit_id,o.id FOR UPDATE OF o;
 -- Existing revision history matters only when its current or archived source
 -- depends on a selected node/objective. Unrelated archives remain permitted.
 IF EXISTS(SELECT 1 FROM path_private.sitov_content_revisions r
  WHERE EXISTS(SELECT 1 FROM public.learning_exercises e WHERE e.id=r.exercise_id AND
   (e.node_id=ANY(affected_nodes) OR EXISTS(SELECT 1 FROM jsonb_array_elements(p->'objectives') v
    WHERE e.unit_id=(v#>>'{before,unit_id}')::uuid AND e.goal_id=v#>>'{before,id}')))
  OR EXISTS(SELECT 1 FROM (VALUES(r.before_full->'exercise'),(r.after_full->'exercise'),
    (r.before_projection),(r.after_projection)) snapshots(s)
   WHERE s->>'node_id'=ANY(affected_nodes::text[]) OR EXISTS(
    SELECT 1 FROM jsonb_array_elements(p->'objectives') v
    WHERE s->>'unit_id'=v#>>'{before,unit_id}' AND s->>'goal_id'=v#>>'{before,id}')))
 THEN RAISE EXCEPTION 'sitov_parent_existing_revision_dependency' USING ERRCODE='23514'; END IF;
 -- Includes unpublished and inactive definitions and their anchor/pool sources.
 IF EXISTS(SELECT 1 FROM sitov_special_private.definitions d
  LEFT JOIN public.path_nodes dn ON dn.id=d.node_id
  WHERE d.node_id=ANY(affected_nodes) OR dn.anchor_node_id=ANY(affected_nodes)
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(p->'objectives') v
    WHERE dn.unit_id=(v#>>'{before,unit_id}')::uuid AND (v#>>'{before,id}')=ANY(dn.goals))
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(d.pool) q
    JOIN public.learning_exercises e ON e.id::text=q->>'id'
    WHERE e.node_id=ANY(affected_nodes) OR EXISTS(SELECT 1 FROM jsonb_array_elements(p->'objectives') v
     WHERE e.unit_id=(v#>>'{before,unit_id}')::uuid AND e.goal_id=v#>>'{before,id}')))
 THEN RAISE EXCEPTION 'sitov_parent_existing_special_dependency' USING ERRCODE='23514'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p->'nodes') ORDER BY value#>>'{before,node,id}' LOOP
  n_id:=(item#>>'{before,node,id}')::uuid;
  SELECT to_jsonb(n) INTO actual FROM public.path_nodes n WHERE n.id=n_id;
  IF actual IS DISTINCT FROM item#>'{before,node}' THEN
   RAISE EXCEPTION 'sitov_parent_stale_full_row' USING ERRCODE='40001'; END IF;
  IF (SELECT count(*) FROM(SELECT 1 FROM public.path_node_translations WHERE node_id=n_id LIMIT 6) bounded)<>5 THEN
   RAISE EXCEPTION 'sitov_parent_translation_count' USING ERRCODE='40001'; END IF;
  SELECT jsonb_agg(to_jsonb(t) ORDER BY t.locale) INTO actual FROM
   (SELECT * FROM public.path_node_translations WHERE node_id=n_id ORDER BY locale LIMIT 5) t;
  SELECT jsonb_agg(value ORDER BY value->>'locale') INTO expected
   FROM jsonb_array_elements(item#>'{before,translations}');
  IF actual IS DISTINCT FROM expected THEN
   RAISE EXCEPTION 'sitov_parent_stale_translations' USING ERRCODE='40001'; END IF;
  UPDATE public.path_nodes SET title=item#>>'{after,node,title}',topic=item#>>'{after,node,topic}',
   merkkarte=(jsonb_populate_record(NULL::public.path_nodes,item#>'{after,node}')).merkkarte
   WHERE id=n_id AND to_jsonb(path_nodes)=item#>'{before,node}';
  GET DIAGNOSTICS changed_count=ROW_COUNT;
  IF changed_count<>1 THEN RAISE EXCEPTION 'sitov_parent_update_count' USING ERRCODE='40001'; END IF;
  FOR tr IN SELECT value FROM jsonb_array_elements(item#>'{after,translations}') ORDER BY value->>'locale' LOOP
   UPDATE public.path_node_translations SET title=tr->>'title',rule=tr->>'rule'
    WHERE node_id=n_id AND locale=tr->>'locale';
   GET DIAGNOSTICS changed_count=ROW_COUNT;
   IF changed_count<>1 THEN RAISE EXCEPTION 'sitov_parent_translation_update_count' USING ERRCODE='40001'; END IF;
  END LOOP;
 END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(p->'objectives') ORDER BY value#>>'{before,unit_id}',value#>>'{before,id}' LOOP
  UPDATE public.path_objectives SET description=item#>>'{after,description}'
   WHERE unit_id=(item#>>'{before,unit_id}')::uuid AND id=item#>>'{before,id}'
    AND to_jsonb(path_objectives)=item->'before';
  GET DIAGNOSTICS changed_count=ROW_COUNT;
  IF changed_count<>1 THEN RAISE EXCEPTION 'sitov_objective_stale_full_row' USING ERRCODE='40001'; END IF;
 END LOOP;
 -- Final complete-row and full translation multiset checks after ALL updates:
 -- catches triggers or cross-parent effects, including unknown future columns.
 FOR item IN SELECT value FROM jsonb_array_elements(p->'nodes') ORDER BY value#>>'{before,node,id}' LOOP
  n_id:=(item#>>'{before,node,id}')::uuid;
  SELECT to_jsonb(n) INTO actual FROM public.path_nodes n WHERE n.id=n_id;
  -- Existing guard_catalog always writes updated_at. Accept only that one
  -- server-generated timestamp; every other known/unknown column is exact.
  IF (actual-'updated_at') IS DISTINCT FROM ((item#>'{after,node}')-'updated_at')
   OR jsonb_typeof(actual->'updated_at') IS DISTINCT FROM 'string'
   OR (actual->>'updated_at')::timestamptz NOT BETWEEN started_at AND clock_timestamp() THEN
   RAISE EXCEPTION 'sitov_parent_postprojection' USING ERRCODE='40001'; END IF;
  IF (SELECT count(*) FROM(SELECT 1 FROM public.path_node_translations WHERE node_id=n_id LIMIT 6) bounded)<>5 THEN
   RAISE EXCEPTION 'sitov_parent_posttranslation_count' USING ERRCODE='40001'; END IF;
  SELECT jsonb_agg(to_jsonb(t) ORDER BY t.locale) INTO actual FROM
   (SELECT * FROM public.path_node_translations WHERE node_id=n_id ORDER BY locale LIMIT 5) t;
  SELECT jsonb_agg(value ORDER BY value->>'locale') INTO expected FROM jsonb_array_elements(item#>'{after,translations}');
  IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'sitov_parent_posttranslations' USING ERRCODE='40001'; END IF;
 END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(p->'objectives') LOOP
  SELECT to_jsonb(o) INTO actual FROM public.path_objectives o
   WHERE unit_id=(item#>>'{after,unit_id}')::uuid AND id=item#>>'{after,id}';
  IF actual IS DISTINCT FROM item->'after' THEN RAISE EXCEPTION 'sitov_objective_postprojection' USING ERRCODE='40001'; END IF;
 END LOOP;
END;
"""


def emit(payload, reviewed_commit=False):
    validate(payload)
    # Hex encoding makes arbitrary content inert inside the DO dollar-quote.
    literal = "convert_from(decode('" + canonical(payload).encode('utf-8').hex() + "','hex'),'UTF8')::jsonb"
    return ("-- Sitov Academy offline preparer; native review required.\n"
            "BEGIN ISOLATION LEVEL SERIALIZABLE;\n"
            "SET LOCAL lock_timeout='2s';\nSET LOCAL statement_timeout='20s';\n"
            "SET LOCAL idle_in_transaction_session_timeout='20s';\n"
            "DO $sitov_parent_cas$\n" + SQL_BODY.replace('SITOV_PAYLOAD', literal) +
            "$sitov_parent_cas$;\nSET CONSTRAINTS ALL IMMEDIATE;\n" +
            ('COMMIT;\n' if reviewed_commit else 'ROLLBACK;\n'))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True)
    parser.add_argument('--sha256', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--reviewed-commit', action='store_true',
                        help='emit COMMIT for later explicitly reviewed M execution; never executes SQL')
    args = parser.parse_args()
    payload = load(args.input, args.sha256)
    output = emit(payload, args.reviewed_commit)
    # Exclusive creation protects a previously reviewed SQL artifact.
    fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as stream:
        stream.write('-- input SHA256: ' + args.sha256 + '\n' + output)
        stream.flush(); os.fsync(stream.fileno())


if __name__ == '__main__':
    main()
