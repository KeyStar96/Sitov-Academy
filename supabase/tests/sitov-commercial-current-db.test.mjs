import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { SitovNativeDatabase, createSitovCurrentNativeDatabase } from './helpers/sitov-night-current-native-db.mjs'
import { sitovRightsSnapshot, sitovHistorySnapshot, sitovUsers, sitovId } from './helpers/sitov-night-current-db.mjs'

test('93 guarded source integration on isolated real normalized current92', { skip: process.env.SITOV_NIGHT_NATIVE !== '1' }, async t => {
  const admin = new SitovNativeDatabase(), database = `sitov_night_commercial_${process.pid}`
  admin.raw(`CREATE DATABASE ${database}`)
  let db
  try {
    db = await createSitovCurrentNativeDatabase({ database })
    // Synthetic operator fixture: remove staged staff-MFA requirement consistently before both snapshots.
    await db.actor(null, 'postgres'); await db.exec(`UPDATE profiles SET sitov_mfa_required=false WHERE id='${sitovUsers.teacher}'`)
    await db.exec(`INSERT INTO lms_media_folder(folder_id,level,title) VALUES('${sitovId(350)}','A1.1','Sitov QA upload folder');
     SET session_replication_role=replica;
     INSERT INTO learning_videos(id,unit_id,folder_id,title,storage_path,file_size) VALUES('${sitovId(351)}','${sitovId(242)}','${sitovId(350)}','Sitov QA uploaded video','A1.1/${sitovId(350)}/videos/${sitovId(351)}.mp4',100);
     SET session_replication_role=origin;`)
    const ownFixtures = ['all', 'none', 'selected', 'disabled', 'outsider'].map((name, index) => ({ name,
      user: sitovUsers[name], unit: sitovId(410 + index), card: sitovId(420 + index) }))
    await db.exec(`SET session_replication_role=replica;
      INSERT INTO cefr_levels(code) VALUES('C2') ON CONFLICT DO NOTHING;
      INSERT INTO learning_levels(code,cefr_level,sort_order,is_active) VALUES('C2.1','C2',100,false) ON CONFLICT DO NOTHING;
      INSERT INTO learning_units(id,level,trainer,label,is_active) VALUES('${sitovId(430)}','C2.1','vocabulary','Sitov unreleased fixture',true);
      INSERT INTO student_level_access(auth_user_id,level) VALUES('${sitovUsers.all}','C2.1');
      INSERT INTO learning_units(id,level,trainer,label,is_active) VALUES('${sitovId(431)}','B2','vocabulary','Sitov coarse fixture',true);
      INSERT INTO student_level_access(auth_user_id,level) VALUES('${sitovUsers.all}','B2');
      INSERT INTO learning_units(id,level,trainer,label,owner_auth_user_id) VALUES('${sitovId(432)}','C2.1','vocabulary','Eigene Wörter','${sitovUsers.all}');
      SET session_replication_role=origin;`)
    for (const own of ownFixtures) {
      await db.exec(`INSERT INTO learning_units(id,level,trainer,label,owner_auth_user_id) VALUES('${own.unit}','A1.1','vocabulary','Eigene Wörter','${own.user}');
        INSERT INTO learning_vocabulary_cards(id,word_de,unit_id) VALUES('${own.card}','Buch','${own.unit}');`)
    }
    const ownBefore = {}
    for (const own of ownFixtures) {
      await db.actor(own.user, 'postgres', { role: 'authenticated' })
      ownBefore[own.name] = (await db.query(`SELECT learning_private.unit_allowed('${own.unit}') allowed`)).rows[0].allowed
    }
    await db.actor(sitovUsers.all, 'postgres', { role: 'authenticated' })
    for (const denied of [430, 431, 432]) {
      assert.equal((await db.query(`SELECT learning_private.unit_allowed('${sitovId(denied)}') allowed`)).rows[0].allowed, false, 'original current92 denies unreleased/coarse/own unit despite stored grant')
    }
    const mediaBefore = {}
    for (const [name, user] of Object.entries(sitovUsers)) {
      await db.actor(user); mediaBefore[name] = (await db.query(`SELECT id FROM learning_videos WHERE id='${sitovId(351)}'`)).rows
    }
    const before = await sitovRightsSnapshot(db), history = await sitovHistorySnapshot(db)
    const sql = await readFile(new URL('../vps/93_sitov_commercial_access.sql', import.meta.url), 'utf8')
    await db.exec(sql)
    const after = await sitovRightsSnapshot(db)
    await t.test('all/none/selected/disabled/explicit-all unchanged, de expansion explicit, history unchanged', async () => {
      for (const key of Object.keys(before).filter(key => key !== 'german')) assert.deepEqual(after[key], before[key], key)
      assert.equal(before.german.filter(row => row.unit_allowed).length, 0)
      assert.equal(after.german.filter(row => row.unit_allowed).length, 8)
      assert.deepEqual(await sitovHistorySnapshot(db), history)
      for (const [name, user] of Object.entries(sitovUsers)) {
        await db.actor(user); assert.deepEqual((await db.query(`SELECT id FROM learning_videos WHERE id='${sitovId(351)}'`)).rows, mediaBefore[name], `legacy uploaded media ${name}`)
      }
      await db.actor(null, 'postgres')
      await db.exec(await readFile(new URL('../vps/rollback/93_sitov_commercial_access.sql', import.meta.url), 'utf8'))
      assert.deepEqual(await sitovRightsSnapshot(db), before, 'pristine rollback restores original effective guards')
      await db.actor(null, 'postgres'); await db.exec(sql)
    })
    await t.test('VIP source reaches real unit/content RLS and revoke restores previous rights', async () => {
      await db.actor(sitovUsers.teacher)
      assert.equal((await db.query(`SELECT set_sitov_student_vip('${sitovUsers.outsider}',true,0) result`)).rows[0].result.success, true)
      await db.actor(sitovUsers.outsider)
      assert.equal((await db.query(`SELECT id FROM learning_vocabulary_cards WHERE id='${sitovId(301)}'`)).rows.length, 1)
      await db.actor(sitovUsers.teacher)
      assert.equal((await db.query(`SELECT set_sitov_student_vip('${sitovUsers.outsider}',false,1) result`)).rows[0].result.success, true)
      await db.actor(sitovUsers.outsider)
      assert.equal((await db.query(`SELECT id FROM learning_vocabulary_cards WHERE id='${sitovId(301)}'`)).rows.length, 0)
    })
    await t.test('own catalog preserves original selected/none inheritance, disabled denial and privacy; no unreleased grant expansion', async () => {
      assert.deepEqual(ownBefore, { all: true, none: true, selected: true, disabled: false, outsider: false })
      for (const own of ownFixtures) {
        await db.actor(own.user)
        const catalog = (await db.query("SELECT get_sitov_access_catalog('A1.1','vocabulary') result")).rows[0].result
        const ids = catalog.units.flatMap(unit => unit.items.map(item => item.id))
        assert.equal(ids.includes(own.card), ownBefore[own.name], own.name)
        assert.ok(ownFixtures.filter(other => other.user !== own.user).every(other => !ids.includes(other.card)), 'foreign private words absent')
        await db.actor(own.user, 'postgres', { role: 'authenticated' })
        assert.equal((await db.query(`SELECT learning_private.unit_allowed('${own.unit}') allowed`)).rows[0].allowed, ownBefore[own.name])
      }
      await db.actor(sitovUsers.all, 'postgres', { role: 'authenticated' })
      for (const denied of [430, 431, 432]) {
        assert.equal((await db.query(`SELECT learning_private.unit_allowed('${sitovId(denied)}') allowed`)).rows[0].allowed, false)
      }
      await db.actor(sitovUsers.teacher)
      const staffCatalog = (await db.query("SELECT get_sitov_access_catalog('A1.1','vocabulary') result")).rows[0].result
      assert.ok(staffCatalog.units.flatMap(unit => unit.items).every(item => !ownFixtures.some(own => own.card === item.id)))
    })
    await t.test('selected-item trial catalog only returns own scope; old unit-only RPC guard stays closed', async () => {
      const manifest = { version: 1, rules: [{ level: 'A1.1', trainer: 'vocabulary', unit_ids: [sitovId(211)],
        items: [{ unit_id: sitovId(211), refs: [{ kind: 'vocabulary_card', id: sitovId(301) }] }] }] }
      await db.actor(sitovUsers.teacher)
      assert.equal((await db.query('SELECT set_sitov_student_trial($1,$2,2) result', [sitovUsers.outsider, manifest])).rows[0].result.success, true)
      await db.actor(sitovUsers.outsider)
      const catalog = (await db.query("SELECT get_sitov_access_catalog('A1.1','vocabulary') result")).rows[0].result
      assert.deepEqual(catalog.units.flatMap(unit => unit.items.map(item => item.id)), [sitovId(301)])
      await db.actor(sitovUsers.outsider, 'postgres', { role: 'authenticated' })
      assert.equal((await db.query(`SELECT learning_private.unit_allowed('${sitovId(211)}') allowed`)).rows[0].allowed, false)
      assert.equal((await db.query(`SELECT sitov_access_private.item_allowed('${sitovUsers.outsider}','vocabulary_card','${sitovId(301)}') allowed`)).rows[0].allowed, true)
    })
    await t.test('empty item buckets never claim a level; selected item scope does', async () => {
      const empty = { version: 1, rules: [{ level: 'A1.1', trainer: 'vocabulary', unit_ids: [sitovId(211)], items: [{ unit_id: sitovId(211), refs: [] }] }] }
      await db.actor(sitovUsers.teacher)
      assert.equal((await db.query('SELECT set_sitov_student_trial($1,$2,3) result', [sitovUsers.outsider, empty])).rows[0].result.success, true)
      await db.actor(sitovUsers.outsider, 'postgres', { role: 'authenticated' })
      assert.equal((await db.query(`SELECT sitov_access_private.level_allowed('${sitovUsers.outsider}','A1.1') allowed`)).rows[0].allowed, false)
      empty.rules[0].items[0].refs.push({ kind: 'vocabulary_card', id: sitovId(301) })
      await db.actor(sitovUsers.teacher)
      assert.equal((await db.query('SELECT set_sitov_student_trial($1,$2,4) result', [sitovUsers.outsider, empty])).rows[0].result.success, true)
      await db.actor(sitovUsers.outsider, 'postgres', { role: 'authenticated' })
      assert.equal((await db.query(`SELECT sitov_access_private.level_allowed('${sitovUsers.outsider}','A1.1') allowed`)).rows[0].allowed, true)
    })
    const setTrial = async manifest => {
      await db.actor(sitovUsers.teacher)
      const revision = (await db.query('SELECT get_sitov_access_context($1) result', [sitovUsers.outsider])).rows[0].result.revision
      assert.equal((await db.query('SELECT set_sitov_student_trial($1,$2,$3) result', [sitovUsers.outsider, manifest, revision])).rows[0].result.success, true)
    }
    await t.test('Special canonical joins reject malformed/inactive nodes and selected sibling tasks', async () => {
      await db.actor(null, 'postgres')
      await db.exec(`SET session_replication_role=replica;
        INSERT INTO path_nodes(id,unit_id,source_id,kind,sort_order,title,topic,anchor_node_id,is_active) VALUES
        ('${sitovId(500)}','${sitovId(221)}','sitov.qa.anchor','review',1,'Wiederholung','Wörter',NULL,true),
        ('${sitovId(501)}','${sitovId(221)}','sitov.qa.special','special',2,'Übung','Wörter','${sitovId(500)}',true),
        ('${sitovId(502)}','${sitovId(221)}','sitov.qa.inactive','special',3,'Übung','Wörter','${sitovId(500)}',false),
        ('${sitovId(503)}','${sitovId(222)}','sitov.qa.foreign','special',4,'Übung','Wörter','${sitovId(500)}',true);
        INSERT INTO learning_exercises(id,unit_id,node_id,type,topic,content) VALUES
        ('${sitovId(504)}','${sitovId(221)}','${sitovId(501)}','multiple_choice','Wörter','{"target_form":["Haus"],"question":"Was passt?","options":["Haus","Baum"],"correct_answer":"Haus","accepted_answers":["Haus"]}'),
        ('${sitovId(505)}','${sitovId(221)}','${sitovId(501)}','multiple_choice','Wörter','{"target_form":["Haus"],"question":"Was passt?","options":["Haus","Baum"],"correct_answer":"Haus","accepted_answers":["Haus"]}');
        SET session_replication_role=origin;`)
      await setTrial({version:1,rules:[{level:'A1.1',trainer:'exercises',unit_ids:[sitovId(221)],items:[{unit_id:sitovId(221),refs:[{kind:'path_special',id:sitovId(501)},{kind:'path_special_item',id:sitovId(504)}]}]}]})
      await db.actor(sitovUsers.outsider, 'postgres', {role:'authenticated'})
      for (const [kind,id,expected] of [['path_special',501,true],['path_special',502,false],['path_special',503,false],['path_special_item',504,true],['path_special_item',505,false]]) {
        assert.equal((await db.query('SELECT sitov_access_private.item_allowed($1,$2,$3) allowed',[sitovUsers.outsider,kind,sitovId(id)])).rows[0].allowed,expected)
      }
      await db.actor(sitovUsers.outsider)
      const catalog=(await db.query("SELECT get_sitov_access_catalog('A1.1','exercises') result")).rows[0].result
      assert.deepEqual(catalog.units.flatMap(u=>u.items.map(i=>i.id)).sort(),[sitovId(501),sitovId(504)].sort())
    })
    await t.test('selected verb trial reaches exact selection RPC and denies siblings; media trial stays exact', async () => {
      await db.actor(null,'postgres')
      const verbs=(await db.query("SELECT id,unit_id FROM sitov_verb_catalog WHERE level='A1.1' ORDER BY id LIMIT 2")).rows
      assert.equal(verbs.length,2)
      await setTrial({version:1,rules:[{level:'A1.1',trainer:'verbs',unit_ids:[...new Set(verbs.map(v=>v.unit_id))],items:[{unit_id:verbs[0].unit_id,refs:[{kind:'verb',id:verbs[0].id}]}]}]})
      await db.actor(sitovUsers.outsider)
      assert.equal((await db.query('SELECT sitov_set_verb_box($1,ARRAY[$2],true) result',['A1.1',verbs[0].id])).rows[0].result.error,undefined)
      assert.equal((await db.query('SELECT sitov_set_verb_box($1,ARRAY[$2],true) result',['A1.1',verbs[1].id])).rows[0].result.error,'not_authorized')
      await setTrial({version:1,rules:[{level:'A1.1',trainer:'videos',unit_ids:[sitovId(242)],items:[{unit_id:sitovId(242),refs:[{kind:'video',id:sitovId(351)}]}]}]})
      await db.actor(sitovUsers.outsider)
      assert.deepEqual((await db.query('SELECT id FROM learning_videos WHERE id IN($1,$2)',[sitovId(351),sitovId(303)])).rows,[{id:sitovId(351)}])
      assert.equal((await db.query('SELECT sitov_set_verb_box($1,ARRAY[$2],true) result',['A1.1',verbs[0].id])).rows[0].result.error,'not_authorized', 'revoked verb trial denies old selection')
      await db.actor(sitovUsers.outsider,'postgres',{role:'authenticated'})
      assert.equal((await db.query('SELECT media_private.path_allowed($1,false) allowed',[`A1.1/${sitovId(350)}/videos/${sitovId(351)}.mp4`])).rows[0].allowed,true)
      assert.equal((await db.query('SELECT media_private.path_allowed($1,true) allowed',[`A1.1/${sitovId(350)}/videos/${sitovId(351)}.mp4`])).rows[0].allowed,false)
    })
    await t.test('exact vocabulary reads, initialization, grading, retry, receipts and revocation with German UI', async () => {
      await db.actor(null,'postgres')
      await db.exec(`INSERT INTO learning_vocabulary_cards(id,word_de,unit_id) VALUES('${sitovId(601)}','Baum','${sitovId(211)}');
        INSERT INTO vocabulary_translations(card_id,locale,translation) VALUES('${sitovId(301)}','ru','дом'),('${sitovId(301)}','en','house'),('${sitovId(601)}','ru','дерево');
        UPDATE profiles SET ui_language='de',native_language='ru' WHERE id='${sitovUsers.outsider}';`)
      const manifest={version:1,rules:[{level:'A1.1',trainer:'vocabulary',unit_ids:[sitovId(211)],items:[{unit_id:sitovId(211),refs:[{kind:'vocabulary_card',id:sitovId(301)}]}]}]}
      // Independent commercial sources must reach the same real row read.
      await setTrial({version:1,rules:[{level:'A1.1',trainer:'vocabulary',unit_ids:[sitovId(211)],items:null}]})
      await db.actor(sitovUsers.outsider)
      assert.equal((await db.query('SELECT id FROM learning_vocabulary_cards WHERE id IN($1,$2)',[sitovId(301),sitovId(601)])).rows.length,2)
      await setTrial({version:1,rules:[]})
      await db.actor(sitovUsers.teacher)
      let revision=(await db.query('SELECT get_sitov_access_context($1) result',[sitovUsers.outsider])).rows[0].result.revision
      assert.equal((await db.query('SELECT set_sitov_student_vip($1,true,$2) result',[sitovUsers.outsider,revision])).rows[0].result.success,true)
      await db.actor(sitovUsers.outsider)
      assert.equal((await db.query('SELECT id FROM learning_vocabulary_cards WHERE id IN($1,$2)',[sitovId(301),sitovId(601)])).rows.length,2)
      await db.actor(null,'postgres')
      await db.exec(`INSERT INTO sitov_access_private.orders(id,student_id,level,request_id,status,provider,provider_confirmation_verified,amount_minor,currency)
        VALUES('${sitovId(620)}','${sitovUsers.outsider}','A1.1','${sitovId(621)}','paid','stripe',true,100,'EUR');
        INSERT INTO sitov_access_private.purchases(order_id) VALUES('${sitovId(620)}');`)
      await db.actor(sitovUsers.teacher)
      revision=(await db.query('SELECT get_sitov_access_context($1) result',[sitovUsers.outsider])).rows[0].result.revision
      assert.equal((await db.query('SELECT set_sitov_student_vip($1,false,$2) result',[sitovUsers.outsider,revision])).rows[0].result.success,true)
      await db.actor(sitovUsers.outsider)
      assert.equal((await db.query('SELECT id FROM learning_vocabulary_cards WHERE id IN($1,$2)',[sitovId(301),sitovId(601)])).rows.length,2,'verified synthetic purchase survives VIP revoke and billing-off')
      await db.actor(null,'postgres');await db.exec(`UPDATE sitov_access_private.purchases SET active=false WHERE order_id='${sitovId(620)}';`)
      await setTrial(manifest)
      await db.actor(sitovUsers.outsider)
      assert.deepEqual((await db.query('SELECT c.id,u.label FROM learning_vocabulary_cards c JOIN learning_units u ON u.id=c.unit_id WHERE c.id IN($1,$2)',[sitovId(301),sitovId(601)])).rows.map(r=>r.id),[sitovId(301)])
      assert.deepEqual((await db.query('SELECT DISTINCT card_id FROM vocabulary_translations WHERE card_id IN($1,$2)',[sitovId(301),sitovId(601)])).rows,[{card_id:sitovId(301)}])
      const rejected=(await db.query('SELECT initialize_vocabulary_cards($1) result',[[{cardId:sitovId(301),alreadyKnown:false},{cardId:sitovId(601),alreadyKnown:false}]])).rows[0].result
      assert.ok(rejected.error, 'mixed allowed/denied initialization rejects atomically')
      assert.equal((await db.query('SELECT count(*)::int n FROM vocabulary_direction_progress WHERE auth_user_id=$1',[sitovUsers.outsider])).rows[0].n,0)
      const initialized=(await db.query('SELECT initialize_vocabulary_cards($1) result',[[{cardId:sitovId(301),alreadyKnown:false}]])).rows[0].result
      assert.equal(initialized.addedNew,1)
      const progress=(await db.query("SELECT id,direction FROM vocabulary_direction_progress WHERE auth_user_id=$1 AND card_id=$2 ORDER BY direction",[sitovUsers.outsider,sitovId(301)])).rows
      assert.equal(progress.length,2)
      const deToNative=progress.find(p=>p.direction==='de_to_native').id
      const nativeToDe=progress.find(p=>p.direction==='native_to_de').id
      // Historical sibling progress is present but must never become a new permission.
      await db.actor(null,'postgres')
      await db.exec(`INSERT INTO vocabulary_direction_progress(id,auth_user_id,card_id,direction,box_number,next_review_date,last_answered_at)
        VALUES('${sitovId(602)}','${sitovUsers.outsider}','${sitovId(601)}','de_to_native',1,now(),now());`)
      await db.actor(sitovUsers.outsider)
      for (const [query,args] of [
        ['SELECT submit_vocabulary_answer($1,NULL,$2,$3) result',[sitovId(602),'дерево','ru']],
        ['SELECT submit_vocabulary_answer($1,NULL,$2,$3,$4) result',[sitovId(602),'дерево','ru','A1.1']],
        ['SELECT submit_vocabulary_self_rating_once($1,$2,true,$3) result',[sitovId(612),sitovId(602),'ru']],
        ['SELECT check_vocabulary_retry($1,$2,$3) result',[sitovId(602),'дерево','ru']],
      ]) assert.ok((await db.query(query,args)).rows[0].result.error,'direct scoring cannot consume an unselected sibling')
      const request=sitovId(610)
      const result=(await db.query('SELECT submit_vocabulary_answer_once($1,$2,NULL,$3,$4,$5) result',[request,deToNative,'дом','ru','A1.1'])).rows[0].result
      assert.equal(result.success,true);assert.equal(result.isCorrect,true);assert.equal(result.correctAnswer,'дом');assert.equal(result.newPhase,2)
      assert.deepEqual((await db.query('SELECT submit_vocabulary_answer_once($1,$2,NULL,$3,$4,$5) result',[request,deToNative,'дом','ru','A1.1'])).rows[0].result,result)
      assert.equal((await db.query('SELECT check_vocabulary_retry($1,$2,$3,$4) result',[deToNative,'дом','ru','A1.1'])).rows[0].result.isCorrect,true)
      await db.actor(null,'postgres');await db.exec(`DELETE FROM vocabulary_learning_state WHERE auth_user_id='${sitovUsers.outsider}';`)
      await db.actor(sitovUsers.outsider)
      assert.equal((await db.query('SELECT submit_vocabulary_self_rating_once($1,$2,true,$3,$4) result',[sitovId(611),nativeToDe,'ru','A1.1'])).rows[0].result.success,true)
      assert.equal((await db.query('SELECT set_vocabulary_lesson_paused($1,true) result',[sitovId(211)])).rows[0].result.paused,true)
      assert.ok((await db.query('SELECT set_vocabulary_lesson_paused($1,false) result',[sitovId(212)])).rows[0].result.error)
      await setTrial({version:1,rules:[]})
      await db.actor(sitovUsers.outsider)
      assert.deepEqual((await db.query('SELECT id FROM learning_vocabulary_cards WHERE id=$1',[sitovId(301)])).rows,[])
      assert.ok((await db.query('SELECT submit_vocabulary_answer_once($1,$2,NULL,$3,$4,$5) result',[request,deToNative,'дом','ru','A1.1'])).rows[0].result.error,'old receipt cannot replay after revoke')
      assert.ok((await db.query('SELECT check_vocabulary_retry($1,$2,$3,$4) result',[deToNative,'дом','ru','A1.1'])).rows[0].result.error)
      assert.ok((await db.query('SELECT submit_vocabulary_self_rating_once($1,$2,true,$3,$4) result',[sitovId(611),nativeToDe,'ru','A1.1'])).rows[0].result.error)
      await setTrial(manifest)
      await db.actor(sitovUsers.outsider)
      assert.equal((await db.query('SELECT skip_vocabulary_assessment($1) result',['A1.1'])).rows[0].result.lesson,'Sitov QA vocabulary 1')
      await db.query('SELECT reset_vocabulary_lesson_progress($1) result',[sitovId(211)])
      await db.actor(null,'postgres')
      assert.equal((await db.query('SELECT count(*)::int n FROM vocabulary_direction_progress WHERE auth_user_id=$1 AND card_id=$2',[sitovUsers.outsider,sitovId(301)])).rows[0].n,0)
      assert.equal((await db.query('SELECT count(*)::int n FROM vocabulary_direction_progress WHERE auth_user_id=$1 AND card_id=$2',[sitovUsers.outsider,sitovId(601)])).rows[0].n,1,'lesson reset preserves inaccessible historical sibling progress')

    })
    await t.test('replay preserves claims, selections, payment-off and historical state', async () => {
      const rights = await sitovRightsSnapshot(db)
      await db.actor(null, 'postgres'); await db.exec(sql)
      assert.deepEqual(await sitovRightsSnapshot(db), rights)
      assert.deepEqual(await sitovHistorySnapshot(db), history)
      await db.actor(sitovUsers.outsider)
      assert.equal((await db.query('SELECT start_sitov_checkout($1,$2) result', ['A1.1', sitovId(999)])).rows[0].result.error, 'payment_disabled')
    })
  } finally { await db?.close(); admin.raw(`DROP DATABASE ${database}`) }
})
