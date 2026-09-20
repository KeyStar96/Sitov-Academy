import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:net'
import { readFile } from 'node:fs/promises'
import { renderTransactionalEmail, MAIL_KINDS, MAIL_LOCALES, mailLink } from '../lib/mail/templates.mjs'
import { createLocalSmtpTransport } from '../lib/mail/smtp.mjs'
import { runMailBatch } from '../lib/mail/worker.mjs'

const site='http://203.0.113.24'
const job={id:'00000000-0000-4000-8000-000000000003',lease_token:'00000000-0000-4000-8000-000000000004',recipient:'student@example.test',locale:'de',kind:'feedback_available',payload:{name:'Anna',path:'/de/dashboard/profile'}}
const log={info(){},error(){}}

test('booking templates show selected units, unit duration, price and total',()=>{
  for(const locale of MAIL_LOCALES) {
    const mail=renderTransactionalEmail('registration_received',locale,{courses:[{
      title:'Privatunterricht – Online',units:4,unitMinutes:45,unitPrice:25,price:100,
    }]},site)
    assert.match(mail.text,/4 × 45 min/)
    assert.ok(mail.text.includes(new Intl.NumberFormat(locale,{style:'currency',currency:'EUR'}).format(25)))
    assert.ok(mail.text.includes(new Intl.NumberFormat(locale,{style:'currency',currency:'EUR'}).format(100)))
  }
})

test('all event templates render in five languages, escape data, and stay on configured IP',()=>{
  for(const locale of MAIL_LOCALES) for(const kind of MAIL_KINDS) {
    const rendered=renderTransactionalEmail(kind,locale,{name:'<img src=x onerror=alert(1)>',courses:[{title:'Deutsch <A1>',price:90}],total:90},site)
    assert.match(rendered.html,new RegExp(`<html lang="${locale}">`))
    assert.match(rendered.html,/Sitov Academy/); assert.doesNotMatch(rendered.html,/Sitov Language Academy/)
    assert.match(rendered.html,/&lt;img src=x onerror=alert\(1\)&gt;/)
    assert.match(rendered.html,/Hüttenstraße 24a/); assert.match(rendered.html,/Vahrenwalder Str\. 92/)
    assert.ok(rendered.text.includes(site)); assert.ok(rendered.subject.length>20)
    assert.doesNotMatch(rendered.html,/https:\/\/(www\.)?sitov-academy\.com/)
  }
  assert.throws(()=>mailLink(site,'/\\evil.example/','de'),/invalid_mail_path/)
  assert.equal(mailLink(site,'https://evil.example/','de'),`${site}/de/dashboard`)
})

test('declined pending requests offer other courses without implying a terminated contract',()=>{
  for (const locale of MAIL_LOCALES) for (const kind of ['booking_cancelled','trial_cancelled']) {
    const rendered=renderTransactionalEmail(kind,locale,{name:'Anna'},site)
    assert.ok(rendered.text.includes(`${site}/${locale}/#courses`))
    assert.ok(!rendered.text.includes(`/${locale}/dashboard`))
  }
  const german=renderTransactionalEmail('booking_cancelled','de',{},site)
  assert.match(german.text,/Kursanfrage konnte leider nicht bestätigt werden/)
  assert.doesNotMatch(german.text,/Vertrags|Zahlungsbedingungen|Buchung wurde beendet/)
})

test('actual Nodemailer delivery is captured by loopback SMTP and acknowledged after acceptance',async()=>{
  const messages=[]
  const sockets=new Set()
  const server=createServer(socket=>{
    sockets.add(socket); socket.on('close',()=>sockets.delete(socket))
    socket.write('220 localhost test SMTP\r\n')
    let buffer='',data=false,body=[]
    socket.on('data',chunk=>{
      buffer+=chunk.toString()
      let end
      while((end=buffer.indexOf('\r\n'))>=0) {
        const line=buffer.slice(0,end); buffer=buffer.slice(end+2)
        if(data) { if(line==='.') { messages.push(body.join('\r\n')); body=[]; data=false; socket.write('250 queued locally\r\n') } else body.push(line); continue }
        if(/^EHLO|^HELO/.test(line)) socket.write('250 localhost\r\n')
        else if(line==='DATA') { data=true; socket.write('354 End with dot\r\n') }
        else if(line==='QUIT') socket.end('221 Bye\r\n')
        else socket.write('250 OK\r\n')
      }
    })
  })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  const transport=createLocalSmtpTransport({SMTP_HOST:'127.0.0.1',SMTP_PORT:String(server.address().port)})
  const calls=[]
  const client={async rpc(name,input){calls.push({name,input});return name==='claim_mail_jobs'?{data:[job],error:null}:{data:true,error:null}}}
  try {
    assert.equal(await runMailBatch({client,transport,env:{SITE_URL:site},logger:log}),1)
    assert.equal(messages.length,1); assert.match(messages[0],/To: student@example.test/)
    assert.match(messages[0],/From: Sitov Academy <info@sitov-academy.com>/)
    assert.match(messages[0],/Message-ID: <00000000-0000-4000-8000-000000000003@sitov-academy.com>/)
    assert.match(messages[0],/multipart\/alternative/)
    assert.equal(calls[1].name,'complete_mail_job'); assert.equal(calls[1].input.p_lease_token,job.lease_token)
  } finally { transport.close(); for(const socket of sockets) socket.destroy(); await new Promise(resolve=>server.close(resolve)) }
})

test('SMTP timeout retries; hard bounce stops; DB acknowledgement failure never reports send failure',async()=>{
  for(const [failure,permanent] of [[{code:'ETIMEDOUT'},false],[{code:'EENVELOPE',responseCode:550},true]]) {
    const calls=[]
    const client={async rpc(name,input){calls.push({name,input});return name==='claim_mail_jobs'?{data:[job],error:null}:{data:true,error:null}}}
    await runMailBatch({client,transport:{async sendMail(){throw failure}},env:{SITE_URL:site},logger:log})
    assert.equal(calls[1].name,'fail_mail_job'); assert.equal(calls[1].input.p_permanent,permanent)
  }
  const calls=[]
  const client={async rpc(name){calls.push(name);return name==='claim_mail_jobs'?{data:[job],error:null}:{data:null,error:{message:'offline'}}}}
  await runMailBatch({client,transport:{async sendMail(){return {accepted:[job.recipient],rejected:[]}}},env:{SITE_URL:site},logger:log})
  assert.deepEqual(calls,['claim_mail_jobs','complete_mail_job'])
  assert.throws(()=>createLocalSmtpTransport({SMTP_HOST:'smtp.resend.com'}),/local_postfix/)
})

test('JSON RPC failures never send unclaimed jobs or falsely acknowledge deliveries',async()=>{
  const errors=[],infos=[],sent=[]
  const logger={error(message){errors.push(message)},info(message){infos.push(message)}}
  const failure={data:{error:'request_failed',message:'The request could not be completed.'},error:null}
  const transport={async sendMail(mail){sent.push(mail);return {accepted:[job.recipient],rejected:[]}}}
  assert.equal(await runMailBatch({client:{async rpc(){return failure}},transport,env:{SITE_URL:site},logger}),0)
  assert.equal(sent.length,0);assert.deepEqual(errors,['[mail-worker] claim_failed'])
  errors.length=0
  const client={async rpc(name){return name==='claim_mail_jobs'?{data:[job],error:null}:failure}}
  await runMailBatch({client,transport,env:{SITE_URL:site},logger})
  assert.equal(sent.length,1);assert.deepEqual(infos,[])
  assert.deepEqual(errors,['[mail-worker] smtp_accepted_ack_failed'])
  errors.length=0
  const invalid={async rpc(name){return name==='claim_mail_jobs'?{data:[{...job,kind:'raw',payload:{}}],error:null}:failure}}
  await runMailBatch({client:invalid,transport,env:{SITE_URL:site},logger})
  assert.equal(sent.length,1);assert.deepEqual(errors,['[mail-worker] failure_write_failed'])
})

test('auth templates contain all locales and token-hash links based only on SiteURL',async()=>{
  for(const template of ['confirmation','recovery','invite','magic_link','email_change']) {
    const content=await readFile(new URL(`../supabase/templates/${template}.html`,import.meta.url),'utf8')
    assert.match(content,/\.TokenHash/); assert.match(content,/\.SiteURL/); assert.doesNotMatch(content,/https:\/\//)
    for(const lang of ['en','ru','uk','tr']) assert.ok(content.includes(`eq $lang "${lang}"`))
    assert.match(content,/Hüttenstraße 24a/)
  }
})
