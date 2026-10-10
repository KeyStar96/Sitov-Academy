#!/usr/bin/env python3
"""Sitov Academy offline combined CAS draft. Never connects or executes SQL."""
import argparse
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import uuid

_spec = importlib.util.spec_from_file_location('sitov_parent_cas', Path(__file__).with_name('sitov-path-parent-cas.py'))
parent = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(parent)
require = parent.require
canonical = parent.canonical
MUTABLE = {'content', 'translations', 'explanation_card', 'topic'}
TR_FIELDS = {'instruction', 'hint', 'explanation', 'prompt', 'task', 'gap_hint'}
FULL_FIELDS = {'id', 'type', 'unit_id', 'node_id', 'goal_id', 'source_ref', 'sort_order',
               'topic', 'content', 'path_is_active', 'explanation_card', 'created_at',
               'content_status', 'content_version', 'solution_audio_url'}
MAX_INPUT = 32_000_000
MAX_BATCH = 1_500_000


def sha(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def load(path, digest, limit=MAX_INPUT):
    require(isinstance(digest, str) and re.fullmatch('[a-f0-9]{64}', digest), 'explicit SHA required')
    with Path(path).open('rb') as stream:
        raw = stream.read(limit + 1)
    require(len(raw) <= limit, 'input size exceeded')
    require(hashlib.sha256(raw).hexdigest() == digest, 'stale input SHA')
    value = json.loads(raw, object_pairs_hook=parent.unique_object,
                       parse_constant=lambda _: (_ for _ in ()).throw(ValueError('nonfinite JSON')))
    encoded = canonical(value).encode()
    require(b'\\u0000' not in encoded, 'NUL forbidden')
    return value


def approval(value, binding):
    require(isinstance(value, dict), 'explicit approval missing')
    require(value.get('approved') is True and value.get('binding') == binding, 'approval/source binding missing')
    for field in ('reviewer', 'evidence_uri', 'docPath'):
        parent.text(value.get(field))
    require(re.fullmatch('[a-f0-9]{40}', value.get('sourceCommit', '')) is not None, 'review commit missing')
    digest = value.get('docSHA256', '')
    require(re.fullmatch('[a-f0-9]{64}', digest) is not None, 'review doc SHA missing')
    with Path(value['docPath']).open('rb') as stream:
        raw = stream.read(2_000_001)
    require(len(raw) <= 2_000_000 and hashlib.sha256(raw).hexdigest() == digest, 'review doc stale')
    # An explicit trusted reviewer supplies approval. A commit lineage alone
    # never generates approval, and these hashes are NOT PostgreSQL CAS hashes.
    return copy.deepcopy(value)


def validate_sources(parents, inventory):
    parent.validate(parents)
    rows = inventory.get('exercises') if isinstance(inventory, dict) else None
    require(isinstance(rows, list) and 1 <= len(rows) <= 1000, 'exercise bound 1..1000')
    ids, result = set(), []
    changed_parents = {r['after']['node']['id']: r['after']['node'] for r in parents['nodes']}
    for row in sorted(rows, key=lambda r: r.get('id', '')):
        require(isinstance(row, dict) and {'id', 'beforeFull', 'before', 'after'} <= row.keys(), 'incomplete exercise item')
        full = row['beforeFull']; before = row['before']; after = row['after']
        require(isinstance(full, dict) and set(full) == {'exercise', 'translations'}, 'complete beforeFull required')
        e = full['exercise']; require(isinstance(e, dict) and FULL_FIELDS <= e.keys(), 'incomplete full exercise')
        eid = parent.identifier(row['id']); require(eid == e['id'] and eid not in ids, 'moved/duplicate exercise'); ids.add(eid)
        parent.identifier(e['node_id']); parent.identifier(e['unit_id'])
        require(isinstance(before, dict) and isinstance(after, dict) and set(before) == set(after), 'business map shape drift')
        require(MUTABLE <= before.keys(), 'mutable business fields missing')
        require(parent.delta(before, after, MUTABLE), 'no-op exercise')
        for key in before:
            if key != 'translations':
                require(key in e and before[key] == e[key], 'business/full before mismatch')
        trs = full['translations']; require(isinstance(trs, list) and len(trs) == 5, 'five full locales required')
        require(isinstance(before['translations'], dict) and set(before['translations']) == parent.LOCALES, 'before locales missing')
        require(isinstance(after['translations'], dict) and set(after['translations']) == parent.LOCALES, 'after locales missing')
        found = set(); new_full = copy.deepcopy(full)
        for tr in new_full['translations']:
            require(isinstance(tr, dict) and TR_FIELDS | {'locale', 'exercise_id', 'smart_hint'} <= tr.keys(), 'full translation fields missing')
            locale = tr['locale']; require(locale in parent.LOCALES and locale not in found and tr['exercise_id'] == eid, 'duplicate/moved locale'); found.add(locale)
            require(set(before['translations'][locale]) == TR_FIELDS and set(after['translations'][locale]) == TR_FIELDS, 'translation business fields')
            require({k: tr[k] for k in TR_FIELDS} == before['translations'][locale], 'translation full before mismatch')
            tr.update(after['translations'][locale])
        new_full['exercise'].update({k: after[k] for k in MUTABLE - {'translations'}})
        if e['node_id'] in changed_parents:
            require(after['topic'] == changed_parents[e['node_id']]['topic'], 'topic must mirror after-parent')
        result.append({'id': eid, 'beforeFull': copy.deepcopy(full), 'afterFull': new_full,
                       'after': {k: copy.deepcopy(after[k]) for k in MUTABLE},
                       'sourceBinding': {'id': eid, 'beforeFullSHA256': sha(full), 'afterBusinessSHA256': sha(after)}})
    return result


def prepare(parents, inventory, reviews, parent_sha, inventory_sha):
    rows = validate_sources(parents, inventory)
    require(isinstance(reviews, dict) and set(reviews) == {'version', 'planUUID', 'parentSHA256', 'inventorySHA256', 'parentsApproval', 'exercises'}, 'review manifest schema')
    require(reviews['version'] == 1 and reviews['parentSHA256'] == parent_sha and reviews['inventorySHA256'] == inventory_sha, 'review manifest input mismatch')
    namespace = uuid.UUID(parent.identifier(reviews['planUUID']))
    pa = approval(reviews['parentsApproval'], {'parentSHA256': parent_sha, 'inventorySHA256': inventory_sha})
    require(isinstance(reviews['exercises'], list) and len(reviews['exercises']) == len(rows), 'exact per-ID approvals required')
    by_id = {}
    for review in reviews['exercises']:
        require(isinstance(review, dict) and review.get('id') not in by_id, 'duplicate review ID')
        by_id[review.get('id')] = review
    require(set(by_id) == {r['id'] for r in rows}, 'review ID coverage mismatch')
    for row in rows:
        row['review'] = approval(by_id[row['id']], row['sourceBinding'])
    return {'version': 1, 'planUUID': str(namespace), 'parentSHA256': parent_sha,
            'inventorySHA256': inventory_sha, 'parents': copy.deepcopy(parents),
            'parentsApproval': pa, 'rows': rows,
            'requestIds': [str(uuid.uuid5(namespace, 'sitov-batch:' + str(i))) for i in range(len(rows))]}


def batches(items, max_count=100, max_bytes=MAX_BATCH):
    """Offline estimate only; emitted SQL measures authoritative jsonb::text."""
    require(1 <= max_count <= 100 and 1 <= max_bytes <= MAX_BATCH, 'invalid batch bound')
    result, batch = [], []
    for item in items:
        size = lambda v: len(json.dumps(v, ensure_ascii=False, sort_keys=True, separators=(', ', ': '), allow_nan=False).encode())
        require(size([item]) <= max_bytes, 'single item too large')
        if batch and (len(batch) == max_count or size(batch + [item]) > max_bytes):
            result.append(batch); batch = []
        batch.append(item)
    if batch: result.append(batch)
    return result


def literal(value):
    return "convert_from(decode('" + canonical(value).encode().hex() + "','hex'),'UTF8')::jsonb"


PRECHECK = r"""
DECLARE p jsonb:=SITOV_PLAN; item jsonb; actual jsonb; expected jsonb;
BEGIN
 IF current_setting('role')<>'none' THEN RAISE EXCEPTION 'sitov_owner_session_required'; END IF;
 LOCK TABLE public.learning_units,public.path_nodes,public.path_node_translations,public.path_objectives,
  public.learning_exercises,public.grammar_translations,path_private.sitov_content_revisions,
  path_private.sitov_content_revision_receipts,sitov_special_private.definitions IN SHARE ROW EXCLUSIVE MODE;
 PERFORM e.id FROM public.learning_exercises e JOIN jsonb_array_elements(p->'rows') v ON e.id=(v->>'id')::uuid ORDER BY e.id FOR UPDATE OF e;
 PERFORM t.exercise_id FROM public.grammar_translations t JOIN jsonb_array_elements(p->'rows') v ON t.exercise_id=(v->>'id')::uuid ORDER BY t.exercise_id,t.locale FOR UPDATE OF t;
 IF EXISTS(SELECT 1 FROM path_private.sitov_content_revisions r JOIN jsonb_array_elements(p->'rows') v ON r.exercise_id=(v->>'id')::uuid)
  OR EXISTS(SELECT 1 FROM path_private.sitov_content_revision_receipts r WHERE r.request_id::text IN(SELECT jsonb_array_elements_text(p->'requestIds')))
 THEN RAISE EXCEPTION 'sitov_combined_existing_history_no_blind_retry'; END IF;
 IF EXISTS(SELECT 1 FROM sitov_special_private.definitions d CROSS JOIN LATERAL jsonb_array_elements(d.pool) q
  JOIN jsonb_array_elements(p->'rows') v ON v->>'id'=q->>'id')
 THEN RAISE EXCEPTION 'sitov_combined_existing_special'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p->'rows') ORDER BY value->>'id' LOOP
  IF (SELECT count(*) FROM(SELECT 1 FROM public.grammar_translations WHERE exercise_id=(item->>'id')::uuid LIMIT 6) bounded)<>5 THEN
   RAISE EXCEPTION 'sitov_combined_translation_count'; END IF;
  actual:=path_private.sitov_revision_full((item->>'id')::uuid);
  SELECT jsonb_agg(value ORDER BY value->>'locale') INTO expected FROM jsonb_array_elements(item#>'{beforeFull,translations}');
  IF actual->'exercise' IS DISTINCT FROM item#>'{beforeFull,exercise}' OR actual->'translations' IS DISTINCT FROM expected THEN
   RAISE EXCEPTION 'sitov_combined_stale_full_source'; END IF;
 END LOOP;
END;
"""

REVISE = r"""
DECLARE p jsonb:=SITOV_PLAN; source jsonb; old jsonb; candidate jsonb; item jsonb;
 batch jsonb:='[]'; all_batches jsonb:='[]'; payload jsonb; result jsonb;
 expected jsonb:='{}'; entry jsonb; req uuid; idx integer:=0; archived record; receipt record;
BEGIN
 FOR source IN SELECT value FROM jsonb_array_elements(p->'rows') ORDER BY value->>'id' LOOP
  old:=path_private.sitov_revision_projection((source->>'id')::uuid);
  IF source#>>'{after,topic}' IS DISTINCT FROM (SELECT n.topic FROM public.path_nodes n WHERE n.id=(source#>>'{beforeFull,exercise,node_id}')::uuid) THEN
   RAISE EXCEPTION 'sitov_combined_topic_binding'; END IF;
  candidate:=old||(source->'after');
  IF candidate=old THEN RAISE EXCEPTION 'sitov_combined_noop'; END IF;
  item:=jsonb_build_object('id',source->>'id','expected_hash',path_private.sitov_revision_hash(old),
   'after',candidate,'review',(source->'review')||jsonb_build_object('before_hash',path_private.sitov_revision_hash(old),'after_hash',path_private.sitov_revision_hash(candidate)));
  IF octet_length(jsonb_build_array(item)::text)>1500000 THEN RAISE EXCEPTION 'sitov_combined_single_item_size'; END IF;
  IF jsonb_array_length(batch)>0 AND (jsonb_array_length(batch)>=100 OR octet_length((batch||jsonb_build_array(item))::text)>1500000) THEN
   all_batches:=all_batches||jsonb_build_array(batch); batch:='[]'; END IF;
  batch:=batch||jsonb_build_array(item);
  expected:=expected||jsonb_build_object(source->>'id',jsonb_build_object('before',old,'after',candidate,'source',source));
 END LOOP;
 IF jsonb_array_length(batch)>0 THEN all_batches:=all_batches||jsonb_build_array(batch); END IF;
 FOR payload IN SELECT value FROM jsonb_array_elements(all_batches) LOOP
  req:=(p->'requestIds'->>idx)::uuid; idx:=idx+1;
  IF jsonb_array_length(payload)>100 OR octet_length(payload::text)>1500000 THEN RAISE EXCEPTION 'sitov_combined_batch_bound'; END IF;
  -- All private construction/hashing runs as owner. Only the public checked
  -- writer runs as service_role; no private writer grant or trigger bypass.
  EXECUTE 'SET LOCAL ROLE service_role';
  result:=public.sitov_revise_path_content(req,payload);
  EXECUTE 'RESET ROLE';
  SELECT * INTO receipt FROM path_private.sitov_content_revision_receipts WHERE request_id=req;
  IF NOT FOUND OR receipt.payload IS DISTINCT FROM payload OR receipt.result IS DISTINCT FROM result
   OR jsonb_array_length(result)<>jsonb_array_length(payload) THEN RAISE EXCEPTION 'sitov_combined_receipt'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(payload) LOOP
   expected:=jsonb_set(expected,ARRAY[item->>'id','requestId'],to_jsonb(req::text));
  END LOOP;
 END LOOP;
 FOR entry IN SELECT value FROM jsonb_each(expected) LOOP
  source:=entry->'source'; req:=(entry->>'requestId')::uuid;
  SELECT * INTO archived FROM path_private.sitov_content_revisions WHERE request_id=req AND exercise_id=(source->>'id')::uuid;
  IF NOT FOUND OR (SELECT count(*) FROM path_private.sitov_content_revisions WHERE exercise_id=(source->>'id')::uuid)<>1
   OR archived.before_projection IS DISTINCT FROM entry->'before' OR archived.after_projection IS DISTINCT FROM entry->'after'
   OR archived.before_hash IS DISTINCT FROM path_private.sitov_revision_hash(entry->'before')
   OR archived.after_hash IS DISTINCT FROM path_private.sitov_revision_hash(entry->'after')
   OR archived.review_evidence IS DISTINCT FROM ((source->'review')||jsonb_build_object('before_hash',path_private.sitov_revision_hash(entry->'before'),'after_hash',path_private.sitov_revision_hash(entry->'after')))
   OR archived.actor_role IS DISTINCT FROM 'service_role'
   OR path_private.sitov_revision_projection((source->>'id')::uuid) IS DISTINCT FROM entry->'after'
   OR archived.before_full->'exercise' IS DISTINCT FROM source#>'{beforeFull,exercise}'
   OR archived.after_full IS DISTINCT FROM path_private.sitov_revision_full((source->>'id')::uuid)
   OR archived.after_full->'exercise' IS DISTINCT FROM source#>'{afterFull,exercise}' THEN
   RAISE EXCEPTION 'sitov_combined_final_archive_projection'; END IF;
  IF archived.before_full->'translations' IS DISTINCT FROM
   (SELECT jsonb_agg(value ORDER BY value->>'locale') FROM jsonb_array_elements(source#>'{beforeFull,translations}'))
   OR archived.after_full->'translations' IS DISTINCT FROM
   (SELECT jsonb_agg(value ORDER BY value->>'locale') FROM jsonb_array_elements(source#>'{afterFull,translations}')) THEN
   RAISE EXCEPTION 'sitov_combined_final_full_translations'; END IF;
 END LOOP;
 IF (SELECT count(*) FROM path_private.sitov_content_revision_receipts r WHERE r.request_id::text IN(SELECT jsonb_array_elements_text(p->'requestIds')))<>idx THEN
  RAISE EXCEPTION 'sitov_combined_final_receipt_count'; END IF;
 -- Recheck complete parent/objective images after every exercise call, so
 -- unexpected cross-table trigger effects cannot escape the final projection.
 FOR source IN SELECT value FROM jsonb_array_elements(p#>'{parents,nodes}') LOOP
  SELECT to_jsonb(n) INTO old FROM public.path_nodes n WHERE n.id=(source#>>'{after,node,id}')::uuid;
  IF (old-'updated_at') IS DISTINCT FROM ((source#>'{after,node}')-'updated_at') THEN
   RAISE EXCEPTION 'sitov_combined_final_parent'; END IF;
  IF (SELECT count(*) FROM(SELECT 1 FROM public.path_node_translations WHERE node_id=(source#>>'{after,node,id}')::uuid LIMIT 6) bounded)<>5
   OR (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.locale) FROM(SELECT * FROM public.path_node_translations WHERE node_id=(source#>>'{after,node,id}')::uuid ORDER BY locale LIMIT 5)t)
    IS DISTINCT FROM (SELECT jsonb_agg(value ORDER BY value->>'locale') FROM jsonb_array_elements(source#>'{after,translations}')) THEN
   RAISE EXCEPTION 'sitov_combined_final_parent_translations'; END IF;
 END LOOP;
 FOR source IN SELECT value FROM jsonb_array_elements(p#>'{parents,objectives}') LOOP
  SELECT to_jsonb(o) INTO old FROM public.path_objectives o WHERE o.unit_id=(source#>>'{after,unit_id}')::uuid AND o.id=source#>>'{after,id}';
  IF old IS DISTINCT FROM source->'after' THEN RAISE EXCEPTION 'sitov_combined_final_objective'; END IF;
 END LOOP;
END;
"""


def emit(plan, reviewed_commit=False):
    suffix = 'SET CONSTRAINTS ALL IMMEDIATE;\nROLLBACK;\n'
    sql = parent.emit(plan['parents'])
    require(sql.endswith(suffix) and sql.count('DO $sitov_parent_cas$') == 1, 'parent emitter contract drift')
    head, body = sql[:-len(suffix)].split('DO $sitov_parent_cas$', 1)
    data = literal(plan)
    return (head + 'SET LOCAL search_path=pg_catalog;\nDO $sitov_combined_before$\n' +
            PRECHECK.replace('SITOV_PLAN', data) + '$sitov_combined_before$;\n' +
            'DO $sitov_parent_cas$' + body + 'DO $sitov_combined_revision$\n' +
            REVISE.replace('SITOV_PLAN', data) + '$sitov_combined_revision$;\n' +
            'SET CONSTRAINTS ALL IMMEDIATE;\n' + ('COMMIT;\n' if reviewed_commit else 'ROLLBACK;\n'))


def normalized_full(value):
    result = copy.deepcopy(value)
    result['translations'] = sorted(result['translations'], key=lambda r: r['locale'])
    return result


def classify(plan, observed):
    """Read-only offline classification of explicit M-collected full readback.

    No retry/connection/write. Missing evidence or mixed state is never NEW.
    Native collector and receipt/hash authenticity remain M's rehearsal gate.
    """
    try:
        old, new = True, True
        for row in plan['rows']:
            actual = normalized_full(observed['exercises'][row['id']])
            old &= actual == normalized_full(row['beforeFull'])
            new &= actual == normalized_full(row['afterFull'])
        for row in plan['parents']['nodes']:
            actual = normalized_full(observed['parents'][row['before']['node']['id']])
            old &= actual == normalized_full(row['before'])
            after = normalized_full(row['after']); actual_new = copy.deepcopy(actual)
            actual_new['node'].pop('updated_at'); after['node'].pop('updated_at')
            new &= actual_new == after
        for row in plan['parents']['objectives']:
            key = row['before']['unit_id'] + '/' + row['before']['id']
            old &= observed['objectives'][key] == row['before']
            new &= observed['objectives'][key] == row['after']
        archives, receipts = observed['archives'], observed['receipts']
        if old and not archives and not receipts: return 'OLD_REVIEW_REQUIRED'
        # Fail closed: this draft intentionally requires separate native
        # archive/receipt verification before any NEW state is accepted.
        if new: return 'NEW_NATIVE_ARCHIVE_VERIFICATION_REQUIRED'
        return 'MIXED_OR_CHANGED_ABORT'
    except (KeyError, TypeError, ValueError):
        return 'INCOMPLETE_READBACK_ABORT'


def write_exclusive(path, content):
    fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, 'w') as stream:
        stream.write(content); stream.flush(); os.fsync(stream.fileno())


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    for field in ('parents', 'inventory', 'reviews'):
        ap.add_argument('--' + field, required=True); ap.add_argument('--' + field + '-sha256', required=True)
    ap.add_argument('--output', required=True); ap.add_argument('--reviewed-commit', action='store_true')
    args = ap.parse_args()
    parents = parent.load(args.parents, args.parents_sha256)
    inventory = load(args.inventory, args.inventory_sha256)
    reviews = load(args.reviews, args.reviews_sha256)
    plan = prepare(parents, inventory, reviews, args.parents_sha256, args.inventory_sha256)
    write_exclusive(args.output, emit(plan, args.reviewed_commit))


if __name__ == '__main__': main()
