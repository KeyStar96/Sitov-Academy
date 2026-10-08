import subprocess,json
namespace='sitov-night-20261008-qa'
def inspect(kind,name):
 p=subprocess.run(['docker',kind,'inspect',name],capture_output=True,text=True)
 return json.loads(p.stdout)[0] if p.returncode==0 else None
def removal_plan(inspect_fn=inspect):
 removals=[]
 for suffix in ['gateway','storage','rest','auth','db']:
  name=namespace+'-'+suffix;d=inspect_fn('container',name)
  if d:
   assert d['Config']['Labels'].get('sitov.qa.namespace')==namespace,'label mismatch: refuse cleanup'
   assert d['Name']=='/'+name,'name mismatch'
   removals.append(['docker','rm','-f',name])
 for kind,suffixes in [('network',['isolated']),('volume',['files','pgdata'])]:
  for suffix in suffixes:
   name=namespace+'-'+suffix;d=inspect_fn(kind,name)
   if d:
    assert d['Name']==name and d['Labels'].get('sitov.qa.namespace')==namespace,'label mismatch'
    removals.append(['docker',kind,'rm',name])
 return removals
def cleanup(inspect_fn=inspect,run=subprocess.run):
 # Validate ALL resources before the first mutation; do not partially delete
 # valid resources before discovering a mismatched later volume/network.
 for command in removal_plan(inspect_fn):run(command,check=True,stdout=subprocess.DEVNULL)
if __name__=='__main__':
 cleanup()
 print('Removed only exact QA namespace resources; no prune or production actions')
