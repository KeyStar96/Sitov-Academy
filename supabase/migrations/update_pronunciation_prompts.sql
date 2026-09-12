BEGIN;
ALTER TABLE public.pronunciation_prompts ADD COLUMN IF NOT EXISTS lesson text NOT NULL DEFAULT 'Lektion 1';

UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'In der Bibliothek', 
    sentence_de = 'Ich möchte mehr auf Deutsch lesen. Deshalb gehe ich heute in die Bibliothek. Eine Mitarbeiterin erklärt mir die Anmeldung. Ich brauche meinen Ausweis und bekomme eine Karte. Im ersten Stock finde ich leichte Bücher. Ich nehme eine kurze Geschichte mit vielen Bildern. Das Buch darf ich vier Wochen behalten. Nächste Woche möchte ich wiederkommen.', 
    focus = 'b und ch; Fragesätze', 
    level = 'A1.2', 
    is_active = true
WHERE id = '0022c931-279a-5050-ac2d-459c1e978cd1';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Ein Ausflug mit dem Zug', 
    sentence_de = 'Morgen besuchen wir meine Schwester in Bremen. Unser Zug fährt um halb zehn. Wir müssen früh aufstehen und die Taschen packen. Am Bahnhof kaufen wir noch ein Brötchen. Auf der Anzeige steht Gleis sieben. Im Zug sitzen wir am Fenster. Meine Schwester wartet am Bahnhof auf uns. Zusammen fahren wir mit der Straßenbahn zu ihr.', 
    focus = 'z und ü; Zahlen und Uhrzeiten', 
    level = 'A1.2', 
    is_active = true
WHERE id = '00cedd4e-cf66-50ae-a181-e687d85a8379';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Trotz des Regens sind wir spazieren gegangen.', 
    focus = 'z, sp', 
    level = NULL, 
    is_active = true
WHERE id = '019a0ef2-442d-47a9-b86c-fc178b4fc4b3';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Im Sommer fahren wir an die Ostsee.', 
    focus = 'mm, ee', 
    level = NULL, 
    is_active = true
WHERE id = '07aaf833-aab7-4d0f-b72c-2b297e171aa6';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Die Nachbarin hat uns freundlich begrüßt.', 
    focus = 'ü, ch', 
    level = NULL, 
    is_active = true
WHERE id = '097028ac-b5d8-4593-a43a-0fd616d5e6c5';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Kannst du mir bitte helfen?', 
    focus = 'st, pf', 
    level = NULL, 
    is_active = true
WHERE id = '0aaf91a8-42bf-450b-b102-df4b12041ba6';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Wir treffen uns um halb vier vor dem Kino.', 
    focus = 'pf, v', 
    level = NULL, 
    is_active = true
WHERE id = '0cbd4341-00e1-4e88-9105-45d4cccf18ec';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Wenn ich Zeit hätte, würde ich öfter ins Theater gehen.', 
    focus = 'ö, ü', 
    level = NULL, 
    is_active = true
WHERE id = '102a494c-742e-4542-a164-98dc03ea03d1';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Ich habe zwei Brüder.', 
    focus = 'ü, zwei', 
    level = NULL, 
    is_active = true
WHERE id = '1034cfa4-069d-460c-ab95-40be39989166';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Warum ich mich ehrenamtlich engagiere', 
    sentence_de = 'Einmal pro Woche helfe ich in einer kleinen Fahrradwerkstatt, die von Freiwilligen organisiert wird. Dort unterstützen wir Menschen dabei, ihre Räder selbst zu reparieren. Als ich damit angefangen habe, wollte ich vor allem meine handwerklichen Kenntnisse nutzen. Inzwischen schätze ich besonders die Gespräche mit Menschen, denen ich sonst kaum begegnen würde. Nicht jeder Termin verläuft einfach: Manchmal fehlen Teile, manchmal braucht eine Erklärung viel Geduld. Trotzdem gehe ich meistens zufrieden nach Hause. Ich sehe unmittelbar, dass meine Zeit jemandem geholfen hat. Gleichzeitig lerne ich selbst weiter. Ehrenamt bedeutet für mich deshalb nicht nur, etwas zu geben, sondern auch Erfahrungen und neue Perspektiven zu gewinnen.', 
    focus = 'eh und ge; persönliche Haltung', 
    level = 'B1.2', 
    is_active = true
WHERE id = '13264420-65a8-54f1-984e-b001a5244341';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Im kleinen Laden', 
    sentence_de = 'Ich bin im Laden. Ich brauche Milch, Brot und drei Äpfel. Die Verkäuferin ist freundlich. Sie zeigt mir das Brot. Es kostet zwei Euro. Ich nehme auch Wasser. Dann bezahle ich und sage danke. Meine Tasche ist jetzt voll.', 
    focus = 'ä und ch; Zahlen', 
    level = 'A1.1', 
    is_active = true
WHERE id = '15c29bec-e14e-5f27-8f12-ea9e45145e97';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Eine Reklamation im Geschäft', 
    sentence_de = 'Vor zwei Wochen habe ich neue Schuhe gekauft. Schon nach wenigen Tagen hat sich an einem Schuh die Sohle gelöst. Deshalb bin ich mit den Schuhen und dem Kassenbon ins Geschäft gegangen. Ich habe der Verkäuferin ruhig erklärt, was passiert ist. Sie hat die Schuhe geprüft und eine Kollegin dazugeholt. Leider war meine Größe nicht mehr da. Wir haben vereinbart, dass das Geschäft mich anruft, sobald ein neues Paar ankommt. Die freundliche Lösung hat mich erleichtert.', 
    focus = 'k und r; sachlicher Ton', 
    level = 'A2.2', 
    is_active = true
WHERE id = '194df28b-7175-5ffa-9813-2c5967cc2cb9';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Ein neuer Beruf als Chance', 
    sentence_de = 'Nachdem ich viele Jahre im Verkauf gearbeitet hatte, wollte ich beruflich etwas Neues ausprobieren. Besonders die Arbeit mit älteren Menschen interessierte mich. Deshalb habe ich mich über eine Ausbildung im Pflegebereich informiert. Die Beratung war hilfreich, trotzdem hatte ich Zweifel: Würde mein Deutsch für den Unterricht ausreichen? Eine Beraterin empfahl mir ein Praktikum. Dort merkte ich, dass ich vieles verstehen konnte und bei Unklarheiten nachfragen durfte. Jetzt bereite ich meine Bewerbung vor. Der Wechsel wird bestimmt anstrengend, aber ich möchte es versuchen. Für mich bedeutet Lernen auch, neue Möglichkeiten zu entdecken.', 
    focus = 'b und ch; längere Satzbögen', 
    level = 'B1.1', 
    is_active = true
WHERE id = '19846618-a6c3-5001-84d5-06b21b99dff5';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Ein Termin beim Arzt', 
    sentence_de = 'Seit gestern tut mein Hals weh. Ich rufe in der Praxis an und möchte einen Termin machen. Die Mitarbeiterin fragt nach meinem Namen. Ich buchstabiere ihn langsam. Am Nachmittag ist ein Termin frei. Ich kann um drei Uhr kommen. Meine Versichertenkarte nehme ich mit. Danach bleibe ich zu Hause und trinke warmen Tee.', 
    focus = 'ch und ts; höfliche Fragen', 
    level = 'A1.2', 
    is_active = true
WHERE id = '1b5c02d4-7217-56e0-8abb-906c20784e30';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Ein freiwilliger Einsatz', 
    sentence_de = 'In unserem Stadtteil wurde am Samstag Müll gesammelt. Ich habe durch einen Aushang davon erfahren und mich angemeldet. Am Treffpunkt bekamen wir Handschuhe und große Säcke. Eine Organisatorin erklärte, welche Wege wir sauber machen sollten. Ich war mit einer älteren Frau in einer Gruppe. Während wir arbeiteten, erzählte sie mir viel über den Stadtteil. Nach zwei Stunden waren die Wege deutlich sauberer. Zum Schluss gab es Suppe für alle. Beim nächsten Mal möchte ich wieder mithelfen.', 
    focus = 'f und ei; flüssige Aufzählungen', 
    level = 'A2.2', 
    is_active = true
WHERE id = '1c914afb-1958-5045-bda2-d609de2bd365';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Weil ich krank war, habe ich den Kurs verpasst.', 
    focus = 'ei, st', 
    level = NULL, 
    is_active = true
WHERE id = '1f556d80-56c6-400f-9338-e3cef079e58a';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Ich möchte einen Termin beim Arzt machen.', 
    focus = 'ö, ch', 
    level = NULL, 
    is_active = true
WHERE id = '222ec2dd-9312-4716-bdd5-b5d0f96997e3';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Unser Kursraum', 
    sentence_de = 'Das ist unser Kursraum. Er ist hell und groß. Hier stehen zwölf Stühle und sechs Tische. An der Wand ist eine Tafel. Mein Heft liegt auf dem Tisch. Die Lehrerin kommt und sagt guten Morgen. Jetzt beginnt unser Deutschkurs.', 
    focus = 'sch und lange Vokale', 
    level = 'A1.1', 
    is_active = true
WHERE id = '25bdcac1-9272-5294-893f-c2063b4838b9';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Eine kleine Reise allein', 
    sentence_de = 'Zum ersten Mal seit vielen Jahren bin ich allein für ein Wochenende verreist. Ich hatte mir eine kleine Stadt ausgesucht, die gut mit dem Zug erreichbar war. Zuerst fand ich es ungewohnt, alle Entscheidungen selbst zu treffen. Niemand fragte, wann wir essen oder welches Museum wir besuchen wollten. Nach einigen Stunden begann ich, diese Freiheit zu genießen. In einem Café kam ich mit einer anderen Reisenden ins Gespräch. Wir tauschten Tipps aus und gingen dann wieder eigene Wege. Zu Hause freute ich mich auf meine Familie. Trotzdem möchte ich eine solche Reise gern wiederholen.', 
    focus = 'ei und r; Erzähltempo variieren', 
    level = 'B1.1', 
    is_active = true
WHERE id = '2824e504-aef5-5a89-9290-aa72f1d42342';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Wer Widersprüche aushält, gewinnt an sprachlicher Souveränität.', 
    focus = 'ch, ä', 
    level = NULL, 
    is_active = true
WHERE id = '2bd081e1-bae3-4c4f-870c-6c4c3548bf72';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Ein Paket für die Nachbarin', 
    sentence_de = 'Als ich gestern nach Hause kam, klingelte der Paketbote. Meine Nachbarin war nicht da, und ich habe ihr Paket angenommen. Am Abend habe ich einen Zettel an ihre Tür gehängt. Darauf stand, dass sie bei mir klingeln kann. Eine Stunde später kam sie vorbei. In dem Paket waren Bücher für ihre Tochter. Wir haben kurz über die Schule gesprochen. Zum Dank hat sie mich am Wochenende zum Kaffee eingeladen.', 
    focus = 'p und k; Satzglieder verbinden', 
    level = 'A2.1', 
    is_active = true
WHERE id = '2c6b8ac4-28e2-556d-950e-9937d7da0da9';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Die Diskussion hat gezeigt, dass beide Seiten berechtigte Einwände haben.', 
    focus = 'sch, ä', 
    level = NULL, 
    is_active = true
WHERE id = '2ce832d8-6380-4de4-a890-854fa8ea4ede';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Sie spricht schnell, aber sehr deutlich.', 
    focus = 'ch, eu', 
    level = NULL, 
    is_active = true
WHERE id = '2eb5d5ed-ec4f-41f9-89f0-6c1d4481630d';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Die Anmeldung im Verein', 
    sentence_de = 'Ich möchte in einem Verein Fußball spielen und habe mich im Internet informiert. Ein Verein in meiner Nähe bietet ein kostenloses Probetraining an. Ich habe eine E-Mail geschrieben und nach der Uhrzeit gefragt. Der Trainer hat schnell geantwortet. Ich soll Sportschuhe und etwas zu trinken mitbringen. Am Donnerstag gehe ich zum ersten Mal hin. Ein Freund begleitet mich, weil er auch gern Fußball spielt. Wir freuen uns auf das Training.', 
    focus = 'ng und ei; höfliche Bitten', 
    level = 'A2.1', 
    is_active = true
WHERE id = '2f3b292b-8bdb-5007-90cb-278f9c00fc02';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Ein Konflikt mit einem Nachbarn', 
    sentence_de = 'Über mehrere Wochen hörte ich spät am Abend laute Musik aus der Nachbarwohnung. Zunächst ärgerte ich mich nur und erzählte anderen davon. Als ich schließlich an der Tür klingelte, versuchte ich bewusst, ruhig zu bleiben. Ich erklärte, wann ich schlafen muss und wie die Musik mich dabei stört. Mein Nachbar war überrascht, weil er nicht wusste, wie deutlich man die Bässe durch die Wand hört. Wir vereinbarten, dass er ab einer bestimmten Uhrzeit Kopfhörer benutzt. Seitdem hat sich die Situation verbessert. Das Gespräch war mir vorher unangenehm, doch es hat mehr bewirkt als meine stillen Vorwürfe. Manchmal fehlt der anderen Person einfach eine wichtige Information.', 
    focus = 'ch und kn; respektvoller Ton', 
    level = 'B1.2', 
    is_active = true
WHERE id = '2fa06ffd-6b82-5386-9c84-a4320c87bbc7';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Letztes Jahr habe ich zum ersten Mal allein verreist.', 
    focus = 'z, ei', 
    level = NULL, 
    is_active = true
WHERE id = '3120ad4c-474f-4e8e-81f8-53d0f3ece4f0';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Wo ist die Toilette?', 
    focus = 'ie, tt', 
    level = NULL, 
    is_active = true
WHERE id = '323ff85f-a44b-45c0-91ef-e29db86d70e3';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Ein Gespräch über Arbeitszeiten', 
    sentence_de = 'Seit meine Tochter in die Schule geht, passen meine Arbeitszeiten nicht mehr gut zu unserem Alltag. Deshalb habe ich meine Chefin um ein Gespräch gebeten. Ich habe erklärt, dass ich am Nachmittag früher zu Hause sein muss. Dafür könnte ich morgens eine Stunde früher anfangen. Meine Chefin wollte zuerst mit dem Team sprechen. Einige Tage später hat sie meinem Vorschlag zugestimmt. Wir probieren die neue Regelung zunächst für einen Monat aus. Ich bin froh, dass ich offen über mein Problem gesprochen habe.', 
    focus = 'ts und ei; Wünsche betonen', 
    level = 'A2.2', 
    is_active = true
WHERE id = '3243b764-4bfc-5fc6-8c24-1a49962988ff';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Ich habe gestern einen interessanten Film gesehen.', 
    focus = 'g, ie', 
    level = NULL, 
    is_active = true
WHERE id = '35f0cd78-5976-4d2f-9989-b7e13e6d3d42';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Die Aussprache klappt besser, wenn man langsam und klar spricht.', 
    focus = 'ch, a', 
    level = NULL, 
    is_active = true
WHERE id = '3bb26602-5c78-42e9-ae9b-69d84d83db6c';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Guten Tag, ich heiße Anna.', 
    focus = 'ie, ch', 
    level = NULL, 
    is_active = true
WHERE id = '3bd21f93-bb07-48d0-8242-fc9c4d1fc1b4';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Sport nach der Arbeit', 
    sentence_de = 'Seit einem Monat besuche ich einen Sportkurs im Stadtteilzentrum. Der Kurs findet immer mittwochs nach meiner Arbeit statt. Am Anfang waren die Übungen ziemlich anstrengend. Jetzt kann ich schon länger mitmachen. Die Trainerin zeigt jede Bewegung langsam und erklärt sie noch einmal. In der Gruppe sind Menschen aus verschiedenen Ländern. Nach dem Training trinken wir manchmal zusammen Wasser und unterhalten uns. Ich bewege mich mehr und lerne dabei neue Leute kennen.', 
    focus = 'sp und st; längere Wortgruppen', 
    level = 'A2.1', 
    is_active = true
WHERE id = '3dfcf736-84e5-599d-a492-b780ffc491c4';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Ich stehe um sieben Uhr auf.', 
    focus = 'st, ie', 
    level = NULL, 
    is_active = true
WHERE id = '4197d999-031e-48a9-8a23-e2cfcbea2b48';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Ich möchte einen Tee, bitte.', 
    focus = 'ö, ch', 
    level = NULL, 
    is_active = true
WHERE id = '4204340a-094d-4936-ac91-813b2b8ba38f';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Es bedarf einer differenzierten Betrachtung, um vorschnelle Schlüsse zu vermeiden.', 
    focus = 'z, sch', 
    level = NULL, 
    is_active = true
WHERE id = '424d0372-11ad-4e97-ac5f-58cb96193db4';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Ein Haustier auf Zeit', 
    sentence_de = 'Unsere Freunde sind für eine Woche verreist und haben uns gebeten, auf ihre Katze aufzupassen. Jeden Morgen bin ich in ihre Wohnung gegangen. Ich habe frisches Wasser hingestellt, Futter gegeben und das Katzenklo sauber gemacht. Am ersten Tag hat sich die Katze unter dem Sofa versteckt. Nach einigen Tagen kam sie schon zur Tür, wenn sie mich hörte. Ich habe unseren Freunden ein Foto geschickt, damit sie sich keine Sorgen machen. Als sie zurückkamen, war die Katze trotzdem am glücklichsten.', 
    focus = 'au und sch; Erzählrhythmus', 
    level = 'A2.2', 
    is_active = true
WHERE id = '4533b44b-4ec1-5147-8a69-3345d5df7933';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Der Vortrag war zwar anspruchsvoll, aber äußerst lehrreich.', 
    focus = 'äu, ch', 
    level = NULL, 
    is_active = true
WHERE id = '456ac6dd-0a9a-4549-a5ae-9472d49166d0';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Ein ruhiger Abend', 
    sentence_de = 'Es ist Abend. Ich bin zu Hause. Mein Handy liegt auf dem Tisch. Heute lese ich ein kleines Buch. Meine Katze schläft auf dem Sofa. Ich trinke Wasser und höre leise Musik. Um zehn Uhr gehe ich ins Bett. Gute Nacht!', 
    focus = 'au und ng; gleichmäßiges Tempo', 
    level = 'A1.1', 
    is_active = true
WHERE id = '4a6f7008-9439-5c6e-9d60-113e8945f800';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Die Nuancen der deutschen Satzmelodie entscheiden über Höflichkeit und Distanz.', 
    focus = 'z, ch', 
    level = NULL, 
    is_active = true
WHERE id = '4c27f103-769a-4461-ada9-8e3382a7a842';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Die Entscheidung für einen Kurs', 
    sentence_de = 'Ich möchte mich beruflich weiterentwickeln und suche einen Computerkurs. Im Internet habe ich zwei passende Angebote gefunden. Ein Kurs findet am Wochenende statt, der andere an zwei Abenden in der Woche. Obwohl der Abendkurs günstiger ist, habe ich mich für den Wochenendkurs entschieden. Nach der Arbeit bin ich oft zu müde, um konzentriert zu lernen. Vor der Anmeldung habe ich gefragt, ob man einen eigenen Laptop braucht. Das ist zum Glück nicht nötig. Die Schule stellt Geräte zur Verfügung.', 
    focus = 'ü und ei; Gründe klar gliedern', 
    level = 'A2.2', 
    is_active = true
WHERE id = '4c550a8b-95b1-5a53-ac3c-b2ad48ea592d';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Ich habe mich über die Nachricht sehr gefreut.', 
    focus = 'ü, eu', 
    level = NULL, 
    is_active = true
WHERE id = '4e268b91-594d-46d7-8efd-52a78993f2fb';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Wir treffen uns nach der Arbeit.', 
    focus = 'ff, ei', 
    level = NULL, 
    is_active = true
WHERE id = '4e3b7ef5-33e5-4a77-a760-7311b0f4e994';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Wo ist der Bahnhof, bitte?', 
    focus = 'ch, hof', 
    level = NULL, 
    is_active = true
WHERE id = '4e46055a-9c81-45d8-a9ac-576db7d1bb48';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Je genauer man zuhört, desto besser versteht man die Melodie.', 
    focus = 'au, ie', 
    level = NULL, 
    is_active = true
WHERE id = '4ea55be0-669d-484a-8786-0d63937efa42';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Unser gemeinsamer Innenhof', 
    sentence_de = 'Der Innenhof unseres Hauses war lange leer und ungemütlich. Bei einem Treffen haben wir Nachbarn überlegt, wie wir ihn verändern könnten. Einige wollten Blumen pflanzen, andere wünschten sich eine Bank. Gemeinsam haben wir einen Plan gemacht und beim Vermieter nachgefragt. Nachdem er zugestimmt hatte, haben wir an einem Samstag alles vorbereitet. Jeder hat eine kleine Aufgabe übernommen. Jetzt sitzen wir abends oft draußen. Der Hof ist schöner geworden, und wir kennen uns im Haus viel besser.', 
    focus = 'h und ö; Gegensätze hörbar machen', 
    level = 'A2.2', 
    is_active = true
WHERE id = '51347d93-a3a8-50aa-811e-4ea2816386f9';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Ein sicherer Umgang mit Nachrichten', 
    sentence_de = 'In einer Chatgruppe bekam ich eine Nachricht über eine angebliche Änderung bei unseren Kurszeiten. Viele Teilnehmende waren sofort beunruhigt. Bevor ich die Nachricht weiterleitete, schaute ich auf der Webseite der Schule nach. Dort stand nichts dazu. Ich rief im Büro an und erfuhr, dass es sich um eine alte Information handelte. Anschließend schrieb ich eine kurze Erklärung in die Gruppe. Die Situation hat mir gezeigt, wie schnell Missverständnisse entstehen können. Heute prüfe ich wichtige Nachrichten lieber einmal mehr. Dabei helfen mir das Datum, die Quelle und eine direkte Nachfrage bei der zuständigen Stelle.', 
    focus = 'ng und ch; sachlich erklären', 
    level = 'B1.1', 
    is_active = true
WHERE id = '525d59e3-5cad-543c-820a-b9316809645f';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Wir wohnen in einer kleinen Wohnung.', 
    focus = 'ö, w', 
    level = NULL, 
    is_active = true
WHERE id = '53ed7ada-e377-4895-b5ef-453e73a771a2';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Ich bin der Meinung, dass Sport den Alltag erleichtert.', 
    focus = 'ng, ch', 
    level = NULL, 
    is_active = true
WHERE id = '5828cfc4-1aa0-4b47-9b5c-6103dc3253ab';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Eine Wohnung besichtigen', 
    sentence_de = 'Wir suchen eine neue Wohnung. Unsere Wohnung ist zu klein. Heute sehen wir uns eine Wohnung in der Nordstraße an. Sie hat drei Zimmer und einen Balkon. Die Küche ist hell. Neben dem Haus ist ein Spielplatz. Die Miete ist für uns etwas hoch. Wir möchten noch eine Nacht darüber schlafen und morgen anrufen.', 
    focus = 'w und ü; sinnvolle Pausen', 
    level = 'A1.2', 
    is_active = true
WHERE id = '5b3316e2-4a9f-5689-ba11-e5d0dc420f2b';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Eins, zwei, drei, vier.', 
    focus = 'ei, z', 
    level = NULL, 
    is_active = true
WHERE id = '5d3949c3-ba44-4c93-b767-e9d23735c517';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Ein bewusster Umgang mit Bewertungen', 
    sentence_de = 'Bevor ich einen Kurs buche oder ein Gerät kaufe, lese ich häufig Bewertungen im Internet. Früher habe ich mich vor allem an der Zahl der Sterne orientiert. Heute schaue ich genauer hin. Mich interessiert, ob jemand konkrete Erfahrungen beschreibt und ob die Bewertung zu meinen eigenen Erwartungen passt. Ein Kurs kann für Anfänger hilfreich und für Fortgeschrittene zu langsam sein. Auch das Datum spielt eine Rolle, denn Angebote können sich verändern. Einzelne sehr positive oder negative Kommentare entscheiden deshalb nicht allein über meine Wahl. Bewertungen sind für mich eine erste Orientierung. Wenn eine Entscheidung wichtig ist, suche ich zusätzliche Informationen oder frage direkt beim Anbieter nach.', 
    focus = 'b und w; Einschränkungen betonen', 
    level = 'B1.2', 
    is_active = true
WHERE id = '5dc0cf34-6f7c-5e67-9728-22bbe90c5dc7';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Das ist mein Freund.', 
    focus = 'eu, nd', 
    level = NULL, 
    is_active = true
WHERE id = '5df41b67-37f0-422b-ae27-d92e9816141c';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Ein Rezept von meiner Mutter', 
    sentence_de = 'Meine Mutter hat mir am Telefon ein einfaches Rezept erklärt. Ich wollte einen Apfelkuchen backen, hatte aber wenig Erfahrung. Zuerst habe ich die Zutaten aufgeschrieben und alles eingekauft. Dann habe ich den Teig vorbereitet. Während der Kuchen im Ofen war, habe ich die Küche aufgeräumt. Nach vierzig Minuten roch die ganze Wohnung nach Äpfeln. Der Kuchen war etwas dunkel, hat aber gut geschmeckt. Meiner Mutter habe ich ein Foto geschickt.', 
    focus = 'r und ch; Reihenfolge hörbar machen', 
    level = 'A2.1', 
    is_active = true
WHERE id = '5ec73679-e979-5ef6-bbac-8d14af8d2651';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Es kommt darauf an, wie gründlich man sich vorbereitet.', 
    focus = 'ü, ch', 
    level = NULL, 
    is_active = true
WHERE id = '5ed1b469-33a6-40e6-ac9c-db6fa54eaf07';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Meine Familie', 
    sentence_de = 'Das ist ein Foto von meiner Familie. Meine Mutter heißt Maria. Sie kocht gern. Mein Vater heißt Oleg. Er hört gern Musik. Meine Schwester ist zwanzig Jahre alt. Sie lernt Deutsch wie ich. Wir telefonieren oft und lachen viel.', 
    focus = 'ie und ö; Namen deutlich sprechen', 
    level = 'A1.1', 
    is_active = true
WHERE id = '610e3f81-2a6f-5794-bb78-ef06cb7ece17';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Sie argumentierte schlüssig, ohne den Gegenüber bloßzustellen.', 
    focus = 'sch, ü', 
    level = NULL, 
    is_active = true
WHERE id = '622150d7-250d-4dac-bdf3-a932636ae0f1';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Bitte sprechen Sie etwas langsamer.', 
    focus = 'ch, er', 
    level = NULL, 
    is_active = true
WHERE id = '627e0ac7-7dac-4935-a5b2-cf42e073eeac';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Heute ist das Wetter schön.', 
    focus = 'ö, eu', 
    level = NULL, 
    is_active = true
WHERE id = '635abd7e-b429-4226-ab80-3632c67222a8';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Wer Stil beherrscht, kann auch Schweigen beredt machen.', 
    focus = 'sch, ch', 
    level = NULL, 
    is_active = true
WHERE id = '65f3ddae-71fe-47a2-867c-454c4a8e0411';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Wir haben uns lange über das Thema unterhalten.', 
    focus = 'th, h', 
    level = NULL, 
    is_active = true
WHERE id = '66f45951-dc65-40c1-8162-20ded51355d0';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Der Zug hat zehn Minuten Verspätung.', 
    focus = 'z, ä', 
    level = NULL, 
    is_active = true
WHERE id = '675e3ad2-81cd-464a-986c-90bf88210ea3';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Ich würde vorschlagen, die Übung noch einmal zu machen.', 
    focus = 'ü, sch', 
    level = NULL, 
    is_active = true
WHERE id = '67dcd417-f530-4d0d-82ea-05974598d3a2';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Es fällt mir schwer, vor vielen Menschen zu sprechen.', 
    focus = 'sch, ch', 
    level = NULL, 
    is_active = true
WHERE id = '680d972b-8506-4425-a571-1e9edb3bf690';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Man sollte nicht voreilig urteilen, bevor alle Fakten da sind.', 
    focus = 'ei, g', 
    level = NULL, 
    is_active = true
WHERE id = '6839aa5b-c23e-4f62-a2fb-578c8eb6148e';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Wem gehört der öffentliche Raum?', 
    sentence_de = 'Auf dem Platz vor unserer Bibliothek treffen sich abends häufig Jugendliche. Einige Anwohner fühlen sich durch die Gespräche und die Musik gestört. Andere finden, dass junge Menschen einen Ort brauchen, an dem sie kostenlos zusammenkommen können. Bei einem Treffen im Stadtteilzentrum wurden beide Seiten angehört. Die Jugendlichen erklärten, dass es in der Nähe kaum Angebote für sie gibt. Gemeinsam wurden feste Ruhezeiten und ein zusätzlicher Treffpunkt vorgeschlagen. Noch sind nicht alle zufrieden, aber das Gespräch war ein Anfang. Für mich zeigt die Situation, dass öffentlicher Raum unterschiedliche Bedürfnisse erfüllen muss. Dauerhafte Lösungen entstehen eher durch klare Regeln und Beteiligung als durch gegenseitige Vorwürfe.', 
    focus = 'r und ö; verschiedene Sichtweisen', 
    level = 'B1.2', 
    is_active = true
WHERE id = '6b4676fc-7a16-51d6-8c1c-4b5da00ffaf2';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Guten Tag, das bin ich', 
    sentence_de = 'Guten Tag, ich heiße Anna. Ich komme aus Polen und wohne jetzt in Hannover. Ich bin dreißig Jahre alt. Meine Familie ist klein. Mein Mann heißt Paul. Wir lernen zusammen Deutsch. Am Abend trinken wir Tee und lesen ein Buch.', 
    focus = 'ie und ch; kurze Satzpausen', 
    level = 'A1.1', 
    is_active = true
WHERE id = '6d2f8e95-6f87-510b-b244-0631733f8ff9';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Die Einladung', 
    sentence_de = 'Nächste Woche habe ich Geburtstag. Ich möchte mit meinen Nachbarn feiern. Die Feier beginnt am Samstag um vier Uhr. Ich schreibe eine kurze Einladung und lege sie in ihre Briefkästen. Jeder kann etwas zu essen mitbringen. Ich kaufe Getränke und backe einen Kuchen. Wir können im Garten sitzen. Bei Regen feiern wir in meiner Wohnung.', 
    focus = 'ei und ü; Betonung von Zeitangaben', 
    level = 'A1.2', 
    is_active = true
WHERE id = '6e15b015-d482-58e4-9fa2-25ba0c8dea72';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Was Erfolg beim Sprachenlernen bedeutet', 
    sentence_de = 'Vor einem Jahr hätte ich Erfolg beim Deutschlernen vor allem an einer guten Prüfungsnote gemessen. Heute denke ich auch an viele kleine Situationen: ein verständliches Telefonat, ein Gespräch mit der Lehrerin meines Kindes oder eine Frage bei der Arbeit. Solche Erlebnisse zeigen mir, dass ich die Sprache tatsächlich nutzen kann. Natürlich möchte ich meine Grammatik und Aussprache weiter verbessern. Trotzdem versuche ich, meinen Fortschritt nicht ständig mit dem anderer Menschen zu vergleichen. Jeder bringt andere Erfahrungen mit und hat unterschiedlich viel Zeit. Mein nächstes Ziel ist, in einer Besprechung meine Meinung klar zu erklären. Es ist ein kleines Ziel, aber für meinen Alltag ein bedeutender Schritt.', 
    focus = 'ch und spr; abschließende Gedanken', 
    level = 'B1.2', 
    is_active = true
WHERE id = '6e667abd-3011-597c-9cf9-0c20c2c30e2d';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Nur wer die Satzmelodie beherrscht, klingt wirklich idiomatisch.', 
    focus = 'ch, t', 
    level = NULL, 
    is_active = true
WHERE id = '6f6d08ed-0452-43e5-ba44-70c8cae98fb3';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Es ist bezeichnend, wie ein einziges Modalpartikel den ganzen Satz kippt.', 
    focus = 'ch, z', 
    level = NULL, 
    is_active = true
WHERE id = '6fd5a400-4689-440f-82e8-a01331a78333';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Eigentlich wollte ich widersprechen, aber mir fehlten die Worte.', 
    focus = 'ch, ei', 
    level = NULL, 
    is_active = true
WHERE id = '7021d6b9-68e5-497e-98f3-8dd9ac69125c';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Die These, dass Sprache unser Denken formt, ist keineswegs neu.', 
    focus = 's, z', 
    level = NULL, 
    is_active = true
WHERE id = '73751689-c009-44fa-8cf6-bc8760aecf5d';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Entschuldigung, wie spät ist es?', 
    focus = 'sch, ä', 
    level = NULL, 
    is_active = true
WHERE id = '7b9d9fa0-0e76-46cb-9edc-7bf2eed7883b';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Nach der Prüfung fühle ich mich erleichtert und müde.', 
    focus = 'ü, ch', 
    level = NULL, 
    is_active = true
WHERE id = '7c9935ff-5f52-447a-8c8b-648982ba9d31';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Am Wochenende besuche ich meine Eltern.', 
    focus = 'ch, wo', 
    level = NULL, 
    is_active = true
WHERE id = '7cc29196-7210-4e44-9795-4088bba53792';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Könntest du das Fenster zumachen?', 
    focus = 'ö, ch', 
    level = NULL, 
    is_active = true
WHERE id = '80027865-2bbb-42fb-bd1a-299a46010977';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Der Apfel ist süß und rot.', 
    focus = 'pf, ü', 
    level = NULL, 
    is_active = true
WHERE id = '85de1de0-96e6-4292-b442-0d0e7daa47bb';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Ich bin müde.', 
    focus = 'ü', 
    level = NULL, 
    is_active = true
WHERE id = '86e3f4b3-74b9-4fcd-8e88-b21b6e6a160f';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Lernen neben Beruf und Familie', 
    sentence_de = 'Seit drei Monaten besuche ich einen Abendkurs, obwohl mein Alltag mit Beruf und Familie bereits gut gefüllt ist. In den ersten Wochen wollte ich jeden freien Moment zum Lernen nutzen. Bald merkte ich jedoch, dass ich ständig müde war und mir wenig merken konnte. Gemeinsam mit meiner Familie habe ich deshalb feste Lernzeiten vereinbart. An zwei Abenden kümmert sich mein Partner um das Essen, damit ich konzentriert arbeiten kann. Dafür bleibt der Sonntag weitgehend frei. Mein Fortschritt ist vielleicht langsamer als geplant, aber die neue Routine lässt sich durchhalten. Ich habe verstanden, dass ein realistischer Plan langfristig hilfreicher ist als ein besonders ehrgeiziger Anfang.', 
    focus = 'l und er; Pausen bei Nebensätzen', 
    level = 'B1.2', 
    is_active = true
WHERE id = '876f98ba-930f-59f0-8b53-e7e09e235b6e';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Ein geübtes Ohr unterscheidet Ironie von bloßer Höflichkeit im Bruchteil einer Sekunde.', 
    focus = 'ü, ch', 
    level = NULL, 
    is_active = true
WHERE id = '88901db9-3fce-4f73-a8aa-0df591e33f41';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Mit Fehlern umgehen', 
    sentence_de = 'In meinem ersten Jahr in Deutschland wollte ich möglichst keine Fehler machen. Deshalb habe ich oft geschwiegen, obwohl ich etwas sagen konnte. Das änderte sich bei einem Gespräch mit einer Kollegin. Sie erzählte mir, wie unsicher sie selbst beim Lernen einer anderen Sprache war. Seitdem versuche ich, Fehler als Teil des Lernens zu betrachten. Wenn ich ein Wort falsch benutze, schreibe ich mir später ein Beispiel auf. Natürlich gibt es Situationen, in denen Genauigkeit wichtig ist. Im Alltag hilft es mir aber mehr, freundlich nachzufragen und weiterzusprechen. So werde ich langsam sicherer.', 
    focus = 'f und ä; Betonung von Schlüsselsätzen', 
    level = 'B1.1', 
    is_active = true
WHERE id = '8c963a66-e60b-5f88-bee3-73aa3f3e3df7';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Der neue Stundenplan', 
    sentence_de = 'Unser Deutschkurs hat ab Montag neue Zeiten. Wir lernen jetzt am Vormittag von neun bis zwölf Uhr. Am Dienstag üben wir besonders viel Sprechen. Am Donnerstag lesen wir kurze Texte. Die Lehrerin erklärt den Stundenplan langsam. Ich schreibe die Zeiten in meinen Kalender. Nach dem Kurs kann ich meine Tochter von der Schule abholen. Das passt gut für mich.', 
    focus = 'st und sp; Satzverbindungen', 
    level = 'A1.2', 
    is_active = true
WHERE id = '8cd6b9c9-8eaf-5a08-863b-27e712dbc484';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Manchmal fällt es mir schwer, ruhig zu bleiben.', 
    focus = 'ch, ei', 
    level = NULL, 
    is_active = true
WHERE id = '8cf5b45f-da02-4445-aa73-e05e7ec32d75';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Die Stadt aus einer anderen Perspektive', 
    sentence_de = 'Vor Kurzem habe ich einen Spaziergang mit einer Bekannten gemacht, die einen Rollstuhl benutzt. Wir wollten gemeinsam ein Café besuchen und danach in die Bibliothek gehen. Schon auf dem Weg fiel mir auf, wie viele kleine Hindernisse ich sonst übersehe: eine hohe Bordsteinkante, Fahrräder auf dem Gehweg und eine schwere Eingangstür. Meine Bekannte erklärte, welche Wege gut funktionieren und wo sie Hilfe braucht. Gleichzeitig wollte sie nicht, dass ich alles ungefragt für sie übernehme. Der Nachmittag hat meinen Blick auf die Stadt verändert. Seitdem achte ich stärker darauf, ob Orte wirklich für alle zugänglich sind. Gute Absichten helfen, aber Zuhören und konkrete Verbesserungen sind ebenso wichtig.', 
    focus = 'st und sp; flüssig erzählen', 
    level = 'B1.2', 
    is_active = true
WHERE id = '8cf76d58-8428-59ef-b449-4301051413ba';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Ein geübtes Ohr hört den Unterschied zwischen Distanz und Wärme.', 
    focus = 'ü, ä', 
    level = NULL, 
    is_active = true
WHERE id = '8d0a7989-8545-45e8-8426-10cae0616f37';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Ein Besuch im Schwimmbad', 
    sentence_de = 'Meine Tochter kann schon gut schwimmen. Am Sonntag gehen wir ins Schwimmbad. Ich packe zwei Handtücher und unsere Badesachen ein. An der Kasse kaufen wir zwei Karten. Das Wasser ist angenehm warm. Meine Tochter schwimmt, und ich übe mit ihr. Nach einer Stunde machen wir eine Pause. Wir haben Hunger und essen eine Banane.', 
    focus = 'schw und au; Satzmelodie', 
    level = 'A1.2', 
    is_active = true
WHERE id = '924ee488-8b97-5070-ba23-eea0f03992e6';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Homeoffice im Alltag', 
    sentence_de = 'An zwei Tagen in der Woche arbeite ich von zu Hause aus. Dadurch spare ich den Arbeitsweg und kann morgens ruhiger beginnen. Allerdings war es anfangs schwierig, nach Feierabend wirklich aufzuhören. Mein Laptop stand auf dem Küchentisch, und ich beantwortete noch spät Nachrichten. Inzwischen habe ich einen festen Arbeitsplatz und klare Arbeitszeiten. Nach der letzten Aufgabe schalte ich den Computer aus und gehe kurz spazieren. Diese kleine Gewohnheit hilft mir, Arbeit und Freizeit zu trennen. Den Kontakt zu meinen Kolleginnen und Kollegen möchte ich trotzdem nicht verlieren. Deshalb bin ich auch gern regelmäßig im Büro.', 
    focus = 'h und o; Vor- und Nachteile', 
    level = 'B1.1', 
    is_active = true
WHERE id = '92818a0b-1e3d-5f69-b023-f61637d49279';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Ich versuche, jeden Tag ein bisschen Deutsch zu sprechen.', 
    focus = 'ch, ü', 
    level = NULL, 
    is_active = true
WHERE id = '933fdedf-8855-48c8-8d51-5177f96dbbab';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Auf dem Wochenmarkt', 
    sentence_de = 'Am Mittwoch ist Markt auf dem großen Platz. Ich gehe mit meinem Korb dorthin. An einem Stand gibt es frische Äpfel und Birnen. Ich möchte ein Kilo Äpfel kaufen. Die Verkäuferin lässt mich einen Apfel probieren. Er schmeckt süß. Am nächsten Stand kaufe ich Kartoffeln. Zum Schluss hole ich Blumen für meine Küche.', 
    focus = 'ö und pf; Mengenangaben', 
    level = 'A1.2', 
    is_active = true
WHERE id = '93e4a1ed-cb70-5f0a-9dd2-cf6b2a9c9699';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Die feinen Registerwechsel zwischen Amtsdeutsch und Umgangssprache verlangen ein sicheres Gespür.', 
    focus = 'sch, ü', 
    level = NULL, 
    is_active = true
WHERE id = '94501aa9-eb33-41b6-a84c-077af097919c';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Die Küche ist hell und freundlich.', 
    focus = 'ü, ch', 
    level = NULL, 
    is_active = true
WHERE id = '94be2733-3f04-4b43-9479-46f60b4763ab';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Ein präziser Wortschatz ersetzt mitunter ganze Erklärungen.', 
    focus = 'z, ch', 
    level = NULL, 
    is_active = true
WHERE id = '9679e3bb-a8cb-438f-8873-9ce61fadd39a';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Zwischen Understatement und Übertreibung liegt die Kunst der Nuance.', 
    focus = 'ü, z', 
    level = NULL, 
    is_active = true
WHERE id = '97314796-6e24-4855-b7d9-fec2eebd7f54';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Es wäre wünschenswert, wenn wir uns auf einen Kompromiss einigen könnten.', 
    focus = 'ü, ss', 
    level = NULL, 
    is_active = true
WHERE id = '9921f077-c7df-4a2d-a021-d16e2028da5d';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Ein Tag ohne Handy', 
    sentence_de = 'Am Sonntag habe ich mein Handy zu Hause vergessen. Zuerst war ich unruhig, weil ich meine Nachrichten nicht lesen konnte. Im Park habe ich mich dann auf eine Bank gesetzt und die Menschen beobachtet. Später habe ich in einem Café eine Zeitung gelesen. Ohne Handy hatte ich viel mehr Zeit. Am Abend habe ich meine Nachrichten beantwortet. Es war nichts Dringendes dabei. Vielleicht lasse ich mein Handy am nächsten Sonntag wieder zu Hause.', 
    focus = 'a und ei; deutliche Satzenden', 
    level = 'A2.1', 
    is_active = true
WHERE id = '99feaf25-8ae7-58f7-a492-e2aa4a501707';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Wie geht es Ihnen?', 
    focus = 'ie, ch', 
    level = NULL, 
    is_active = true
WHERE id = '9fc60ff9-7ecd-4ac8-9c9a-a47cebf76623';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Ich heiße Jürgen.', 
    focus = 'ü, ei', 
    level = NULL, 
    is_active = true
WHERE id = 'a0abb7f8-5856-4528-95bc-594963b7a3c6';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Mein Zimmer', 
    sentence_de = 'Mein Zimmer ist nicht groß, aber schön. Links steht mein Bett. Am Fenster steht ein Tisch. Auf dem Tisch liegt mein Deutschbuch. Der Stuhl ist blau. Ich lese hier gern. Am Abend mache ich die Lampe an und lerne neue Wörter.', 
    focus = 'z und sch; Wortbetonung', 
    level = 'A1.1', 
    is_active = true
WHERE id = 'a218b88e-9369-5472-b5fe-34c99d1ced76';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = NULL, 
    sentence_de = 'Ich kaufe Brot, Milch und Äpfel.', 
    focus = 'ä, pf', 
    level = NULL, 
    is_active = true
WHERE id = 'a21abf03-660b-4c3f-8df2-55ef32cd1b70';


UPDATE public.pronunciation_prompts 
SET lesson = 'Lektion 1', 
    title = 'Eine faire Aufgabenverteilung', 
    sentence_de = 'In unserer Wohngemeinschaft gab es immer wieder Streit über die Hausarbeit. Einige putzten häufig, andere bemerkten den Schmutz angeblich gar nicht. Irgendwann setzten wir uns zusammen, statt nur kurze Nachrichten in die Gruppe zu schreiben. Jeder erklärte, welche Aufgaben er übernehmen konnte und was ihn störte. Wir erstellten einen einfachen Plan, der jede Woche wechselt. Außerdem vereinbarten wir, rechtzeitig Bescheid zu geben, wenn jemand keine Zeit hat. Seitdem ist nicht alles perfekt, aber die Stimmung ist besser. Besonders geholfen hat uns, einander zuzuhören und konkrete Absprachen zu treffen.', 
    focus = 'f und t; Gegensätze und Lösungen', 
    level = 'B1.1', 
    is_active = true
WHERE id = 'a32ba623-4578-55b4-9b44-b717c857a46c';

COMMIT;