#!/usr/bin/env python3
"""Optional author-time translation drafts for public, nonpersonal lesson strings.

No application/runtime dependency. Cache is durable, keyed by exact NFC German
text and target locale. Batches that change the line count are rejected and split.
Manual overrides take precedence. A failed transport never creates placeholder
or German fallback translations. Run only after German editorial work.
"""
from pathlib import Path
import argparse, concurrent.futures, hashlib, json, os, re, time, unicodedata, urllib.parse, urllib.request
ROOT=Path(__file__).resolve().parents[1]
ENDPOINT='https://translate.googleapis.com/translate_a/single'
LOCALES=['en','ru','uk','tr']
def norm(x):return re.sub(r'\s+',' ',unicodedata.normalize('NFC',x)).strip()
def key(lang,text):return lang+':'+hashlib.sha256(norm(text).encode()).hexdigest()
def read(path):return json.loads(Path(path).read_text())
def atomic(path,data):
 path=Path(path);path.parent.mkdir(parents=True,exist_ok=True);tmp=path.with_name(path.name+'.tmp');tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');os.replace(tmp,path)
def batches(texts,max_chars=3500,max_items=32):
 batch=[];size=0
 for text in texts:
  if batch and (size+len(text)+1>max_chars or len(batch)>=max_items):yield batch;batch=[];size=0
  batch.append(text);size+=len(text)+1
 if batch:yield batch

def request(lang,texts):
 # Each input is one line; translated output must retain exactly that many lines.
 joined='\n'.join(texts)
 url=ENDPOINT+'?'+urllib.parse.urlencode({'client':'gtx','sl':'de','tl':lang,'dt':'t','q':joined})
 req=urllib.request.Request(url,headers={'User-Agent':'Sitov Academy content authoring/1.0'})
 last=None
 for attempt in range(7):
  try:
   with urllib.request.urlopen(req,timeout=45) as response:data=json.load(response)
   translated=''.join(segment[0] or '' for segment in data[0])
   rows=[norm(row) for row in translated.split('\n')]
   if len(rows)!=len(texts) or any(not row for row in rows):
    if len(texts)==1:raise ValueError('transport returned empty/misaligned translation')
    midpoint=len(texts)//2
    return request(lang,texts[:midpoint])+request(lang,texts[midpoint:])
   return rows
  except Exception as exc:
   last=exc;time.sleep(min(30,2**attempt))
 raise RuntimeError(f'translation request failed ({lang}, {len(texts)} strings): {type(last).__name__}') from last

def sources(card):
 word=(card['article']+' '+card['word_de']) if card.get('article') in ['der','die','das'] else card['word_de']
 values=[('translation',word),('context_sentence',card['translations']['de']['context_sentence'])]
 if card.get('chunk_de'):values.append(('chunk_translation',card['chunk_de']))
 return values

def jobs_for(seed,cache,overrides):
 needed={lang:set() for lang in LOCALES}
 for unit in seed['units']:
  for card in unit['cards']:
   for lang in LOCALES:
    tr=card.get('translations',{}).get(lang,{})
    values=sources(card)
    for field,text in values:
     if tr.get(field) or overrides.get(card['source_id'],{}).get(lang,{}).get(field) or overrides.get('texts',{}).get(norm(card['word_de'] if field=='translation' else text),{}).get(lang):continue
     text=norm(text)
     if key(lang,text) not in cache:needed[lang].add(text)
 return [(lang,batch) for lang,texts in needed.items() for batch in batches(sorted(texts))]

def apply_cache(seed,cache,overrides):
 missing=[]
 for unit in seed['units']:
  for card in unit['cards']:
   for lang in LOCALES:
    tr=card['translations'].setdefault(lang,{})
    values=sources(card)
    for field,text in values:
     override=overrides.get(card['source_id'],{}).get(lang,{}).get(field)
     generic=overrides.get('texts',{}).get(norm(card['word_de'] if field=='translation' else text),{}).get(lang)
     value=override or generic or tr.get(field) or cache.get(key(lang,text),{}).get('translation')
     if value:
      value=norm(value)
      if field=='translation' and lang=='en' and card.get('article') in ['der','die','das'] and not (override or generic):value=re.sub(r'^the\s+','',value,flags=re.I)
      tr[field]=value
     else:missing.append((card['source_id'],lang,field))
 return missing

def main():
 p=argparse.ArgumentParser();p.add_argument('--input',type=Path,default=ROOT/'content/vocabulary/german-seed.json');p.add_argument('--output',type=Path,default=ROOT/'content/vocabulary/sitov-vocabulary-seed.json');p.add_argument('--cache',type=Path,required=True);p.add_argument('--workers',type=int,default=3);p.add_argument('--offline',action='store_true');args=p.parse_args()
 seed=read(args.input);cache=read(args.cache) if args.cache.exists() else {};overrides_path=ROOT/'content/vocabulary/translation-overrides.json';overrides=read(overrides_path) if overrides_path.exists() else {}
 for audit_file in ['native-editorial-audit.json','en-editorial-audit.json','ru-editorial-audit.json']:
  audit_path=ROOT/'content/vocabulary'/audit_file
  if audit_path.exists():
   for source_id,locales in read(audit_path).items():
    for locale,fields in locales.items():overrides.setdefault(source_id,{}).setdefault(locale,{}).update(fields)
 jobs=jobs_for(seed,cache,overrides);print(json.dumps({'pending_batches':len(jobs),'pending_strings':sum(len(x) for _,x in jobs),'cache_entries':len(cache)}),flush=True)
 if jobs and not args.offline:
  done=0;errors=[]
  with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
   futures={pool.submit(request,lang,texts):(lang,texts) for lang,texts in jobs}
   for future in concurrent.futures.as_completed(futures):
    lang,texts=futures[future]
    try:
     translated=future.result()
     for text,value in zip(texts,translated):cache[key(lang,text)]={'source':text,'locale':lang,'translation':value,'provider':'Google web translation author-time draft','authored_on':'2026-10-03'}
     atomic(args.cache,cache);done+=1
     if done%10==0 or done==len(jobs):print(json.dumps({'completed_batches':done,'total_batches':len(jobs),'cache_entries':len(cache)}),flush=True)
    except Exception as exc:errors.append(str(exc));print(json.dumps({'translation_error':str(exc)}),flush=True)
  if errors:raise RuntimeError(f'{len(errors)} failed translation batches; cache retained')
 missing=apply_cache(seed,cache,overrides)
 if missing:raise ValueError(f'{len(missing)} missing translations, first={missing[:5]}')
 seed['provenance']['translation_provider']='Google web translation; frozen author-time drafts + editorial overrides; no runtime HTTP calls'
 seed['provenance']['translation_review']='German sources fully edited; English headwords fully reviewed against collocations/examples; Russian editorial corrections and Ukrainian role/polysemy audits applied; all native fields checked for completeness. Remaining machine drafts can receive ongoing teacher corrections.'
 atomic(args.output,seed)
 print(json.dumps({'output':str(args.output),'cards':sum(len(u['cards']) for u in seed['units']),'cache_entries':len(cache)}),flush=True)
if __name__=='__main__':main()
