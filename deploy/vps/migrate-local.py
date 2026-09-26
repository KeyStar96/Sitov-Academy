#!/usr/bin/env python3
"""Explicit VPS migrations with PostgreSQL + Storage API file backups.
The retired cleanup aborted on nonempty MinIO and stopped services even for
--backup-only. Storage is populated: never replay the legacy cleanup files.
This alternative preserves all files and metadata and checks SHA256 digests.
Backups contain private data, remain root-only, and must never enter Git.
"""
import argparse, datetime, hashlib, json, os, re, subprocess, urllib.parse, urllib.request
from pathlib import Path
DB='supabase-db-eknmzxvqilojjicinatnllbt'
STORAGE='supabase-storage-eknmzxvqilojjicinatnllbt'
BASE=Path('/var/www/sitov-academy')
ORDER=['02_identity_alignment.sql','03_registration_identity.sql','01_critical_fixes.sql','04_normalization.sql','05_rpc_errors.sql','06_soft_errors.sql','07_content_quality.sql','08_performance_indexes.sql','09_progress_aggregate.sql','10_rls_performance.sql','11_teacher_analytics.sql','12_media_upload.sql','13_mail_exception_kind.sql','14_mail_exceptions.sql','15_grading_helper_permissions.sql','16_uploaded_video_visibility.sql','17_remove_video_placeholders.sql','18_vocabulary_self_rating.sql','19_vocabulary_self_rating_fix.sql','20_vocabulary_learner_mode.sql','21_vocabulary_sentence_learner_choice.sql','22_vocabulary_phase6_rules.sql','23_vocabulary_own_words.sql','24_learning_activity_days.sql','25_vocabulary_lesson_switch.sql','26_mail_signup_kind.sql','27_staff_signup_notification.sql','28_mail_level_access_kind.sql','29_student_level_access_notification.sql','30_fair_answer_grading.sql','31_vocabulary_target_forms.sql','32_last_active_level.sql','33_path_exercise_types.sql','34_path_content_contract.sql','35_path_learning.sql','36_migrate_old_grammar_progress.sql','37_vocabulary_carryover.sql','38_learning_sessions.sql','39_teacher_dashboard.sql']
# Explicit file metadata: comments/string literals must never disable transactions.
AUTOCOMMIT={'08_performance_indexes.sql'}

def run(args,**kwargs):
    return subprocess.run(args,check=True,capture_output=True,**kwargs).stdout

def sql(query,database='postgres'):
    return run(['docker','exec','-i',DB,'psql','-X','-U','supabase_admin','-d',database,'-v','ON_ERROR_STOP=1','-At'],input=query,text=True).strip()

def digest(path):
    value=hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda:source.read(1024*1024),b''): value.update(chunk)
    return value.hexdigest()

def inventory():
    return json.loads(sql("SELECT coalesce(json_agg(x ORDER BY x.bucket_id,x.name),'[]') FROM (SELECT bucket_id,name,id,version,updated_at,metadata FROM storage.objects) x"))

def backup(root=Path('/root/backups'),prefix='sitov-migration-'):
    stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    target=root/(prefix+stamp)
    target.mkdir(mode=0o700,parents=True)
    before=inventory()
    for filename,command in [('postgres.dump',['pg_dump','-d','postgres','-Fc']),('roles.sql',['pg_dumpall','--roles-only'])]:
        with (target/filename).open('wb') as output:
            subprocess.run(['docker','exec',DB,*command,'-U','supabase_admin'],stdout=output,stderr=subprocess.PIPE,check=True)
    configuration=json.loads(run(['docker','inspect',STORAGE],text=True))[0]
    environment=dict(entry.split('=',1) for entry in configuration['Config']['Env'])
    key=environment['SERVICE_KEY']
    headers={'Authorization':'Bearer '+key,'apikey':key}
    request=urllib.request.Request('http://127.0.0.1:9080/storage/v1/bucket',headers=headers)
    with urllib.request.urlopen(request,timeout=30) as response:
        (target/'buckets.json').write_bytes(response.read())
    manifest=[]
    (target/'objects').mkdir(mode=0o700)
    for item in before:
        # UUID backup filenames prevent traversal by user-controlled object paths.
        destination=target/'objects'/item['id']
        path='/'.join(urllib.parse.quote(part,safe='') for part in [item['bucket_id'],*item['name'].split('/')])
        request=urllib.request.Request('http://127.0.0.1:9080/storage/v1/object/authenticated/'+path,headers=headers)
        with urllib.request.urlopen(request,timeout=120) as response,destination.open('wb') as output:
            for chunk in iter(lambda:response.read(1024*1024),b''): output.write(chunk)
        expected=(item.get('metadata') or {}).get('size')
        if expected is not None and destination.stat().st_size!=int(expected):
            raise RuntimeError('Storage size mismatch; backup invalid')
        manifest.append({**item,'backup_file':str(destination.relative_to(target)),'sha256':digest(destination)})
    if before!=inventory(): raise RuntimeError('Storage changed during backup; retry before migration')
    (target/'storage-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    hashes={str(p.relative_to(target)):digest(p) for p in sorted(target.rglob('*')) if p.is_file()}
    (target/'sha256.json').write_text(json.dumps(hashes,indent=2)+'\n')
    (target/'COMPLETE').write_text(stamp+'\n')
    print(json.dumps({'backup':str(target),'postgres_sha256':hashes['postgres.dump'],'storage_manifest_sha256':hashes['storage-manifest.json'],'objects':len(manifest)}),flush=True)
    return target

def main():
    os.umask(0o077)
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backup-only',action='store_true')
    parser.add_argument('--apply',nargs='+',choices=ORDER)
    parser.add_argument('--sql-dir',type=Path,default=BASE/'supabase/vps')
    parser.add_argument('--database',default='postgres')
    parser.add_argument('--keep-stopped',action='store_true',help='Keep services stopped after successful production migration until matching release is ready')
    args=parser.parse_args()
    if not args.backup_only and not args.apply: parser.error('Specify --backup-only or exact --apply files; legacy cleanup disabled')
    if args.backup_only and args.apply: parser.error('Choose backup or apply')
    if args.apply and args.apply!=sorted(set(args.apply),key=ORDER.index): parser.error('Follow identity, registration, media, normalization order')
    if args.apply and args.database=='postgres' and not args.keep_stopped: parser.error('Production schema changes require --keep-stopped until the matching release is activated')
    sources=[]
    for name in args.apply or []:
        content=(args.sql_dir/name).read_text()
        if re.search(r'^\s*(BEGIN|COMMIT)\s*;',content,re.M|re.I): raise RuntimeError('Own transaction boundary in '+name)
        sources.append(content)
    running=[]
    sql_started=False
    try:
        if args.apply and args.database=='postgres':
            for service in ['sitov-app','sitov-mail']:
                if subprocess.run(['systemctl','is-active','--quiet',service]).returncode==0:
                    running.append(service)
                    run(['systemctl','stop',service])
        target=backup()
        if args.apply:
            command=""
            for name,source in zip(args.apply,sources):
                if name in AUTOCOMMIT:
                    command+="SET lock_timeout='10s';\nSET statement_timeout='180s';\n"+source+"\nRESET lock_timeout;\nRESET statement_timeout;\n"
                else:
                    command+="BEGIN;\nSET LOCAL lock_timeout='10s';\nSET LOCAL statement_timeout='180s';\n"+source+"\nCOMMIT;\n"
            command+="NOTIFY pgrst, 'reload schema';\n"
            # A lost connection or a local logging failure can follow a successful
            # COMMIT. From this point onward only a verified matching release may
            # restart production; a client error does not prove a rollback.
            sql_started=True
            result=subprocess.run(['docker','exec','-i',DB,'psql','-X','-U','supabase_admin','-d',args.database,'-v','ON_ERROR_STOP=1'],input=command,text=True,capture_output=True)
            (target/'migration.log').write_text(result.stdout+result.stderr)
            if result.returncode: raise RuntimeError('Migration failed; commit status is unverified. Inspect protected log before activating a matching release: '+str(target/'migration.log'))
            (target/'applied.json').write_text(json.dumps({'database':args.database,'files':args.apply,'sha256':[hashlib.sha256(s.encode()).hexdigest() for s in sources]}))
            print('Committed: '+', '.join(args.apply),flush=True)
    finally:
        if not(sql_started and args.keep_stopped):
            for service in running: run(['systemctl','start',service])

if __name__=='__main__': main()
