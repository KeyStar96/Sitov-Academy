import {
  SITOV_VERB_CATALOG,
  getSitovVerbById,
  getSitovVerbCatalog,
} from "@/lib/verbs/catalog";
import {
  buildSitovVerbExercise,
  evaluateSitovVerbAnswer,
  gradeSitovVerbAnswer,
  getSitovVerbPreviousIds,
  getSitovVerbExerciseKinds,
  getSitovVerbTenses,
  prioritizeSitovVerbTasks,
} from "@/lib/verbs/engine";
import type { SitovVerbEntry, SitovVerbProgress } from "@/lib/verbs/types";

function verb(infinitive: string): SitovVerbEntry {
  const entry = SITOV_VERB_CATALOG.find((row) => row.infinitive === infinitive);
  if (!entry) throw new Error(`Unknown verb ${infinitive}`);
  return entry;
}

describe("Sitov Academy verb catalog", () => {
  it("contains the entire supplied pool, preserving first introduction and lexical phrases", () => {
    expect(SITOV_VERB_CATALOG).toHaveLength(960);
    expect(new Set(SITOV_VERB_CATALOG.map((row) => row.infinitive)).size).toBe(
      960,
    );
    expect(new Set(SITOV_VERB_CATALOG.map((row) => row.id)).size).toBe(960);
    expect(
      Object.fromEntries(
        ["A1.1", "A1.2", "A2.1", "A2.2", "B1.1", "B1.2", "B2", "C1"].map(
          (level) => [
            level,
            SITOV_VERB_CATALOG.filter((row) => row.level === level).length,
          ],
        ),
      ),
    ).toEqual({
      "A1.1": 140,
      "A1.2": 129,
      "A2.1": 93,
      "A2.2": 62,
      "B1.1": 92,
      "B1.2": 70,
      B2: 187,
      C1: 187,
    });
    expect(verb("abnehmen").level).toBe("B1.1");
    expect(verb("Stellung nehmen").level).toBe("B2");
    expect(verb("sich bewusst machen").level).toBe("C1");
    expect(getSitovVerbById("sitov-verb-koennen")?.infinitive).toBe("können");
  });

  it("provides every language and complete finite paradigms without source parser artifacts", () => {
    for (const row of SITOV_VERB_CATALOG) {
      expect(row.id).toMatch(/^sitov-verb-/);
      for (const locale of ["de", "en", "ru", "uk", "tr"] as const)
        expect(row.translations[locale].trim()).not.toBe("");
      for (const forms of [row.present, row.past]) {
        expect(forms).toHaveLength(6);
        for (const form of forms) expect(form).toMatch(/^[\p{L} ]+$/u);
      }
      expect(row.presentParts).toHaveLength(6);
      expect(row.pastParts).toHaveLength(6);
      expect(row.participles.length).toBeGreaterThan(0);
      expect(row.auxiliaries.length).toBeGreaterThan(0);
      // Source double-particle artifacts (aus vor / bei vor) are never taught.
      for (const parts of [...row.presentParts, ...row.pastParts])
        expect(parts[1]).not.toMatch(/^(aus vor|bei vor|aus her)$/);
      expect([...row.present, ...row.past].join(" ")).not.toMatch(
        /schloß|schoß|goß|floß|biß|riß|vergißt/,
      );
    }
  });

  it.each([
    ["anrufen", "rufe an", "rief an", "angerufen"],
    ["anfangen", "fange an", "fing an", "angefangen"],
    ["unterschreiben", "unterschreibe", "unterschrieb", "unterschrieben"],
    ["wiederholen", "wiederhole", "wiederholte", "wiederholt"],
    ["übernehmen", "übernehme", "übernahm", "übernommen"],
    ["unterstützen", "unterstütze", "unterstützte", "unterstützt"],
    ["überzeugen", "überzeuge", "überzeugte", "überzeugt"],
    ["übersetzen", "übersetze", "übersetzte", "übersetzt"],
    ["umfahren", "umfahre", "umfuhr", "umfahren"],
    ["vorbeikommen", "komme vorbei", "kam vorbei", "vorbeigekommen"],
    ["herausfiltern", "filtere heraus", "filterte heraus", "herausgefiltert"],
    [
      "sich herausstellen",
      "stelle mich heraus",
      "stellte mich heraus",
      "herausgestellt",
    ],
    ["voraussagen", "sage voraus", "sagte voraus", "vorausgesagt"],
    ["darlegen", "lege dar", "legte dar", "dargelegt"],
    ["klarmachen", "mache klar", "machte klar", "klargemacht"],
    ["lahmlegen", "lege lahm", "legte lahm", "lahmgelegt"],
    ["zurechtkommen", "komme zurecht", "kam zurecht", "zurechtgekommen"],
    ["teilnehmen", "nehme teil", "nahm teil", "teilgenommen"],
    ["stattfinden", "finde statt", "fand statt", "stattgefunden"],
    ["festhalten", "halte fest", "hielt fest", "festgehalten"],
    ["brachliegen", "liege brach", "lag brach", "brachgelegen"],
    ["schiefgehen", "gehe schief", "ging schief", "schiefgegangen"],
    ["großschreiben", "schreibe groß", "schrieb groß", "großgeschrieben"],
    ["entgegenstehen", "stehe entgegen", "stand entgegen", "entgegengestanden"],
    [
      "sich auseinandersetzen",
      "setze mich auseinander",
      "setzte mich auseinander",
      "auseinandergesetzt",
    ],
    ["kennenlernen", "lerne kennen", "lernte kennen", "kennengelernt"],
    ["vorbereiten", "bereite vor", "bereitete vor", "vorbereitet"],
    ["zubereiten", "bereite zu", "bereitete zu", "zubereitet"],
    ["schaffen", "schaffe", "schaffte", "geschafft"],
    ["abschaffen", "schaffe ab", "schaffte ab", "abgeschafft"],
    ["sich bewegen", "bewege mich", "bewegte mich", "bewegt"],
    ["missgönnen", "missgönne", "missgönnte", "missgönnt"],
    ["schließen", "schließe", "schloss", "geschlossen"],
    ["gießen", "gieße", "goss", "gegossen"],
    ["schießen", "schieße", "schoss", "geschossen"],
    ["beißen", "beiße", "biss", "gebissen"],
  ])("uses reviewed forms for %s", (infinitive, present, past, participle) => {
    const row = verb(infinitive);
    expect(row.present[0]).toBe(present);
    expect(row.past[0]).toBe(past);
    expect(row.participles).toContain(participle);
  });

  it.each([
    "sein",
    "spazieren gehen",
    "fahren",
    "wandern",
    "vorkommen",
    "passieren",
    "abbiegen",
    "flitzen",
    "hasten",
    "jetten",
    "platzen",
    "verzweifeln",
  ])("uses sein for %s in the chosen meaning", (infinitive) => {
    expect(verb(infinitive).auxiliaries).toEqual(["sein"]);
  });

  it("keeps valid variants while excluding sense-specific wrong combinations", () => {
    expect(verb("backen").presentAlternatives?.[1]).toContain("bäckst");
    expect(verb("backen").pastAlternatives?.[0]).toContain("backte");
    expect(verb("sammeln").presentAlternatives?.[0]).toContain("sammele");
    expect(verb("lassen").pastAlternatives?.[1]).toContain("ließest");
    expect(verb("reiten").pastAlternatives?.[1]).toContain("rittst");
    expect(verb("senden").participles).toEqual(
      expect.arrayContaining(["gesandt", "gesendet"]),
    );
    expect(verb("schwimmen").auxiliaries).toEqual(
      expect.arrayContaining(["haben", "sein"]),
    );
    expect(verb("hängen").participles).toEqual(["gehangen"]);
    expect(
      evaluateSitovVerbAnswer(
        buildSitovVerbExercise(verb("hängen"), "perfect", {
          kind: "perfect",
          person: 0,
        }),
        ["bin", "gehängt"],
      ),
    ).toBe(false);
    expect(verb("werden").participles).toEqual(["geworden"]);
    expect(verb("geboren werden").participles).toEqual(["geboren worden"]);
    expect(verb("sich blicken lassen").participles).toEqual(["blicken lassen"]);
  });
});

describe("Sitov Academy verb exercises and progression", () => {
  it("expands the pool and tenses independently without unlocking future verbs", () => {
    expect(getSitovVerbCatalog("A1.1")).toHaveLength(140);
    expect(getSitovVerbCatalog("A1.2")).toHaveLength(269);
    expect(getSitovVerbTenses("A1.1", verb("fahren"))).toEqual(["present"]);
    expect(getSitovVerbTenses("A1.2", verb("fahren"))).toEqual([
      "present",
      "perfect",
    ]);
    expect(getSitovVerbTenses("A2.1", verb("fahren"))).toEqual([
      "present",
      "perfect",
    ]);
    expect(getSitovVerbTenses("A2.1", verb("wissen"))).toEqual([
      "present",
      "perfect",
      "past",
    ]);
    expect(getSitovVerbTenses("B1.1", verb("fahren"))).toEqual([
      "present",
      "perfect",
      "past",
    ]);
  });

  it("builds complete separable and reflexive sentences with German word order", () => {
    expect(
      buildSitovVerbExercise(verb("anrufen"), "perfect", {
        kind: "sentence",
        person: 0,
      }).solution,
    ).toBe("Gestern habe ich meine Mutter angerufen.");
    expect(
      buildSitovVerbExercise(verb("anrufen"), "present", {
        kind: "sentence",
        person: 0,
      }).solution,
    ).toBe("Heute rufe ich meine Mutter an.");
    expect(
      buildSitovVerbExercise(verb("sich vorbereiten"), "past", {
        kind: "sentence",
        person: 1,
      }).solution,
    ).toBe("Damals bereitetest du dich auf die Prüfung vor.");
    expect(
      buildSitovVerbExercise(verb("sich bewusst machen"), "perfect", {
        kind: "sentence",
        person: 0,
      }).solution,
    ).toBe("Gestern habe ich mir die Folgen bewusst gemacht.");
    expect(
      buildSitovVerbExercise(verb("sich vertraut machen"), "present", {
        kind: "sentence",
        person: 0,
      }).solution,
    ).toBe("Heute mache ich mich mit dem Thema vertraut.");
    expect(
      buildSitovVerbExercise(verb("spazieren gehen"), "perfect", {
        kind: "sentence",
        person: 3,
      }).solution,
    ).toBe("Gestern sind wir im Park spazieren gegangen.");
    expect(
      buildSitovVerbExercise(verb("fliegen"), "perfect", {
        kind: "sentence",
        person: 3,
      }).answers[0],
    ).toEqual(["sind"]);
  });

  it("mixes all six task kinds and restricts impersonal and reciprocal forms", () => {
    const kinds = new Set(
      ["present", "perfect", "past"].flatMap((tense) =>
        getSitovVerbExerciseKinds(
          verb("anrufen"),
          tense as "present" | "perfect" | "past",
        ),
      ),
    );
    expect([...kinds].sort()).toEqual([
      "auxiliary",
      "conjugation",
      "direct",
      "participle",
      "perfect",
      "sentence",
    ]);
    expect(
      buildSitovVerbExercise(verb("regnen"), "present", { person: 0 }).person,
    ).toBe(2);
    expect(
      buildSitovVerbExercise(verb("sich lohnen"), "present", { person: 0 })
        .person,
    ).toBe(2);
    expect(
      buildSitovVerbExercise(verb("sich kennenlernen"), "present", {
        person: 0,
      }).person,
    ).toBeGreaterThanOrEqual(3);
    expect(
      getSitovVerbExerciseKinds(verb("sich blicken lassen"), "perfect"),
    ).not.toContain("participle");
  });

  it("grades task structures with the shared spelling tolerance and rejects wrong slots", () => {
    for (const row of SITOV_VERB_CATALOG) {
      for (const tense of ["present", "perfect", "past"] as const) {
        for (const kind of getSitovVerbExerciseKinds(row, tense)) {
          const exercise = buildSitovVerbExercise(row, tense, {
            kind,
            seed: 17,
          });
          expect(exercise.parts).toHaveLength(exercise.answers.length + 1);
          expect(
            evaluateSitovVerbAnswer(
              exercise,
              exercise.answers.map((answers) => answers[0]),
            ),
          ).toBe(true);
          expect(evaluateSitovVerbAnswer(exercise, [])).toBe(false);
          expect(exercise.solution).not.toContain("undefined");
        }
      }
    }
    const present = buildSitovVerbExercise(verb("fahren"), "present", {
      kind: "conjugation",
      person: 1,
    });
    expect(evaluateSitovVerbAnswer(present, ["  FÄHRST  "])).toBe(true);
    expect(gradeSitovVerbAnswer(present, ["fahrst"])).toEqual({ correct: true, softError: "typo" });
    expect(gradeSitovVerbAnswer(present, ["faehrst"])).toEqual({ correct: true, softError: "umlaut" });
    expect(evaluateSitovVerbAnswer(present, ["fahren"])).toBe(false);
    expect(evaluateSitovVerbAnswer(present, ["fährst", "fahren"])).toBe(false);
    expect(
      evaluateSitovVerbAnswer(
        buildSitovVerbExercise(verb("backen"), "present", {
          kind: "conjugation",
          person: 1,
        }),
        ["bäckst"],
      ),
    ).toBe(true);
  });

  it("prioritizes new and due verb-tense states while keeping old mastery intact", () => {
    const now = Date.parse("2026-10-03T12:00:00Z");
    const progress: SitovVerbProgress[] = [
      {
        verbId: verb("fahren").id,
        tense: "present",
        box: 5,
        attempts: 15,
        correct: 14,
        lapses: 1,
        nextReviewAt: "2026-10-10T12:00:00Z",
        lastAnsweredAt: "2026-10-02T12:00:00Z",
      },
    ];
    const tasks = prioritizeSitovVerbTasks(
      [verb("fahren"), verb("sich erinnern")],
      progress,
      "A1.2",
      undefined,
      now,
    );
    expect(tasks.map((task) => `${task.verbId}:${task.tense}`)).toEqual([
      "sitov-verb-fahren:perfect",
    ]);
    expect(tasks[0]).toMatchObject({ due: true, progress: null });
    expect(progress[0].box).toBe(5);
    expect(
      prioritizeSitovVerbTasks(
        [verb("fahren")],
        progress,
        "B1.1",
        ["past"],
        now,
      ),
    ).toHaveLength(1);
    expect(
      prioritizeSitovVerbTasks(
        [verb("fahren")],
        progress,
        "A1.1",
        ["perfect"],
        now,
      ),
    ).toEqual([]);
  });

  it("never schedules archive forms or repeat grading on the same Berlin calendar day", () => {
    const now = Date.parse("2026-10-03T12:00:00Z");
    const progress: SitovVerbProgress[] = [
      { verbId: verb("fahren").id, tense: "present", box: 7, attempts: 12, correct: 12, lapses: 0,
        nextReviewAt: "2026-10-01T12:00:00Z", lastAnsweredAt: "2026-10-01T10:00:00Z" },
      { verbId: verb("fahren").id, tense: "perfect", box: 4, attempts: 12, correct: 11, lapses: 1,
        nextReviewAt: "2026-10-03T11:05:00Z", lastAnsweredAt: "2026-10-03T11:00:00Z" },
    ];
    expect(prioritizeSitovVerbTasks([verb("fahren")], progress, "A1.2", undefined, now)).toEqual([]);
  });

  it("recovers the latest graded source verb and handles equal timestamps without guessing", () => {
    expect(getSitovVerbPreviousIds([
      { verbId: "old", lastAnsweredAt: "2026-10-01T12:00:00Z" },
      { verbId: "new", lastAnsweredAt: "2026-10-02T12:00:00Z" },
      { verbId: "new", lastAnsweredAt: "2026-10-02T12:00:00Z" },
      { verbId: "unanswered", lastAnsweredAt: null },
      { verbId: "invalid", lastAnsweredAt: "invalid" },
    ])).toEqual(["new"]);
    expect(getSitovVerbPreviousIds([
      { verbId: "b", lastAnsweredAt: "2026-10-02T12:00:00Z" },
      { verbId: "a", lastAnsweredAt: "2026-10-02T12:00:00Z" },
    ])).toEqual(["a", "b"]);
  });
});
