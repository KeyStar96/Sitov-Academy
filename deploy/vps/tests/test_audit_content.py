"""Deterministic content-audit checks; no database or SSH calls."""
import copy
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('audit_content', Path(__file__).parents[1] / 'audit-content.py')
audit = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(audit)


def fixture(prompt=False):
    data = {
        'captured_at': '2026-09-20T00:00:00Z', 'read_only': 'on', 'isolation': 'repeatable read',
        'database': 'fixture_only', 'server_version': '17', 'schema': [],
        'learning_vocabulary_cards': [{'id': 'v1', 'word_de': 'Haus', 'sentence_practice': True}, {'id': 'v2', 'word_de': 'Telefon', 'sentence_practice': False}],
        'learning_exercises': [{'id': 'g1', 'type': 'fill_in_blank', 'topic': 'Verben', 'level': 'A1.1', 'unit_label': 'Lektion 1', 'content': {'correct_answer': 'bin', 'accepted_answers': ['bin'], 'target_form': ['sein']}}],
        'learning_reading_texts': [{'id': 'r1', 'sentence_de': 'Ich wohne hier.', 'focus': None}],
        'courses': [{'id': 'c1', 'title': 'Deutsch', 'description': '', 'slug': 'deutsch', 'archived_at': None}],
        'vocabulary_translations': [], 'grammar_translations': [], 'course_translations': [],
    }
    for table, spec in audit.TABLES.items():
        for field in spec['fields']:
            if field != 'prompt' or prompt:
                data['schema'].append({'table': table, 'column': field, 'type': 'text'})
    for locale, word, hint, title in [('de', None, 'Hinweis', 'Deutsch'), ('en', 'house', 'Hint', 'German'), ('ru', 'дом', 'Подсказка', 'Немецкий'), ('uk', 'будинок', 'Підказка', 'Німецька'), ('tr', 'ev', 'İpucu', 'Almanca')]:
        for row_id in ('v1', 'v2'):
            data['vocabulary_translations'].append({'card_id': row_id, 'locale': locale, 'translation': word, 'context_sentence': hint if row_id == 'v1' else None})
        data['grammar_translations'].append({'exercise_id': 'g1', 'locale': locale, 'hint': hint, 'smart_hint': None, 'explanation': None, 'prompt': None})
        data['course_translations'].append({'course_id': 'c1', 'locale': locale, 'title': title, 'description': ''})
    return data


def row(data, table, locale, row_id=None):
    return next(item for item in data[table] if item['locale'] == locale and (row_id is None or item[audit.TABLES[table]['key']] == row_id))


def summary(report, table, locale):
    return next(item for item in report['translation_summary'] if item['table'] == table and item['locale'] == locale)


class ContentAuditTest(unittest.TestCase):
    def test_counts_missing_rows_separately_and_preserves_exact_ids(self):
        data = fixture()
        data['grammar_translations'].remove(row(data, 'grammar_translations', 'uk'))
        report = audit.audit(data)
        totals = summary(report, 'grammar_translations', 'uk')
        self.assertEqual((totals['expected_rows'], totals['rows'], totals['missing_rows']), (1, 0, 1))
        self.assertEqual(totals['source_field_missing'], 1)
        missing = [f for f in report['findings'] if f['check'] == 'missing_row']
        self.assertEqual([(f['table'], f['id'], f['locale'], f['field_path']) for f in missing], [('grammar_translations', 'g1', 'uk', '$')])

    def test_distinguishes_required_blanks_optional_blanks_and_empty_rows(self):
        data = fixture()
        row(data, 'vocabulary_translations', 'ru', 'v1').update(translation='  ', context_sentence=None)
        report = audit.audit(data)
        totals = summary(report, 'vocabulary_translations', 'ru')
        self.assertEqual(totals['required_blank_fields'], 2)
        self.assertEqual(totals['blank_fields'], {'translation': 1, 'context_sentence': 2})
        self.assertEqual(totals['all_text_blank_rows'], 1)
        self.assertEqual(totals['no_cyrillic_rows'], 0)
        self.assertEqual(summary(report, 'course_translations', 'ru')['required_blank_fields'], 0)
        self.assertEqual(summary(report, 'course_translations', 'ru')['blank_fields']['description'], 1)

    def test_russian_and_ukrainian_latin_rows_are_only_review_heuristics(self):
        data = fixture()
        row(data, 'grammar_translations', 'ru')['hint'] = 'Anna'
        row(data, 'grammar_translations', 'uk')['hint'] = 'Nico'
        report = audit.audit(data)
        for locale in ('ru', 'uk'):
            self.assertEqual(summary(report, 'grammar_translations', locale)['no_cyrillic_rows'], 1)
        suspects = [f for f in report['findings'] if f['check'] == 'no_cyrillic_in_nonblank_row']
        self.assertTrue(all(f['classification'] == 'review_heuristic' for f in suspects))
        self.assertEqual({f['text_fields']['hint'] for f in suspects}, {'Anna', 'Nico'})

    def test_copy_checks_use_canonical_german_parent_when_redundant_de_text_absent(self):
        data = fixture()
        data['course_translations'].remove(row(data, 'course_translations', 'de'))
        row(data, 'course_translations', 'tr')['title'] = 'Deutsch'
        row(data, 'vocabulary_translations', 'tr', 'v2')['translation'] = 'Telefon'
        report = audit.audit(data)
        self.assertEqual(summary(report, 'vocabulary_translations', 'de')['required_blank_fields'], 0)
        self.assertEqual(summary(report, 'course_translations', 'de')['missing_rows'], 1)
        copies = [f for f in report['findings'] if f['check'] == 'exact_german_copy']
        self.assertEqual({(f['id'], f['field_path'], f['source']) for f in copies}, {('c1', 'title', 'courses.title'), ('v2', 'translation', 'learning_vocabulary_cards.word_de')})
        self.assertTrue(all(f['classification'] == 'review_heuristic' for f in copies))

    def test_copy_comparison_is_exact_and_does_not_count_empty_fields(self):
        data = fixture()
        row(data, 'grammar_translations', 'ru')['hint'] = 'Hinweis '
        row(data, 'grammar_translations', 'tr')['hint'] = 'Hinweis'
        report = audit.audit(data)
        self.assertEqual(summary(report, 'grammar_translations', 'ru')['exact_german_copy_fields'], 0)
        self.assertEqual(summary(report, 'grammar_translations', 'tr')['exact_german_copy_fields'], 1)
        self.assertEqual(summary(report, 'course_translations', 'tr')['exact_german_copy_fields'], 0)

    def test_optional_prompt_works_before_and_after_migration_and_counts_source_gaps(self):
        before = audit.audit(fixture())
        self.assertEqual(summary(before, 'grammar_translations', 'ru')['unavailable_fields'], ['prompt'])
        self.assertNotIn('prompt', summary(before, 'grammar_translations', 'ru')['blank_fields'])
        data = fixture(prompt=True)
        row(data, 'grammar_translations', 'de')['prompt'] = 'Wie heißen Sie?'
        row(data, 'grammar_translations', 'ru')['prompt'] = 'Как вас зовут?'
        after = audit.audit(data)
        self.assertEqual(summary(after, 'grammar_translations', 'ru')['source_field_missing'], 0)
        self.assertEqual(summary(after, 'grammar_translations', 'uk')['source_field_missing'], 1)
        gaps = [f for f in after['findings'] if f['check'] == 'german_source_present_translation_blank' and f['field_path'] == 'prompt']
        self.assertEqual({f['locale'] for f in gaps}, {'en', 'uk', 'tr'})

    def test_german_scan_preserves_nested_array_paths_and_distinct_row_counts(self):
        data = fixture()
        data['learning_exercises'][0]['content']['options'] = ['Hallo', 'Живёт', 'şimdi']
        data['learning_exercises'][0]['content']['parts'] = [{'text': 'Їжа'}]
        data['learning_reading_texts'][0]['focus'] = 'ı'
        report = audit.audit(data)
        grammar, reading = report['german_content_summary']
        self.assertEqual((grammar['affected_rows'], grammar['affected_fields']), (1, 3))
        self.assertEqual((reading['affected_rows'], reading['affected_fields']), (1, 1))
        paths = {f['field_path'] for f in report['findings'] if f['check'] == 'forbidden_characters'}
        self.assertEqual(paths, {'content.options[1]', 'content.options[2]', 'content.parts[0].text', 'focus'})

    def test_unicode_normalization_extended_cyrillic_and_localized_exclusions(self):
        data = fixture()
        data['learning_exercises'][0]['content']['correct_answer'] = 's\u0327imdi'
        data['learning_exercises'][0]['content']['hint'] = {'ru': 'Подсказка'}
        data['learning_exercises'][0]['content']['explanation'] = {'tr': 'Açıklama'}
        data['learning_reading_texts'][0]['sentence_de'] = '\U0001e030\u1d2b\u1d78'
        report = audit.audit(data)
        found = [f for f in report['findings'] if f['check'] == 'forbidden_characters']
        self.assertEqual({f['field_path'] for f in found}, {'content.correct_answer', 'sentence_de'})
        self.assertEqual(next(f for f in found if f['id'] == 'g1')['characters'], ['ş'])
        self.assertEqual(set(next(f for f in found if f['id'] == 'r1')['characters']), set('\U0001e030\u1d2b\u1d78'))

    def test_target_form_whitespace_matches_javascript_and_sql_including_bom(self):
        for text in ['\ufeff', '\u00a0\u202f', '\t\n\r']:
            self.assertEqual(audit.target_state({'target_form': [text]}), 'invalid_items')
        self.assertEqual(audit.target_state({'target_form': ['\u200c']}), 'valid')

    def test_target_form_validity_and_level_counts(self):
        data = fixture()
        for n, value in enumerate([None, [], [''], ['sein', 7], ['sein']]):
            exercise = copy.deepcopy(data['learning_exercises'][0])
            exercise['id'] = 'g' + str(n + 2)
            exercise['content']['target_form'] = value
            data['learning_exercises'].append(exercise)
        del data['learning_exercises'][0]['content']['target_form']
        report = audit.audit(data)
        self.assertEqual(report['target_form']['states'], {'missing': 1, 'not_array': 1, 'empty_array': 1, 'invalid_items': 2, 'valid': 1})
        self.assertEqual(report['target_form']['by_level']['A1.1']['invalid_items'], 2)

    def test_cli_runs_only_read_only_query_and_writes_local_reproducible_artifacts(self):
        snapshot = fixture()
        with tempfile.TemporaryDirectory() as directory, patch.object(audit.subprocess, 'run') as run:
            run.return_value.stdout = json.dumps(snapshot)
            with patch('sys.argv', ['audit-content.py', '--ssh-host', 'fixture-host', '--output-dir', directory]), patch('builtins.print'):
                audit.main()
            args, options = run.call_args
            self.assertEqual(args[0][0:2], ['ssh', 'fixture-host'])
            self.assertIn('READ ONLY', options['input'])
            self.assertIn("to_jsonb(t)->>'prompt'", options['input'])
            self.assertNotRegex(options['input'], r'\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE)\b')
            report = json.loads((Path(directory) / 'content-lektorat.json').read_text())
            self.assertEqual(report['source']['database'], 'fixture_only')
            markdown = (Path(directory) / 'content-lektorat.md').read_text()
            self.assertIn('N/A (Spalte fehlt)', markdown)
            self.assertIn('Lektorats-Hinweise', markdown)


if __name__ == '__main__':
    unittest.main()
