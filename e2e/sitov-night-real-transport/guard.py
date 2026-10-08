import json,sys,datetime,subprocess
from pathlib import Path

namespace='sitov-night-20261008-qa'
expected={'db':'sha256:bce4f0725a10d80bb16e01d678db8d40dd09223d18562125902e2682dd74ecdb','auth':'sha256:f2112b9289422f205df4ea15b8b550d425ae42528ea54521faa32cc7b62490de','storage':'sha256:4f0eb90b935c676914ed0609c2c7d47cddb3f336155726bb2d5542617d4afdfa','rest':'sha256:7afcb0447b7849f6875bba4a0c603d79b1e2e44aec97af123bf9a0a2ccfeae52','gateway':'sha256:6addf50e6bd8d578314cb9ce4f2d2d1e3781d2edecef59f707e00c6e05d384f5'}
facts=json.loads(Path(sys.argv[1]).read_text())
plan=json.loads(Path('compose.json').read_text())
age=(datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(facts['captured_at'])).total_seconds()
assert 0<=age<=120,'fresh inspection required'
assert facts['memory_mib']['MemAvailable']>=3072,'3GiB headroom required'
assert facts['docker_disk_free_bytes']>=4*1024**3,'4GiB disk required'
assert 19483 not in facts['listening_tcp_ports'],'port occupied'
assert plan['name']==namespace and plan['networks']['isolated']['internal'] is True
assert plan['networks']['isolated']['name']==namespace+'-isolated'
assert not plan['networks']['isolated'].get('external')
assert sum(s['mem_limit'] for s in plan['services'].values())<=1024**3
assert sum(s['cpus'] for s in plan['services'].values())<=2
assert set(plan['services'])==set(expected)
cached={i['id'] for i in facts['images'] if i['arch']=='amd64'}
for name,s in plan['services'].items():
 assert s['image']==expected[name] and s['image'] in cached and s['pull_policy']=='never'
 assert s['container_name']==namespace+'-'+name and s['labels']['sitov.qa.namespace']==namespace
 assert s['networks']==['isolated'] and not s.get('network_mode') and not s.get('privileged')
 assert 0<s['mem_limit']==s['memswap_limit'] and 0<s['cpus']<=2
 assert s['env_file']==['./'+name+'.env']
 assert not s.get('ports'),'internal bridge: SSH to verified gateway IP only'
 assert s.get('volumes',[])=={'db':['pgdata:/var/lib/postgresql/data'],'storage':['files:/var/lib/storage'],'gateway':['./kong.json:/etc/kong/kong.json:ro']}.get(name,[])
 assert subprocess.run(['docker','container','inspect',s['container_name']],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode!=0,'existing container: stop, never reuse'
for kind in ['network','volume']:
 names=[namespace+'-isolated'] if kind=='network' else [namespace+'-pgdata',namespace+'-files']
 for name in names:
  assert subprocess.run(['docker',kind,'inspect',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode!=0,'existing resource: stop, never reuse'
for name,v in plan['volumes'].items():
 assert name in ['pgdata','files'] and v['name']==namespace+'-'+name and v['labels']['sitov.qa.namespace']==namespace and not v.get('external')
for path in Path('.').glob('*.env'):
 assert not path.is_symlink() and path.stat().st_mode&0o077==0,'private non-symlink env files required'
db_env=dict(line.split('=',1) for line in Path('db.env').read_text().splitlines() if '=' in line)
assert db_env.get('POSTGRES_USER')=='supabase_admin','cached vendor migrate.sh requires supabase_admin initialization'
print('QA preflight passed: immutable cached images; fresh headroom; exact empty namespace')
