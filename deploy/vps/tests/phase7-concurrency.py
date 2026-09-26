#!/usr/bin/env python3
"""Exercise both serial orders of learner writes and teacher resets in a disposable local Phase-7 clone.

Uses independent real PostgreSQL connections. The first transaction holds its
locks after its RPC returns; pg_stat_activity must prove the other connection
is waiting on an advisory lock before the first transaction commits. A verified
pg_dump is written before synthetic fixture creation. Only the generated fixture
UUIDs are removed afterwards; existing learners, paths and content are untouched.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import select
import subprocess
import time
import uuid


def quoted(value):
    return "'" + str(value).replace("'", "''") + "'"


class Connection:
    def __init__(self, argv, env, label):
        self.label = label
        self.proc = subprocess.Popen(argv, env={**env, 'PGAPPNAME': label}, stdin=subprocess.PIPE,
                                     stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        self.buffer = b''
        self.send("SET statement_timeout='10s'; SET idle_in_transaction_session_timeout='30s';")

    def send(self, sql):
        self.proc.stdin.write((sql + '\n').encode())
        self.proc.stdin.flush()

    def line(self, timeout=12):
        deadline = time.monotonic() + timeout
        while b'\n' not in self.buffer:
            if self.proc.poll() is not None:
                raise RuntimeError(self.proc.stderr.read().decode())
            remaining = deadline-time.monotonic()
            if remaining <= 0:
                raise TimeoutError(f'{self.label}: PostgreSQL response timed out')
            ready, _, _ = select.select([self.proc.stdout], [], [], remaining)
            if ready:
                chunk = os.read(self.proc.stdout.fileno(), 65536)
                if not chunk:
                    raise RuntimeError(self.proc.stderr.read().decode())
                self.buffer += chunk
        row, self.buffer = self.buffer.split(b'\n', 1)
        return row.decode()

    def query(self, sql):
        self.send(sql)
        return json.loads(self.line())

    def begin(self, actor):
        self.send(f"BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub={quoted(actor)};")

    def commit(self):
        self.send("COMMIT;\n\\echo COMMITTED")
        assert self.line() == 'COMMITTED'

    def close(self):
        if self.proc.poll() is None:
            self.send('ROLLBACK;\n\\q')
            self.proc.wait(timeout=12)
        self.proc.stdin.close()
        self.proc.stdout.close()
        self.proc.stderr.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--connection', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--pg-bin', type=Path, default=Path('/opt/homebrew/opt/postgresql@17/bin'))
    args = parser.parse_args()
    config = json.loads(args.connection.read_text())
    socket = Path(config['socket']).resolve()
    # The parent harness creates this named ephemeral Unix-socket directory.
    # Never accept a TCP URI, arbitrary database, or persistent production path.
    if config['database'] != 'phase7' or socket.name != 'socket' or not socket.parent.name.startswith('sitov-p7-'):
        raise ValueError('Only the disposable phase7-local-dashboard.py clone is allowed')
    if not (socket / f".s.PGSQL.{int(config['port'])}").exists():
        raise ValueError('Local PostgreSQL socket is missing')
    os.umask(0o077)
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    env = {key: value for key, value in os.environ.items() if not key.startswith('PG')}
    env.update(PGHOST=str(socket), PGPORT=str(config['port']), PGUSER='postgres', PGDATABASE='phase7')
    argv = [str(args.pg_bin / 'psql'), '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-d', 'phase7']

    def sql(source):
        result = subprocess.run(argv, env=env, input=source, text=True, capture_output=True, timeout=15)
        if result.returncode:
            raise RuntimeError(result.stderr)
        return result.stdout.strip()

    def rpc(actor, expression):
        return json.loads(sql(f"BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub={quoted(actor)}; SELECT {expression}; COMMIT;"))

    assert sql("SELECT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.get_teacher_dashboard_students()'))") == 't'
    backup = output / 'before-concurrency.dump'
    if backup.exists():
        raise ValueError('Use a fresh output directory; never overwrite a verified backup')
    subprocess.run([str(args.pg_bin / 'pg_dump'), '-Fc', '-f', str(backup), '-d', 'phase7'], env=env, check=True, timeout=30, capture_output=True)
    subprocess.run([str(args.pg_bin / 'pg_restore'), '--list', str(backup)], check=True, timeout=15, capture_output=True)
    digest = hashlib.sha256(backup.read_bytes()).hexdigest()
    (output / 'backup.sha256').write_text(digest + '  before-concurrency.dump\n')
    ids = {key: str(uuid.uuid4()) for key in ['student', 'teacher', 'unit', 'practice', 'exam', 'exercise', 'test1', 'test2']}
    learner, teacher, unit, practice, exam = [ids[key] for key in ['student', 'teacher', 'unit', 'practice', 'exam']]
    tag = f'concurrency-{uuid.uuid4()}'
    report = {'database': 'local PostgreSQL', 'backup': str(backup), 'backup_sha256': digest,
              'scenarios': [], 'fixture_cleanup': False, 'fixture_ids': ids}
    sessions = []

    def intervention(action, node=None):
        return f"public.manage_learning_path({quoted(learner)},{quoted(unit)},{quoted(action)},{quoted(node) if node else 'NULL'},{quoted(uuid.uuid4())})"

    def prepare_practice():
        assert rpc(teacher, intervention('unlock'))['success']
        started = rpc(learner, f'public.start_path_node({quoted(practice)})')
        assert 'run_id' in started, started
        return started

    def practice_answer(run):
        return f"public.submit_path_answer({quoted(run['run_id'])},{quoted(run['queue'][0])},'{{\"index\":0}}'::jsonb,{quoted(uuid.uuid4())})"

    def prepare_exam():
        started = rpc(learner, f'public.start_path_test({quoted(exam)})')
        assert 'attempt_id' in started, started
        saved = rpc(learner, f"public.submit_path_test_answer({quoted(started['attempt_id'])},{quoted(started['exercises'][0]['id'])},'{{\"index\":0}}'::jsonb)")
        assert saved.get('saved'), saved
        return started

    def wait_for_lock(label):
        deadline = time.monotonic()+5
        while time.monotonic()<deadline:
            found = sql(f"SELECT coalesce(bool_or(wait_event_type='Lock' AND wait_event='advisory'),false) FROM pg_stat_activity WHERE application_name={quoted(label)}")
            if found == 't':
                return
            time.sleep(.025)
        raise AssertionError(f'{label} did not wait for the competing transaction advisory lock')

    def race(name, first_actor, first_expr, second_actor, second_expr):
        started = time.monotonic()
        a = Connection(argv, env, f'{tag}-first')
        b = Connection(argv, env, f'{tag}-second')
        sessions.extend([a, b])
        try:
            a.begin(first_actor)
            first = a.query('SELECT ' + first_expr + ';')
            assert 'error' not in first, first
            b.begin(second_actor)
            b.send('SELECT ' + second_expr + ';')
            wait_for_lock(b.label)
            a.commit()
            second = json.loads(b.line())
            b.commit()
            report['scenarios'].append({'name': name, 'wait_event': 'advisory',
                                        'elapsed_ms': round((time.monotonic()-started)*1000, 3),
                                        'first_result': first, 'second_result': second})
            return first, second
        finally:
            a.close()
            b.close()
            sessions.remove(a)
            sessions.remove(b)

    def state():
        return rpc(teacher, f"public.get_teacher_student_detail({quoted(learner)},'path','en')")['data']

    try:
        fixture = f"""
        BEGIN;
        INSERT INTO auth.users(id,email,email_confirmed_at) VALUES({quoted(learner)},{quoted(learner+'@example.invalid')},now()),({quoted(teacher)},{quoted(teacher+'@example.invalid')},now());
        INSERT INTO public.profiles(id,role,native_language,ui_language) VALUES({quoted(learner)},'student','en','en'),({quoted(teacher)},'teacher','en','en');
        INSERT INTO public.people(auth_user_id,display_name,email) VALUES({quoted(learner)},'Synthetic concurrency learner',{quoted(learner+'@example.invalid')}),({quoted(teacher)},'Synthetic concurrency teacher',{quoted(teacher+'@example.invalid')});
        INSERT INTO public.student_level_access(auth_user_id,level) VALUES({quoted(learner)},'A1.1');
        INSERT INTO public.learning_units(id,level,trainer,label,sort_order,is_path,path_source_id,path_slug,path_title)
        VALUES({quoted(unit)},'A1.1','exercises',{quoted(tag)},9000,true,{quoted(tag)},{quoted(tag)},'Nebenläufigkeitstest');
        INSERT INTO public.path_objectives(unit_id,id,area,description) VALUES({quoted(unit)},'goal','grammar','Künstliches Prüfziel');
        INSERT INTO public.path_nodes(id,unit_id,source_id,kind,sort_order,title,topic,merkkarte,goals,test_size)
        VALUES({quoted(practice)},{quoted(unit)},'practice','practice',1,'Prüfstation','Prüfung','{{"rule":"Wähle Ja.","examples":["Ja."]}}',ARRAY['goal'],NULL),
        ({quoted(exam)},{quoted(unit)},'test','test',2,'Prüftest','Prüfung',NULL,ARRAY['goal'],1);
        """
        content = quoted(json.dumps({'target_form': ['Ja'], 'question': 'Wähle Ja.', 'options': ['Ja', 'Nein'], 'correct_answer': 'Ja', 'accepted_answers': ['Ja']}))
        for key, node, order in [('exercise', practice, 1), ('test1', exam, 1), ('test2', exam, 2)]:
            fixture += f"INSERT INTO public.learning_exercises(id,unit_id,node_id,goal_id,source_ref,sort_order,topic,type,content) VALUES({quoted(ids[key])},{quoted(unit)},{quoted(node)},'goal',{quoted(key)},{order},'Prüfung','multiple_choice',{content});\n"
        sql(fixture+'COMMIT;')

        run = prepare_practice()
        cached_expr = practice_answer(run)
        first, second = race('practice answer commits before path reset', learner, cached_expr, teacher, intervention('reset_path'))
        assert first.get('completed') and second.get('success')
        data = state()
        path = next(path for path in data['paths'] if path['id'] == unit)
        assert path['nodes'][0]['stars'] == 0 and path['nodes'][0]['status'] is None
        assert sql(f"SELECT NOT is_active FROM public.path_practice_runs WHERE id={quoted(run['run_id'])}") == 't'
        assert rpc(learner, cached_expr).get('error') in ('attempt_unavailable', 'node_locked')

        run = prepare_practice()
        first, second = race('path reset commits before stale practice answer', teacher, intervention('reset_path'), learner, practice_answer(run))
        assert first.get('success') and second.get('error') in ('attempt_unavailable', 'node_locked'), second
        assert sql(f"SELECT count(*) FROM path_private.answer_receipts WHERE run_id={quoted(run['run_id'])}") == '0'

        run = prepare_practice()
        assert rpc(learner, practice_answer(run)).get('completed')
        attempted = prepare_exam()
        finish = f"public.finish_path_test({quoted(attempted['attempt_id'])},'en')"
        first, second = race('passed exam commits before test reset', learner, finish, teacher, intervention('reset_test', exam))
        assert first.get('passed') and second.get('success')
        data = state()
        path = next(path for path in data['paths'] if path['id'] == unit)
        archived = next(attempt for attempt in data['attempts'] if attempt['id'] == attempted['attempt_id'])
        assert not path['completed'] and not archived['isActive'] and archived['passed']
        assert archived['answers'][0]['result']['status'] == 'EXACT'
        assert rpc(learner, finish).get('error') == 'attempt_unavailable'

        attempted = prepare_exam()
        finish = f"public.finish_path_test({quoted(attempted['attempt_id'])},'en')"
        first, second = race('test reset commits before exam finish', teacher, intervention('reset_test', exam), learner, finish)
        assert first.get('success') and second.get('error') == 'attempt_unavailable', second
        data = state()
        archived = next(attempt for attempt in data['attempts'] if attempt['id'] == attempted['attempt_id'])
        assert not archived['isActive'] and archived['percentage'] is None and archived['answers'][0]['result'] is None
        report['passed'] = True
    except Exception as error:
        report['passed'] = False
        report['error'] = str(error)
        raise
    finally:
        for session in sessions:
            session.close()
        # All UUIDs were generated by this invocation. The database is disposable;
        # removing test fixtures restores the 200-learner benchmark population.
        (output / 'concurrency.json').write_text(json.dumps(report, indent=2)+'\n')
        sql(f"BEGIN; DELETE FROM public.profiles WHERE id={quoted(learner)}; DELETE FROM public.learning_exercises WHERE unit_id={quoted(unit)}; DELETE FROM public.learning_units WHERE id={quoted(unit)}; DELETE FROM public.profiles WHERE id={quoted(teacher)}; DELETE FROM public.people WHERE auth_user_id IN({quoted(learner)},{quoted(teacher)}); DELETE FROM auth.users WHERE id IN({quoted(learner)},{quoted(teacher)}); COMMIT;")
        report['fixture_cleanup'] = True
        (output / 'concurrency.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps({'passed': report['passed'], 'scenarios': len(report['scenarios']), 'fixture_cleanup': report['fixture_cleanup'], 'evidence': str(output / 'concurrency.json')}))


if __name__ == '__main__':
    main()
