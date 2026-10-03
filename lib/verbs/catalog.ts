import data from "./catalog-data.json";
import {
  SITOV_VERB_LEVELS,
  type SitovVerbEntry,
  type SitovVerbLevel,
  type SitovVerbLocale,
} from "./types";

export const SITOV_VERB_CATALOG = data as unknown as readonly SitovVerbEntry[];
const sitovVerbIndex = new Map(
  SITOV_VERB_CATALOG.map((verb) => [verb.id, verb]),
);

export function isSitovVerbLevel(level: unknown): level is SitovVerbLevel {
  return (
    typeof level === "string" &&
    (SITOV_VERB_LEVELS as readonly string[]).includes(level)
  );
}

/** An expanded level never replaces the verbs introduced at earlier levels. */
export function getSitovVerbCatalog(level?: SitovVerbLevel): SitovVerbEntry[] {
  if (!level) return [...SITOV_VERB_CATALOG];
  const maximum = SITOV_VERB_LEVELS.indexOf(level);
  return SITOV_VERB_CATALOG.filter(
    (verb) => SITOV_VERB_LEVELS.indexOf(verb.level) <= maximum,
  );
}

export function getSitovVerbById(id: string): SitovVerbEntry | undefined {
  return sitovVerbIndex.get(id);
}

export function getSitovVerbTranslation(
  verb: SitovVerbEntry,
  locale: string,
): string {
  const supported = ["de", "en", "ru", "uk", "tr"].includes(locale)
    ? (locale as SitovVerbLocale)
    : "en";
  return verb.translations[supported];
}

export { getSitovVerbTenses } from "./progression";
export { SITOV_VERB_LEVELS } from "./types";
