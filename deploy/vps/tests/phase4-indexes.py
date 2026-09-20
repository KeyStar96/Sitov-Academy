#!/usr/bin/env python3
"""Real PostgreSQL 15 concurrent-index recovery test on an isolated VPS database.
Run after migrate-local.py --backup-only. Never connects DDL to the app database.
"""
import os, re, subprocess
from pathlib import Path
DB='supabase-db-eknmzxvqilojjicinatnllbt'
name='sitov_phase4_indexes_'+str(os.getpid())
assert re.fullmatch(r'sitov_phase4_indexes_\d+',name)
def sql(source,database=name,check=True):
    return subprocess.run(['docker','exec','-i',DB,'psql','-X','-U','supabase_admin','-d',database,'-At','-v','ON_ERROR_STOP=1'],input=source,text=True,capture_output=True,check=check)
source=(Path(__file__).resolve().parents[3]/'supabase/vps/08_performance_indexes.sql').read_text()
try:
    sql('CREATE DATABASE '+name+';',database='postgres')
    sql('CREATE TABLE public.vocabulary_direction_progress(id uuid PRIMARY KEY,auth_user_id uuid,box_number integer,next_review_date timestamptz);')
    sql("SET lock_timeout='2s'; SET statement_timeout='20s';\n"+source)
    before=sql("SELECT indexrelid FROM pg_index WHERE indexrelid='vocabulary_direction_user_box_idx'::regclass").stdout.strip()
    sql(source)
    assert sql("SELECT indexrelid FROM pg_index WHERE indexrelid='vocabulary_direction_user_box_idx'::regclass").stdout.strip()==before
    # Simulate the catalog state left by a failed concurrent build, only in this
    # throwaway database. A valid sibling index must keep its object identity.
    sibling=sql("SELECT 'vocabulary_direction_user_order_idx'::regclass::oid").stdout.strip()
    sql("UPDATE pg_index SET indisvalid=false WHERE indexrelid='vocabulary_direction_user_box_idx'::regclass;")
    sql(source)
    assert sql("SELECT indisvalid FROM pg_index WHERE indexrelid='vocabulary_direction_user_box_idx'::regclass").stdout.strip()=='t'
    assert sql("SELECT 'vocabulary_direction_user_order_idx'::regclass::oid").stdout.strip()==sibling
    sql('DROP INDEX vocabulary_direction_user_box_idx; CREATE INDEX vocabulary_direction_user_box_idx ON vocabulary_direction_progress(box_number);')
    result=sql(source,check=False)
    assert result.returncode!=0 and 'phase4_index_definition_mismatch' in result.stderr
    assert '(box_number)' in sql("SELECT pg_get_indexdef('vocabulary_direction_user_box_idx'::regclass)").stdout
    print('PASS: PostgreSQL concurrent create, replay, INVALID recovery, valid-index preservation, conflicting-definition rejection.')
finally:
    sql('DROP DATABASE IF EXISTS '+name+' WITH (FORCE);',database='postgres')
