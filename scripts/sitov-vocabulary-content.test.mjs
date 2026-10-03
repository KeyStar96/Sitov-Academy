import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {readSeed,germanAudioTexts,summarize} from './sitov-vocabulary-import.mjs'
const {seed}=await readSeed(new URL('../content/vocabulary/sitov-vocabulary-seed.json',import.meta.url))
const teacher=JSON.parse(await readFile(new URL('../content/vocabulary/teacher-source.json',import.meta.url),'utf8'))
const baseline=JSON.parse(await readFile(new URL('../content/vocabulary/a1.1-baseline.json',import.meta.url),'utf8'))
const frozen=JSON.parse(await readFile(new URL('../content/vocabulary/german-audio-texts.json',import.meta.url),'utf8'))
const cards=seed.units.flatMap(unit=>unit.cards)
const bySource=new Map(cards.map(card=>[card.source_id,card]))
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex')

test('six complete seven-lesson levels and all intentional teacher cards survive',()=>{
 assert.deepEqual(summarize(seed),{unit_count:42,card_count:3027,vocabulary_count:2611,chunk_count:416})
 const expected={'A1.1':526,'A1.2':476,'A2.1':678,'A2.2':431,'B1.1':514,'B1.2':402}
 for(const [level,count]of Object.entries(expected)){
  const units=seed.units.filter(unit=>unit.level===level)
  assert.deepEqual(units.map(unit=>unit.sort_order),[1,2,3,4,5,6,7])
  assert.equal(units.flatMap(unit=>unit.cards).length,count)
 }
 for(const original of teacher.units.flatMap(unit=>unit.cards))assert.ok(bySource.has(original.source_id),original.source_id)
 assert.equal(teacher.units.flatMap(unit=>unit.cards).length,2135)
 assert.equal(new Set(cards.map(card=>card.source_id)).size,3027)
})

test('word, attached collocation and example stay on the same card; standalone chunks retain full phrase',()=>{
 for(const original of teacher.units.flatMap(unit=>unit.cards)){
  const card=bySource.get(original.source_id)
  assert.equal(card.content_kind,original.content_kind)
  if(card.content_kind==='vocabulary')assert.ok(card.chunk_de)
 }
 for(const card of cards.filter(card=>card.content_kind==='chunk')){
  assert.equal(card.article,null)
  assert.equal(card.chunk_de,null)
 }
 const truth=bySource.get('sitov-B1.1-L04-C001')
 assert.equal(truth.word_de,'die Wahrheit sagen')
 assert.equal(bySource.get('sitov-A2.1-L04-V035').content_kind,'vocabulary')
 assert.equal(bySource.get('sitov-A2.1-L04-C014').content_kind,'chunk')
})

test('all existing A1.1 identities, lesson ownership and guarded revisions are traceable',()=>{
 for(const old of baseline){
  const card=bySource.get('sitov-existing-'+old.id)
  assert.equal(card.id,old.id)
  assert.equal(seed.units.find(unit=>unit.cards.includes(card)).id,old.unit_id)
  assert.equal(card.sentence_practice,old.sentence_practice)
  const oldSentence=old.translations.find(row=>row.locale==='de').context_sentence
  if(card.word_de!==old.word_de||card.translations.de.context_sentence!==oldSentence){
   assert.deepEqual(card.legacy_revision,{word_de:old.word_de,article:old.article==='none'?null:old.article??null,context_sentence_de:oldSentence})
  }else assert.equal(card.legacy_revision,undefined)
 }
 assert.equal(cards.filter(card=>card.legacy_revision).length,55)
 assert.equal(bySource.get('sitov-existing-cc030a00-e322-455c-8818-81d34e30354c').translations.de.context_sentence,'Ich rufe meinen Vater an.')
 assert.equal(bySource.get('sitov-existing-114ed40c-e13e-4c80-80e0-f9dfc91a31bb').translations.de.context_sentence,'Er kauft im Supermarkt ein.')
})

test('the reusable A1.1 baseline contains only teaching data',()=>{
 const cardFields=new Set(['id','level','lesson','plural','article','unit_id','word_de','sort_order','target_form','translations','sentence_practice'])
 const translationFields=new Set(['locale','card_id','translation','is_difficult','context_sentence'])
 for(const card of baseline){
  for(const field of Object.keys(card))assert.ok(cardFields.has(field),field)
  for(const row of card.translations)for(const field of Object.keys(row))assert.ok(translationFields.has(field),field)
 }
 assert.doesNotMatch(JSON.stringify(baseline),/https?:\/\/|(?:access|refresh)_token|owner_id|user_id|auth_id/)
})

test('all German/audio fields remain exactly the frozen reviewed corpus',()=>{
 const texts=germanAudioTexts(seed).sort()
 assert.equal(texts.length,7518)
 assert.equal(sha(texts),frozen.sha256)
 assert.deepEqual(texts,frozen.texts)
 const fields=cards.map(c=>({source_id:c.source_id,word_de:c.word_de,article:c.article,chunk_de:c.chunk_de,context_sentence:c.translations.de.context_sentence})).sort((a,b)=>a.source_id.localeCompare(b.source_id))
 assert.equal(sha(fields),frozen.german_fields_sha256)
 for(const card of cards){
  assert.doesNotMatch(card.translations.de.context_sentence,/Heute sprechen wir über|Im Kurs sprechen wir über der|Man kann im Alltag|Im Alltag kann man sagen|Dieses Wort kommt im Alltag|Wir üben heute, wie|Beispiel: Wir können heute/)
  assert.doesNotMatch(card.word_de,/^(der|die|das)$/)
  assert.doesNotMatch(card.word_de,/\+ (?:Akk|Dat)\.|(?:vorig|sonstig|folgend|heutig|beid|einig)-$/)
 }
})

test('native-language fields are complete and audited polysemy/time errors stay corrected',()=>{
 for(const card of cards)for(const locale of ['en','ru','uk','tr']){
  const tr=card.translations[locale]
  assert.ok(tr.translation?.trim())
  assert.ok(tr.context_sentence?.trim())
  if(card.chunk_de)assert.ok(tr.chunk_translation?.trim())
 }
 assert.equal(bySource.get('sitov-A2.2-L09-V014').translations.en.translation,'record')
 assert.equal(bySource.get('sitov-A1.2-L03-V011').translations.tr.translation,'kol')
 assert.equal(bySource.get('sitov-A1.2-L06-V003').translations.uk.translation,'спідниця')
 assert.equal(bySource.get('sitov-A2.1-L03-V017').translations.en.translation,'dish')
 assert.equal(bySource.get('sitov-B1.1-L07-V001').translations.en.translation,'court')
 assert.equal(bySource.get('sitov-A1.2-L01-C017').translations.tr.context_sentence,'Saat dokuzdan on beşe kadar çalışıyorum.')
 assert.match(bySource.get('sitov-existing-8940864b-e1eb-4311-99a0-f94a10a9f7e6').translations.en.context_sentence,/German word.*article/)
 assert.equal(bySource.get('sitov-B1.1-L02-V020').translations.uk.translation,'співак')
 assert.equal(bySource.get('sitov-B1.2-L11-V017').translations.uk.translation,'застуда')
 assert.equal(bySource.get('sitov-B1.2-L10-V010').translations.en.translation,'place (an advertisement)')
 assert.match(bySource.get('sitov-A2.1-L06-V017').translations.tr.context_sentence,/Mesleki eğitim/)
})
