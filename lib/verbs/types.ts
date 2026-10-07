/** Offered trainer contexts. Coarse B2/C1 remain authored catalogue levels only. */
export const SITOV_VERB_TRAINER_LEVELS = [
  "A1.1",
  "A1.2",
  "A2.1",
  "A2.2",
  "B1.1",
  "B1.2",
  "B2.1",
  "B2.2",
] as const;
export type SitovVerbTrainerLevel = (typeof SITOV_VERB_TRAINER_LEVELS)[number];
export const SITOV_VERB_LEVELS = [...SITOV_VERB_TRAINER_LEVELS, "B2", "C1"] as const;
export type SitovVerbLevel = (typeof SITOV_VERB_LEVELS)[number];
/**
 * Contexts without verbs of their own: at B2.1 and B2.2 the trainer repeats every verb up to
 * B1.2. The order mirrors `learning_levels.sort_order` (migration 85): the coarse contexts B2
 * and C1 follow their sublevels, and C1.1/C1.2 have no verb trainer at all.
 */
export const SITOV_VERB_REVIEW_LEVELS: readonly SitovVerbLevel[] = ["B2.1", "B2.2"];
export type SitovVerbTense = "present" | "perfect" | "past";
export type SitovVerbLocale = "de" | "en" | "ru" | "uk" | "tr";
export type SitovVerbExerciseKind =
  | "conjugation"
  | "direct"
  | "participle"
  | "auxiliary"
  | "perfect"
  | "sentence";
export type SitovVerbPerson = 0 | 1 | 2 | 3 | 4 | 5;
export type SitovVerbForms = [string, string, string, string, string, string];

export interface SitovVerbEntry {
  id: string;
  infinitive: string;
  level: SitovVerbLevel;
  translations: Record<SitovVerbLocale, string>;
  /** Main-clause forms: includes reflexive pronoun and separated particle. */
  present: SitovVerbForms;
  past: SitovVerbForms;
  presentAlternatives?: Partial<Record<SitovVerbPerson, string[]>>;
  pastAlternatives?: Partial<Record<SitovVerbPerson, string[]>>;
  participles: string[];
  auxiliaries: ("haben" | "sein")[];
  /** Accusative by default; a small set of lexical phrases uses dative. */
  reflexive?: "accusative" | "dative";
  /** A reviewed context following the subject and finite verb, excluding the particle. */
  sentence?: string;
  /** Finite verb + any trailing particle/phrase, before inserting reflexive pronouns. */
  presentParts: [string, string][];
  pastParts: [string, string][];
  /** Words before the participle in compound verb phrases, e.g. spazieren gegangen. */
  note?: string;
  /** Weather/impersonal verbs use only es; passive geboren werden only er/sie/es. */
  persons?: SitovVerbPerson[];
}

export interface SitovVerbExercise {
  id: string;
  verbId: string;
  tense: SitovVerbTense;
  kind: SitovVerbExerciseKind;
  prompt: string;
  person: SitovVerbPerson;
  /** Render parts[0], input[0], parts[1], …; length is answers.length + 1. */
  parts: string[];
  answers: string[][];
  solution: string;
}

export interface SitovVerbProgress {
  verbId: string;
  tense: SitovVerbTense;
  box: number;
  attempts: number;
  correct: number;
  lapses: number;
  nextReviewAt: string | null;
  lastAnsweredAt: string | null;
}

export interface SitovVerbTask {
  verbId: string;
  tense: SitovVerbTense;
  due: boolean;
  progress: SitovVerbProgress | null;
}

// Convenient aliases for server and UI consumers.
export type VerbTrainerLevel = SitovVerbLevel;
export type VerbTense = SitovVerbTense;
export type VerbCatalogEntry = SitovVerbEntry;
