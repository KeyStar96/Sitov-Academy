import 'server-only'
import scenarios from '@/content/exam-simulation/sitov-scenarios.json'
import upperReading from '@/content/exam-simulation/sitov-upper-reading.json'
import longReading from '@/content/exam-simulation/sitov-universal-long-reading.json'
import lowerLanguage from '@/content/exam-simulation/sitov-lower-language.json'
import clozeItems from '@/content/exam-simulation/sitov-language-cloze.json'
import b2Coherence from '@/content/exam-simulation/sitov-b2-coherence.json'
import upperCoherence from '@/content/exam-simulation/sitov-upper-coherence.json'
import { EXAM_TASKS } from '@/lib/exam-preparation/content'
import audioManifest from '@/scripts/sitov-exam-audio-manifest.json'
import universalAudioManifest from '@/content/exam-simulation/sitov-universal-audio-manifest.json'
import listeningSets from '@/content/exam-simulation/sitov-universal-listening.json'
import { SIMULATION_LEVELS } from './catalogue'
import { sitovSceneImage } from './scenes'
import type { SimulationLevel, SimulationTask } from './types'

export interface ServerSimulationTask extends SimulationTask {
  scenarioId: string
  /** Semantic story anchors remain private and prevent printed answers leaking into hearing. */
  sourceScenarioIds?: string[]
  correctAnswer?: string | string[]
  explanation: string
  evidence?: string
  provenance: string
  /** Never included in the client payload, including after completion. */
  audioSource?: { id: string; script: string; plays: number }
}
export const SIMULATION_CONTENT_VERSION = 1
export const SIMULATION_LEGACY_AUDIO_SOURCES = Object.entries(audioManifest).map(([id, script]) => ({ id, script, level: 'B1' as const }))
export const SIMULATION_AUDIO_SOURCES = listeningSets.map(source => ({ id: source.id, script: universalAudioManifest[source.id as keyof typeof universalAudioManifest], level: source.level as SimulationLevel }))
const provenance = 'Eigene universelle Prüfung von Sitov Academy; keine institutsgebundene Originalprüfung.'
const minWords: Record<SimulationLevel, string> = { A1: 'etwa 30 Wörter', A2: 'etwa 50–70 Wörter', B1: 'etwa 80–100 Wörter', B2: 'etwa 130–160 Wörter', C1: 'etwa 180–220 Wörter', C2: 'etwa 230–280 Wörter' }
const productiveCriteria: Record<SimulationLevel, string[]> = {
  A1: ['Die genannten Inhaltspunkte verständlich nennen', 'Einfache passende Wörter verwenden', 'Kurze Sätze und eine passende Anrede bilden'],
  A2: ['Alle Inhaltspunkte behandeln', 'Einfache Sätze sinnvoll verbinden', 'Häufige Wörter und Formen überwiegend richtig verwenden'],
  B1: ['Alle Inhaltspunkte verständlich und zusammenhängend behandeln', 'Anrede und Ausdruck an den Empfänger anpassen', 'Gründe, Beispiele und passende Verknüpfungen verwenden', 'Wortschatz und grammatische Formen überwiegend sicher einsetzen'],
  B2: ['Inhaltspunkte klar und ausreichend ausführlich behandeln', 'Standpunkte begründen und Vor- sowie Nachteile abwägen', 'Text oder Beitrag logisch strukturieren und adressatengerecht formulieren', 'Abwechslungsreichen Wortschatz und komplexe Sätze sicher einsetzen'],
  C1: ['Das Anliegen präzise und differenziert bearbeiten', 'Argumente gewichten und Einwände nachvollziehbar berücksichtigen', 'Register, Kohärenz und sprachliche Mittel sicher steuern', 'Auch komplexe Zusammenhänge mit hoher sprachlicher Genauigkeit darstellen'],
  C2: ['Implizite Annahmen und konkurrierende Perspektiven differenziert aufgreifen', 'Eine überzeugende eigenständige Argumentationslinie entwickeln', 'Feine Bedeutungs- und Registerunterschiede gezielt einsetzen', 'Komplexe Inhalte nahezu durchgängig idiomatisch und präzise ausdrücken'],
}
const dialogueCriteria = [
  'Beide Gesprächspartner müssen in der Aufnahme hörbar sein.',
  'Mindestens zwei Rückfragen verständlich beantworten.',
  'Auf Vorschläge reagieren und bei Planungsaufgaben gemeinsam entscheiden.',
  'Schriftliche Notizen oder ein allein gesprochener Text ersetzen keine echte Gesprächsaufnahme.',
  'Verständlich sprechen und den Beitrag flüssig gestalten.',
]
function speakingCriteria(level: SimulationLevel, extra: string[] = []): string[] {
  return [...productiveCriteria[level], ...extra, ...dialogueCriteria]
}
function base(level: SimulationLevel, scenarioId: string, family: string, skill: SimulationTask['skill']): Omit<ServerSimulationTask, 'type' | 'title' | 'instruction'> {
  return { id: `sitov-simulation-${level.toLowerCase()}-${scenarioId}-${family}`, version: 1, level, skill, family, scenarioId, sourceScenarioIds: [scenarioId], maxPoints: 1, minutes: 2, explanation: '', provenance }
}
function choice(level: SimulationLevel, scenario: (typeof scenarios)[number], family: string, title: string, instruction: string, text: string, correct: string, wrong: string[], evidence = text): ServerSimulationTask {
  return { ...base(level, scenario.id, family, 'reading'), type: 'choice', title, instruction, text, options: [{ id: 'a', text: correct }, ...wrong.map((value, index) => ({ id: String.fromCharCode(98 + index), text: value }))], correctAnswer: 'a', explanation: `Die passende Aussage ist: ${correct}`, evidence }
}
const authored: ServerSimulationTask[] = SIMULATION_LEVELS.flatMap(level => scenarios.flatMap(scenario => {
  const long = level === 'C1' || level === 'C2' ? longReading[scenario.id as keyof typeof longReading][level] : undefined
  const lower = level === 'A1' || level === 'A2' ? lowerLanguage[scenario.id as keyof typeof lowerLanguage] : undefined
  const text = long?.text ?? scenario.texts[level]
  const upper = level === 'C1' || level === 'C2' ? upperReading[scenario.id as keyof typeof upperReading] : undefined
  const scenarioIndex = scenarios.findIndex(item => item.id === scenario.id)
  const matchedScenarios = [0, 1, 2].map(offset => scenarios[(scenarioIndex + offset) % scenarios.length])
  const matching: ServerSimulationTask = {
    ...base(level, scenario.id, 'reading-selective', 'reading'),
    id: `sitov-simulation-${level.toLowerCase()}-${scenario.id}-matching-specific`,
    type: 'matching', title: 'Angebote zuordnen',
    instruction: level === 'A1' ? 'Lesen Sie die drei Situationen. Welches Angebot passt? Wählen Sie für jede Person ein Angebot.' : 'Ordnen Sie jeder Situation das passende Angebot zu. Zwei Angebote passen nicht. Jedes Angebot darf nur einmal verwendet werden.',
    prompts: matchedScenarios.map((item, index) => ({ id: `sitov-person-${index + 1}`, text: lower ? lowerLanguage[item.id as keyof typeof lowerLanguage].need : upper ? upperReading[item.id as keyof typeof upperReading].need : item.need })),
    options: [
      ...matchedScenarios.map((item, index) => ({ id: String.fromCharCode(97 + index), text: lower ? lowerLanguage[item.id as keyof typeof lowerLanguage].offer : upper ? upperReading[item.id as keyof typeof upperReading].offer : item.offer })),
      { id: 'd', text: lower?.badOffers[0] ?? (upper ? upper.badOffers[0] : scenario.badOffers[0]) },
      { id: 'e', text: lower?.badOffers[1] ?? (upper ? upper.badOffers[1] : scenario.badOffers[1]) },
    ],
    correctAnswer: ['a', 'b', 'c'], maxPoints: 3, minutes: 4,
    sourceScenarioIds: matchedScenarios.map(item => item.id),
    explanation: 'Für jede Situation muss das Angebot alle genannten Anforderungen erfüllen. Ein einzelnes passendes Stichwort genügt nicht.',
    evidence: matchedScenarios.map(item => upper ? upperReading[item.id as keyof typeof upperReading].need : item.need).join('\n'),
  }
  const parts: ServerSimulationTask[] = [
    choice(level, scenario, 'reading-global', 'Das Thema verstehen', lower ? 'Worum geht es im Text?' : 'Welche Überschrift passt am besten zum ganzen Text?', text, lower?.global ?? long?.heading ?? upper?.heading ?? scenario.global, lower?.globalWrong ?? long?.headingWrong ?? scenario.globalWrong),
    choice(level, scenario, 'reading-detail', upper ? 'Eine Schlussfolgerung beurteilen' : 'Eine wichtige Einzelheit', long?.question ?? upper?.question ?? (lower ? `Was ist richtig?` : `Welche Aussage über ${scenario.person} ist richtig?`), text, lower?.correct ?? long?.correct ?? upper?.correct ?? scenario.correct, lower?.wrong ?? long?.wrong ?? upper?.wrong ?? scenario.wrong),
    matching,
    choice(level, scenario, 'reading-instructions', upper ? 'Reichweite einer Regel verstehen' : 'Eine Regel anwenden', upper?.noticeQuestion ?? (lower ? 'Was sollen Sie machen?' : 'Was ist nach dem Hinweis richtig?'), lower?.notice ?? upper?.notice ?? scenario.notice, lower?.ruleCorrect ?? upper?.noticeCorrect ?? scenario.ruleCorrect, lower?.ruleWrong ?? upper?.noticeWrong ?? scenario.ruleWrong, lower?.notice ?? upper?.notice ?? scenario.notice),
    choice(level, scenario, 'reading-opinion', upper ? 'Eine Argumentation verstehen' : 'Eine Meinung verstehen', upper?.question ?? 'Welche Aussage gibt den Standpunkt richtig wieder?', upper ? text : scenario.opinion, upper?.correct ?? scenario.opinionCorrect, upper?.wrong ?? scenario.opinionWrong, upper ? text : scenario.opinion),
  ]
  if (scenarioIndex % 2 === 1) {
    const ruleTask = parts.find(task => task.family === 'reading-instructions')!
    const statementTrue = scenarioIndex % 4 === 1
    const statement = ruleTask.options![statementTrue ? 0 : 1].text
    ruleTask.type = 'true-false'
    ruleTask.instruction = lower ? 'Lesen Sie den Hinweis und die Aussage. Ist die Aussage richtig oder falsch?' : 'Beurteilen Sie, ob die folgende Aussage nach dem Hinweis richtig oder falsch ist.'
    ruleTask.text = `${ruleTask.text}\n\nAussage: ${statement}`
    ruleTask.correctAnswer = statementTrue ? 'true' : 'false'
    ruleTask.options = undefined
    ruleTask.explanation = `${statementTrue ? 'Die Aussage stimmt.' : 'Die Aussage stimmt nicht.'} ${lower?.ruleCorrect ?? upper?.noticeCorrect ?? scenario.ruleCorrect}`
  }
  // Productive tasks complement the level-specific reading and language sources.
  for (const [family, title, instruction] of [
    ['writing-personal', 'Eine persönliche Nachricht', lower?.personal ?? scenario.personal],
    ['writing-formal', 'Eine formelle Nachricht', lower?.formal ?? scenario.formal],
    ['writing-opinion', 'Einen Standpunkt begründen', scenario.debate],
  ]) parts.push({ ...base(level, scenario.id, family, 'writing'), type: 'writing', title, instruction: `${instruction}\nSchreiben Sie ${minWords[level]}. ${level === 'C1' || level === 'C2' ? 'Unterscheiden Sie die Perspektiven und wägen Sie Ihre Argumente sorgfältig ab.' : 'Beachten Sie alle genannten Punkte.'}`, criteria: productiveCriteria[level], maxPoints: 20, minutes: level === 'A1' ? 5 : level === 'A2' ? 7 : 10, explanation: 'Die Lehrkraft bewertet Inhalt, Zusammenhang, angemessenen Ausdruck und sprachliche Genauigkeit. Eine Wortzahl allein beweist keine ausreichende Leistung.' })
  for (const [family, title, instruction] of [
    ['speaking-introduction', 'Sich vorstellen', `Stellen Sie sich vor. Nennen Sie Ihren Alltag, Ihre Interessen und Ihre Erfahrungen zum Thema ${scenario.topic}.`],
    ['speaking-experience', 'Über Erfahrungen sprechen', `Beschreiben Sie das Bild. Sprechen Sie über Ihre Erfahrungen zum Thema ${scenario.topic} und vergleichen Sie verschiedene Möglichkeiten.`],
    ['speaking-presentation', 'Ein Thema vorstellen', `Stellen Sie das Thema ${scenario.topic} vor. Berichten Sie von Erfahrungen, nennen Sie Vor- und Nachteile und erläutern Sie Ihre Meinung.`],
    ['speaking-opinion', 'Ein Thema besprechen', scenario.debate],
    ['speaking-planning', 'Gemeinsam planen', scenario.planning],
  ]) {
    const simpleInstruction = lower && family === 'speaking-introduction'
      ? `Stellen Sie sich vor. Sagen Sie Ihren Namen, Ihren Wohnort und Ihre Interessen. Sprechen Sie kurz über ${scenario.topic}.`
      : lower && family === 'speaking-planning'
        ? `Planen Sie zusammen etwas zum Thema ${scenario.topic}. Sagen Sie wann und wo. Sprechen Sie darüber, wer was mitbringt, und finden Sie zusammen eine Lösung.` : instruction
    parts.push({ ...base(level, scenario.id, family, 'speaking'), type: 'speaking', title, instruction: simpleInstruction, criteria: speakingCriteria(level), interactionRequired: true, ...(family === 'speaking-experience' ? { image: sitovSceneImage(scenario.topic, scenarioIndex) } : {}), maxPoints: 20, minutes: 3, explanation: 'Für diese Aufgabe sind eine Aufnahme mit tatsächlichem Gespräch und die Bewertung durch die Lehrkraft erforderlich. Rückfragen, Aussprache und Gesprächsführung werden nicht aus einem getippten Text bewertet.' })
  }
  return parts
}))

/** Each level has its own grammar, rather than relabelled B1 items. */
const languageItems: Record<SimulationLevel, [string, string, string, string, string][]> = {
  A1: [
    ['Ben ___ aus Hamburg.', 'kommt', 'kommen', 'kommst', 'Bei er steht das Verb in der dritten Person Singular.'],
    ['Amir hat ___ Bruder.', 'einen', 'ein', 'eine', 'Bruder ist maskulin; nach haben steht der Akkusativ.'],
    ['Wir ___ Deutsch.', 'lernen', 'lernt', 'lerne', 'Bei wir endet das Verb hier auf -en.'],
    ['Der Kurs beginnt ___ Montag.', 'am', 'im', 'um', 'Für einen Wochentag verwendet man am.'],
    ['Leon fährt ___ dem Bus.', 'mit', 'für', 'ohne', 'Mit beschreibt das Verkehrsmittel und verlangt den Dativ.'],
    ['Paul wohnt ___ Berlin.', 'in', 'am', 'zum', 'Bei Städten steht hier in ohne Artikel.'],
    ['___ heißt du?', 'Wie', 'Wo', 'Wann', 'Nach dem Namen fragt man mit Wie heißt du?.'],
    ['Das ___ mein Buch.', 'ist', 'sind', 'sein', 'Das Subjekt das steht im Singular.'],
    ['Ich habe ___ Zeit.', 'keine', 'kein', 'keinen', 'Zeit ist feminin; der verneinte unbestimmte Artikel lautet keine.'],
    ['Nils steht ___ sieben Uhr auf.', 'um', 'am', 'im', 'Vor einer Uhrzeit steht um.'],
    ['Ihr ___ am Samstag.', 'arbeitet', 'arbeiten', 'arbeitest', 'Die Form für ihr lautet arbeitet.'],
    ['Omar ___ ein Ticket kaufen.', 'möchte', 'möchtest', 'möchten', 'Omar ist dritte Person Singular.'],
  ],
  A2: [
    ['Ben bleibt zu Hause, weil er krank ___.', 'ist', 'sein', 'hat', 'Im weil-Satz steht das konjugierte Verb am Ende.'],
    ['Gestern ___ Amir eine Wohnung besichtigt.', 'hat', 'ist', 'wird', 'Besichtigen bildet das Perfekt mit haben.'],
    ['Leon fährt mit ___ Zug.', 'dem', 'den', 'der', 'Mit verlangt den Dativ; Zug ist maskulin.'],
    ['Paul hat ___ Freund angerufen.', 'seinen', 'sein', 'seinem', 'Anrufen verlangt den Akkusativ.'],
    ['Erik läuft schneller ___ Ben.', 'als', 'wie', 'wenn', 'Nach einem Komparativ steht beim Vergleich als.'],
    ['Omar ___ gestern keine Zeit.', 'hatte', 'hätte', 'hattest', 'Das Präteritum von haben bei er lautet hatte.'],
    ['Bitte ___ das Fenster!', 'öffne', 'öffnetest', 'öffnest', 'Der Imperativ für du lautet hier öffne.'],
    ['Daniel wartet ___ den Bus.', 'auf', 'mit', 'aus', 'Die feste Verbindung lautet auf etwas warten.'],
    ['Wenn es regnet, ___ wir drinnen.', 'bleiben', 'bleibt', 'geblieben', 'Das Subjekt wir verlangt bleiben.'],
    ['Karim muss heute länger ___.', 'arbeiten', 'arbeitet', 'gearbeitet', 'Nach müssen steht der Infinitiv ohne zu.'],
    ['Timo interessiert sich ___ Musik.', 'für', 'an', 'über', 'Die feste Verbindung lautet sich für etwas interessieren.'],
    ['Felix hat das Buch schon ___.', 'gelesen', 'lesen', 'las', 'Im Perfekt verwendet man das Partizip gelesen.'],
  ],
  B1: [
    ['Ben fährt mit dem Ersatzrad, ___ sein eigenes repariert wird.', 'während', 'trotzdem', 'deshalb', 'Während leitet hier einen zeitlichen Nebensatz ein.'],
    ['Amir fragt, ___ die Heizkosten in der Miete enthalten sind.', 'ob', 'dass', 'denn', 'Eine indirekte Entscheidungsfrage beginnt mit ob.'],
    ['Leon gibt das Buch zurück, ___ er noch nicht fertig ist.', 'obwohl', 'deswegen', 'damit', 'Obwohl drückt einen Gegensatz zur erwarteten Folge aus.'],
    ['Yusuf tauscht die Schicht, ___ seinen Termin wahrnehmen zu können.', 'um', 'ohne', 'statt', 'Um ... zu nennt hier den Zweck.'],
    ['Paul nimmt den Zug, ___ um 10.20 Uhr abfährt.', 'der', 'den', 'dem', 'Das Relativpronomen ist Subjekt und bezieht sich auf den maskulinen Zug.'],
    ['Erik meldet sich an, ___ der Verein die Plätze planen kann.', 'damit', 'weil', 'obwohl', 'Damit nennt den Zweck mit einem anderen Subjekt.'],
    ['Omar hilft beim Fest. ___ übernimmt ein anderer Teilnehmer.', 'Danach', 'Während', 'Weil', 'Danach verbindet zwei aufeinanderfolgende Handlungen.'],
    ['Daniel hat vergessen, den Antrag ___.', 'zu unterschreiben', 'unterschreiben', 'unterschrieben', 'Nach vergessen folgt hier ein Infinitiv mit zu.'],
    ['Karim ___ den Kundenservice kontaktieren, bevor er das Paket versendet.', 'sollte', 'würde', 'wäre', 'Sollte drückt hier einen Rat zum vorgesehenen Vorgehen aus.'],
    ['Nils stellt Wasser bereit. Es wird ___ drei Stunden abgestellt.', 'für', 'seit', 'vor', 'Für bezeichnet die vorgesehene Dauer.'],
    ['Je früher Felix absagt, ___ besser können die anderen planen.', 'desto', 'so', 'wie', 'Die zweiteilige Verbindung lautet je ... desto.'],
    ['Timo freut sich ___ die Führung am Sonntag.', 'auf', 'über', 'an', 'Sich auf etwas freuen bezieht sich auf ein zukünftiges Ereignis.'],
  ],
  B2: [
    ['Die Werkstatt nennt einen Termin, ___ das Ersatzteil noch nicht verfügbar ist.', 'obwohl', 'sofern', 'indem', 'Obwohl markiert einen Gegensatz zwischen Zusage und Verfügbarkeit.'],
    ['Amir sagt nur zu, ___ die Nebenkosten eindeutig geklärt sind.', 'sofern', 'wohingegen', 'sodass', 'Sofern nennt die Bedingung für seine Zusage.'],
    ['Leon nutzt die digitale Ausgabe, ___ auf die Rückgabe zu verzichten.', 'ohne', 'anstatt', 'um', 'Ohne ... zu sagt, dass die genannte Begleithandlung nicht erfolgt.'],
    ['Die Änderung muss ___ Beginn der Schicht dokumentiert sein.', 'vor', 'seit', 'während', 'Die Dokumentation muss zeitlich vor dem Beginn liegen.'],
    ['Das Ticket bleibt gültig, ___ die Reservierung nicht übertragen wird.', 'während', 'sobald', 'damit', 'Während wird hier gegenüberstellend verwendet.'],
    ['Die Probestunde dient ___, den Kurs kennenzulernen.', 'dazu', 'darauf', 'dafür', 'Die Verbindung lautet dazu dienen, etwas zu tun.'],
    ['Die klare Ablösung trägt dazu bei, Überforderung ___.', 'zu vermeiden', 'vermeiden', 'vermieden', 'Beitragen zu wird hier durch einen Infinitivsatz mit zu ergänzt.'],
    ['Die Bestätigung ersetzt den Antrag ___.', 'keineswegs', 'jedenfalls', 'dennoch', 'Keineswegs verneint die behauptete Ersatzfunktion deutlich.'],
    ['Die Zuordnung gelingt, ___ die Bestellnummer angegeben wird.', 'indem', 'trotzdem', 'ob', 'Indem beschreibt das Mittel, mit dem die Zuordnung gelingt.'],
    ['___ der Reparatur bleibt die Wohnung zugänglich.', 'Während', 'Wegen', 'Statt', 'Während nennt den Zeitraum, in dem der Zugang bestehen bleibt.'],
    ['Felix legt Wert ___ eine gerechte Aufgabenverteilung.', 'auf', 'an', 'für', 'Die feste Verbindung lautet Wert auf etwas legen.'],
    ['Das Eintrittsticket berechtigt nicht ___ Teilnahme an der Führung.', 'zur', 'für die', 'an der', 'Die feste Verbindung lautet zu etwas berechtigen.'],
  ],
  C1: [
    ['Die Zusage erfolgte, ___ die Lieferfähigkeit bereits festgestanden hätte.', 'ohne dass', 'als ob', 'zumal', 'Ohne dass nennt hier einen fehlenden Begleitumstand.'],
    ['Amir verlangt Transparenz, ___ die Lage seine Erwartungen erfüllt.', 'auch wenn', 'sodass', 'insofern als', 'Auch wenn signalisiert, dass der positive Umstand seine Forderung nicht aufhebt.'],
    ['Die Rückgabepflicht besteht fort, ___ eine digitale Ausgabe genutzt wird.', 'selbst wenn', 'damit', 'bevor', 'Selbst wenn macht deutlich, dass die Bedingung an der Pflicht nichts ändert.'],
    ['Der Tausch ist verbindlich, ___ er genehmigt und dokumentiert ist.', 'vorausgesetzt, dass', 'anstatt dass', 'wenngleich', 'Vorausgesetzt, dass formuliert eine notwendige Bedingung.'],
    ['Die Ticketgültigkeit erlaubt keine Aussage ___ eine garantierte Sitzgelegenheit.', 'über', 'für', 'gegen', 'Eine Aussage über etwas bezieht sich auf deren Gegenstand.'],
    ['Die Anmeldung ist organisatorisch verbindlich, ___ sie eine Kursbuchung darstellt.', 'ohne dass', 'zumal', 'sodass', 'Ohne dass schließt den weitergehenden Schluss aus.'],
    ['Die Einsatzplanung berücksichtigt private Verpflichtungen, ___ sie diese ignoriert.', 'anstatt dass', 'indem', 'sobald', 'Anstatt dass stellt die gewählte Vorgehensweise einer verworfenen gegenüber.'],
    ['Der digitale Zugang wird nicht ___ vollständigen Digitalisierung gleichgesetzt.', 'mit einer', 'für eine', 'von einer', 'Die feste Verbindung lautet etwas mit etwas gleichsetzen.'],
    ['Die Wartezeit ist vertretbar, ___ sie die spätere Zuordnung erleichtert.', 'insofern als', 'selbst wenn', 'sodass', 'Insofern als begrenzt die Begründung auf den genannten Zusammenhang.'],
    ['Ein neuer Aushang soll ___, falls die Arbeiten länger dauern.', 'angebracht werden', 'anbringen werden', 'angebracht haben', 'Das Passiv mit Modalverb lautet angebracht werden.'],
    ['Die Verteilung verhindert, dass die Vorbereitung einem Einzelnen ___.', 'aufgebürdet wird', 'aufgebürdet hat', 'aufbürden werden', 'Die unpersönliche Belastung wird im Vorgangspassiv ausgedrückt.'],
    ['Die Regel ist nicht pauschal, ___ auf bestimmte Nutzungsformen bezogen.', 'sondern', 'denn', 'trotzdem', 'Nicht ... sondern korrigiert die zuerst verneinte Einordnung.'],
  ],
  C2: [
    ['Die Zwischenlösung mildert die Folgen, ___ die Fehleinschätzung aufzuheben.', 'ohne indes', 'um folglich', 'anstatt deshalb', 'Ohne indes hebt eine Grenze der Wirkung hervor.'],
    ['Die günstige Lage darf die Kostenfrage nicht ___.', 'in den Hintergrund drängen', 'auf den Weg bringen', 'zur Sprache kommen', 'In den Hintergrund drängen bedeutet hier, die Bedeutung einer Frage zu verringern.'],
    ['Die Regel wird durch ein Angebot ergänzt, nicht ___.', 'außer Kraft gesetzt', 'in Betracht gezogen', 'in Anspruch genommen', 'Außer Kraft setzen würde die Regel unwirksam machen.'],
    ['Die Absicherung verhindert, dass aus Flexibilität Unklarheit ___.', 'erwächst', 'wächstet', 'erwachsen hat', 'Erwachsen aus beschreibt das Entstehen einer Folge.'],
    ['Aus der Ticketgültigkeit ___ keine Platzgarantie ableiten.', 'lässt sich', 'hat sich', 'wird sich', 'Lässt sich ableiten ist die modale Passiversatzform.'],
    ['Der Anmeldung kommt eine andere Funktion ___ als der Buchung.', 'zu', 'an', 'vor', 'Einer Sache kommt eine Funktion zu bedeutet, dass sie diese Funktion besitzt.'],
    ['Die Bereitschaft zu helfen darf nicht über Gebühr ___ werden.', 'beansprucht', 'veranlasst', 'zustande', 'Beanspruchen bezeichnet hier das Nutzen oder Fordern von Hilfsbereitschaft.'],
    ['Der Zugang legt Erwartungen nahe, ___ er sie erfüllt.', 'ohne dass', 'zumal', 'dadurch dass', 'Ohne dass unterscheidet geweckte Erwartung und tatsächliche Erfüllung.'],
    ['Das Vorgehen ist nur wirksam, ___ es in den Prozess eingebunden ist.', 'insoweit als', 'währenddessen', 'ungeachtet', 'Insoweit als begrenzt die Wirksamkeit auf die genannte Voraussetzung.'],
    ['Die Zeitangabe wird damit nicht beliebig ___.', 'relativiert', 'konkret', 'entsprechen', 'Relativieren bezeichnet das Einschränken der Geltung einer Aussage.'],
    ['Gemeinsames Lernen setzt mehr voraus als bloßes ___.', 'Nebeneinanderarbeiten', 'nebeneinander gearbeitet', 'nebeneinander zu arbeiten', 'Nach bloßes wird hier ein substantivierter Ausdruck benötigt.'],
    ['Zusätzliche Berechtigungen lassen sich aus dem Eintritt allein nicht ___.', 'herleiten', 'beilegen', 'verlauten', 'Herleiten bedeutet einen Schluss aus einer Grundlage ziehen.'],
  ],
}

/** Explicit discourse context makes semantically different but grammatical distractors unambiguous. */
const languageContexts: Partial<Record<SimulationLevel, string[]>> = {
  B1: [
    'Beide Vorgänge geschehen zur selben Zeit: Die Reparatur läuft, und Ben benutzt das Ersatzrad.',
    'Amir kennt die Antwort noch nicht und stellt eine Frage, die mit Ja oder Nein beantwortet werden kann.',
    'Leon ist noch nicht fertig. Trotzdem hält er die Rückgabefrist ein.',
    'Yusuf verfolgt mit dem Tausch ausdrücklich das Ziel, seinen Termin wahrzunehmen.',
    'Der Zug selbst fährt um 10.20 Uhr ab. Ergänzen Sie einen Relativsatz über diesen Zug.',
    'Die Anmeldung verfolgt das Ziel, dem Verein die Platzplanung zu ermöglichen.',
    'Erst endet Omars Einsatz, anschließend übernimmt ein anderer Teilnehmer.',
    'Daniel bemerkt zu spät, dass auf dem Antrag seine Unterschrift fehlt.',
    'Ein Freund gibt Karim einen Rat zum vorgesehenen Vorgehen; er beschreibt keine hypothetische eigene Handlung.',
    'Die Unterbrechung ist auf eine künftige Dauer von drei Stunden begrenzt.',
    'Eine frühere Absage verbessert die Planungsmöglichkeiten. Ergänzen Sie den proportionalen Vergleich.',
    'Die Führung findet erst kommenden Sonntag statt. Timo empfindet Vorfreude auf dieses Ereignis.',
  ],
  B2: [
    'Die Werkstatt sagt bereits einen Termin zu. Das fehlende Teil steht dieser Zusage entgegen; keine Bedingung der Zusage wird formuliert.',
    'Amir macht seine Zusage von einer notwendigen Voraussetzung abhängig: Erst muss die Kostenfrage geklärt sein.',
    'Leon liest digital weiter und gibt das gedruckte Buch gleichzeitig zurück. Beschrieben wird ein nicht eintretender Begleitumstand, kein Austausch alternativer Handlungen.',
    'Die Dokumentation muss abgeschlossen sein, wenn die Schicht anfängt.',
    'Ticket und Reservierung werden gegenübergestellt: Das eine gilt weiterhin, das andere wird nicht übertragen.',
    'Die Probestunde erfüllt den Zweck, Interessenten den Kurs kennenzulernen zu ermöglichen.',
    'Das Ziel der Ablösung ist, dass niemand zu lange belastet wird.',
    'Die Bestätigung hat ausdrücklich keinerlei Ersatzfunktion für die erforderlichen Unterlagen.',
    'Die Bestellnummer ist das Mittel, mit dem die Sendung zugeordnet werden kann.',
    'Für den gesamten Zeitraum der Arbeiten gilt weiterhin freier Wohnungszugang.',
    'Felix betrachtet eine gerechte Verteilung als wichtiges Qualitätsmerkmal.',
    'Die Führung ist eine gesonderte Leistung. Ergänzen Sie die feste Verbindung berechtigen und Teilnahme.',
  ],
  C1: [
    'Bei der Zusage war die Verfügbarkeit tatsächlich noch ungeprüft. Der Satz verneint diesen Begleitumstand, statt einen fiktiven Vergleich zu formulieren.',
    'Die Lage passt. Dieser Vorteil hebt Amirs Forderung nach Transparenz jedoch nicht auf.',
    'Auch eine digitale Ausleihe ändert an der Rückgabepflicht nichts; der Satz soll diese mögliche Bedingung ausdrücklich einschließen.',
    'Genehmigung und Dokumentation sind notwendige Voraussetzungen der Verbindlichkeit.',
    'Gegenstand der nicht zulässigen Schlussfolgerung ist die garantierte Sitzgelegenheit.',
    'Die einzelne Probestunde wird organisiert, aber ausdrücklich kein längerfristiger Vertrag abgeschlossen.',
    'Die Planung berücksichtigt andere Verpflichtungen. Die gegenteilige Vorgehensweise wird als verworfene Alternative genannt.',
    'Digitaler Zugang und vollständige Digitalisierung dürfen nicht als dasselbe angesehen werden.',
    'Die Rechtfertigung der Wartezeit ist auf ihren Nutzen für die spätere Zuordnung beschränkt; eine andere Begründung wird nicht behauptet.',
    'Nicht der Aushang handelt selbst: Der Hausmeister bringt ihn an. Gesucht ist die passive Darstellung dieser geplanten Handlung.',
    'Die Vorbereitung soll nicht als einseitige Last bei einem Teilnehmer liegen.',
    'Die erste Einordnung wird verneint und durch eine genauere Einordnung ersetzt.',
  ],
  C2: [
    'Die Maßnahme mildert den Schaden. Gleichzeitig bleibt die ursprüngliche Fehleinschätzung bestehen; sie soll durch die Maßnahme ausdrücklich nicht aufgehoben werden.',
    'Amir will vermeiden, dass die Kostenfrage gegenüber dem Lagevorteil an Bedeutung verliert.',
    'Die Bibliotheksregel bleibt wirksam und wird weiterhin angewandt. Verneint wird ausschließlich ihre Aufhebung durch das zusätzliche Angebot.',
    'Aus einer ungesicherten flexiblen Absprache könnte Unklarheit entstehen.',
    'Der Text verneint die Möglichkeit, aus Ticketgültigkeit eine Platzgarantie zu folgern.',
    'Die Anmeldung besitzt eine bestimmte Funktion, die sich von der Funktion der Buchung unterscheidet.',
    'Die Hilfe soll nicht übermäßig in Anspruch genommen werden.',
    'Die Erwartungen werden geweckt, aber tatsächlich nicht erfüllt. Der fehlende Begleitumstand wird ausgedrückt.',
    'Die Wirksamkeit wird ausdrücklich auf den Umfang beschränkt, in dem die Einbindung in den Prozess gegeben ist.',
    'Die ursprüngliche Zeitangabe soll trotz Aktualisierung nicht beliebig an Geltung verlieren.',
    'Gesucht ist eine substantivierte Bezeichnung für das bloße gleichzeitige Arbeiten, die nach dem Adjektiv steht.',
    'Aus dem allgemeinen Eintritt darf kein weitergehender Anspruch gefolgert werden.',
  ],
}
const language: ServerSimulationTask[] = SIMULATION_LEVELS.flatMap(level => languageItems[level].flatMap((item, index) => ['language-choice', 'language-cloze'].map(family => {
  const [sentence, answer, wrong1, wrong2, explanation] = family === 'language-cloze' ? clozeItems[level][index] : item
  return {
    ...base(level, `sprachgebrauch-${index + 1}`, family, 'language'), sourceScenarioIds: [scenarios[index].id], type: 'choice' as const,
    title: family === 'language-cloze' ? 'Eine Textlücke ergänzen' : 'Die passende Form wählen',
    instruction: 'Wählen Sie die Ergänzung, die den Text grammatisch und mit der beschriebenen Bedeutung richtig vervollständigt.',
    text: `${family === 'language-choice' && languageContexts[level]?.[index] ? languageContexts[level]![index] + '\n\n' : ''}${sentence}`,
    options: [{ id: 'a', text: answer }, { id: 'b', text: wrong1 }, { id: 'c', text: wrong2 }], correctAnswer: 'a', explanation, evidence: sentence.replace('___', answer),
  }
})))

const reusableAudio: ServerSimulationTask[] = EXAM_TASKS.filter(task => task.releaseStatus !== 'draft' && task.skill === 'listening' && task.audio?.route === 'qwen' && ['choice', 'true-false'].includes(task.type) && task.correctAnswer).map(task => ({
  id: `sitov-simulation-reuse-${task.id}`, version: task.version, level: 'B1', skill: 'listening',
  family: task.audio!.id.includes('opinion') || task.audio!.id.includes('contrast') ? 'listening-opinion' : task.formatFamily.includes('global') || task.audio!.id.includes('check') ? 'listening-announcement' : 'listening-detail',
  scenarioId: task.audio!.id, type: task.type as 'choice' | 'true-false', title: task.title, instruction: task.instruction,
  ...(task.options ? { options: task.options } : {}), correctAnswer: task.correctAnswer, maxPoints: 1, minutes: 2,
  explanation: task.explanation ?? 'Die Lösung folgt aus den Angaben im Hörtext.', evidence: task.evidence, provenance,
  audioSource: { id: task.audio!.id, script: audioManifest[task.audio!.id as keyof typeof audioManifest] ?? task.audio!.script, plays: 1 },
}))

const universalListening: ServerSimulationTask[] = listeningSets.flatMap(source => {
  const level = source.level as SimulationLevel
  const lower = level === 'A1' || level === 'A2' ? lowerLanguage[source.scenarioId as keyof typeof lowerLanguage] : undefined
  const long = level === 'C1' || level === 'C2' ? longReading[source.scenarioId as keyof typeof longReading][level] : undefined
  const global = lower?.global ?? long?.heading ?? source.global
  const globalWrong = lower?.globalWrong ?? long?.headingWrong ?? source.globalWrong
  const correct = lower?.correct ?? long?.correct ?? source.correct
  const wrong = lower?.wrong ?? long?.wrong ?? source.wrong
  const audioSource = { id: source.id, script: universalAudioManifest[source.id as keyof typeof universalAudioManifest], plays: level === 'A1' || level === 'A2' ? 2 : 1 }
  const tasks: ServerSimulationTask[] = [
    { ...base(level, source.scenarioId, source.family, 'listening'), id: `${source.id}-global`, type: 'choice' as const, title: 'Das Thema im Hörtext verstehen', instruction: lower ? 'Worum geht es im Hörtext?' : 'Welche Aussage beschreibt das Hauptthema des Hörtexts?', options: [{ id: 'a', text: global }, ...globalWrong.map((text, index) => ({ id: String.fromCharCode(98 + index), text }))], correctAnswer: 'a', explanation: `Das Hauptthema ist: ${global}`, audioSource },
    { ...base(level, source.scenarioId, source.family, 'listening'), id: `${source.id}-detail`, type: 'choice' as const, title: level === 'C1' || level === 'C2' ? 'Eine Schlussfolgerung aus dem Hörtext' : 'Eine Einzelheit im Hörtext', instruction: lower ? 'Was ist richtig?' : long?.question ?? source.question, options: [{ id: 'a', text: correct }, ...wrong.map((text, index) => ({ id: String.fromCharCode(98 + index), text }))], correctAnswer: 'a', explanation: `Die passende Aussage ist: ${correct}`, evidence: long?.correct ?? source.criteria, audioSource },
  ]
  if (source.family === 'listening-announcement' && !long) {
    const task = tasks[1]
    const statementTrue = Number(source.id.match(/-v(\d+)$/)?.[1] ?? 1) % 2 === 0
    task.type = 'true-false'
    task.instruction = lower ? 'Hören Sie die Nachricht. Ist die folgende Aussage richtig oder falsch?' : 'Beurteilen Sie die folgende Aussage anhand der gehörten Nachricht.'
    Object.assign(task, { text: statementTrue ? correct : wrong[0], options: undefined, correctAnswer: statementTrue ? 'true' : 'false', explanation: `${statementTrue ? 'Die Aussage stimmt.' : 'Die Aussage stimmt nicht.'} ${correct}` })
  }
  return tasks
})

const registrationDays = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
const registrationTimes = ['09:00', '10:30', '11:15', '14:00', '15:30', '16:15', '09:30', '10:00', '13:15', '14:30', '17:00', '18:15']
const extraTasks: ServerSimulationTask[] = scenarios.flatMap((scenario, index) => {
  const form: ServerSimulationTask = {
    ...base('A1', scenario.id, 'writing-form', 'writing'), type: 'form', title: 'Ein Anmeldeformular ausfüllen', instruction: 'Lesen Sie die Nachricht. Tragen Sie die vier Angaben in das Formular ein.',
    text: `Ich heiße ${scenario.person}. Ich möchte das Angebot „${scenario.topic}“ besuchen. Ich kann am ${registrationDays[index]} um ${registrationTimes[index]} Uhr kommen. Bitte melden Sie mich dafür an.`,
    fields: [{ id: 'sitov-first-name', label: 'Vorname' }, { id: 'sitov-offer', label: 'Angebot' }, { id: 'sitov-day', label: 'Tag' }, { id: 'sitov-time', label: 'Uhrzeit' }],
    correctAnswer: [scenario.person, scenario.topic, registrationDays[index], registrationTimes[index]], maxPoints: 4, minutes: 4,
    explanation: 'Die vier Angaben stehen in der Nachricht. Übertragen Sie Vorname, Angebot, Tag und Uhrzeit in die passenden Felder.',
  }
  const request: ServerSimulationTask = {
    ...base('A1', scenario.id, 'speaking-requests', 'speaking'), type: 'speaking', title: 'Fragen stellen und auf eine Bitte reagieren',
    instruction: `Sprechen Sie über ${scenario.topic}. Fragen Sie nach einem Termin und nach einer Sache, die Sie brauchen. Bitten Sie um Hilfe und antworten Sie auf die Bitte Ihres Partners.`,
    interactionRequired: true, criteria: speakingCriteria('A1', ['Zwei verständliche Fragen und eine Bitte formulieren', 'Auf die Bitte des Partners passend reagieren']), maxPoints: 20, minutes: 3,
    explanation: 'Eine Lehrkraft bewertet die Fragen, die Bitte und Ihre Reaktion im tatsächlich aufgenommenen Gespräch.',
  }
  const reports = (['B2', 'C1', 'C2'] as SimulationLevel[]).map(level => ({
    ...base(level, scenario.id, 'writing-report', 'writing'), type: 'writing' as const, title: 'Informationen geordnet berichten',
    instruction: `Verfassen Sie für einen Teilnehmer, der die Nachricht nicht gelesen hat, einen sachlichen Bericht. Ordnen Sie Ausgangslage, Bedingungen, Änderungen und verbleibende Fragen. Übernehmen Sie keine längeren Formulierungen wörtlich. Schreiben Sie ${minWords[level]}.`,
    text: level === 'C1' || level === 'C2' ? longReading[scenario.id as keyof typeof longReading][level].text : scenario.texts[level], criteria: [...productiveCriteria[level], 'Zentrale Angaben vollständig und ohne Verfälschung wiedergeben', 'Tatsachen von Schlussfolgerungen trennen'], maxPoints: 20, minutes: 12,
    explanation: 'Die Lehrkraft vergleicht Ihren Bericht mit der Quelle und bewertet Auswahl, Genauigkeit, Struktur und eigene Formulierungen.',
  }))
  const reformulation: ServerSimulationTask = {
    ...base('C2', scenario.id, 'writing-reformulation', 'writing'), type: 'writing', title: 'Register und Perspektive verändern',
    instruction: 'Formulieren Sie aus der Analyse eine klar verständliche, sachliche Nachricht für direkt betroffene Personen. Erhalten Sie alle wesentlichen Bedingungen und Bedeutungsunterschiede. Erklären Sie anschließend in zwei Sätzen, welche sprachlichen Entscheidungen Sie für die Zielgruppe verändert haben.',
    text: longReading[scenario.id as keyof typeof longReading].C2.text, criteria: [...productiveCriteria.C2, 'Bedeutung und Einschränkungen bei verändertem Register erhalten', 'Adressatengerechte Reformulierung und begründete sprachliche Entscheidungen'], maxPoints: 20, minutes: 12,
    explanation: 'Die Lehrkraft prüft, ob die neue Fassung die differenzierte Bedeutung zuverlässig und im passenden Register vermittelt.',
  }
  const coherence = (['B2', 'C1', 'C2'] as const).map(level => {
    const paragraphs = level === 'B2' ? b2Coherence[scenario.id as keyof typeof b2Coherence]
      : upperCoherence[scenario.id as keyof typeof upperCoherence][level]
    return {
      ...base(level, scenario.id, 'reading-coherence', 'reading'), type: 'ordering' as const, title: 'Eine Argumentation ordnen',
      instruction: level === 'B2'
        ? 'Ordnen Sie den Ablauf: Ausgangssituation, neue Information oder Vorschlag, Bedingungen oder Vorgehen, Entscheidung oder Folge. Beachten Sie Wörter wie dort, diese und deshalb: Worauf beziehen sie sich?'
        : level === 'C1'
        ? 'Ordnen Sie die Argumentationsschritte: Ausgangslage, Vorschlag, Einwand, Reaktion, begrenztes Ergebnis. Beachten Sie, auf welche zuvor eingeführten Personen und Gedanken die Sätze reagieren.'
        : 'Ordnen Sie die Argumentationsschritte: Ausgangslage, vorgeschlagener Maßstab, Einwand, Erwiderung, weitere Abwägung, geplante Auswertung, begrenztes Fazit. Beachten Sie Rückverweise und die Entwicklung der Argumentation.',
      options: paragraphs.map((text, paragraphIndex) => ({ id: String.fromCharCode(97 + paragraphIndex), text })),
      correctAnswer: paragraphs.map((_, paragraphIndex) => String.fromCharCode(97 + paragraphIndex)),
      maxPoints: paragraphs.length, minutes: 8, explanation: 'Die Ausgangslage führt die Beteiligten ein. Vorschläge werden anschließend durch Einwände und Erwiderungen geprüft; Auswertung und Fazit folgen der Abwägung. Die verlangte Schrittfolge bestimmt die Zuordnung.',
      evidence: paragraphs.join('\n'),
    }
  })
  return [form, request, ...reports, reformulation, ...coherence]
})
const mediationTasks: ServerSimulationTask[] = listeningSets.filter(source => ['C1', 'C2'].includes(source.level) && source.family === 'listening-detail').map(source => {
  const level = source.level as SimulationLevel
  return {
    ...base(level, source.scenarioId, 'integrated-listening-writing', 'writing'), id: `${source.id}-mediation`, type: 'writing', title: 'Hörinformationen schriftlich vermitteln',
    instruction: `Sie haben den Vortrag gehört. Schreiben Sie für einen abwesenden Teilnehmer eine sachliche Zusammenfassung mit den zentralen Informationen, Bedingungen und Konsequenzen. Unterscheiden Sie belegte Angaben von Ihrer eigenen Einordnung. Verwenden Sie eigene Formulierungen und schreiben Sie ${minWords[level]}.`,
    audioSource: { id: source.id, script: universalAudioManifest[source.id as keyof typeof universalAudioManifest], plays: 1 },
    criteria: [...productiveCriteria[level], 'Zentrale Hörinformationen vollständig, präzise und ohne Verfälschung vermitteln', 'Quelle und eigene Einordnung erkennbar unterscheiden'], maxPoints: 20, minutes: 15,
    explanation: 'Die Lehrkraft hört dieselbe eingefrorene Quelle und bewertet die Genauigkeit und sprachliche Vermittlung Ihrer Zusammenfassung.',
  }
})

export const SIMULATION_TASK_POOL: ServerSimulationTask[] = [...authored, ...language, ...reusableAudio, ...universalListening, ...extraTasks, ...mediationTasks]
export const SIMULATION_POOL_SUMMARY = SIMULATION_LEVELS.map(level => ({ level, tasks: SIMULATION_TASK_POOL.filter(task => task.level === level).length, topics: scenarios.length, release: 'sitov-universal-exam' as const }))
