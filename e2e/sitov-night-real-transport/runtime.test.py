import unittest,copy
from unittest.mock import Mock
from runtime import validate_scope,retry,EXPECTED,NAMESPACE,NETWORK
from cleanup import removal_plan,cleanup

def fixtures():
 net={'Name':NETWORK,'Internal':True,'Labels':{'sitov.qa.namespace':NAMESPACE}}
 containers={}
 for suffix,image in EXPECTED.items():
  containers[suffix]={'Name':'/'+NAMESPACE+'-'+suffix,'Image':image,
   'Config':{'Labels':{'sitov.qa.namespace':NAMESPACE}},
   'NetworkSettings':{'Networks':{NETWORK:{'IPAddress':'10.0.3.3'}},'Ports':{'8000/tcp':None}},
   'HostConfig':{'Memory':128*1024**2,'NanoCpus':250000000,'Privileged':False,'NetworkMode':NETWORK}}
 return net,containers
class Guards(unittest.TestCase):
 def test_actual_internal_route_requires_exact_scope_and_no_host_ports(self):
  net,containers=fixtures();self.assertEqual(validate_scope(net,containers),'http://10.0.3.3:8000')
  for mutate in [lambda n,c:n.update(Internal=False),lambda n,c:c['gateway']['Config']['Labels'].clear(),
   lambda n,c:c['gateway']['NetworkSettings']['Networks'].update(production={'IPAddress':'1.2.3.4'}),
   lambda n,c:c['gateway']['NetworkSettings']['Ports'].update({'8000/tcp':[{'HostIp':'0.0.0.0'}]})]:
   n,c=copy.deepcopy(net),copy.deepcopy(containers);mutate(n,c)
   with self.assertRaises(AssertionError):validate_scope(n,c)
 def test_retry_is_bounded_and_recovery_is_observed(self):
  fail=Mock(side_effect=OSError('sanitized'))
  with self.assertRaises(RuntimeError):retry(fail,attempts=3,sleep=lambda _:None)
  self.assertEqual(fail.call_count,3)
  recover=Mock(side_effect=[OSError(),200]);self.assertEqual(retry(recover,sleep=lambda _:None),200)
 def test_cleanup_rejects_all_before_mutation_on_late_label_mismatch(self):
  run=Mock()
  def inspect(kind,name):
   if kind=='container':return {'Name':'/'+name,'Config':{'Labels':{'sitov.qa.namespace':NAMESPACE}}}
   return {'Name':name,'Labels':{'sitov.qa.namespace':'wrong' if name.endswith('pgdata') else NAMESPACE}}
  with self.assertRaises(AssertionError):cleanup(inspect_fn=inspect,run=run)
  run.assert_not_called()
 def test_cleanup_plan_only_exact_names_not_prune_or_generic_stop(self):
  def inspect(kind,name):
   return {'Name':'/'+name,'Config':{'Labels':{'sitov.qa.namespace':NAMESPACE}}} if kind=='container' else {'Name':name,'Labels':{'sitov.qa.namespace':NAMESPACE}}
  plan=removal_plan(inspect)
  self.assertEqual(len(plan),8)
  self.assertTrue(all(command[-1].startswith(NAMESPACE+'-') for command in plan))
  self.assertTrue(all('prune' not in command and 'stop' not in command for command in plan))
if __name__=='__main__':unittest.main()
