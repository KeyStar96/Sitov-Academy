import {
  SITOV_VERB_LEVELS,
  type SitovVerbEntry,
  type SitovVerbLevel,
  type SitovVerbTense,
} from "./types";

const sitovCorePastVerbs = new Set([
  "sein",
  "haben",
  "werden",
  "können",
  "müssen",
  "dürfen",
  "sollen",
  "wollen",
  "mögen",
  "wissen",
]);

/** At A2, Präteritum is confined to frequent auxiliaries and modal verbs. */
export function getSitovVerbTenses(
  level: SitovVerbLevel,
  verb?: Pick<SitovVerbEntry, "infinitive">,
): SitovVerbTense[] {
  const index = SITOV_VERB_LEVELS.indexOf(level);
  const tenses: SitovVerbTense[] = ["present"];
  if (index >= 1) tenses.push("perfect");
  if (
    index >= 4 ||
    (index >= 2 && (!verb || sitovCorePastVerbs.has(verb.infinitive)))
  )
    tenses.push("past");
  return tenses;
}
