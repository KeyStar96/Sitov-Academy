#!/usr/bin/env python3
"""Export app-only schema and real generated TypeScript on the VPS, without leaking credentials."""
import argparse,json,subprocess,urllib.parse,urllib.request
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--database',default='postgres');parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
schemas=['public','business_private','grammar_private','identity_private','learning_private','learning_reset_private','platform_private','private','pronunciation_private','trainer_access_private','vocabulary_private','media_private']
command=['docker','exec','supabase-db-eknmzxvqilojjicinatnllbt','pg_dump','-U','supabase_admin','-d',args.database,'--schema-only','--no-owner']
for schema in schemas:command.extend(['--schema',schema])
args.output.mkdir(parents=True,exist_ok=True)
dump=subprocess.check_output(command,text=True)
# pg_dump 15.14+ emits random psql restrict tokens; keep an ordinary SQL schema artifact.
dump='\n'.join(line for line in dump.splitlines() if not line.startswith(('\\restrict','\\unrestrict'))).rstrip()+'\n'
(args.output/'schema.sql').write_text('-- Canonical VPS application schema. Auth/Storage bootstrap is managed separately.\n'+dump)
generator="""
import {PostgresMeta} from '/usr/src/app/dist/lib/index.js';
import {getGeneratorMetadata} from '/usr/src/app/dist/lib/generators.js';
import {apply} from '/usr/src/app/dist/server/templates/typescript.js';
const pg=new PostgresMeta({host:process.env.PG_META_DB_HOST,port:Number(process.env.PG_META_DB_PORT||5432),user:process.env.PG_META_DB_USER,password:process.env.PG_META_DB_PASSWORD,database:process.argv[2]});
const {data,error}=await getGeneratorMetadata(pg,{includedSchemas:['public'],excludedSchemas:[]});
if(error) throw new Error(error.message);
process.stdout.write(await apply({...data,detectOneToOneRelationships:true,postgrestVersion:'14.6'}));
await pg.end();
"""
types=subprocess.check_output(['docker','exec','-i','supabase-meta-eknmzxvqilojjicinatnllbt','node','--input-type=module','-',args.database],input=generator,text=True)
if 'export type Database' not in types:raise RuntimeError('Invalid generated types')
(args.output/'database.types.ts').write_text(types)
print('Exported app schema and public types for '+args.database)
print('Dump command: '+' '.join(command))
print('Excluded: Supabase-managed auth, storage, realtime, extensions, graphql, vault, cron, net and migration history.')
