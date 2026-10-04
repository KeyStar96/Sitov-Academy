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
elif name=='systemd-run':
 os.execvp(args[args.index('--')+1],args[args.index('--')+1:])
elif name=='nice':
 os.execvp(args[2],args[2:])
elif name=='npm':
 with open(os.environ['MOCK_LOG'],'a') as f:f.write(json.dumps(['npm-env',os.environ.get('NODE_OPTIONS'),os.environ.get('SITOV_BUILD_CPUS')])+'\n')
 with open(os.environ['MOCK_LOG'],'a') as f:f.write(json.dumps(['npm-deployment-id',args,os.environ.get('SITOV_DEPLOYMENT_ID')])+'\n')
 if args==['ci','--no-audit','--no-fund']:
  pathlib.Path('node_modules/sitov-runtime/dist').mkdir(parents=True)
  pathlib.Path('node_modules/sitov-runtime/package.json').write_text('{}')
  pathlib.Path('node_modules/sitov-runtime/dist/index.js').write_text('module.exports = {}')
 elif args in (['run','build'],['run','build','--','--webpack']):
  if os.environ.get('MOCK_BUILD_FAIL')=='1':sys.exit(1)
  pathlib.Path('.next/server').mkdir(parents=True)
  pathlib.Path('.next/BUILD_ID').write_text('prepared-build\n')
  pathlib.Path('.next/required-server-files.json').write_text('{}')
  pathlib.Path('.next/server/main.js').write_text('built application')
elif name=='install':
 values=[];directory=False;mode=0o755;i=0
 while i<len(args):
  if args[i]=='-d':directory=True;i+=1
  elif args[i]=='-m':mode=int(args[i+1],8);i+=2
  elif args[i] in ('-o','-g'):i+=2
  else:values.append(args[i]);i+=1
 if directory:
  for path in values:
   pathlib.Path(path).mkdir(parents=True)
   pathlib.Path(path).chmod(mode)
 else:
  for source in values[:-1]:
   target=pathlib.Path(values[-1])
   if target.is_dir():target=target/pathlib.Path(source).name
   shutil.copy2(source,target)
   target.chmod(mode)
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
        for name in ('git', 'npm', 'systemctl', 'curl', 'install', 'chown', 'flock', 'sleep', 'mv', 'readlink', 'sha256sum', 'systemd-run', 'nice'):
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
        self.meminfo = self.root / 'meminfo'
        self.meminfo.write_text('MemTotal:        8073216 kB\nMemAvailable:    4550000 kB\n')
        self.env = dict(os.environ, PATH=str(self.bin)+os.pathsep+os.environ['PATH'],
            MOCK_LOG=str(self.log), MOCK_SOURCE=str(self.source), MOCK_MAIL_ACTIVE='1',
            SITOV_SOURCE_DIR=str(self.source), SITOV_RELEASES_DIR=str(self.root/'releases'),
            SITOV_CURRENT_LINK=str(self.current), SITOV_ENV_FILE=str(self.env_file),
            SITOV_SYSTEMD_DIR=str(self.systemd), SITOV_DEPLOY_LOCK_FILE=str(self.root/'lock'), SITOV_MEMINFO=str(self.meminfo))
        self.env.pop('SITOV_BUILD_BUNDLER', None)

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

    def test_restrictive_caller_mask_keeps_runtime_readable_and_secrets_protected(self):
        result=subprocess.run(
            ['bash','-c','umask 077; exec bash "$@"','sitov-restrictive-caller',str(SCRIPT),'--prepare-only'],
            env=self.env,text=True,capture_output=True)
        self.assertEqual(result.returncode,0,result.stderr)
        release=self.root/'releases'/REVISION
        # Root installs packages; the sitov service needs read and traversal
        # rights without owning them. Mock npm creates files under inherited mask.
        for path in (release,release/'node_modules',release/'node_modules/sitov-runtime',
                     release/'node_modules/sitov-runtime/dist',release/'.next',release/'.next/server'):
            self.assertEqual(path.stat().st_mode & 0o777,0o755,str(path))
        for path in (release/'node_modules/sitov-runtime/package.json',
                     release/'node_modules/sitov-runtime/dist/index.js',release/'.next/server/main.js'):
            self.assertEqual(path.stat().st_mode & 0o777,0o644,str(path))
        self.assertEqual((release/'.env.local').stat().st_mode & 0o777,0o640)
        for name in ('.sitov-prepared','.sitov-prepared.sha256','.sitov-build-id','.sitov-mail-was-running'):
            self.assertEqual((release/name).stat().st_mode & 0o777,0o600,name)
        self.assertEqual(self.current.resolve(),self.previous)

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

    def test_failed_build_removes_incomplete_release_so_a_retry_works(self):
        result=self.run_script('--prepare-only',MOCK_BUILD_FAIL='1')
        self.assertNotEqual(result.returncode,0)
        self.assertFalse((self.root/'releases'/REVISION).exists())
        self.assertIn('removed incomplete',result.stderr)
        self.prepare()

    def test_build_runs_in_a_memory_capped_scope_with_one_worker(self):
        self.prepare()
        scopes=[c for c in self.calls() if c[0]=='systemd-run']
        self.assertEqual(len(scopes),2)
        for call in scopes:
            self.assertIn('MemoryMax=2560M',call)
            self.assertIn('MemorySwapMax=0',call)
            self.assertIn('--scope',call)
        self.assertIn(['npm-env','--max-old-space-size=2048','1'],self.calls())
        self.assertIn(['npm','run','build'],self.calls())
        self.assertFalse(any(c[0]=='npm' for c in self.calls() if c[0]!='npm-env' and 'systemd-run' not in json.dumps(scopes)))

    def test_build_and_runtime_share_the_full_release_revision_without_rewriting_credentials(self):
        release=self.prepare()
        full_revision=REVISION+'0'*28
        self.assertIn(['npm-deployment-id',['run','build'],full_revision],self.calls())
        self.assertEqual((release/'.sitov-runtime.env').read_text(),f'SITOV_DEPLOYMENT_ID={full_revision}\n')
        self.assertEqual((release/'.sitov-runtime.env').stat().st_mode & 0o777,0o644)
        self.assertEqual((release/'.env.local').read_bytes(),self.env_file.read_bytes())
        service=(SCRIPT.parent/'sitov-app.service').read_text()
        self.assertIn('EnvironmentFile=-/var/www/sitov-current/.sitov-runtime.env',service)
        self.assertLess(service.index('EnvironmentFile=/etc/sitov-academy/app.env'),service.index('EnvironmentFile=-/var/www/sitov-current/.sitov-runtime.env'))

    def test_tampered_runtime_release_identity_cannot_activate(self):
        release=self.prepare(); self.log.write_text('')
        (release/'.sitov-runtime.env').write_text('SITOV_DEPLOYMENT_ID=wrong-release\n')
        result=self.run_script('--activate',REVISION)
        self.assertNotEqual(result.returncode,0)
        self.assertIn('artifact verification',result.stderr)
        self.assertEqual(self.current.resolve(),self.previous)
        self.assertFalse(any(c[0]=='systemctl' for c in self.calls()))

    def test_webpack_flag_reaches_the_capped_build_without_switching_live(self):
        result=self.run_script('--prepare-only',SITOV_BUILD_BUNDLER='webpack')
        self.assertEqual(result.returncode,0,result.stderr)
        calls=self.calls()
        self.assertIn(['npm','ci','--no-audit','--no-fund'],calls)
        self.assertIn(['npm','run','build','--','--webpack'],calls)
        build_scope=next(c for c in calls if c[0]=='systemd-run' and 'build' in c)
        self.assertEqual(build_scope[-5:],['npm','run','build','--','--webpack'])
        self.assertIn('MemoryMax=2560M',build_scope)
        self.assertIn('MemorySwapMax=0',build_scope)
        self.assertIn(['npm-env','--max-old-space-size=2048','1'],calls)
        self.assertTrue((self.root/'releases'/REVISION/'.sitov-prepared').is_file())
        self.assertEqual(self.current.resolve(),self.previous)
        self.assertEqual((self.source/'app.js').read_text(),'source')
        self.assertFalse(any(c[0]=='systemctl' and c[1] in ('restart','stop','daemon-reload') for c in calls))

    def test_explicit_turbopack_retains_the_default_build_command(self):
        result=self.run_script('--prepare-only',SITOV_BUILD_BUNDLER='turbopack')
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertIn(['npm','run','build'],self.calls())
        self.assertFalse(any('--webpack' in c or '--turbopack' in c for c in self.calls()))

    def test_invalid_bundler_is_rejected_before_source_or_live_mutations(self):
        (self.previous/'live.js').write_text('active release')
        source_before={str(path.relative_to(self.source)):path.read_bytes() for path in self.source.rglob('*') if path.is_file()}
        for bundler in ('', 'invalid', 'WEBPACK', 'webpack --no-mangling', 'turbopack; touch injected'):
            with self.subTest(bundler=bundler):
                result=self.run_script('--prepare-only',SITOV_BUILD_BUNDLER=bundler)
                self.assertEqual(result.returncode,2,result.stderr)
                self.assertIn('Invalid SITOV_BUILD_BUNDLER',result.stderr)
                self.assertFalse(self.log.exists())
                self.assertFalse((self.root/'lock').exists())
                self.assertFalse((self.root/'releases').exists())
                self.assertEqual(self.current.resolve(),self.previous)
                self.assertEqual((self.previous/'live.js').read_text(),'active release')
                self.assertEqual({str(path.relative_to(self.source)):path.read_bytes() for path in self.source.rglob('*') if path.is_file()},source_before)

    def test_low_memory_refuses_before_touching_anything(self):
        self.meminfo.write_text('MemTotal:        8073216 kB\nMemAvailable:    1945600 kB\n')
        result=self.run_script('--prepare-only')
        self.assertNotEqual(result.returncode,0)
        self.assertIn('Nothing was changed',result.stderr)
        self.assertFalse((self.root/'releases').exists() and any((self.root/'releases').iterdir()))
        self.assertFalse(self.log.exists() and any(c[0] in ('git','npm','systemd-run') for c in self.calls()))
        self.assertEqual(self.current.resolve(),self.previous)

    def test_rejects_unknown_revision_and_path_traversal(self):
        for revision in (REVISION,'../previous'):
            result=self.run_script('--activate',revision)
            self.assertNotEqual(result.returncode,0)
            self.assertEqual(self.current.resolve(),self.previous)

if __name__ == '__main__':
    unittest.main()
