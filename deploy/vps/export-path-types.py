#!/usr/bin/env python3
"""Refresh the Phase-3 public TypeScript surface from the verified clone catalog.

Unchanged generated types are preserved. No database connection or credentials.
Usage: python3 deploy/vps/export-path-types.py /tmp/clone/public-catalog.json
"""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('catalog', type=Path)
parser.add_argument('--output', type=Path, default=ROOT / 'supabase/database.types.ts')
args = parser.parse_args()
catalog = json.loads(args.catalog.read_text())
source = args.output.read_text()
enums = {}
for enum in sorted(catalog['enums'], key=lambda item: item['sort']):
    enums.setdefault(enum['name'], []).append(enum['label'])


def ts_type(pgtype):
    if pgtype.endswith('[]'):
        return ts_type(pgtype[:-2]) + '[]'
    pgtype = pgtype.removeprefix('public.')
    if pgtype in enums:
        return 'Database["public"]["Enums"][' + json.dumps(pgtype) + ']'
    if pgtype in ('json', 'jsonb'):
        return 'Json'
    if pgtype in ('boolean', 'bool'):
        return 'boolean'
    if pgtype in ('smallint', 'integer', 'bigint', 'numeric', 'real', 'double precision', 'int2', 'int4', 'int8', 'float4', 'float8'):
        return 'number'
    if pgtype in ('text', 'uuid', 'character varying', 'timestamp with time zone', 'timestamp without time zone', 'date', 'timestamptz'):
        return 'string'
    raise ValueError('Unmapped type: ' + pgtype)


def replace_member(section, name, body):
    global source
    start = source.index('    ' + section + ': {')
    stop = source.index('\n    }', start)
    current = source[start:stop]
    pattern = re.compile(r'^      ' + re.escape(name) + r': .*?(?=^      \w+:|\Z)', re.M | re.S)
    if pattern.search(current):
        current = pattern.sub(lambda _: body.rstrip() + '\n', current)
    else:
        current += '\n' + body.rstrip()
    source = source[:start] + current.rstrip() + source[stop:]


selected = sorted({c['table_name'] for c in catalog['columns']
                   if c['table_name'].startswith('path_') or c['table_name'] in ('learning_units', 'learning_exercises', 'grammar_translations')})
for table in selected:
    columns = sorted([c for c in catalog['columns'] if c['table_name'] == table], key=lambda c: c['column_name'])
    lines = ['      ' + table + ': {']
    for shape in ('Row', 'Insert', 'Update'):
        lines.append('        ' + shape + ': {')
        for column in columns:
            generated = column['is_generated'] != 'NEVER'
            nullable = column['is_nullable'] == 'YES'
            pgtype = column['udt_name'][1:] + '[]' if column['data_type'] == 'ARRAY' else column['udt_name'] if column['data_type'] == 'USER-DEFINED' else column['data_type']
            kind = 'never' if generated and shape != 'Row' else ts_type(pgtype) + (' | null' if nullable else '')
            optional = shape == 'Update' or (shape == 'Insert' and (generated or nullable or column['column_default'] is not None))
            lines.append(f'          {column["column_name"]}{"?" if optional else ""}: {kind}')
        lines.append('        }')
    relationships = []
    for constraint in catalog['constraints']:
        if constraint['table'] not in (table, 'public.' + table) or constraint['type'] != 'f':
            continue
        match = re.search(r'FOREIGN KEY \((.*?)\) REFERENCES (?:public\.)?(\w+)\((.*?)\)', constraint['definition'])
        if match:
            local, relation, remote = match.groups()
            relationships.append((constraint['name'], local.split(', '), relation, remote.split(', ')))
    lines.append('        Relationships: [')
    for name, local, relation, remote in sorted(relationships):
        lines.extend(['          {', f'            foreignKeyName: {json.dumps(name)}',
                      f'            columns: {json.dumps(local)}', '            isOneToOne: false',
                      f'            referencedRelation: {json.dumps(relation)}',
                      f'            referencedColumns: {json.dumps(remote)}', '          },'])
    lines.extend(['        ]', '      }'])
    replace_member('Tables', table, '\n'.join(lines))

functions = ['get_learning_path', 'start_path_node', 'submit_path_answer', 'start_path_test', 'submit_path_test_answer',
             'finish_path_test', 'manage_learning_path', 'import_learning_path', 'export_learning_path']
for name in functions:
    found = [fn for fn in catalog['functions'] if fn['name'] == name]
    if len(found) != 1 or found[0]['result'] != 'jsonb':
        raise ValueError('Unexpected public RPC signature: ' + name)
    lines = ['      ' + name + ': {', '        Args: {']
    for parameter in found[0]['arguments'].split(', '):
        argument, pgtype = parameter.split(' ', 1)
        pgtype, *default = pgtype.split(' DEFAULT ', 1)
        lines.append(f'          {argument}{"?" if default else ""}: {ts_type(pgtype)}')
    lines.extend(['        }', '        Returns: Json', '      }'])
    replace_member('Functions', name, '\n'.join(lines))

for name, labels in enums.items():
    if name != 'exercise_type' and not name.startswith('path_'):
        continue
    replace_member('Enums', name, '      ' + name + ': ' + ' | '.join(map(json.dumps, labels)))
    constant_start = source.index('export const Constants =')
    front, constants = source[:constant_start], source[constant_start:]
    line = '      ' + name + ': ' + json.dumps(labels) + ','
    pattern = re.compile(r'^      ' + re.escape(name) + r': \[.*?\],', re.M | re.S)
    if pattern.search(constants):
        constants = pattern.sub(lambda _: line, constants)
    else:
        constants = constants.replace('    Enums: {', '    Enums: {\n' + line, 1)
    source = front + constants
args.output.write_text(source)
print(f'Updated {len(selected)} tables, {len(functions)} RPCs and path/exercise enums from verified PostgreSQL catalog.')
