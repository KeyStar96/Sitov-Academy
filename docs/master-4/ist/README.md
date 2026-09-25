# Ist-Bilder – Phase 0

Aufgenommen am 25.09.2026, ca. 22:16–22:18 Europe/Berlin. Ausgangsrevision `e123fab0ba49177c3c15f06db10249d92eb688d9`. Alle zwölf Aufrufe lieferten HTTP 200; alle zwölf PNGs wurden visuell geprüft.

**Quelle:** unverändertes lokales Frontend aus dem erfolgreichen Produktionsbuild (`next start`, `http://localhost:3000`), mit ausschließlich künstlichen Daten eines kurzlebigen Loopback-Fixtures. **Keine Bilder einer echten Personensitzung und kein Screenshot einer produktiven Datenbank.** Der Runtime-Code entspricht dem aktiven Release `5f12313ac51e`; der Git-Unterschied betrifft nur Dokumentation, Seeds und Tests.

Profil „Demo“, reservierte Adresse `demo@example.invalid`, erfundene UUIDs, nur A1.1 freigeschaltet. Sieben synthetische Einwort-Lektionen, eine in Fach 1 mit zwei fälligen Richtungen, eigener neu formulierter Aussprachetext, keine Aufnahmen/Nachrichten/Kursbuchungen. Grammatik und Mediathek zeigen Leerzustände. Das ist für Grammatik mit dem Live-Befund 604/604 `incomplete` vereinbar; der Mediathek-Leerzustand ist lediglich ein Fixture und keine Aussage über den Live-Medienbestand. Zahlen in Bildern ersetzen niemals die gemessenen Live-Zahlen in [VPS-BESTAND.md](../VPS-BESTAND.md).

Oberflächensprache Englisch, weil die deutschsprachige Oberfläche die Trainer regulär sperrt. Light / Standard-Kontrast, `prefers-reduced-motion: reduce`, Device Scale Factor 1. Browser: Playwright 1.58.2 mit lokalem Google Chrome 153.0.8010.54. Desktop-Viewport 1440×1000; Handy-Viewport 390×844 mit Touch-/Mobile-Emulation, kein physisches Gerät. Nur Loopback-Browseranfragen erlaubt. Keine Audio-/Aufnahme-/Bewertungsaktion ausgelöst.

Die PNGs zeigen jeweils die **ganze Seite**. Fixierte Leisten bleiben dabei an ihrer Position im ursprünglichen Viewport; dass sie mitten im langen Gesamtbild liegen, ist eine Eigenschaft der Vollseitenaufnahme. Desktop und Handy sind daher anhand ihrer jeweiligen Viewports zu vergleichen. Keine nachträgliche Retusche, keine CSS-/DOM-Umbauten, keine Maskierung echter Daten. Erste Versuche gegen den Entwicklungsserver wurden vollständig durch die finalen Bilder ohne Dev-Overlay ersetzt.

| Bildschirm | Route | Desktop | Handy |
|---|---|---|---|
| Home | `/en/dashboard` | [home-desktop.png](home-desktop.png) | [home-handy.png](home-handy.png) |
| Niveau | `/en/dashboard/level/A1.1` | [niveau-desktop.png](niveau-desktop.png) | [niveau-handy.png](niveau-handy.png) |
| Vokabeln | `/en/dashboard/level/A1.1/vocabulary` | [vokabeln-desktop.png](vokabeln-desktop.png) | [vokabeln-handy.png](vokabeln-handy.png) |
| Grammatik | `/en/dashboard/level/A1.1/exercises` | [grammatik-desktop.png](grammatik-desktop.png) | [grammatik-handy.png](grammatik-handy.png) |
| Aussprache | `/en/dashboard/level/A1.1/pronunciation` | [aussprache-desktop.png](aussprache-desktop.png) | [aussprache-handy.png](aussprache-handy.png) |
| Mediathek | `/en/dashboard/level/A1.1/videos` | [mediathek-desktop.png](mediathek-desktop.png) | [mediathek-handy.png](mediathek-handy.png) |

## Sichtbarer Bestandsbefund

Die mobile Vokabel-Vollseitenaufnahme ist **415 px breit trotz 390-px-Viewport**. Das ist ein beobachteter horizontaler Überstand im aktuellen Renderzustand und wurde weder abgeschnitten noch durch CSS korrigiert. Ursache und Verhalten beim Scrollen/Zoom sind in Phase 2/8 zu prüfen. Die übrigen Handy-PNGs sind 390 px breit. Dieser Befund gehört nicht zu den sechs öffentlichen Axe-Testfällen.

## Prüfsummen und Abmessungen

| Datei | PNG-Abmessungen | SHA256 |
|---|---|---|
| `home-desktop.png` | 1440×1782 | `985c69ac9e6d21de86c86c163e9eea09ef510d06c732fb9e2e86ea2d27701cae` |
| `niveau-desktop.png` | 1440×2652 | `7d4027fd0075cc7f73ab8a6175898204f802f40c683db6f2119a782797e06fce` |
| `vokabeln-desktop.png` | 1440×1119 | `0552d161955c5b792038946daaa612e351ac5a46e6feb8f5f1f71f78350ca493` |
| `grammatik-desktop.png` | 1440×1000 | `2359e45b632ed3b30a87779f39277e3fa56e3d6c81aace605a388f71121f27a9` |
| `aussprache-desktop.png` | 1440×1134 | `d842dd370deb45520791c8290bf6c49f1ef3fb484642a314aafdc823f425f400` |
| `mediathek-desktop.png` | 1440×1000 | `c4a7bef7bf6e0b56ec9aa2b6643d086bda17fb74534c7eec123ec383860ce083` |
| `home-handy.png` | 390×3686 | `fa886e57c4ef04bb20167a3be1e1b8c57f12425c7171882b5acce915a4632fa2` |
| `niveau-handy.png` | 390×2928 | `c709cad107183888e2bc53d6bcf966d80d2b14980fe1efb0013280984285bfc1` |
| `vokabeln-handy.png` | 415×1191 | `b0766e3d1c2d1820249791f4c7f39c97aba1a0cd71a806b3f20c7ae657d0913a` |
| `grammatik-handy.png` | 390×844 | `089dd07061228b0f5be92cdc76884d7e58454479d4de1a177243609a11823577` |
| `aussprache-handy.png` | 390×1342 | `37d5c316710140f06e3c434138e7d8aae26a325b41c37d6b44f500173099a6ae` |
| `mediathek-handy.png` | 390×844 | `9b7dca40bbf395e73fc943370e3ffc5b8b1678d190740371dd16fbebdc7a06da` |

## Wiederholung mit derselben künstlichen Ausgangslage

Die folgenden temporären Werkzeuge dokumentieren den tatsächlich genutzten Aufnahmeaufbau. Sie sind **keine Anwendungserweiterung**, kein Supabase-/RLS-Test und keine produktive Authentifizierung. Der Mini-Server beantwortet nur die für diese Ansichten nötigen Datenabfragen, schreibt nichts persistent und wird nach der Aufnahme beendet. Nicht für funktionale Tests oder andere Seiten verwenden. Test-/Browserabhängigkeiten und Build-Befehle stehen in [TEST-BASELINE.md](../TEST-BASELINE.md).

1. Den folgenden Fixture-Block unter `/tmp/smartgerman-phase0/fixture.cjs` speichern und mit Node starten (Loopback-Port 54321).
2. Den vorhandenen Build mit denselben lokalen Dummy-Umgebungsvariablen wie in TEST-BASELINE starten (`npm run start`, Port 3000). Niemals Produktiv-URLs/Schlüssel für diesen Aufbau verwenden.
3. Den Aufnahme-Block aus dem Repository-Stamm mit Node ausführen. Er überschreibt die zwölf Bilddateien; nur zur bewussten Erneuerung einer Baseline nutzen.
4. Beide temporären lokalen Prozesse beenden.

### Daten-Fixture

```js
const http=require('node:http');
const user={id:'00000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',email:'demo@example.invalid',email_confirmed_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
const unit=(n,trainer='vocabulary')=>({id:`00000000-0000-4000-8000-${String(100+n).padStart(12,'0')}`,level:'A1.1',label:`Lektion ${n}`,sort_order:n,is_active:true,owner_auth_user_id:null,trainer,learning_levels:{cefr_level:'A1'}});
const terms=[['Name','name'],['Familie','family'],['Apfel','apple'],['Tisch','table'],['Morgen','morning'],['Sonne','sun'],['Schule','school']];
const cards=terms.map(([word,en],i)=>({id:`00000000-0000-4000-8000-${String(200+i).padStart(12,'0')}`,unit_id:unit(i+1).id,word_de:word,article:i===0||i===2||i===3||i===4?'der':'die',plural:null,image_url:null,audio_url:null,created_at:'2026-01-01T00:00:00Z',sentence_practice:false,alternative_answers_de:[],unit:unit(i+1),translations:[{locale:'en',translation:en,context_sentence:null,is_difficult:false},{locale:'de',translation:word,context_sentence:null,is_difficult:false}]}));
const progress=['de_to_native','native_to_de'].map((direction,i)=>({id:`00000000-0000-4000-8000-${String(300+i).padStart(12,'0')}`,card_id:cards[0].id,direction,box_number:1,next_review_date:'2026-01-01T00:00:00Z'}));
const tables={profiles:[{id:user.id,role:'student',native_language:'en',ui_language:'en',person:{display_name:'Demo',email:user.email},level_access:[{level:'A1.1'}]}],learning_vocabulary_cards:cards,vocabulary_direction_progress:progress,learning_reading_texts:[{id:'00000000-0000-4000-8000-000000000401',unit:unit(1,'pronunciation'),sentence_de:'Heute lernen wir zusammen. Danach machen wir eine Pause.',focus:'Satzmelodie',audio_url:null}],learning_units:cards.map(c=>c.unit)};
http.createServer((req,res)=>{const url=new URL(req.url,'http://127.0.0.1:54321');const name=url.pathname.split('/').at(-1);let data=[];console.log(req.method,url.pathname,url.searchParams.get('select')||'');
 if(url.pathname==='/auth/v1/user')data=user;
 else if(url.pathname.startsWith('/rest/v1/rpc/')){if(name==='claim_verified_person')data={id:null,unresolved:false};else data=[];}
 else {data=tables[name]||[];const offset=Number(url.searchParams.get('offset')||0);if(offset)data=[];if(req.headers.accept?.includes('vnd.pgrst.object+json'))data=data[0]||null;}
 if(!['GET','HEAD','OPTIONS'].includes(req.method)&&!url.pathname.startsWith('/rest/v1/rpc/')){res.writeHead(405);return res.end('{}');}
 res.writeHead(200,{'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'*','content-range':`0-${Math.max(0,(data?.length||1)-1)}/${data?.length||1}`});res.end(req.method==='HEAD'?'':JSON.stringify(data));
}).listen(54321,'127.0.0.1',()=>console.log('Fixture listening locally on 54321'));
```

### Aufnahme

```js
const {chromium}=require(process.cwd()+'/node_modules/playwright');
const fs=require('node:fs');
const root=process.cwd()+'/docs/master-4/ist';
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const user={id:'00000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',email:'demo@example.invalid',email_confirmed_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
const exp=Math.floor(Date.now()/1000)+3600;
const token=`${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:user.id,aud:'authenticated',role:'authenticated',exp})}.local-fixture-only`;
const session={access_token:token,refresh_token:'local-fixture-only',token_type:'bearer',expires_in:3600,expires_at:exp,user};
(async()=>{fs.mkdirSync(root,{recursive:true});const browser=await chromium.launch({headless:true,channel:'chrome'});const meta=[];
 for(const [device,viewport] of [['desktop',{width:1440,height:1000}],['handy',{width:390,height:844}]]){
 const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:device==='handy',hasTouch:device==='handy',reducedMotion:'reduce',colorScheme:'light'});
 await context.addCookies([{name:'sb-sitov-auth-token',value:'base64-'+b64(session),domain:'localhost',path:'/',httpOnly:false,secure:false,sameSite:'Lax'}]);
 await context.addInitScript(()=>{localStorage.setItem('theme','light');localStorage.setItem('academy-contrast','standard');});
 await context.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
 const page=await context.newPage();page.on('pageerror',err=>console.log('PAGEERROR',err.message));
 for(const [name,path] of [['home','/en/dashboard'],['niveau','/en/dashboard/level/A1.1'],['vokabeln','/en/dashboard/level/A1.1/vocabulary'],['grammatik','/en/dashboard/level/A1.1/exercises'],['aussprache','/en/dashboard/level/A1.1/pronunciation'],['mediathek','/en/dashboard/level/A1.1/videos']]){
 const response=await page.goto('http://localhost:3000'+path,{waitUntil:'networkidle',timeout:90000});
 await page.locator('h1:visible').first().waitFor({state:'visible',timeout:30000});await page.waitForTimeout(1800);
 const title=await page.locator('h1').allTextContents();const body=await page.locator('body').innerText();
 if(page.url().includes('/login')||body.includes('Application error'))throw Error('Screen failed '+name);
 await page.screenshot({path:`${root}/${name}-${device}.png`,fullPage:true,animations:'disabled'});
 meta.push({file:`${name}-${device}.png`,path,status:response.status(),viewport,title});console.log(device,name,response.status(),JSON.stringify(title));
 }
 await context.close();}await browser.close();fs.writeFileSync('/tmp/smartgerman-phase0/screenshots.json',JSON.stringify(meta,null,2));})();
```
