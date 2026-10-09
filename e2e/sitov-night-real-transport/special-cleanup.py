"""Exact epoch9 own disposable actors/receipts/runs cleanup; M fixtures preserved."""
import json,sys,uuid,subprocess,urllib.request
from pathlib import Path
from runtime import scope,health
TARGET='5e1b656ad8befd6af52b593be372519bf1c50704'
assert sys.argv[1:]==['--ready-target',TARGET]
root=Path('/tmp/sitov-night-20261008-qa-master');ledger=root/'s5-epoch9-ledger.json';d=json.loads(ledger.read_text());assert d['target']==TARGET and len(d['actors'])==3
url,_=scope();health();keys=json.loads((root/'test-keys.json').read_text())
for a in d['actors']:
 uid=str(uuid.UUID(a['id']));assert a['email'].startswith('sitov-s5-e9-') and a['email'].endswith('@example.invalid')
 q="DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id='"+uid+"' AND email='"+a['email']+"') THEN RAISE EXCEPTION 'own_fixture_only';END IF;END $$;DELETE FROM sitov_special_private.receipts WHERE student_id='"+uid+"';DELETE FROM sitov_special_private.runs WHERE student_id='"+uid+"';DELETE FROM public.path_node_progress WHERE auth_user_id='"+uid+"';"
 p=subprocess.run(['docker','exec','-i','sitov-night-20261008-qa-db','psql','-X','-U','supabase_admin','-d','postgres','-At','-v','ON_ERROR_STOP=1'],input=q,text=True,capture_output=True);assert p.returncode==0,'sanitized guarded cleanup failed'
 req=urllib.request.Request(url+'/auth/v1/admin/users/'+uid,headers={'Authorization':'Bearer '+keys['service'],'apikey':keys['anon']},method='DELETE')
 with urllib.request.urlopen(req,timeout=15) as r:assert r.status==200
q="SELECT jsonb_build_object('pretestDefinitions',(SELECT count(*) FROM sitov_pronunciation_private.pretest_definitions),'pretestActive',(SELECT count(*) FROM sitov_pronunciation_private.pretest_definitions WHERE active),'pretestPasses',(SELECT count(*) FROM sitov_pronunciation_private.pretest_passes),'pretestAttempts',(SELECT count(*) FROM sitov_pronunciation_private.pretest_attempts),'specialActive',(SELECT count(*) FROM sitov_special_private.activation),'authUsers',(SELECT count(*) FROM auth.users),'assets',(SELECT count(*) FROM storage.objects));"
p=subprocess.run(['docker','exec','-i','sitov-night-20261008-qa-db','psql','-X','-U','supabase_admin','-d','postgres','-At','-v','ON_ERROR_STOP=1'],input=q,text=True,capture_output=True);assert p.returncode==0;after=json.loads(p.stdout)
before=d['protocol_result']['baseline'];assert after==before
summary={'target':TARGET,'cleaned':True,'newAccounts':3,'uploads':0,'ownSpecialRunsReceiptsAnchorProgressRemoved':True,'globalCountsPreserved':True,'before':before,'after':after};ledger.write_text(json.dumps(summary));print(json.dumps(summary,indent=2))
