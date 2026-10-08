import subprocess,json
namespace='sitov-night-20261008-qa'
def inspect(kind,name):
 p=subprocess.run(['docker',kind,'inspect',name],capture_output=True,text=True)
 return json.loads(p.stdout)[0] if p.returncode==0 else None
for suffix in ['gateway','storage','rest','auth','db']:
 name=namespace+'-'+suffix;d=inspect('container',name)
 if d:
  assert d['Config']['Labels'].get('sitov.qa.namespace')==namespace,'label mismatch: refuse cleanup'
  assert d['Name']=='/'+name,'name mismatch'
  subprocess.run(['docker','rm','-f',name],check=True,stdout=subprocess.DEVNULL)
for kind,suffixes in [('network',['isolated']),('volume',['files','pgdata'])]:
 for suffix in suffixes:
  name=namespace+'-'+suffix;d=inspect(kind,name)
  if d:
   assert d['Name']==name and d['Labels'].get('sitov.qa.namespace')==namespace,'label mismatch'
   subprocess.run(['docker',kind,'rm',name],check=True,stdout=subprocess.DEVNULL)
print('Removed only exact QA namespace resources; no prune or production actions')
