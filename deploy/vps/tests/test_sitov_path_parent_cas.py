"""CPU/file tests only; SQL transaction/races require M's native rehearsal."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location('sitov_parent_cas', Path(__file__).parents[1] / 'sitov-path-parent-cas.py')
cas = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(cas)
NODE = '00000000-0000-4000-8000-000000000001'
UNIT = '00000000-0000-4000-8000-000000000002'


def fixture():
    node = dict(id=NODE, unit_id=UNIT, source_id='P1-N1', kind='practice',
                sort_order=1, title='Alt', topic='Thema', merkkarte={'rule': 'Alt', 'examples': ['Alt']},
                goals=['P1-G1'], anchor_node_id=None, test_size=None, is_active=True,
                created_by=None, created_at='2026-01-01T00:00:00+00:00',
                updated_at='2026-01-01T00:00:00+00:00', future_field={'keep': [1, 2]})
    before = {'node': node, 'translations': [dict(node_id=NODE, locale=locale,
              title='Alt', rule='Alt', future_field=None) for locale in sorted(cas.LOCALES)]}
    after = copy.deepcopy(before); after['node']['title'] = 'Neu'
    after['translations'][0]['rule'] = 'Neu'
    old_o = dict(unit_id=UNIT, id='P1-G1', area='grammar', description='Alt', future_field=7)
    new_o = {**old_o, 'description': 'Neu'}
    return dict(version=1, nodes=[dict(before=before, after=after)],
                objectives=[dict(before=old_o, after=new_o)])


class PreparerTests(unittest.TestCase):
    def rejects(self, mutate):
        value = fixture(); mutate(value)
        with self.assertRaises(ValueError): cas.validate(value)

    def test_valid_full_rows_and_rollback_default(self):
        value = fixture(); self.assertEqual(cas.validate(value), value)
        sql = cas.emit(value)
        self.assertTrue(sql.endswith('ROLLBACK;\n'))
        self.assertTrue(cas.emit(value, reviewed_commit=True).endswith('COMMIT;\n'))
        self.assertIn('BEGIN ISOLATION LEVEL SERIALIZABLE;', sql)
        self.assertIn("lock_timeout='2s'", sql); self.assertIn("statement_timeout='20s'", sql)
        self.assertIn('ORDER BY t.node_id,t.locale FOR UPDATE', sql)
        self.assertIn('SET CONSTRAINTS ALL IMMEDIATE', sql)
        self.assertNotIn('INSERT INTO', sql); self.assertNotIn('DELETE FROM', sql)

    def test_stale_input_sha_and_full_row_sql_predicates(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder)/'input.json'; raw = json.dumps(fixture()).encode(); p.write_bytes(raw)
            digest = hashlib.sha256(raw).hexdigest()
            self.assertEqual(cas.load(p, digest), fixture())
            p.write_bytes(raw+b' ')
            with self.assertRaisesRegex(ValueError, 'SHA mismatch'): cas.load(p, digest)
        sql = cas.emit(fixture())
        self.assertIn("actual IS DISTINCT FROM item#>'{before,node}'", sql)
        self.assertIn("to_jsonb(path_nodes)=item#>'{before,node}'", sql)
        self.assertIn("to_jsonb(path_objectives)=item->'before'", sql)
        self.assertIn('sitov_parent_stale_translations', sql)

    def test_preserves_and_rejects_changed_unknown_fields(self):
        self.rejects(lambda p: p['nodes'][0]['after']['node']['future_field'].update(keep=[]))
        self.rejects(lambda p: p['nodes'][0]['after']['translations'][0].update(future_field=1))
        self.rejects(lambda p: p['objectives'][0]['after'].update(future_field=8))
        self.rejects(lambda p: p['nodes'][0]['after']['node'].pop('future_field'))

    def test_translation_duplicates_missing_and_moved_ids(self):
        self.rejects(lambda p: p['nodes'][0]['after']['translations'][0].update(locale='en'))
        self.rejects(lambda p: p['nodes'][0]['after']['translations'].pop())
        self.rejects(lambda p: p['nodes'][0]['after']['translations'][0].update(node_id=UNIT))
        self.rejects(lambda p: p['nodes'][0]['after']['translations'].append(copy.deepcopy(p['nodes'][0]['after']['translations'][0])))

    def test_identity_and_business_protection(self):
        for field, value in [('id', UNIT), ('unit_id', NODE), ('goals', ['P2-G1']),
                             ('sort_order', 2), ('kind', 'test'), ('is_active', False),
                             ('anchor_node_id', UNIT), ('test_size', 10), ('source_id', 'P2-N1'),
                             ('updated_at', '2026-01-02T00:00:00+00:00')]:
            with self.subTest(field=field):
                self.rejects(lambda p: p['nodes'][0]['after']['node'].update({field: value}))
        self.rejects(lambda p: p['objectives'][0]['after'].update(area='vocabulary'))

    def test_invalid_identifiers_and_envelope(self):
        self.rejects(lambda p: p['nodes'][0]['before']['node'].update(id="';DROP TABLE x;--"))
        self.rejects(lambda p: p['objectives'][0]['before'].update(id="P1';--"))
        self.rejects(lambda p: p.update(table='public.profiles'))
        self.rejects(lambda p: p['nodes'].append(copy.deepcopy(p['nodes'][0])))

    def test_content_sql_injection_is_only_hex_data(self):
        value = fixture(); attack = "O'Brien $sitov_parent_cas$; COMMIT; DROP TABLE x; -- \\"
        value['nodes'][0]['after']['node']['title'] = attack
        sql = cas.emit(value)
        self.assertNotIn(attack, sql); self.assertNotIn('DROP TABLE x', sql)
        self.assertIn(cas.canonical(value).encode().hex(), sql)

    def test_noops_bounds_and_nonfinite(self):
        self.rejects(lambda p: p['nodes'][0].update(after=copy.deepcopy(p['nodes'][0]['before'])))
        self.rejects(lambda p: p['objectives'][0].update(after=copy.deepcopy(p['objectives'][0]['before'])))
        self.rejects(lambda p: p.update(nodes=p['nodes']*101))
        self.rejects(lambda p: p.update(objectives=p['objectives']*11))
        self.rejects(lambda p: p['nodes'][0]['after']['node']['merkkarte'].update(x=float('nan')))
        self.rejects(lambda p: p['nodes'][0]['after']['node'].update(title='bad\x00text'))

    def test_duplicate_json_keys_and_raw_size(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder)/'input.json'
            for raw in [b'{"version":1,"version":1}', b' '*(cas.MAX_BYTES+1)]:
                p.write_bytes(raw)
                with self.assertRaises(ValueError): cas.load(p, hashlib.sha256(raw).hexdigest())

    def test_dependency_guards_and_bounded_aggregates(self):
        sql = cas.emit(fixture())
        self.assertIn('r.before_full', sql); self.assertIn('r.after_projection', sql)
        self.assertIn('sitov_parent_existing_revision_dependency', sql)
        self.assertIn('sitov_parent_existing_special_dependency', sql)
        self.assertIn('dn.anchor_node_id=ANY(affected_nodes)', sql)
        self.assertNotIn('d.published', sql)
        self.assertIn('LIMIT 6', sql); self.assertIn('ORDER BY locale LIMIT 5', sql)
        self.assertIn('SHARE ROW EXCLUSIVE MODE', sql)
        self.assertIn('rolsuper OR rolbypassrls', sql)
        self.assertIn("(actual-'updated_at') IS DISTINCT FROM", sql)


if __name__ == '__main__': unittest.main()
