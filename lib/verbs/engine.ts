import { getSitovVerbTenses } from "./progression";
import { isSitovVerbDue } from "./review";
import { validateUserAnswer } from "@/lib/grammar-validation";
import type { SoftErrorReason } from "@/lib/answer-grading";
import {
  SITOV_VERB_LEVELS,
  type SitovVerbEntry,
  type SitovVerbExercise,
  type SitovVerbExerciseKind,
  type SitovVerbLevel,
  type SitovVerbPerson,
  type SitovVerbProgress,
  type SitovVerbTask,
  type SitovVerbTense,
} from "./types";

export { getSitovVerbTenses } from "./progression";

const sitovPronouns = ["ich", "du", "er", "wir", "ihr", "sie"] as const;
const sitovReflexives = {
  accusative: ["mich", "dich", "sich", "uns", "euch", "sich"],
  dative: ["mir", "dir", "sich", "uns", "euch", "sich"],
};
const sitovAuxiliaryForms = {
  haben: ["habe", "hast", "hat", "haben", "habt", "haben"],
  sein: ["bin", "bist", "ist", "sind", "seid", "sind"],
};

function sitovHash(value: string): number {
  let hash = 2166136261;
  for (const char of value)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

export function getSitovVerbExerciseKinds(
  verb: SitovVerbEntry,
  tense: SitovVerbTense,
): SitovVerbExerciseKind[] {
  const kinds: SitovVerbExerciseKind[] =
    tense === "perfect"
      ? ["participle", "auxiliary", "perfect"]
      : ["conjugation", "direct"];
  // These multiword constructions have an Ersatzinfinitiv/passive final part,
  // rather than a single lexical Partizip II to retrieve in isolation.
  if (
    verb.infinitive === "sich blicken lassen" ||
    verb.infinitive === "geboren werden"
  ) {
    const index = kinds.indexOf("participle");
    if (index >= 0) kinds.splice(index, 1);
  }
  if (verb.sentence) kinds.push("sentence");
  return kinds;
}

export function buildSitovVerbExercise(
  verb: SitovVerbEntry,
  tense: SitovVerbTense,
  options: {
    kind?: SitovVerbExerciseKind;
    person?: SitovVerbPerson;
    seed?: string | number;
  } = {},
): SitovVerbExercise {
  const seed = String(options.seed ?? 0);
  const random = sitovHash(`${verb.id}:${tense}:${seed}`);
  const persons = verb.persons ?? ([0, 1, 2, 3, 4, 5] as SitovVerbPerson[]);
  const person =
    options.person !== undefined && persons.includes(options.person)
      ? options.person
      : persons[random % persons.length];
  const pronoun =
    verb.persons?.length === 1 && verb.persons[0] === 2
      ? "es"
      : sitovPronouns[person];
  const reflexive = verb.reflexive
    ? sitovReflexives[verb.reflexive][person]
    : "";
  const available = getSitovVerbExerciseKinds(verb, tense);
  const kind = options.kind ?? available[(random >>> 4) % available.length];
  if (!available.includes(kind))
    throw new Error(
      `Unsupported Sitov Academy verb exercise: ${tense}/${kind}`,
    );
  const label = { present: "Präsens", perfect: "Perfekt", past: "Präteritum" }[
    tense
  ];
  let parts: string[];
  let answers: string[][];
  let prompt = `${verb.infinitive} · ${label}`;

  if (kind === "participle") {
    prompt = `${verb.infinitive} · Partizip II`;
    parts = ["", ""];
    answers = [[...verb.participles]];
  } else if (kind === "auxiliary") {
    prompt = `${verb.infinitive} · haben oder sein?`;
    parts = ["", ""];
    answers = [[...verb.auxiliaries]];
  } else if (
    kind === "perfect" ||
    (kind === "sentence" && tense === "perfect")
  ) {
    const context = kind === "sentence" ? verb.sentence! : "";
    // Directional contexts explicitly select sein; free form recall accepts both.
    const contextualAux =
      kind === "sentence" &&
      ["nach Berlin", "auf den Berg", "zum Bahnhof", "ins Wasser"].includes(
        context,
      )
        ? verb.auxiliaries.filter((aux) => aux === "sein")
        : verb.auxiliaries;
    const auxiliaries = contextualAux.length ? contextualAux : verb.auxiliaries;
    const middle = [reflexive, context].filter(Boolean).join(" ");
    parts =
      kind === "sentence"
        ? ["Gestern ", ` ${pronoun}${middle ? ` ${middle}` : ""} `, "."]
        : [`${pronoun} `, middle ? ` ${middle} ` : " ", ""];
    answers = [
      auxiliaries.map((aux) => sitovAuxiliaryForms[aux][person]),
      [...verb.participles],
    ];
  } else if (kind === "sentence") {
    const forms = tense === "past" ? verb.pastParts : verb.presentParts;
    const alternatives =
      (tense === "past" ? verb.pastAlternatives : verb.presentAlternatives)?.[
        person
      ] ?? [];
    const [finite, particle] = forms[person];
    const context = [reflexive, verb.sentence!].filter(Boolean).join(" ");
    const start = tense === "past" ? "Damals " : "Heute ";
    const finiteAnswers = [
      finite,
      ...alternatives.map((form) => form.split(" ")[0]),
    ];
    parts = particle
      ? [start, ` ${pronoun} ${context} `, "."]
      : [start, ` ${pronoun} ${context}.`];
    answers = particle ? [finiteAnswers, [particle]] : [finiteAnswers];
  } else {
    const forms = tense === "past" ? verb.past : verb.present;
    const alternatives =
      (tense === "past" ? verb.pastAlternatives : verb.presentAlternatives)?.[
        person
      ] ?? [];
    prompt += ` · ${pronoun}`;
    parts = [`${pronoun} `, ""];
    answers = [[forms[person], ...alternatives]];
  }

  const solution = parts
    .map((part, index) => `${part}${answers[index]?.[0] ?? ""}`)
    .join("");
  return {
    id: `sitov-exercise-${sitovHash(`${verb.id}:${tense}:${kind}:${person}:${seed}`)}`,
    verbId: verb.id,
    tense,
    kind,
    prompt,
    person,
    parts,
    answers,
    solution,
  };
}

/** German-preserving normalization for literal comparisons. */
export function normalizeSitovVerbAnswer(value: string): string {
  return value.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");
}

export function evaluateSitovVerbAnswer(
  exercise: Pick<SitovVerbExercise, "answers">,
  supplied: string[],
): boolean {
  return gradeSitovVerbAnswer(exercise, supplied).correct;
}

/** Development-only mirror; production feedback is graded by PostgreSQL. */
export function gradeSitovVerbAnswer(
  exercise: Pick<SitovVerbExercise, "answers">,
  supplied: string[],
): { correct: boolean; softError: SoftErrorReason | null } {
  if (supplied.length !== exercise.answers.length) return { correct: false, softError: null };
  const grades = exercise.answers.map((answers, index) => validateUserAnswer(supplied[index] ?? "", answers));
  if (grades.some(grade => grade.status === "INCORRECT")) return { correct: false, softError: null };
  const soft = grades.find(grade => grade.status === "SOFT_ERROR");
  return { correct: true, softError: soft?.status === "SOFT_ERROR" ? soft.reason : null };
}

/** The persisted spacing boundary also survives switching trainer contexts. */
export function getSitovVerbPreviousIds(progress: readonly Pick<SitovVerbProgress, "verbId" | "lastAnsweredAt">[]): string[] {
  let latest = Number.NEGATIVE_INFINITY;
  let previous = new Set<string>();
  for (const row of progress) {
    const time = row.lastAnsweredAt ? Date.parse(row.lastAnsweredAt) : Number.NaN;
    if (!Number.isFinite(time) || time < latest) continue;
    if (time > latest) { latest = time; previous = new Set(); }
    previous.add(row.verbId);
  }
  return [...previous].sort();
}

/** Due verb × unlocked tense tasks only; learned forms stay in the archive. */
export function prioritizeSitovVerbTasks(
  entries: readonly SitovVerbEntry[],
  progress: readonly SitovVerbProgress[],
  level: SitovVerbLevel,
  tenses?: readonly SitovVerbTense[],
  now: number = Date.now(),
): SitovVerbTask[] {
  const progressByKey = new Map(
    progress.map((row) => [`${row.verbId}:${row.tense}`, row]),
  );
  const maximum = SITOV_VERB_LEVELS.indexOf(level);
  const tasks = entries
    .filter((verb) => SITOV_VERB_LEVELS.indexOf(verb.level) <= maximum)
    .flatMap((verb) =>
      getSitovVerbTenses(level, verb)
        .filter((tense) => !tenses || tenses.includes(tense))
        .map((tense) => {
          const row = progressByKey.get(`${verb.id}:${tense}`) ?? null;
          return {
            verbId: verb.id,
            tense,
            due: isSitovVerbDue(row, now),
            progress: row,
          };
        }),
    ).filter(task => task.due);
  return tasks.sort((a, b) => {
    const aTime = a.progress?.nextReviewAt
      ? Date.parse(a.progress.nextReviewAt)
      : 0;
    const bTime = b.progress?.nextReviewAt
      ? Date.parse(b.progress.nextReviewAt)
      : 0;
    return (
      (Number.isFinite(aTime) ? aTime : 0) -
        (Number.isFinite(bTime) ? bTime : 0) ||
      (a.progress?.box ?? 0) - (b.progress?.box ?? 0) ||
      (b.progress?.lapses ?? 0) - (a.progress?.lapses ?? 0) ||
      a.verbId.localeCompare(b.verbId) ||
      a.tense.localeCompare(b.tense)
    );
  });
}
