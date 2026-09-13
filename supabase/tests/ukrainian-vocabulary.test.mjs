import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'
await test('Ukrainian vocabulary backfill is valid, preserves teacher text and is repeatable',async()=>{
 const db=new PGlite()
 try{
  await db.exec(`CREATE TABLE vocabulary_cards(word_de text,translation_ru text,translation_en text,translation_uk text);
   INSERT INTO vocabulary_cards VALUES('Haus','дом','house',NULL),('Name','имя','name',NULL),('Haus','дом','house','авторський переклад'),('NEW teacher word','новое','new',NULL);`)
  const sql=await readFile(new URL('../migrations/20260913110720_complete_ukrainian_vocabulary_translations.sql',import.meta.url),'utf8')
  await db.exec(sql)
  assert.deepEqual((await db.query("SELECT translation_uk FROM vocabulary_cards WHERE word_de='Haus' ORDER BY translation_uk")).rows.map(r=>r.translation_uk),['авторський переклад','будинок'])
  assert.equal((await db.query("SELECT translation_uk FROM vocabulary_cards WHERE word_de='Name'")).rows[0].translation_uk,"ім'я")
  assert.equal((await db.query("SELECT translation_uk FROM vocabulary_cards WHERE word_de='NEW teacher word'")).rows[0].translation_uk,null)
  const before=(await db.query('SELECT * FROM vocabulary_cards ORDER BY word_de,translation_uk')).rows
  await db.exec(sql)
  assert.deepEqual((await db.query('SELECT * FROM vocabulary_cards ORDER BY word_de,translation_uk')).rows,before)
 }finally{await db.close()}
})
