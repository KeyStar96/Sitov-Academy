#!/usr/bin/env python3
"""Mocked deployment contract tests. No network, package install or systemd changes."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'deploy-release.sh'
REVISION = 'a123456789bc'
MOCK = r'''#!/usr/bin/env python3
import hashlib,json,os,pathlib,shutil,sys,tarfile
name=pathlib.Path(sys.argv[0]).name; args=sys.argv[1:]
with open(os.environ['MOCK_LOG'],'a') as f:f.write(json.dumps([name,*args])+'\n')
if name=='git':
 if 'ls-files' in args:sys.exit(1)
 if 'pull' in args:sys.exit(0)
 if 'rev-parse' in args:print('a123456789bc'+'0'*28)
 elif 'archive' in args:
  with tarfile.open(fileobj=sys.stdout.buffer,mode='w|') as tar:
   for p in sorted(pathlib.Path(os.environ['MOCK_SOURCE']).rglob('*')):
    if p.is_file():tar.add(p,arcname=str(p.relative_to(os.environ['MOCK_SOURCE'])))
 elif 'ls-tree' in args:
  for p in sorted(pathlib.Path(os.environ['MOCK_SOURCE']).rglob('*')):
   if p.is_file():sys.stdout.buffer.write(str(p.relative_to(os.environ['MOCK_SOURCE'])).encode()+b'\0')
elif name=='npm':
 if args==['run','build']:
  if os.environ.get('MOCK_BUILD_FAIL')=='1':sys.exit(1)
  pathlib.Path('.next/server').mkdir(parents=True)
  pathlib.Path('.next/BUILD_ID').write_text('prepared-build\n')
  pathlib.Path('.next/required-server-files.json').write_text('{}')
  pathlib.Path('.next/server/main.js').write_text('built application')
elif name=='install':
 values=[];directory=False;i=0
 while i<len(args):
  if args[i]=='-d':directory=True;i+=1
  elif args[i] in ('-m','-o','-g'):i+=2
  else:values.append(args[i]);i+=1
 if directory:
  for path in values:pathlib.Path(path).mkdir(parents=True)
 else:
  for source in values[:-1]:shutil.copy2(source,values[-1])
elif name=='systemctl':
 if args[:2]==['is-active','--quiet']:sys.exit(0 if os.environ.get('MOCK_MAIL_ACTIVE')=='1' else 3)
 if args==['restart','sitov-app'] and os.environ.get('MOCK_START_FAIL')=='1':sys.exit(1)
elif name=='curl':sys.exit(0 if os.environ.get('MOCK_READY','1')=='1' else 1)
elif name=='mv':
 paths=[a for a in args if not a.startswith('-')];os.replace(*paths)
elif name=='readlink':
 path=args[-1]
 if not os.path.lexists(path):sys.exit(1)
 print(os.path.realpath(path))
elif name=='sha256sum':
 if '--check' in args:
  for line in pathlib.Path(args[-1]).read_text().splitlines():
   digest,path=line.split('  ',1)
   if not pathlib.Path(path).is_file() or hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()!=digest:sys.exit(1)
 else:
  for path in args:
   if path=='--':continue
   print(hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()+'  '+path)
'''

class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.source = self.root / 'source'
        self.source.mkdir()
        (self.source / 'deploy/vps').mkdir(parents=True)
        for name in ('sitov-app.service', 'sitov-mail.service'):
            (self.source / 'deploy/vps' / name).write_text('[Service]\n')
        (self.source / 'package-lock.json').write_text('{}')
        (self.source / 'app.js').write_text('source')
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        for name in ('git', 'npm', 'systemctl', 'curl', 'install', 'chown', 'flock', 'sleep', 'mv', 'readlink', 'sha256sum'):
            command = self.bin / name
            command.write_text(MOCK)
            command.chmod(0o755)
        self.previous = self.root / 'previous'
        self.previous.mkdir()
        self.current = self.root / 'current'
        self.current.symlink_to(self.previous)
        self.systemd = self.root / 'systemd'
        self.systemd.mkdir()
        self.env_file = self.root / 'app.env'
        self.env_file.write_text('FAKE=mock-only\n')
        self.log = self.root / 'calls.jsonl'
        self.env = dict(os.environ, PATH=str(self.bin)+os.pathsep+os.environ['PATH'],
            MOCK_LOG=str(self.log), MOCK_SOURCE=str(self.source), MOCK_MAIL_ACTIVE='1',
            SITOV_SOURCE_DIR=str(self.source), SITOV_RELEASES_DIR=str(self.root/'releases'),
            SITOV_CURRENT_LINK=str(self.current), SITOV_ENV_FILE=str(self.env_file),
            SITOV_SYSTEMD_DIR=str(self.systemd), SITOV_DEPLOY_LOCK_FILE=str(self.root/'lock'))

    def run_script(self, *args, **changes):
        return subprocess.run(['bash', str(SCRIPT), *args], env=dict(self.env, **changes), text=True, capture_output=True)

    def calls(self):
        return [json.loads(line) for line in self.log.read_text().splitlines()]

    def prepare(self):
        result = self.run_script('--prepare-only')
        self.assertEqual(result.returncode, 0, result.stderr)
        return self.root/'releases'/REVISION

    def test_prepare_is_reviewable_and_never_switches_or_restarts(self):
        release=self.prepare()
        self.assertEqual(self.current.resolve(),self.previous)
        self.assertTrue((release/'.sitov-prepared').is_file())
        self.assertTrue((release/'.sitov-prepared.sha256').is_file())
        self.assertFalse(any(c[0]=='systemctl' and c[1] in ('restart','stop','daemon-reload') for c in self.calls()))

    def test_activate_verifies_prepared_build_without_pull_or_build_and_restores_mail(self):
        release=self.prepare(); self.log.write_text('')
        result=self.run_script('--activate',REVISION,'--schema-changed',MOCK_MAIL_ACTIVE='0')
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual(self.current.resolve(),release)
        self.assertFalse(any(c[0] in ('git','npm') for c in self.calls()))
        self.assertIn(['systemctl','restart','sitov-mail'],self.calls())

    def test_tampered_or_incomplete_artifact_cannot_activate(self):
        release=self.prepare(); self.log.write_text('')
        (release/'.next/server/main.js').write_text('tampered')
        result=self.run_script('--activate',REVISION)
        self.assertNotEqual(result.returncode,0)
        self.assertIn('artifact verification',result.stderr)
        self.assertEqual(self.current.resolve(),self.previous)
        self.assertFalse(any(c[0]=='systemctl' for c in self.calls()))

    def test_schema_changed_failure_stops_both_services_without_old_app_rollback(self):
        release=self.prepare(); self.log.write_text('')
        result=self.run_script('--activate',REVISION,'--schema-changed',MOCK_READY='0',MOCK_MAIL_ACTIVE='0')
        self.assertNotEqual(result.returncode,0)
        self.assertIn('no automatic rollback',result.stderr)
        self.assertEqual(self.current.resolve(),release)
        self.assertIn(['systemctl','stop','sitov-app','sitov-mail'],self.calls())
        self.assertEqual(self.calls().count(['systemctl','restart','sitov-app']),1)

    def test_standard_deploy_retains_automatic_readiness_rollback(self):
        result=self.run_script(MOCK_READY='0')
        self.assertNotEqual(result.returncode,0)
        self.assertEqual(self.current.resolve(),self.previous)
        self.assertIn('previous release restored',result.stderr)
        self.assertEqual(self.calls().count(['systemctl','restart','sitov-app']),2)

    def test_failed_build_does_not_publish_ready_marker(self):
        result=self.run_script('--prepare-only',MOCK_BUILD_FAIL='1')
        self.assertNotEqual(result.returncode,0)
        self.assertFalse((self.root/'releases'/REVISION/'.sitov-prepared').exists())
        self.assertEqual(self.current.resolve(),self.previous)

    def test_rejects_unknown_revision_and_path_traversal(self):
        for revision in (REVISION,'../previous'):
            result=self.run_script('--activate',revision)
            self.assertNotEqual(result.returncode,0)
            self.assertEqual(self.current.resolve(),self.previous)

if __name__ == '__main__':
    unittest.main()
