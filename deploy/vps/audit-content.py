#!/usr/bin/env python3
"""Read-only Phase 3.4/3.5 catalog audit; writes only local JSON/Markdown reports.

Run locally with --ssh-host sitov-academy, or on the VPS without --ssh-host.
No learner, account, submission, billing or storage data is queried.
"""
import argparse
import collections
import hashlib
import json
import re
import shlex
import subprocess
import unicodedata
from pathlib import Path

LOCALES = ('de', 'en', 'ru', 'uk', 'tr')
CYRILLIC_CHARACTERS = '\u0400-\u052f\u1c80-\u1c8f\u1d2b\u1d78\u2de0-\u2dff\ua640-\ua69f\U0001e030-\U0001e08f'
CYRILLIC = re.compile('[' + CYRILLIC_CHARACTERS + ']')
FORBIDDEN = re.compile('[' + CYRILLIC_CHARACTERS + 'ığşİĞŞ]')
TRIM_CHARACTERS = '\t\n\v\f\r \u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff'
GERMAN_EXERCISE_FIELDS = ('instruction', 'text_before', 'text_after', 'question', 'correct_answer', 'gap_hint', 'options', 'accepted_answers', 'parts', 'target_form')
TABLES = {
    'vocabulary_translations': {'parent': 'learning_vocabulary_cards', 'key': 'card_id', 'fields': ('translation', 'context_sentence')},
    'grammar_translations': {'parent': 'learning_exercises', 'key': 'exercise_id', 'fields': ('hint', 'smart_hint', 'explanation', 'prompt')},
    'course_translations': {'parent': 'courses', 'key': 'course_id', 'fields': ('title', 'description')},
}
# Explicit projections prevent accidentally exporting newly added sensitive fields.
QUERY = """
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SELECT jsonb_build_object(
 'captured_at', clock_timestamp(),
 'read_only', current_setting('transaction_read_only'),
 'isolation', current_setting('transaction_isolation'),
 'database', current_database(),
 'server_version', current_setting('server_version'),
 'schema', (SELECT jsonb_agg(jsonb_build_object('table',table_name,'column',column_name,'type',data_type) ORDER BY table_name,ordinal_position)
   FROM information_schema.columns WHERE table_schema='public' AND table_name IN
   ('vocabulary_translations','grammar_translations','course_translations','learning_vocabulary_cards','learning_exercises','learning_reading_texts','courses')),
 'learning_vocabulary_cards', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM
   (SELECT id,word_de,sentence_practice FROM public.learning_vocabulary_cards) x),
 'learning_exercises', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM
   (SELECT e.id,e.topic,e.type,e.content,u.level,u.label AS unit_label FROM public.learning_exercises e JOIN public.learning_units u ON u.id=e.unit_id) x),
 'learning_reading_texts', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM
   (SELECT id,sentence_de,focus FROM public.learning_reading_texts) x),
 'courses', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM
   (SELECT id,slug,title,description,archived_at FROM public.courses) x),
 'vocabulary_translations', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY card_id,locale),'[]') FROM
   (SELECT card_id,locale,translation,context_sentence FROM public.vocabulary_translations) x),
 'grammar_translations', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY exercise_id,locale),'[]') FROM
   (SELECT exercise_id,locale,hint,smart_hint,explanation,to_jsonb(t)->>'prompt' AS prompt FROM public.grammar_translations t) x),
 'course_translations', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY course_id,locale),'[]') FROM
   (SELECT course_id,locale,title,description FROM public.course_translations) x)
);
COMMIT;
"""


def blank(value):
    return not isinstance(value, str) or not value.strip(TRIM_CHARACTERS)


def leaves(value, path):
    if isinstance(value, str):
        yield path, value
    elif isinstance(value, dict):
        for key, child in sorted(value.items()):
            yield from leaves(child, path + '.' + key)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from leaves(child, f'{path}[{index}]')


def target_state(content):
    if 'target_form' not in content:
        return 'missing'
    target = content['target_form']
    if not isinstance(target, list):
        return 'not_array'
    if not target:
        return 'empty_array'
    if any(blank(item) for item in target):
        return 'invalid_items'
    return 'valid'


def audit(snapshot):
    findings = []
    summary = []

    def finding(table, row_id, locale, check, field, value=None, **extra):
        item = {'table': table, 'id': row_id, 'locale': locale, 'check': check, 'field_path': field, **extra}
        if value is not None:
            item['value'] = value
        findings.append(item)

    for table, spec in TABLES.items():
        parents = {row['id']: row for row in snapshot[spec['parent']]}
        rows = {(row[spec['key']], row['locale']): row for row in snapshot[table]}
        columns = {column['column'] for column in snapshot['schema'] if column['table'] == table}
        fields = [field for field in spec['fields'] if field in columns]
        unavailable = [field for field in spec['fields'] if field not in columns]
        for locale in LOCALES:
            totals = dict(table=table, locale=locale, expected_rows=len(parents), rows=0, missing_rows=0,
                          all_text_blank_rows=0, required_blank_fields=0, source_field_missing=0,
                          no_cyrillic_rows=0, exact_german_copy_rows=0, exact_german_copy_fields=0,
                          blank_fields={field: 0 for field in fields}, unavailable_fields=unavailable)
            for row_id, parent in parents.items():
                source = dict(rows.get((row_id, 'de'), {}))
                origins = {field: 'de_translation_row' for field in fields}
                # German headwords/course copy are canonical on the parent table.
                fallback = {'translation': parent['word_de']} if table == 'vocabulary_translations' else (
                    {field: parent[field] for field in fields} if table == 'course_translations' else {})
                for field, value in fallback.items():
                    if blank(source.get(field)):
                        source[field] = value
                        origins[field] = spec['parent'] + ('.word_de' if table == 'vocabulary_translations' else '.' + field)
                row = rows.get((row_id, locale))
                if locale != 'de':
                    for field in fields:
                        if (row is None or blank(row.get(field))) and not blank(source.get(field)):
                            totals['source_field_missing'] += 1
                            finding(table, row_id, locale, 'german_source_present_translation_blank', field,
                                    source=origins[field], translation_row_present=row is not None)
                if row is None:
                    totals['missing_rows'] += 1
                    finding(table, row_id, locale, 'missing_row', '$', expected_parent=spec['parent'])
                    continue
                totals['rows'] += 1
                if all(blank(row.get(field)) for field in fields):
                    totals['all_text_blank_rows'] += 1
                    finding(table, row_id, locale, 'all_text_blank', '$')
                for field in fields:
                    value = row.get(field)
                    if blank(value):
                        totals['blank_fields'][field] += 1
                        required = (table == 'vocabulary_translations' and
                                    ((field == 'translation' and locale != 'de') or (field == 'context_sentence' and parent['sentence_practice']))) or (
                                    table == 'course_translations' and field == 'title')
                        totals['required_blank_fields'] += int(required)
                        finding(table, row_id, locale, 'blank_field', field, required=required,
                                value_kind='null' if value is None else 'blank_string')
                nonblank = [row[field] for field in fields if not blank(row.get(field))]
                if locale in ('ru', 'uk') and nonblank and not any(CYRILLIC.search(unicodedata.normalize('NFC', value)) for value in nonblank):
                    totals['no_cyrillic_rows'] += 1
                    finding(table, row_id, locale, 'no_cyrillic_in_nonblank_row', '$', text_fields={field: row[field] for field in fields if not blank(row.get(field))}, classification='review_heuristic')
                copied = []
                if locale in ('ru', 'uk', 'tr'):
                    for field in fields:
                        if not blank(row.get(field)) and row[field] == source.get(field):
                            copied.append(field)
                            finding(table, row_id, locale, 'exact_german_copy', field, row[field], source=origins[field], classification='review_heuristic')
                totals['exact_german_copy_rows'] += int(bool(copied))
                totals['exact_german_copy_fields'] += len(copied)
            summary.append(totals)
        for row in snapshot[table]:
            if row[spec['key']] not in parents or row['locale'] not in LOCALES:
                finding(table, row[spec['key']], row['locale'], 'outside_expected_matrix', '$')

    german_summary = []
    for table, fields in [('learning_exercises', ('topic', *('content.' + field for field in GERMAN_EXERCISE_FIELDS))), ('learning_reading_texts', ('sentence_de', 'focus'))]:
        affected = set()
        paths = collections.Counter()
        for row in snapshot[table]:
            for field in fields:
                source = row['content'].get(field.split('.', 1)[1]) if field.startswith('content.') else row.get(field)
                for path, value in leaves(source, field):
                    chars = sorted(set(FORBIDDEN.findall(unicodedata.normalize('NFC', value))))
                    if chars:
                        affected.add(row['id'])
                        paths[path] += 1
                        finding(table, row['id'], 'de', 'forbidden_characters', path, value, characters=chars,
                                classification='review_scope_before_constraint')
        german_summary.append({'table': table, 'rows': len(snapshot[table]), 'checked_fields': list(fields),
                               'affected_rows': len(affected), 'affected_fields': sum(paths.values()), 'paths': dict(paths)})
    target_counts = collections.Counter()
    target_by_level = collections.defaultdict(collections.Counter)
    for row in snapshot['learning_exercises']:
        state = target_state(row['content'])
        target_counts[state] += 1
        target_by_level[row['level']][state] += 1
        if state != 'valid':
            finding('learning_exercises', row['id'], 'de', 'target_form_' + state, 'content.target_form',
                    level=row['level'], unit_label=row['unit_label'], exercise_type=row['type'])
    findings.sort(key=lambda item: (item['table'], item['locale'], item['id'], item['check'], item['field_path']))
    return {
        'format_version': 1,
        'source': {key: snapshot[key] for key in ('captured_at', 'database', 'server_version', 'read_only', 'isolation')},
        'schema': snapshot['schema'],
        'snapshot_sha256': hashlib.sha256(json.dumps(snapshot, sort_keys=True, ensure_ascii=False).encode()).hexdigest(),
        'definitions': {
            'missing_row': 'Parent id × one of de/en/ru/uk/tr has no translation row; optional help rows are not necessarily required.',
            'blank_fields': 'Existing rows only: NULL, empty strings and whitespace-only strings; optional fields are counted separately.',
            'required_blank_fields': 'Non-German vocabulary translation, context_sentence for sentence_practice cards, and course title; an audit convention, not a new database constraint.',
            'source_field_missing': 'Non-German field is blank or the row is missing, while its corresponding German source is nonblank.',
            'no_cyrillic_rows': 'Nonblank ru/uk row with no Cyrillic in any inspected text field. Empty rows are counted only as empty, not twice.',
            'exact_german_copy': 'Nonblank corresponding field equals de byte-for-byte; no case folding, trimming or fuzzy language detection.',
            'canonical_german_sources': 'If de translation text is absent, vocabulary translation uses learning_vocabulary_cards.word_de, and course title/description use courses.title/description. Raw de row/blank counts are still reported.',
            'optional_prompt': 'grammar_translations.prompt is read via to_jsonb, audited when present in the schema, otherwise recorded as unavailable_fields; missing source-backed prompts are counted.',
            'heuristic_limits': 'Names, international words, quoted German examples and empty optional hints/descriptions are not automatically translation errors. English is not covered by the requested Cyrillic/copy heuristics.',
            'german_scope': 'Exercise topic and string leaves under ' + ', '.join(GERMAN_EXERCISE_FIELDS) + '; reading sentence_de/focus. Localized hints, smart_hint, explanations and translation prompts are excluded, matching migration 07.',
            'forbidden_characters': 'After Unicode NFC: Cyrillic U+0400–052F, U+1C80–1C8F, U+1D2B, U+1D78, U+2DE0–2DFF, U+A640–A69F, U+1E030–1E08F and ı ğ ş İ Ğ Ş; zero matches does not prove German language.',
        },
        'translation_summary': summary,
        'german_content_summary': german_summary,
        'target_form': {'rows': len(snapshot['learning_exercises']), 'states': dict(target_counts), 'by_level': dict(sorted(target_by_level.items()))},
        'findings': findings,
    }


def markdown(report, json_name, command):
    lines = ['# Inhaltslektorat — Phase 3.4/3.5', '',
             f"Stand: **{report['source']['captured_at']}** · Datenbank `{report['source']['database']}` · konsistenter Snapshot (`REPEATABLE READ`, `READ ONLY`).",
             'Der Audit liest ausschließlich Inhaltsdaten. Er ändert weder Datenbank noch Dienste; die Dateien dokumentieren den Prüfzeitpunkt.', '',
             '## Übersetzungen', '',
             '| Tabelle | Locale | Soll / vorhanden | Fehlende Zeilen | Alle Texte leer | Leere Felder | Pflichtfelder leer | DE-Quelltext ohne Übersetzung | Ohne Kyrillisch | DE-Kopie Zeilen / Felder |',
             '|---|---|---:|---:|---:|---|---:|---:|---:|---:|']
    for row in report['translation_summary']:
        blanks = ', '.join(f'{field}: {count}' for field, count in row['blank_fields'].items())
        blanks += ''.join(f'; {field}: N/A (Spalte fehlt)' for field in row['unavailable_fields'])
        lines.append(f"| `{row['table']}` | {row['locale']} | {row['expected_rows']} / {row['rows']} | {row['missing_rows']} | {row['all_text_blank_rows']} | {blanks} | {row['required_blank_fields']} | {row['source_field_missing']} | {row['no_cyrillic_rows']} | {row['exact_german_copy_rows']} / {row['exact_german_copy_fields']} |")
    lines.extend(['', 'Zähllogik: Soll = sämtliche Basisdatensätze × fünf Locales, einschließlich archivierter Kurse. Leere Felder betreffen vorhandene Zeilen; fehlende Zeilen werden separat gezählt. „Pflichtfelder“ umfasst nichtdeutsche Vokabelübersetzung, Satzkontext aktivierter Satzkarten und Kurstitel. Grammatik-Hinweise, Erklärungen, Prompts und Kursbeschreibungen sind optional.', '',
                  'Deutsche Vokabeln stehen kanonisch in `learning_vocabulary_cards.word_de`, deutsche Kurstexte in `courses.title/description`. Fehlende redundante de-Übersetzungen sind daher kein Inhaltsverlust; der Audit zählt sie transparent und nutzt die kanonischen Basisfelder für den Sprachvergleich.', '',
                  '„DE-Quelltext ohne Übersetzung“ zählt leere Zielfelder oder fehlende Zielzeilen bei nichtleerer deutscher Quelle. „Ohne Kyrillisch“ betrifft nur nichtleere ru/uk-Zeilen. „DE-Kopie“ vergleicht nichtleere ru/uk/tr-Felder bytegenau mit der deutschen Quelle. `grammar_translations.prompt` wird nach Einführung geprüft, zuvor als N/A ausgewiesen.', '',
                  '**Diese Sprachprüfungen sind Lektorats-Hinweise:** Eigennamen, internationale Wörter und zitierte deutsche Beispiele können korrekt sein. Fehlende optionale Hilfen sind nicht pauschal Fehler. Die Prüfungen erkennen weder jede falsche Übersetzung noch englische Texte zuverlässig.', '',
                  '## Konkrete Sprachhinweise', ''])
    suspects = [item for item in report['findings'] if item['check'] in ('no_cyrillic_in_nonblank_row', 'exact_german_copy')]
    if not suspects:
        lines.append('Keine Treffer der Kyrillisch-/Kopierheuristik.')
    else:
        lines.extend(['| Tabelle / ID | Locale | Feld | Befund / Auszug |', '|---|---|---|---|'])
        for item in suspects[:12]:
            fields = item.get('text_fields', {item['field_path']: item.get('value', '')})
            for field, value in fields.items():
                excerpt = value.replace('|', '\\|').replace('\n', ' ')[:220]
                lines.append(f"| `{item['table']}` / `{item['id']}` | {item['locale']} | `{field}` | `{item['check']}`: {excerpt} |")
        lines.append(f'\n{len(suspects)} Hinweise insgesamt; alle Einzelfunde stehen in der JSON-Datei. Keine automatische Übersetzung oder Korrektur vorgenommen.')
    lines.extend(['', '## Deutsche Lerninhalte', '', '| Tabelle | Zeilen | Geprüfte Felder | Auffällige Zeilen / Felder |', '|---|---:|---|---:|'])
    for row in report['german_content_summary']:
        lines.append(f"| `{row['table']}` | {row['rows']} | {', '.join(row['checked_fields'])} | {row['affected_rows']} / {row['affected_fields']} |")
    lines.extend(['', 'Geprüft werden die String-Blätter der angegebenen deutschen Felder nach NFC-Normalisierung auf kyrillische Unicode-Blöcke (einschließlich Extended-D und Modifikatorbuchstaben) sowie `ı ğ ş İ Ğ Ş`. Der Befund beweist keine vollständige Sprachkorrektheit. Lokalisierte Hinweise, Erklärungen und Übersetzungsaufforderungen sind vom deutschen Textfilter ausgenommen; der Prüfbereich entspricht Migration 07.', '', '## Bestand `target_form`', '',
                  f"Insgesamt **{report['target_form']['rows']}** Aufgaben; Zustände: " + ', '.join(f'`{state}`: **{count}**' for state, count in report['target_form']['states'].items()) + '.', '',
                  '| Niveau | Gültig | Fehlend | Ungültig |', '|---|---:|---:|---:|'])
    for level, counts in report['target_form']['by_level'].items():
        lines.append(f"| {level} | {counts.get('valid', 0)} | {counts.get('missing', 0)} | {sum(n for k,n in counts.items() if k not in ('valid','missing'))} |")
    lines.extend(['', 'Gültig bedeutet: nichtleeres Array ausschließlich nichtleerer Strings. Zielwerte werden nicht aus Lösungen erfunden. Fehlende Zielwerte sind redaktionell zu ergänzen; eine Freigabesperre für solche Aufgaben hat entsprechend Auswirkungen auf den Schülerkatalog.', '', '## Reproduktion und Einzelfunde', '',
                  f'```sh\n{command}\n```', '',
                  f'Maschinenlesbar: [{json_name}]({json_name}). Enthält alle betroffenen IDs, Locales, Prüfarten und Feldpfade sowie Werte bei Sprachauffälligkeiten, Schemainventar und Zähldefinitionen.', '',
                  f"Snapshot-SHA256: `{report['snapshot_sha256']}`. Die Prüfsumme bezieht sich auf den vollständig gelesenen Inhaltssnapshot; der Bericht enthält nur Auditbefunde, keine Lernenden- oder Kontodaten.", ''])
    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ssh-host')
    parser.add_argument('--container', default='supabase-db-eknmzxvqilojjicinatnllbt')
    parser.add_argument('--database', default='postgres')
    parser.add_argument('--output-dir', type=Path, default=Path('docs/audit'))
    args = parser.parse_args()
    command = ['docker', 'exec', '-i', args.container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'supabase_admin', '-d', args.database]
    if args.ssh_host:
        command = ['ssh', args.ssh_host, shlex.join(command)]
    response = subprocess.run(command, input=QUERY, text=True, capture_output=True, check=True, timeout=60)
    snapshot = json.loads(response.stdout)
    if snapshot['read_only'] != 'on' or snapshot['isolation'] != 'repeatable read':
        raise RuntimeError('Audit did not use the required read-only consistent snapshot')
    report = audit(snapshot)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    json_path = args.output_dir / 'content-lektorat.json'
    md_path = args.output_dir / 'content-lektorat.md'
    json_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
    invocation = ['python3', 'deploy/vps/audit-content.py']
    if args.ssh_host:
        invocation += ['--ssh-host', args.ssh_host]
    invocation += ['--container', args.container, '--database', args.database, '--output-dir', str(args.output_dir)]
    md_path.write_text(markdown(report, json_path.name, shlex.join(invocation)))
    print(json.dumps({'captured_at': snapshot['captured_at'], 'report': str(md_path), 'details': str(json_path),
                      'findings': len(report['findings']), 'target_form': report['target_form']['states'],
                      'forbidden_german_rows': {row['table']: row['affected_rows'] for row in report['german_content_summary']}}, ensure_ascii=False))


if __name__ == '__main__':
    main()
