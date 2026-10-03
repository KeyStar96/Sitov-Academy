// Sitov Academy verb catalog authoring build. This runs offline.
// Lexicon snapshot licensing and modifications: lib/verbs/DATA-SOURCES.md.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const source = path.join(root, "lib/verbs/source");
const pool = require(path.join(source, "pool.json"));
const dictionary = require(path.join(source, "lexicon.json"));
const translations = require(path.join(source, "translations.json"));
dictionary["müssen"].PRT.S[2] = "musstest";
const modern = (s) =>
  s
    .replace(/paß/g, "pass")
    .replace(/wußt/g, "wusst")
    .replace(/muß/g, "muss")
    .replace(/miß/g, "miss")
    .replace(/faß/g, "fass")
    .replace(/fluß/g, "fluss")
    .replace(/laß/g, "lass")
    .replace(/läßt/g, "lässt")
    .replace(/schloß/g, "schloss")
    .replace(/schoß/g, "schoss")
    .replace(/floß/g, "floss")
    .replace(/goß/g, "goss")
    .replace(/riß/g, "riss")
    .replace(/biß/g, "biss")
    .replace(/giß/g, "giss")
    .replace(/^ißt/, "isst")
    .replace(/^eßt/, "esst");
const pairs = (d, t) =>
  ["S", "P"].flatMap((n) =>
    [1, 2, 3].map((p) => {
      const f = d[t][n][p];
      return typeof f === "string"
        ? [modern(f), ""]
        : [modern(f[0]), modern(f.slice(1).join(" "))];
    }),
  );
const weak = (inf) => {
  let stem = inf.endsWith("en") ? inf.slice(0, -2) : inf.slice(0, -1);
  const e = /(?:[dt]|[^aeiouäöüyrlmn][mn])$/.test(stem) ? "e" : "";
  const one = inf.endsWith("eln") ? stem.slice(0, -2) + "le" : stem + "e";
  return {
    present: [
      [one, ""],
      [stem + (/[sßxz]$/.test(stem) ? e + "t" : e + "st"), ""],
      [stem + e + "t", ""],
      [inf, ""],
      [stem + e + "t", ""],
      [inf, ""],
    ],
    past: [
      stem + e + "te",
      stem + e + "test",
      stem + e + "te",
      stem + e + "ten",
      stem + e + "tet",
      stem + e + "ten",
    ].map((x) => [x, ""]),
    participles: [
      (/^(?:be|emp|ent|er|ge|miss|ver|zer)/.test(inf) || inf.endsWith("ieren")
        ? ""
        : "ge") +
        stem +
        e +
        "t",
    ],
  };
};
const curatedWeak = new Set(
  "chatten klicken frühstücken jonglieren gelangen recherchieren stricken surfen vereinbaren grillieren parkieren stylen deaktivieren dehydrieren deinstallieren demotivieren destabilisieren jetten konservieren missgönnen reintegrieren revidieren wackeln zelebrieren".split(
    " ",
  ),
);
const compound = {
  anklicken: ["klicken", "an"],
  anlocken: ["locken", "an"],
  herumgehen: ["gehen", "herum"],
  leidtun: ["tun", "leid"],
  losfahren: ["fahren", "los"],
  mitkommen: ["kommen", "mit"],
  herunterladen: ["laden", "herunter"],
  vorbeibringen: ["bringen", "vorbei"],
  wehtun: ["tun", "weh"],
  reinkommen: ["kommen", "rein"],
  krankmelden: ["melden", "krank"],
  vorhaben: ["haben", "vor"],
  dahinterstecken: ["stecken", "dahinter"],
  heraushängen: ["hängen", "heraus"],
  schieflaufen: ["laufen", "schief"],
  zutun: ["tun", "zu"],
  abtun: ["tun", "ab"],
  einspeisen: ["speisen", "ein"],
  hineinschnuppern: ["schnuppern", "hinein"],
  fernhalten: ["halten", "fern"],
  hineinversetzen: ["versetzen", "hinein"],
};
const phrases = {
  "spazieren gehen": ["gehen", "spazieren"],
  "sauber machen": ["machen", "sauber"],
  "stehen bleiben": ["bleiben", "stehen"],
  "geboren werden": ["werden", "geboren"],
  "in Anspruch nehmen": ["nehmen", "in Anspruch"],
  "blicken lassen": ["lassen", "blicken"],
  "vertraut machen": ["machen", "vertraut"],
  "bewusst machen": ["machen", "bewusst"],
  "Stellung nehmen": ["nehmen", "Stellung"],
};
const strongPast = (stem) =>
  [
    stem,
    stem + (/[sßz]$/.test(stem) ? "est" : "st"),
    stem,
    stem + "en",
    stem + (/[dt]$/.test(stem) ? "et" : "t"),
    stem + "en",
  ].map((x) => [x, ""]);
const prefixes = [
  "zurecht",
  "voraus",
  "dar",
  "klar",
  "lahm",
  "auseinander",
  "entgegen",
  "zufrieden",
  "zusammen",
  "zurück",
  "herunter",
  "vorbei",
  "heraus",
  "hinein",
  "abwärts",
  "weiter",
  "kaputt",
  "kennen",
  "krank",
  "brach",
  "schief",
  "groß",
  "warm",
  "fern",
  "nahe",
  "herum",
  "statt",
  "teil",
  "fest",
  "wieder",
  "durch",
  "leid",
  "weh",
  "rein",
  "los",
  "mit",
  "nach",
  "vor",
  "weg",
  "her",
  "hin",
  "bei",
  "ab",
  "an",
  "auf",
  "aus",
  "ein",
  "zu",
  "um",
];
const canInflect = (b) =>
  Boolean(dictionary[b]?.["PRÄ"] && dictionary[b]?.PRT) ||
  curatedWeak.has(b) ||
  Boolean(compound[b]) ||
  b === "schreiten" ||
  b === "bereiten";
function morphology(base) {
  if (base === "bereiten" || base === "schaffen" || base === "bewegen")
    return weak(base);
  if (base === "hängen")
    return {
      present: pairs(dictionary[base], "PRÄ"),
      past: strongPast("hing"),
      participles: ["gehangen", "gehängt"],
    };
  const inseparable =
    /^(über|unter)/.test(base) ||
    base === "wiederholen" ||
    base === "vollziehen";
  if (
    !inseparable &&
    !["umfahren", "durchlaufen", "durchschreiten"].includes(base)
  ) {
    const prefix = prefixes.find(
      (p) => base.startsWith(p) && canInflect(base.slice(p.length)),
    );
    if (prefix) {
      const r = morphology(base.slice(prefix.length));
      return {
        present: r.present.map(([f, p]) => [
          f,
          [p, prefix].filter(Boolean).join(" "),
        ]),
        past: r.past.map(([f, p]) => [
          f,
          [p, prefix].filter(Boolean).join(" "),
        ]),
        participles: r.participles.map((p) => prefix + p),
      };
    }
  }
  if (base === "schreiten")
    return {
      present: [
        ["schreite", ""],
        ["schreitest", ""],
        ["schreitet", ""],
        ["schreiten", ""],
        ["schreitet", ""],
        ["schreiten", ""],
      ],
      past: [
        ["schritt", ""],
        ["schrittest", ""],
        ["schritt", ""],
        ["schritten", ""],
        ["schrittet", ""],
        ["schritten", ""],
      ],
      participles: ["geschritten"],
    };
  if (dictionary[base]) {
    const join = (parts) =>
      inseparable ? parts.map(([f, p]) => [p + f, ""]) : parts;
    return {
      present: join(pairs(dictionary[base], "PRÄ")),
      past: join(pairs(dictionary[base], "PRT")),
      participles: [...new Set(dictionary[base].PA2.map(modern))],
    };
  }
  if (curatedWeak.has(base)) return weak(base);
  if (compound[base]) {
    const [root, particle] = compound[base];
    let result = morphology(root);
    return {
      present: result.present.map(([f, p]) => [
        f,
        [p, particle].filter(Boolean).join(" "),
      ]),
      past: result.past.map(([f, p]) => [
        f,
        [p, particle].filter(Boolean).join(" "),
      ]),
      participles: result.participles.map((p) => particle + p),
    };
  }
  if (phrases[base]) {
    const [root, tail] = phrases[base];
    let result = morphology(root);
    return {
      present: result.present.map(([f, p]) => [
        f,
        [tail, p].filter(Boolean).join(" "),
      ]),
      past: result.past.map(([f, p]) => [
        f,
        [tail, p].filter(Boolean).join(" "),
      ]),
      participles: result.participles.map((p) => tail + " " + p),
    };
  }
  throw Error("Missing " + base);
}
const sein = new Set(
  `bleiben fahren gehen kommen aufstehen ausgehen aussteigen herumgehen losfahren losgehen mitkommen steigen zurückkommen abfahren ankommen ausfallen einsteigen fliegen hingehen reisen umsteigen vorbeikommen werden umziehen einziehen ausziehen fallen reinkommen hinfallen laufen auftreten wegfahren springen stürzen stehen bleiben auffallen landen kaputtgehen sterben verschwinden folgen begegnen entstehen gelingen umgehen aufwachen zurechtkommen geboren werden wiederkommen einfallen wachsen weggehen eintreten geschehen abweichen aufwachsen eilen eingehen entspringen gelangen geraten nachkommen rutschen scheitern schieflaufen sinken vorgehen zusammenkommen abwärtsgehen ausklingen ausweichen eintauchen erscheinen missglücken misslingen missraten schiefgehen schwinden versinken wiederkehren zerfallen zerfließen zergehen zerlaufen zerplatzen zerspringen`.split(
    " ",
  ),
);
["stehen bleiben", "geboren werden"].forEach((v) => sein.add(v));
sein.delete("stehen");
sein.delete("geboren");
const mixedAux = new Set([
  "flanieren",
  "angehen",
  "trocknen",
  "enden",
  "klettern",
  "reiten",
  "schwimmen",
  "surfen",
  "fliegen",
  "joggen",
  "starten",
  "brechen",
  "abbrechen",
  "pendeln",
  "hüpfen",
  "heilen",
  "kreisen",
  "schwanken",
  "zerkochen",
]);
const dative = new Set([
  "sich merken",
  "sich wünschen",
  "sich überlegen",
  "sich vornehmen",
  "sich leisten",
  "sich aneignen",
  "sich erarbeiten",
  "sich bewusst machen",
  "sich einprägen",
  "sich verderben",
  "sich vertreiben",
]);
const refl = {
  accusative: ["mich", "dich", "sich", "uns", "euch", "sich"],
  dative: ["mir", "dir", "sich", "uns", "euch", "sich"],
};
const contexts = {
  abholen: "meine Mutter am Bahnhof",
  anfangen: "mit dem Deutschkurs",
  ankreuzen: "die richtige Antwort",
  anrufen: "meine Mutter",
  ansehen: "den Film",
  antworten: "auf die Frage",
  arbeiten: "im Büro",
  aufräumen: "das Zimmer",
  aufstehen: "um sieben Uhr",
  ausfüllen: "das Formular",
  ausgehen: "mit Freunden",
  aussteigen: "am Bahnhof",
  backen: "einen Kuchen",
  beantworten: "die Frage",
  begrüßen: "die Lehrerin",
  beschreiben: "das Bild",
  bezahlen: "die Rechnung",
  bitten: "um Hilfe",
  bleiben: "zu Hause",
  brauchen: "ein Wörterbuch",
  bringen: "einen Kuchen",
  buchstabieren: "meinen Namen",
  chatten: "mit Freunden",
  danken: "der Lehrerin",
  diktieren: "einen Satz",
  einkaufen: "im Supermarkt",
  "sich entschuldigen": "bei der Lehrerin",
  ergänzen: "den Satz",
  erzählen: "eine Geschichte",
  essen: "eine Suppe",
  fahren: "nach Berlin",
  fernsehen: "am Abend",
  finden: "den Schlüssel",
  fotografieren: "die Stadt",
  fragen: "nach dem Weg",
  "sich freuen": "auf den Urlaub",
  frühstücken: "um acht Uhr",
  geben: "meiner Mutter ein Geschenk",
  gehen: "zur Schule",
  grillen: "im Garten",
  haben: "einen Hund",
  heißen: "Alex",
  helfen: "meiner Mutter",
  hören: "Musik",
  "sich informieren": "über den Kurs",
  kaufen: "ein Buch",
  kennen: "die Lehrerin",
  klettern: "auf den Berg",
  kochen: "eine Suppe",
  kommen: "aus Berlin",
  korrigieren: "den Text",
  leben: "in Berlin",
  lernen: "Deutsch",
  lesen: "ein Buch",
  "sich lieben": "sehr",
  liegen: "auf dem Sofa",
  losfahren: "um acht Uhr",
  machen: "die Hausaufgaben",
  malen: "ein Bild",
  markieren: "das Verb",
  meinen: "die erste Antwort",
  "sich merken": "das neue Wort",
  mitkommen: "zur Party",
  mögen: "Schokolade",
  nachfragen: "bei der Lehrerin",
  nachsprechen: "den Satz",
  nehmen: "den Bus",
  nennen: "ein Beispiel",
  notieren: "die Adresse",
  öffnen: "das Fenster",
  planen: "eine Reise",
  regnen: "den ganzen Tag",
  reiten: "auf einem Pferd",
  sagen: "die Wahrheit",
  sammeln: "Briefmarken",
  schauen: "aus dem Fenster",
  schlafen: "acht Stunden",
  schließen: "die Tür",
  schneien: "den ganzen Tag",
  schreiben: "einen Brief",
  schwimmen: "im See",
  sehen: "den Film",
  sein: "zu Hause",
  singen: "ein Lied",
  "spazieren gehen": "im Park",
  spielen: "Fußball",
  sprechen: "mit meiner Mutter",
  stellen: "die Flasche auf den Tisch",
  stricken: "einen Schal",
  studieren: "Medizin",
  suchen: "den Schlüssel",
  tanzen: "auf der Party",
  telefonieren: "mit meiner Mutter",
  treffen: "meine Freunde",
  trinken: "Wasser",
  üben: "die neuen Verben",
  "sich verabschieden": "von der Lehrerin",
  vergessen: "den Schlüssel",
  vergleichen: "die Preise",
  verkaufen: "mein Fahrrad",
  verstehen: "die Frage",
  "sich vorstellen": "bei der Lehrerin",
  wandern: "in den Bergen",
  waschen: "das Auto",
  wecken: "meine Schwester",
  wissen: "die Antwort",
  wohnen: "in Berlin",
  zählen: "die Wörter",
  zeichnen: "ein Bild",
  zeigen: "der Lehrerin das Foto",
  zurückkommen: "am Abend",
  zustimmen: "dem Vorschlag",
  abfahren: "um neun Uhr",
  abgeben: "die Hausaufgaben",
  anbieten: "meiner Mutter einen Kaffee",
  ankommen: "um neun Uhr",
  anmachen: "das Licht",
  "sich anmelden": "für den Kurs",
  anprobieren: "die Jacke",
  "sich anziehen": "für die Feier",
  aufmachen: "das Fenster",
  ausdrucken: "den Text",
  ausmachen: "das Licht",
  ausschalten: "den Computer",
  ausschlafen: "am Sonntag",
  auswählen: "ein Buch",
  bestellen: "einen Kaffee",
  besuchen: "meine Mutter",
  denken: "an den Urlaub",
  drücken: "den Knopf",
  "sich duschen": "am Morgen",
  einladen: "meine Freunde",
  einschalten: "den Computer",
  einsteigen: "in den Bus",
  empfehlen: "das Buch",
  erklären: "die Regel",
  erreichen: "den Bahnhof",
  feiern: "meinen Geburtstag",
  fliegen: "nach Berlin",
  gewinnen: "das Spiel",
  heiraten: "im Sommer",
  herunterladen: "die Datei",
  hinterlassen: "eine Nachricht",
  holen: "einen Kaffee",
  "sich kennenlernen": "im Deutschkurs",
  kopieren: "den Text",
  lachen: "über den Witz",
  leihen: "meiner Mutter ein Buch",
  "sich melden": "bei der Lehrerin",
  mieten: "eine Wohnung",
  mitbringen: "einen Kuchen",
  mitmachen: "beim Spiel",
  mitnehmen: "das Buch",
  mitsingen: "beim Konzert",
  organisieren: "eine Feier",
  parken: "vor dem Haus",
  pfeifen: "ein Lied",
  putzen: "das Fenster",
  reisen: "nach Berlin",
  reparieren: "das Fahrrad",
  reservieren: "einen Tisch",
  "sauber machen": "das Zimmer",
  schaffen: "die Aufgabe",
  schenken: "meiner Mutter ein Buch",
  schicken: "eine Nachricht",
  schneiden: "das Brot",
  sitzen: "auf dem Sofa",
  stehen: "vor dem Haus",
  trainieren: "jeden Tag",
  umsteigen: "in Berlin",
  unterschreiben: "den Vertrag",
  verdienen: "Geld",
  vereinbaren: "einen Termin",
  "sich verletzen": "beim Sport",
  verstecken: "den Schlüssel",
  vorbereiten: "die Feier",
  warten: "auf den Bus",
  weitermachen: "mit der Aufgabe",
  werden: "müde",
  wiederholen: "den Satz",
  "sich wünschen": "ein Fahrrad",
  ziehen: "den Wagen",
  zuhören: "der Lehrerin",
  zumachen: "die Tür",
  zurückgeben: "das Buch",
  zurückrufen: "meine Mutter",
  umziehen: "nach Berlin",
  einziehen: "in die neue Wohnung",
  ausziehen: "aus der alten Wohnung",
  kennenlernen: "die Lehrerin",
  "sich erinnern": "an den Urlaub",
  "sich verlieben": "in Alex",
  vermissen: "meine Freunde",
  legen: "das Buch auf den Tisch",
  bauen: "ein Haus",
  fallen: "auf den Boden",
  werfen: "den Ball",
  gießen: "die Blumen",
  besprechen: "den Plan",
  übernehmen: "die Aufgabe",
  "sich ausziehen": "vor dem Duschen",
  versuchen: "die neue Übung",
  "sich bewegen": "jeden Tag",
  "sich interessieren": "für Musik",
  "sich fühlen": "gut",
  "sich ausruhen": "auf dem Sofa",
  "sich ärgern": "über den Fehler",
  "sich schminken": "für die Feier",
  "sich rasieren": "am Morgen",
  "sich umziehen": "für die Feier",
  "sich kämmen": "vor dem Spiegel",
  "sich waschen": "am Morgen",
  "sich beeilen": "am Morgen",
  "sich konzentrieren": "auf die Aufgabe",
  "sich beschweren": "über den Lärm",
  "sich kümmern": "um den Hund",
  laufen: "zum Bahnhof",
  "sich bewerben": "um die Stelle",
  "sich streiten": "mit Alex",
  "sich vertragen": "mit Alex",
  glauben: "der Lehrerin",
  "sich vorbereiten": "auf die Prüfung",
  weinen: "vor Freude",
  tragen: "eine Jacke",
  ausgeben: "Geld",
  "sich unterhalten": "mit Alex",
  mitspielen: "beim Fußball",
  vorschlagen: "einen Termin",
  sparen: "für ein Fahrrad",
  wiegen: "das Paket",
  senden: "eine Nachricht",
  frieren: "im Winter",
  springen: "ins Wasser",
  "stehen bleiben": "vor dem Haus",
  reden: "mit Alex",
  baden: "im See",
  buchen: "ein Hotel",
  "sich einigen": "auf einen Termin",
  annehmen: "das Angebot",
  ablehnen: "das Angebot",
  verschieben: "den Termin",
  abheben: "Geld",
  einzahlen: "Geld",
  überweisen: "das Geld",
  "sich setzen": "auf den Stuhl",
  nachdenken: "über die Frage",
  absagen: "den Termin",
  rufen: "nach meiner Mutter",
  teilnehmen: "am Kurs",
  lügen: "nie",
  übersetzen: "den Text",
  aufschreiben: "die Adresse",
  "sich beruhigen": "langsam",
  "sich überlegen": "einen Plan",
  bestätigen: "den Termin",
  schreien: "vor Freude",
  anschließen: "den Computer",
  anklicken: "den Link",
  wegwerfen: "das Papier",
  "sich anstellen": "an der Kasse",
  schütteln: "die Flasche",
  stehlen: "das Geld",
  "sich vornehmen": "eine neue Aufgabe",
  vorlesen: "die Geschichte",
  "sich einsetzen": "für den Umweltschutz",
  zubereiten: "das Essen",
  braten: "das Fleisch",
  rühren: "die Suppe",
  aufladen: "das Handy",
  ausprobieren: "das neue Spiel",
  berühren: "die Wand",
  beurteilen: "den Text",
  drehen: "den Schlüssel",
  einnehmen: "die Tablette",
  erwähnen: "den Termin",
  verlieren: "den Schlüssel",
  zugeben: "den Fehler",
  zunehmen: "im Winter",
  ablenken: "meine Schwester",
  beibehalten: "den Plan",
  beitragen: "zur Lösung",
  durchlaufen: "einen Prozess",
  erwarten: "meine Freunde",
  "sich bewusst machen": "die Folgen",
  "sich vertraut machen": "mit dem Thema",
  "sich vertreiben": "die Zeit",
  "sich einprägen": "das Wort",
  "sich fernhalten": "von dem Hund",
  "sich orientieren": "an der Karte",
  "sich verschreiben": "im Formular",
  "sich widersetzen": "der Anweisung",
  "sich widmen": "der Aufgabe",
  umfahren: "das Hindernis",
  übergehen: "die Frage",
  überspringen: "den Absatz",
  übertreten: "die Regel",
};
[
  "sein",
  "spazieren gehen",
  "wandern",
  "vorkommen",
  "passieren",
  "abbiegen",
  "flitzen",
  "hasten",
  "jetten",
  "verzweifeln",
].forEach((v) => sein.add(v));
sein.add("platzen");
let result = [];
for (const row of pool) {
  const reflexive = row.infinitive.startsWith("sich ");
  const base = row.infinitive.replace(/^sich /, "");
  let data = morphology(base);
  const notes = [];
  let pa;
  let pr;
  if (["vorbereiten", "zubereiten"].includes(base)) {
    const particle = base === "vorbereiten" ? "vor" : "zu";
    const w = weak("bereiten");
    data = {
      present: w.present.map(([f]) => [f, particle]),
      past: w.past.map(([f]) => [f, particle]),
      participles: [particle + "bereitet"],
    };
  }
  if (base === "bereiten") data = weak("bereiten");
  if (base === "schaffen")
    data = { ...data, past: weak("schaffen").past, participles: ["geschafft"] };
  if (base === "bewegen" && reflexive)
    data = { ...data, past: weak("bewegen").past, participles: ["bewegt"] };
  if (base === "erschrecken")
    data = {
      ...data,
      past: strongPast("erschrak"),
      participles: ["erschrocken"],
    };
  if (base === "hängen") {
    data = { ...data, past: strongPast("hing"), participles: ["gehangen"] };
    notes.push(
      "Hier als Zustand: hing / gehangen. Die Handlung verwendet hängte / gehängt.",
    );
  }
  if (base === "abhängen") {
    data = {
      ...data,
      past: strongPast("hing").map(([f]) => [f, "ab"]),
      participles: ["abgehangen"],
    };
  }
  if (base === "heraushängen") {
    data = {
      ...data,
      past: strongPast("hing").map(([f]) => [f, "heraus"]),
      participles: ["herausgehangen"],
    };
  }
  if (base === "backen") {
    pr = { 1: ["bäckst"], 2: ["bäckt"] };
    pa = Object.fromEntries(weak("backen").past.map(([f], i) => [i, [f]]));
  }
  if (
    ["senden", "versenden", "verwenden", "wenden", "anwenden"].includes(base)
  ) {
    const stems = {
      senden: "sand",
      versenden: "versand",
      verwenden: "verwand",
      wenden: "wand",
      anwenden: "wand",
    };
    const particle = base === "anwenden" ? "an" : "";
    pa = Object.fromEntries(
      [
        stems[base] + "te",
        stems[base] + "test",
        stems[base] + "te",
        stems[base] + "ten",
        stems[base] + "tet",
        stems[base] + "ten",
      ].map((f, i) => [
        i,
        [
          [
            f,
            reflexive
              ? refl[dative.has(row.infinitive) ? "dative" : "accusative"][i]
              : "",
            particle,
          ]
            .filter(Boolean)
            .join(" "),
        ],
      ]),
    );
  }
  if (
    [
      "übersetzen",
      "umfahren",
      "überspringen",
      "übertreten",
      "übergehen",
      "durchlaufen",
      "durchschreiten",
    ].includes(base)
  ) {
    const roots = {
      übersetzen: ["setzen", "über"],
      umfahren: ["fahren", "um"],
      überspringen: ["springen", "über"],
      übertreten: ["treten", "über"],
      übergehen: ["gehen", "über"],
      durchlaufen: ["laufen", "durch"],
      durchschreiten: ["schreiten", "durch"],
    };
    const [root, prefix] = roots[base];
    let r = morphology(root);
    data = {
      present: r.present.map(([f]) => [prefix + f, ""]),
      past: r.past.map(([f]) => [prefix + f, ""]),
      participles: [prefix + r.participles[0].replace(/^ge/, "")],
    };
  }
  if (base === "umschreiben") {
    const r = morphology("schreiben");
    data = {
      present: r.present.map(([f]) => [f, "um"]),
      past: r.past.map(([f]) => [f, "um"]),
      participles: ["umgeschrieben"],
    };
  }
  if (base === "blicken lassen") {
    data.participles = ["blicken lassen"];
    notes.push("Mit lassen + Infinitiv: hat sich blicken lassen.");
  }
  if (base === "werden") data.participles = ["geworden"];
  if (base === "geboren werden") {
    data.participles = ["geboren worden"];
    notes.push("Passiv: ist geboren worden.");
  }
  if (base === "wachsen" || base === "aufwachsen")
    data.participles = [base === "wachsen" ? "gewachsen" : "aufgewachsen"];
  if (base === "abweichen") data.participles = ["abgewichen"];
  if (base === "ausweichen") data.participles = ["ausgewichen"];
  if (base === "löschen") data.participles = ["gelöscht"];
  if (base === "sich blicken lassen") throw Error("Reflexive parse");
  const rcase = dative.has(row.infinitive) ? "dative" : "accusative";
  const form = (parts, i) =>
    [parts[0], reflexive ? refl[rcase][i] : "", parts[1]]
      .filter(Boolean)
      .join(" ");
  // Both contractions are standard: sammle / sammele; ließt / ließest;
  // rittst / rittest. Store full main-clause alternatives for the grader.
  const addAlternative = (target, person, value, canonical) => {
    if (value === canonical) return target;
    target ??= {};
    target[person] = [...new Set([...(target[person] ?? []), value])];
    return target;
  };
  if (base.endsWith("eln")) {
    const [finite, particle] = data.present[0];
    const alternate = finite.endsWith("ele")
      ? finite.replace(/ele$/, "le")
      : finite.replace(/le$/, "ele");
    pr = addAlternative(
      pr,
      0,
      form([alternate, particle], 0),
      form(data.present[0], 0),
    );
  }
  const [pastStem, pastParticle] = data.past[0];
  if (/(?:ss|ß|s|d|t)$/.test(pastStem)) {
    const variants = [
      pastStem + "est",
      pastStem + (/(ss|ß|s)$/.test(pastStem) ? "t" : "st"),
    ];
    for (const alternate of variants) {
      pa = addAlternative(
        pa,
        1,
        form([alternate, pastParticle], 1),
        form(data.past[1], 1),
      );
    }
  }
  const aux = reflexive
    ? ["haben"]
    : mixedAux.has(base)
      ? ["sein", "haben"]
      : sein.has(base)
        ? ["sein"]
        : ["haben"];
  if (base === "erschrecken") aux.splice(0, aux.length, "sein");
  if (
    ["stehen", "sitzen", "liegen", "hängen", "knien", "brachliegen"].includes(
      base,
    )
  )
    aux.push("sein");
  if (
    ["können", "müssen", "dürfen", "sollen", "wollen", "mögen"].includes(base)
  )
    notes.push(
      "Partizip als Vollverb. Mit einem weiteren Infinitiv steht der Ersatzinfinitiv (z. B. hat kommen müssen).",
    );
  const id =
    "sitov-verb-" +
    row.infinitive
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const entry = {
    id,
    ...row,
    translations: {},
    present: data.present.map(form),
    past: data.past.map(form),
    ...(pr ? { presentAlternatives: pr } : {}),
    ...(pa ? { pastAlternatives: pa } : {}),
    participles: data.participles,
    auxiliaries: [...new Set(aux)],
    ...(reflexive ? { reflexive: rcase } : {}),
    ...(contexts[row.infinitive] ? { sentence: contexts[row.infinitive] } : {}),
    presentParts: data.present,
    pastParts: data.past,
    ...(notes.length ? { note: notes.join(" ") } : {}),
    ...([
      "passieren",
      "regnen",
      "schneien",
      "leidtun",
      "wehtun",
      "geschehen",
      "gelingen",
      "missglücken",
      "misslingen",
      "missraten",
      "dahinterstecken",
      "andeuten",
      "herausstellen",
      "lohnen",
    ].includes(base)
      ? { persons: [2] }
      : {}),
    ...(["sich lieben", "sich kennenlernen", "sich ausschließen"].includes(
      row.infinitive,
    )
      ? { persons: [3, 4, 5] }
      : {}),
  };
  if (base === "sauber machen") entry.participles.push("saubergemacht");
  if (base === "stehen bleiben") entry.participles.push("stehengeblieben");
  result.push(entry);
}

for (const verb of result) {
  verb.translations = translations[verb.infinitive];
  if (
    !verb.translations ||
    ["de", "en", "ru", "uk", "tr"].some((locale) => !verb.translations[locale])
  )
    throw new Error("Missing translation: " + verb.infinitive);
}
const output = path.join(root, "lib/verbs/catalog-data.json");
const serialized = JSON.stringify(result, null, 2) + "\n";
if (process.argv.includes("--check")) {
  if (fs.readFileSync(output, "utf8") !== serialized)
    throw new Error(
      "Catalog is stale. Run node scripts/build-sitov-verb-catalog.cjs",
    );
  console.log(
    "Sitov Academy verb catalog matches its offline sources (" +
      result.length +
      " verbs).",
  );
} else {
  fs.writeFileSync(output, serialized);
  console.log(
    "Built Sitov Academy verb catalog (" + result.length + " verbs).",
  );
}
