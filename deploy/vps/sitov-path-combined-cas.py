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
DECLARE p jsonb; item jsonb; actual jsonb; expected jsonb;
BEGIN
 SELECT plan::jsonb INTO STRICT p FROM pg_temp.sitov_combined_plan;
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
DECLARE p jsonb; source jsonb; old jsonb; candidate jsonb; item jsonb;
 batch jsonb:='[]'; all_batches jsonb:='[]'; payload jsonb; result jsonb;
 expected jsonb:='{}'; entry jsonb; req uuid; idx integer:=0; archived record; receipt record;
 spoken text; old_url text; prepared_url text;
BEGIN
 SELECT plan::jsonb INTO STRICT p FROM pg_temp.sitov_combined_plan;
 FOR source IN SELECT value FROM jsonb_array_elements(p->'rows') ORDER BY value->>'id' LOOP
  old:=path_private.sitov_revision_projection((source->>'id')::uuid);
  IF source#>>'{after,topic}' IS DISTINCT FROM (SELECT n.topic FROM public.path_nodes n WHERE n.id=(source#>>'{beforeFull,exercise,node_id}')::uuid) THEN
   RAISE EXCEPTION 'sitov_combined_topic_binding'; END IF;
  candidate:=old||(source->'after');
  IF candidate=old THEN RAISE EXCEPTION 'sitov_combined_noop'; END IF;
  -- SQL71 persists only the authoritative fill answer / joined MC utterance.
  -- Derive via the real proof BEFORE the writer, including SQL115 variants;
  -- never ignore solution_audio_url or trust a client-supplied replacement.
  old_url:=source#>>'{beforeFull,exercise,solution_audio_url}';
  IF old->>'type' IN('fill_in_blank','multiple_choice')
   AND (nullif(btrim(old_url),'') IS NULL OR strpos(old_url,'/audio_cache/')>0) THEN
   IF old->>'type'='fill_in_blank' THEN spoken:=candidate#>>'{content,correct_answer}';
   ELSE spoken:=(learning_private.sitov_learning_audio_texts('exercises',candidate,'[]'::jsonb))[1]; END IF;
   prepared_url:=vocabulary_private.sitov_prepared_german_audio_url(spoken);
   IF prepared_url IS NULL OR prepared_url !~ '^storage://audio_cache/sitov-qwen-v1/de/[a-f0-9]{64}[.]mp3$' THEN
    RAISE EXCEPTION 'sitov_combined_authoritative_audio_url'; END IF;
   source:=jsonb_set(source,'{afterFull,exercise,solution_audio_url}',to_jsonb(prepared_url));
  END IF;
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
    # COPY text escapes must be applied after JSON encoding. In particular,
    # doubling JSON's backslashes prevents COPY from interpreting JSON escapes.
    # One physical data line cannot introduce psql's standalone \ . marker.
    data = canonical(plan)
    copied = data.replace('\\', '\\\\').replace('\t', '\\t').replace('\n', '\\n').replace('\r', '\\r')
    # pg_temp isolates sessions; CREATE deliberately rejects a prior same-name
    # table. A singleton key rejects a second row, STRICT rejects zero rows.
    # Bind the raw canonical bytes so intervening triggers cannot replace the
    # frozen plan between the two independently loaded DO blocks.
    transport = (
        'CREATE TEMP TABLE sitov_combined_plan (\n'
        ' singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),\n'
        ' plan text NOT NULL CHECK (pg_catalog.encode(pg_catalog.sha256('
        "pg_catalog.convert_to(plan,'UTF8')),'hex')='" + sha(plan) + "')\n"
        ') ON COMMIT DROP;\n'
        "COPY pg_temp.sitov_combined_plan (plan) FROM STDIN WITH (FORMAT text, ENCODING 'UTF8');\n"
        + copied + '\n\\.\n')
    return (head + 'SET LOCAL search_path=pg_catalog;\n' + transport +
            'DO $sitov_combined_before$\n' + PRECHECK + '$sitov_combined_before$;\n' +
            'DO $sitov_parent_cas$' + body + 'DO $sitov_combined_revision$\n' +
            REVISE + '$sitov_combined_revision$;\n' +
            'SET CONSTRAINTS ALL IMMEDIATE;\n' + ('COMMIT;\n' if reviewed_commit else 'ROLLBACK;\n'))


def emit_bounded(plan, reviewed_commit=False, chunk_size=20):
    """Bound native statements while preserving one all-or-nothing transaction.

    Native JSONB byte limits remain authoritative. An unexpectedly split chunk
    aborts the entire transaction rather than advancing the request sequence.
    """
    require(type(chunk_size) is int and 1 <= chunk_size <= 100, 'invalid native chunk size')
    count = len(plan['rows'])
    require(1 <= count <= 1000, 'invalid native chunk coverage')
    original = emit(plan, True)
    for setting in ('statement_timeout', 'idle_in_transaction_session_timeout'):
        old = setting + "='20s'"
        require(original.count(old) == 1, 'parent native timeout contract drift')
        original = original.replace(old, setting + "='15s'", 1)
    start = original.index('DO $sitov_combined_revision$')
    body = original[start:]
    final_start = body.index(' FOR entry IN SELECT value FROM jsonb_each(expected) LOOP')
    construction = body[body.index('\n\nDECLARE'):final_start]
    chunks = (count + chunk_size - 1) // chunk_size
    out = original[:start] + 'CREATE TEMP TABLE sitov_combined_expected(id text PRIMARY KEY,value jsonb NOT NULL) ON COMMIT DROP;\n'
    for index in range(chunks):
        size = min(chunk_size, count - index * chunk_size)
        tag = '$sitov_combined_chunk_' + str(index).zfill(2) + '$'
        chunk = construction.replace('idx integer:=0', 'idx integer:=' + str(index))
        chunk = chunk.replace("ORDER BY value->>'id' LOOP", "ORDER BY value->>'id' LIMIT " + str(size) + ' OFFSET ' + str(index * chunk_size) + ' LOOP', 1)
        out += ('DO ' + tag + chunk + " IF (SELECT count(*) FROM jsonb_each(expected))<>" + str(size)
                + " OR idx<>" + str(index + 1) + " THEN RAISE EXCEPTION 'sitov_combined_chunk_shape'; END IF;\n"
                + ' INSERT INTO pg_temp.sitov_combined_expected(id,value) SELECT key,value FROM jsonb_each(expected);\nEND;\n' + tag + ';\n')
    final = body[final_start:body.index('\nEND;\n$sitov_combined_revision$;')]
    final = final.replace(' FOR entry IN SELECT value FROM jsonb_each(expected) LOOP',
                          ' FOR entry IN SELECT value FROM pg_temp.sitov_combined_expected ORDER BY id LOOP', 1)
    final = final.replace(')<>idx THEN', ')<>' + str(chunks) + ' THEN', 1)
    out += ("DO $sitov_combined_final$\nDECLARE p jsonb;source jsonb;old jsonb;entry jsonb;req uuid;archived record;\nBEGIN\n"
            + ' SELECT plan::jsonb INTO STRICT p FROM pg_temp.sitov_combined_plan;\n'
            + ' IF (SELECT count(*)FROM pg_temp.sitov_combined_expected)<>' + str(count)
            + " OR (SELECT count(*)FROM pg_temp.sitov_combined_expected x JOIN jsonb_array_elements(p->'rows')r ON x.id=r->>'id')<>" + str(count)
            + " THEN RAISE EXCEPTION 'sitov_combined_final_coverage';END IF;\n"
            + final + '\nEND;\n$sitov_combined_final$;\nSET CONSTRAINTS ALL IMMEDIATE;\n'
            + ('COMMIT;\n' if reviewed_commit else 'ROLLBACK;\n'))
    return out


def normalized_full(value):
    result = copy.deepcopy(value)
    result['translations'] = sorted(result['translations'], key=lambda r: r['locale'])
    return result


def expected_solution_url(old_url, exercise_type, derived_prepared_url):
    """SQL71 mirror for CPU checks; SQL derives the actual trusted URL itself.

    No candidate-supplied URL is accepted. Sentence-building and external real
    recording references remain exact. Prepared metadata proof stays in SQL.
    """
    if exercise_type not in {'fill_in_blank', 'multiple_choice'}:
        return old_url
    if old_url is not None and old_url.strip(' ') and '/audio_cache/' not in old_url:
        return old_url
    require(isinstance(derived_prepared_url, str) and re.fullmatch(
        r'storage://audio_cache/sitov-qwen-v1/de/[a-f0-9]{64}\.mp3', derived_prepared_url),
        'invalid authoritative prepared URL')
    return derived_prepared_url


def check_solution_url(old_url, exercise_type, derived_prepared_url, observed_url):
    require(observed_url == expected_solution_url(old_url, exercise_type, derived_prepared_url),
            'stale or unexpected authoritative audio URL')


def classify(plan, observed):
    """Pure verification; unknown acknowledgement never invokes a writer."""
    try:
        require(observed['planSHA256'] == sha(plan) and observed['complete'] is True,
                'incomplete or wrong plan')
        require(observed['readOnly'] is True and observed['privileged'] is True
                and observed['role'] == 'none', 'untrusted collector role')
        old, new = True, True
        require(set(observed['parents']) == {r['before']['node']['id'] for r in plan['parents']['nodes']}, 'parent coverage')
        require(set(observed['exercises']) == {r['id'] for r in plan['rows']}, 'exercise coverage')
        require(set(observed['objectives']) == {r['before']['unit_id']+'/'+r['before']['id'] for r in plan['parents']['objectives']}, 'objective coverage')
        for row in plan['parents']['nodes']:
            actual = normalized_full(observed['parents'][row['before']['node']['id']])
            old &= actual == normalized_full(row['before'])
            after = normalized_full(row['after']); actual_new = copy.deepcopy(actual)
            stamp = actual_new['node'].pop('updated_at'); prior = after['node'].pop('updated_at')
            from datetime import datetime
            new &= actual_new == after and datetime.fromisoformat(stamp) > datetime.fromisoformat(prior)
        for row in plan['parents']['objectives']:
            actual = observed['objectives'][row['before']['unit_id']+'/'+row['before']['id']]
            old &= actual == row['before']; new &= actual == row['after']
        for row in plan['rows']:
            record = observed['exercises'][row['id']]; actual = normalized_full(record['full'])
            old &= actual == normalized_full(row['beforeFull'])
            after = normalized_full(row['afterFull'])
            e = row['beforeFull']['exercise']
            try:
                after['exercise']['solution_audio_url'] = expected_solution_url(e['solution_audio_url'], e['type'], record['derivedPreparedURL'])
                new &= actual == after
            except ValueError:
                new = False
        archives, receipts = observed['archives'], observed['receipts']
        if old and not archives and not receipts: return 'OLD_REVIEW_REQUIRED'
        require(new, 'mixed or changed source')
        require(len(archives) == len(plan['rows']) and 1 <= len(receipts) <= len(plan['rows']), 'archive/receipt counts')
        by_id = {}; by_request = {}; expected_items = {}
        for rec in archives:
            a = rec['record']; eid = a['exercise_id']
            require(eid not in by_id, 'duplicate archive'); by_id[eid] = a
            source = next(r for r in plan['rows'] if r['id'] == eid)
            current = observed['exercises'][eid]; projection = current['projection']
            before = copy.deepcopy(projection); e = source['beforeFull']['exercise']
            before.update(content=e['content'], topic=e['topic'], explanation_card=e['explanation_card'],
                          translations={t['locale']:{k:t[k] for k in TR_FIELDS} for t in source['beforeFull']['translations']})
            require(a['before_projection'] == before and a['after_projection'] == projection, 'archive projections')
            for key in ('id','type','unit_id','node_id','goal_id','source_ref','sort_order'):
                require(projection[key] == source['afterFull']['exercise'][key], 'projection immutable drift')
            require(all(projection[k] == source['after'][k] for k in MUTABLE), 'projection after drift')
            require(normalized_full(a['before_full']) == normalized_full(source['beforeFull'])
                    and normalized_full(a['after_full']) == normalized_full(current['full']), 'archive full images')
            require(a['actor_role'] == 'service_role' and a['before_hash'] == rec['beforeHashRecomputed'] == current['beforeProjectionHash']
                    and a['after_hash'] == rec['afterHashRecomputed'] == current['projectionHash'], 'native hashes/actor')
            review = source['review'] | {'before_hash':a['before_hash'], 'after_hash':a['after_hash']}
            require(a['review_evidence'] == review, 'sourcebound review drift')
            expected_items[eid] = {'id':eid,'expected_hash':a['before_hash'],'after':projection,'review':review}
        require(set(by_id) == {r['id'] for r in plan['rows']}, 'archive coverage')
        for rec in receipts:
            r = rec['record']; req = r['request_id']; require(req not in by_request, 'duplicate receipt'); by_request[req] = rec
        require(set(by_request) == set(plan['requestIds'][:len(receipts)]), 'deterministic request coverage')
        seen = []
        for req in plan['requestIds'][:len(receipts)]:
            rec = by_request[req]; r = rec['record']; payload = r['payload']
            require(isinstance(payload,list) and 1 <= len(payload) <= 100 and 0 < rec['payloadOctets'] <= MAX_BATCH, 'native batch bound')
            ids = [v['id'] for v in payload]; require(ids == sorted(ids) and len(set(ids)) == len(ids), 'batch ID order')
            require(payload == [expected_items[eid] for eid in ids], 'receipt payload drift')
            require(r['result'] == [{'id':eid,'before_hash':by_id[eid]['before_hash'],'after_hash':by_id[eid]['after_hash']} for eid in ids], 'receipt result drift')
            require(all(by_id[eid]['request_id'] == req for eid in ids), 'archive request mismatch')
            seen.extend(ids)
        require(seen == sorted(expected_items), 'global batch coverage/order')
        return 'NEW_VERIFIED'
    except (KeyError, TypeError, ValueError, StopIteration, OverflowError):
        return 'MIXED_OR_CHANGED_ABORT'


def collector_sql(plan, plan_sha, deadline):
    """Emit bounded owner READ ONLY JSONL SQL; never execute or retry."""
    from datetime import datetime, timezone, timedelta
    require(plan_sha == sha(plan), 'explicit canonical plan SHA mismatch')
    end = datetime.fromisoformat(deadline)
    now = datetime.now(timezone.utc)
    require(end.tzinfo is not None and now < end <= now+timedelta(minutes=15), 'finite collector deadline required')
    deadline_sql = end.astimezone(timezone.utc).isoformat()
    guard = "DO $sitov_recovery_guard$ BEGIN IF clock_timestamp()>TIMESTAMPTZ '"+deadline_sql+"' OR current_setting('role')<>'none' OR current_setting('transaction_read_only')<>'on' OR NOT coalesce((SELECT rolsuper OR rolbypassrls FROM pg_catalog.pg_roles WHERE rolname=current_user),false) THEN RAISE EXCEPTION 'sitov_recovery_owner_deadline_readonly'; END IF; END $sitov_recovery_guard$;\n"
    out = ["BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\nSET LOCAL statement_timeout='15s';SET LOCAL lock_timeout='2s';SET LOCAL work_mem='4MB';SET LOCAL idle_in_transaction_session_timeout='15s';SET LOCAL search_path=pg_catalog;\n",guard,
           "SELECT jsonb_build_object('kind','meta','planSHA256','"+plan_sha+"','readOnly',true,'privileged',true,'role',current_setting('role'));\n"]
    for row in plan['parents']['nodes']:
        eid = parent.identifier(row['before']['node']['id'])
        out += [guard,"SELECT jsonb_build_object('kind','parent','id','"+eid+"','full',jsonb_build_object('node',(SELECT to_jsonb(n)FROM public.path_nodes n WHERE id='"+eid+"'),'translations',(SELECT coalesce(jsonb_agg(to_jsonb(t)ORDER BY locale),'[]')FROM(SELECT * FROM public.path_node_translations WHERE node_id='"+eid+"' ORDER BY locale LIMIT 6)t)));\n"]
    for row in plan['parents']['objectives']:
        e = row['before']; unit = parent.identifier(e['unit_id']); oid = e['id']
        require(re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,99}',oid), 'invalid objective identifier')
        out += [guard,"SELECT jsonb_build_object('kind','objective','key','"+unit+'/'+oid+"','full',(SELECT to_jsonb(o)FROM public.path_objectives o WHERE unit_id='"+unit+"' AND id='"+oid+"'));\n"]
    for row in plan['rows']:
        eid = parent.identifier(row['id']); e = row['beforeFull']['exercise']
        before = {'content':e['content'],'topic':e['topic'],'explanation_card':e['explanation_card'], 'translations':{t['locale']:{k:t[k]for k in TR_FIELDS}for t in row['beforeFull']['translations']}}
        candidate = {'type':e['type'],'content':row['after']['content']}
        spoken = "("+literal(candidate)+")#>>'{content,correct_answer}'" if e['type']=='fill_in_blank' else "(learning_private.sitov_learning_audio_texts('exercises',"+literal(candidate)+",'[]'))[1]"
        derive = "NULL::text"
        if e['type'] in {'fill_in_blank','multiple_choice'} and (e['solution_audio_url'] is None or not e['solution_audio_url'].strip(' ') or '/audio_cache/' in e['solution_audio_url']):
            derive = "CASE WHEN EXISTS(SELECT 1 FROM path_private.sitov_content_revisions WHERE exercise_id='"+eid+"')THEN vocabulary_private.sitov_prepared_german_audio_url("+spoken+")ELSE NULL END"
        out += [guard,"SELECT jsonb_build_object('kind','exercise','id','"+eid+"','record',jsonb_build_object('full',jsonb_build_object('exercise',to_jsonb(e),'translations',(SELECT coalesce(jsonb_agg(to_jsonb(t)ORDER BY locale),'[]')FROM(SELECT * FROM public.grammar_translations WHERE exercise_id=e.id ORDER BY locale LIMIT 6)t)),'projection',p.v,'projectionHash',path_private.sitov_revision_hash(p.v),'beforeProjectionHash',path_private.sitov_revision_hash(p.v||"+literal(before)+"),'derivedPreparedURL',"+derive+")) FROM public.learning_exercises e CROSS JOIN LATERAL(SELECT CASE WHEN (SELECT count(*)FROM(SELECT 1 FROM public.grammar_translations WHERE exercise_id=e.id LIMIT 6)bounded)=5 THEN path_private.sitov_revision_projection(e.id)END v)p WHERE e.id='"+eid+"';\n"]
    ids = ','.join("'"+parent.identifier(r['id'])+"'::uuid"for r in plan['rows'])
    requests = ','.join("'"+parent.identifier(r)+"'::uuid"for r in plan['requestIds'])
    bound = str(len(plan['rows'])+1)
    out += [guard,"SELECT jsonb_build_object('kind','archive','record',to_jsonb(r),'beforeHashRecomputed',path_private.sitov_revision_hash(r.before_projection),'afterHashRecomputed',path_private.sitov_revision_hash(r.after_projection)) FROM path_private.sitov_content_revisions r WHERE exercise_id IN("+ids+") OR request_id IN("+requests+") ORDER BY revision_id LIMIT "+bound+";\n",guard,
            "SELECT jsonb_build_object('kind','receipt','record',to_jsonb(r),'payloadOctets',octet_length(r.payload::text)) FROM path_private.sitov_content_revision_receipts r WHERE request_id IN("+requests+") ORDER BY request_id LIMIT "+bound+";\n",guard,
            "SELECT jsonb_build_object('kind','end','planSHA256','"+plan_sha+"');\nCOMMIT;\n"]
    return ''.join(out)


def parse_collector(plan, raw):
    records = [json.loads(line,object_pairs_hook=parent.unique_object) for line in raw.splitlines() if line.strip()]
    require(2 <= len(records) <= 4*len(plan['rows'])+len(plan['parents']['nodes'])+len(plan['parents']['objectives'])+3,'collector row bound')
    meta = records[0]; require(meta.pop('kind') == 'meta' and records[-1] == {'kind':'end','planSHA256':sha(plan)},'collector framing')
    observed = meta | {'complete':True,'parents':{},'objectives':{},'exercises':{},'archives':[],'receipts':[]}
    for rec in records[1:-1]:
        kind = rec['kind']
        if kind in {'parent','objective','exercise'}:
            target = observed[{'parent':'parents','objective':'objectives','exercise':'exercises'}[kind]]
            key = rec['key'] if kind=='objective' else rec['id']; require(key not in target,'duplicate collector identity')
            target[key] = rec['record'] if kind=='exercise' else rec['full']
        else:
            require(kind in {'archive','receipt'},'unknown collector record')
            observed['archives' if kind=='archive' else 'receipts'].append({k:v for k,v in rec.items()if k!='kind'})
    return observed


def write_exclusive(path, content):
    fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, 'w') as stream:
        stream.write(content); stream.flush(); os.fsync(stream.fileno())


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    for field in ('parents', 'inventory', 'reviews'):
        ap.add_argument('--' + field, required=True); ap.add_argument('--' + field + '-sha256', required=True)
    ap.add_argument('--output', required=True); ap.add_argument('--reviewed-commit', action='store_true')
    ap.add_argument('--collector-deadline'); ap.add_argument('--plan-sha256')
    ap.add_argument('--native-chunk-size', type=int)
    args = ap.parse_args()
    parents = parent.load(args.parents, args.parents_sha256)
    inventory = load(args.inventory, args.inventory_sha256)
    reviews = load(args.reviews, args.reviews_sha256)
    plan = prepare(parents, inventory, reviews, args.parents_sha256, args.inventory_sha256)
    if args.collector_deadline:
        require(not args.reviewed_commit, 'collector never commits writes')
        require(args.native_chunk_size is None, 'collector cannot emit native writer chunks')
        output = collector_sql(plan, args.plan_sha256, args.collector_deadline)
    else:
        require(args.plan_sha256 is None, 'plan SHA option requires collector')
        output = (emit(plan, args.reviewed_commit) if args.native_chunk_size is None
                  else emit_bounded(plan, args.reviewed_commit, args.native_chunk_size))
    write_exclusive(args.output, output)


if __name__ == '__main__': main()
