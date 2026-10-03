#!/usr/bin/env python3
"""Reproducible Sitov Academy vocabulary authoring (no publication or live DB writes)."""
from pathlib import Path
import argparse, hashlib, json, re, uuid
ROOT=Path(__file__).resolve().parents[1]
NAMESPACE=uuid.UUID('c9d7d060-5b39-5619-9d85-460e43d8d6de')
LEVELS=['A1.1','A1.2','A2.1','A2.2','B1.1','B1.2']
LOCALES=['en','ru','uk','tr']
def uid(key): return str(uuid.uuid5(NAMESPACE,key))
def read(path): return json.loads(Path(path).read_text())
def dump(path,data): Path(path).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
def import_sources(vault):
 units=[];report=[]
 for file in sorted(vault.rglob('*')):
  if file.suffix not in ['.json','.txt','.xlsx']:continue
  row={'file':str(file.relative_to(vault)), 'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'bytes':file.stat().st_size}
  if file.suffix=='.json':
   data=read(file);level=data.get('level') or file.parent.name
   row['level']=level;row['included']=level in LEVELS
   if level=='B1.2':
    lessons=[]
    for number,l in data.items():
     cards=[]
     for idx,c in enumerate(l['woerter'],1):cards.append({'id':f'B1.2-L{int(number):02d}-V{idx:03d}','type':'vocabulary_card','word':c['lernwort'],'example':c['beispiel']})
     for idx,c in enumerate(l['wichtige_chunks'],1):
      cards.append({'id':f'B1.2-L{int(number):02d}-C{idx:03d}','type':'chunk_card', **({'chunk':c} if isinstance(c,str) else {'chunk':c.get('chunk',c.get('lernchunk',c.get('phrase'))),'example':c.get('beispiel',c.get('example',''))})})
     lessons.append({'lesson':int(number),'title':l['titel'],'cards':cards})
   else:lessons=data.get('lessons',[data])
   row['lessons']=[]
   for l in lessons:
    cards=l.get('cards',l.get('vocabulary_cards',[])+l.get('chunk_cards',[]))
    original=l.get('source_lesson',l.get('lesson',l.get('app_lesson')))
    number=l.get('app_lesson',l.get('lesson'))
    if level in ['A2.2','B1.2']:number=original-7
    row['lessons'].append({'source_lesson':original,'app_lesson':number,'title':l['title'],'cards':len(cards),'chunks':sum(c.get('type',c.get('card_type'))=='chunk_card' for c in cards)})
    if level not in LEVELS:continue
    normalized=[]
    for c in cards:
     kind='chunk' if c.get('type',c.get('card_type'))=='chunk_card' else 'vocabulary'
     source_id='sitov-'+c.get('card_id',c.get('id'))
     word=c.get('word',c.get('chunk'))
     if not word:raise ValueError((source_id,c))
     normalized.append({'id':uid(source_id),'source_id':source_id,'content_kind':kind,'word_de':word,'chunk_de':(c.get('chunk_on_same_card',c.get('chunk')) if kind=='vocabulary' else None),'sentence_de':c.get('example_on_same_card',c.get('example','')),'source_word':word})
    units.append({'id':uid(f'sitov-vocabulary-{level}-lesson-{number}'),'level':level,'label':f'Lektion {number} · {l["title"]}','sort_order':number,'app_lesson':number,'source_lesson':original,'cards':normalized})
  report.append(row)
 return {'version':1,'units':units},report

def main():
 p=argparse.ArgumentParser();p.add_argument('--vault',type=Path);p.add_argument('--import-sources',action='store_true');args=p.parse_args()
 if args.import_sources:
  data,report=import_sources(args.vault)
  dump(ROOT/'content/vocabulary/teacher-source.json',data)
  dump(ROOT/'content/vocabulary/source-inventory.json',report)

# Public authoring helpers are imported by the quality tests.
MALE_REPLACEMENTS=[
 ('Meine Schwester','Mein Bruder'),('meine Schwester','mein Bruder'),('meiner Schwester','meinem Bruder'),
 ('Meine Tochter','Mein Sohn'),('meine Tochter','mein Sohn'),('meiner Tochter','meinem Sohn'),
 ('Meine Mutter','Mein Vater'),('meine Mutter','mein Vater'),('meiner Mutter','meinem Vater'),('deiner Mutter','deinem Vater'),
 ('Meine Oma','Mein Opa'),('meine Oma','mein Opa'),('meiner Oma','meinem Opa'),
 ('Meine Freundin','Mein Freund'),('meine Freundin','mein Freund'),('meiner Freundin','meinem Freund'),
 ('Meine Nachbarin','Mein Nachbar'),('meine Nachbarin','mein Nachbar'),
 ('Die Journalistin','Der Journalist'),('als Journalistin','als Journalist'),
 ('Die Ärztin','Der Arzt'),('als Ärztin','als Arzt'),('als Polizistin','als Polizist'),
 ('als Reiseführerin','als Reiseführer'),('als Kellnerin','als Kellner'),('als Köchin','als Koch'),
 ('als Sekretärin','als Sekretär'),('Krankenschwester von Beruf','Krankenpfleger von Beruf'),
 ('Sie geht','Er geht'),('Sie kommt','Er kommt'),('Sie kocht','Er kocht'),('Sie räumt','Er räumt'),('Sie ruft ihre','Er ruft seine'),('sieht sie fern','sieht er fern'),('Pia','Paul'),('Lea','Lukas'),('Anna','Paul'),('Sie arbeitet','Er arbeitet'),('Sie hat','Er hat'),('Sie möchte','Er möchte'),('Sie macht','Er macht'),
 ('Sie ist','Er ist'),('Sie lernt','Er lernt'),('Sie studiert','Er studiert'),('Sie kann','Er kann'),
 ('Sie bewirbt','Er bewirbt'),('Sie erfüllt','Er erfüllt'),('Sie spricht','Er spricht'),
 ('Die Sängerin schreibt','Der Sänger schreibt'),('sie fließend','er fließend'),
 ('Sie gibt','Er gibt'),('Sie verdient','Er verdient'),
 ('Frau Müller','Herr Müller'),('Frau Klein','Herr Klein'),
 ('mit Anna','mit Paul'),('für Anna','für Paul'),('Maria!','Paul!')
]
STEM_FORMS={'eigen-':'eigene','ander-':'andere','manch-':'manche','einzig-':'einzig','morgig':'morgig'}
def male_text(text):
 for a,b in MALE_REPLACEMENTS:text=text.replace(a,b)
 return text

def editorial_rows(file):
 sections={};section=None
 for lineno,line in enumerate(Path(file).read_text().splitlines(),1):
  line=line.strip()
  if not line or line.startswith('#'):continue
  if line.startswith('@ '):section=int(line[2:]);sections[section]=[];continue
  if section is None or ' | ' not in line:raise ValueError(f'{file}:{lineno}: invalid editorial row')
  chunk,sentence=line.split(' | ',1)
  sections[section].append((chunk,sentence))
 return sections

def split_word(original):
 # Keep an existing noun's grammatical article; paired occupational forms use a male learning character.
 if original.startswith('der / die '):original='der '+original[len('der / die '):]
 variants=re.split(r'\s*/\s*',original)
 if len(variants)>1 and variants[0].startswith('die ') and any(v.startswith('der ') for v in variants):
  variants=sorted(variants,key=lambda v:not v.startswith('der '))
 primary=variants[0]
 match=re.fullmatch(r'(der|die|das)\s+(.+)',primary)
 article,word=(match.group(1),match.group(2)) if match else ('none',primary)
 alternatives=[]
 for variant in variants[1:]:
  m=re.fullmatch(r'(der|die|das)\s+(.+)',variant)
  # Grammatical gender pairs remain in provenance, not interchangeable answers for a male character.
  if m and m.group(1)!=article:continue
  v=m.group(2) if m else variant
  if v not in [word,'']:alternatives.append(v)
 return word,article,alternatives

def assemble(a1_file=None,partial=False):
 data=read(ROOT/'content/vocabulary/teacher-source.json')
 overrides=read(ROOT/'content/vocabulary/teacher-editorial-overrides.json')
 for level in ['A2.2','B1.1','B1.2']:
  file=ROOT/f'content/vocabulary/{level.lower()}-editorial.txt'
  if not file.exists():
   if partial:data['units']=[u for u in data['units'] if u['level']!=level];continue
   raise FileNotFoundError(file)
  editorial=editorial_rows(file)
  for u in data['units']:
   if u['level']!=level:continue
   cards=[c for c in u['cards'] if c['content_kind']=='vocabulary']
   source_lesson=u['source_lesson']
   if len(cards)!=len(editorial[source_lesson]):raise ValueError((level,source_lesson,len(cards),len(editorial[source_lesson])))
   for card,(chunk,sentence) in zip(cards,editorial[source_lesson]):card.update(chunk_de=chunk,sentence_de=sentence)
 chunk_file=ROOT/'content/vocabulary/chunk-editorial.json'
 if chunk_file.exists():overrides.update(read(chunk_file))
 for u in data['units']:
  for card in u['cards']:
   for field in ['chunk_de','sentence_de']:
    if card.get(field):card[field]=male_text(card[field])
   card.update(overrides.get(card['source_id'],{}))
 # A1.2 lessons 2–7 are deliberately newly authored because no teacher source exists.
 expansion=ROOT/'content/vocabulary/a1.2-expansion.json'
 if expansion.exists():
  more=read(expansion)
  data['units'].extend(more.get('units',more) if isinstance(more,dict) else more)
 elif not partial:raise FileNotFoundError(expansion)
 for u in data['units']:
  u.setdefault('id',uid(f'sitov-vocabulary-{u["level"]}-lesson-{u["sort_order"]}'))
  for card in u['cards']:
   card.setdefault('id',uid(card['source_id']))
   word,article,alternatives=(card['word_de'],'none',[]) if card['content_kind']=='chunk' else split_word(card['word_de'])
   card['word_de']=STEM_FORMS.get(word,word);card['article']=None if article=='none' else article
   card['alternative_answers_de']=alternatives
   card['sentence_practice']=False
   card['target_form']=[card['word_de']]
   card['translations']={'de':{'context_sentence':card.pop('sentence_de')}}
   card['chunk_de']=card.get('chunk_de') or None
 if a1_file:
  existing=read(a1_file);a1_chunks=read(ROOT/'content/vocabulary/a1.1-chunks.json')
  groups={}
  for old in existing:
   unit=groups.setdefault(old['unit_id'],{'id':old['unit_id'],'level':'A1.1','label':old['lesson'],'sort_order':old['sort_order'],'app_lesson':old['sort_order'],'source_lesson':old['sort_order'],'cards':[]})
   card={k:old.get(k) for k in ['id','word_de','article','plural','target_form','sentence_practice']}
   card['article']=None if old.get('article') in [None,'none'] else old['article']
   card['plural']=old.get('plural') or None
   card['source_id']='sitov-existing-'+old['id'];card['content_kind']='vocabulary'
   card['alternative_answers_de']=old.get('alternative_answers_de',[])
   card['chunk_de']=a1_chunks['embedded'].get(old['word_de'])
   card['translations']={t['locale']:{k:t.get(k) for k in ['translation','context_sentence']} for t in old['translations']}
   original_word=card['word_de'];original_sentence=card['translations']['de']['context_sentence']
   corrections=read(ROOT/'content/vocabulary/a1.1-editorial-overrides.json').get(old['id'],{})
   new_word=corrections.get('word_de',male_text(original_word))
   new_sentence=corrections.get('sentence_de',male_text(original_sentence))
   card['original_word_de']=original_word;card['original_sentence_de']=original_sentence
   if new_word!=original_word:
    card['word_de']=new_word
    for lang in LOCALES:card['translations'].setdefault(lang,{})['translation']=None
   if new_sentence!=original_sentence:
    card['translations']['de']['context_sentence']=new_sentence
    for lang in LOCALES:card['translations'].setdefault(lang,{})['context_sentence']=None
   if new_word!=original_word or new_sentence!=original_sentence:
    card['target_form']=[male_text(form) for form in (old['target_form'] or [])] or ([new_word] if new_word!=original_word else old['target_form'])
    card['legacy_revision']={'word_de':original_word,'article':old['article'] or 'none','context_sentence_de':original_sentence}
   unit['cards'].append(card)
  for u in groups.values():
   for idx,(phrase,sentence) in enumerate(a1_chunks['standalone'][str(u['sort_order'])],1):
    key=f'sitov-A1.1-L{u["sort_order"]:02d}-C{idx:03d}'
    u['cards'].append({'id':uid(key),'source_id':key,'content_kind':'chunk','word_de':phrase,'article':None,'chunk_de':None,'target_form':[phrase],'alternative_answers_de':[],'sentence_practice':False,'translations':{'de':{'context_sentence':sentence}},'source_word':phrase})
   data['units'].append(u)
 data['units'].sort(key=lambda u:(LEVELS.index(u['level']),u['sort_order']))
 data['provenance']={'academy':'Sitov Academy','authored_on':'2026-10-03','source_inventory':'source-inventory.json','card_rule':'Each teacher object creates exactly one card. Embedded chunks and examples stay on their vocabulary card. Only intentional chunk objects create additional cards.','translations':'Stored author-time translations, no runtime AI dependency. Google web translation drafts are cached and reviewed separately.','audio_publication':'No active import before exact Qwen3-TTS-12Hz-1.7B-Base male profile and forced alignment recordings are prepared and audited.'}
 return data

def authoring_main():
 p=argparse.ArgumentParser();p.add_argument('--assemble',action='store_true');p.add_argument('--a1-existing',type=Path,default=ROOT/'content/vocabulary/a1.1-baseline.json');p.add_argument('--partial',action='store_true');args=p.parse_args()
 if args.assemble:
  data=assemble(args.a1_existing,args.partial);dump(ROOT/'content/vocabulary/german-seed.json',data)
  print(json.dumps({'units':len(data['units']),'cards':sum(len(u['cards']) for u in data['units'])}))

if __name__=='__main__':
 import sys
 if '--assemble' in sys.argv:authoring_main()
 else:main()
