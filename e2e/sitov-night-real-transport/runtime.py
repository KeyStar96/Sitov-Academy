"""Read-only exact QA scope/health; no container mutations or credential output."""
import subprocess,json,ipaddress,time,urllib.request,sys,datetime
NAMESPACE='sitov-night-20261008-qa'
NETWORK=NAMESPACE+'-isolated'
EXPECTED={'db':'sha256:bce4f0725a10d80bb16e01d678db8d40dd09223d18562125902e2682dd74ecdb','auth':'sha256:f2112b9289422f205df4ea15b8b550d425ae42528ea54521faa32cc7b62490de','storage':'sha256:4f0eb90b935c676914ed0609c2c7d47cddb3f336155726bb2d5542617d4afdfa','rest':'sha256:7afcb0447b7849f6875bba4a0c603d79b1e2e44aec97af123bf9a0a2ccfeae52','gateway':'sha256:6addf50e6bd8d578314cb9ce4f2d2d1e3781d2edecef59f707e00c6e05d384f5'}
def inspect(kind,name):
 p=subprocess.run(['docker',kind,'inspect',name],capture_output=True,text=True)
 return json.loads(p.stdout)[0] if p.returncode==0 else None
def validate_scope(network,containers):
 assert network and network['Name']==NETWORK and network['Internal'] is True and network['Labels'].get('sitov.qa.namespace')==NAMESPACE,'QA network mismatch'
 memory=0;cpu=0;gateway=None
 for suffix,image in EXPECTED.items():
  d=containers[suffix]
  assert d and d['Name']=='/'+NAMESPACE+'-'+suffix and d['Image']==image,'QA name/image mismatch'
  assert d['Config']['Labels'].get('sitov.qa.namespace')==NAMESPACE,'QA label mismatch'
  assert set(d['NetworkSettings']['Networks'])=={NETWORK},'foreign network forbidden'
  assert not any(d['NetworkSettings'].get('Ports',{}).values()),'published host ports forbidden'
  assert not d['HostConfig'].get('Privileged') and d['HostConfig'].get('NetworkMode') not in ['host','none']
  address=d['NetworkSettings']['Networks'][NETWORK]['IPAddress']
  assert ipaddress.ip_address(address).is_private and not ipaddress.ip_address(address).is_loopback
  memory+=d['HostConfig']['Memory'];cpu+=d['HostConfig']['NanoCpus']
  assert d['HostConfig']['Memory']>0 and d['HostConfig']['NanoCpus']>0
  if suffix=='gateway':gateway=address
 assert memory<=1024**3 and cpu<=2000000000,'QA resource limit exceeded'
 return 'http://'+gateway+':8000'
def scope():
 network=inspect('network',NETWORK)
 containers={suffix:inspect('container',NAMESPACE+'-'+suffix) for suffix in EXPECTED}
 return validate_scope(network,containers),containers
def retry(operation,attempts=15,pause=1,sleep=time.sleep):
 last=None
 for attempt in range(attempts):
  try:return operation()
  except Exception as error:
   last=type(error).__name__
   if attempt+1<attempts:sleep(pause)
 raise RuntimeError('bounded QA retry failed: '+str(last))
def metadata():
 url,containers=scope()
 return {'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'network':NETWORK,'gateway_url':url,
  'containers':[{'name':d['Name'],'image_id':d['Image'],'running':d['State']['Running'],'oom_killed':d['State']['OOMKilled'],
   'exit_code':d['State']['ExitCode'],'restart_count':d['RestartCount'],'memory_limit':d['HostConfig']['Memory'],'nano_cpus':d['HostConfig']['NanoCpus'],
   'hostports':d['NetworkSettings'].get('Ports',{})} for d in containers.values()]}
def health():
 url,containers=scope()
 assert all(d['State']['Running'] and not d['State']['OOMKilled'] for d in containers.values())
 results=[]
 for path in ['/auth/v1/health','/rest/v1/','/storage/v1/status']:
  def request():
   with urllib.request.urlopen(url+path,timeout=2) as response:
    assert response.status==200
    return response.status
  results.append({'path':path,'http_status':retry(request)})
 result=metadata();result['health']=results
 return result
if __name__=='__main__':
 print(json.dumps(health() if len(sys.argv)>1 and sys.argv[1]=='health' else metadata(),indent=2))
