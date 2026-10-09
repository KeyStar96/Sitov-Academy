# S2 epoch21: evidenced partial mappings and recommendation variety

Base: `12da40948738d7a6680df1a34eeb0385b4fb0a90`; branch `codex/sitov-night-s2-release-mapping`. No publication, database, audio, actor, browser, QA or production operations.

Nine topics added to the existing seven: A1.1 Satzbau, Praesens, Tageszeit, Essen, Wohnen, Einkaufen; A1.2 Gesundheit, Ablauf, Akkusativ. Evidence and concrete anchors are embedded in the mapping. Sources: canonical A1.1/A1.2 path seeds and rule cards, `supabase/seeds/verbs-catalog.json`, `supabase/seeds/pronunciation-reading-2026.json`. All referenced catalog IDs and levels checked by the authoritative-catalog test. No invented vocabulary cards, static runtime path UUIDs, or replacement of the eleven absent actual-QA vocabulary references. Wohnen uses liegen; stehen is A1.2 and excluded from A1.1. Added mapping is partial evidence, not a claim of complete competency coverage.

Selection now takes the first available item of each kind within each existing priority before repeated kinds. All continuation items still outrank practice/pretest and review. Only already authorized/current-progress items enter selection; maximum remains respected. No prerequisite or authorization changes. Three slots cannot display all four kinds simultaneously.

Validation: four targeted Jest suites /70 tests PASS; scoped ESLint PASS. Tests cover variety, continuation priority, denied pronunciation, limit, real catalog evidence and cross-level rejection. No full TypeScript/build/global test run.

## M/S3 private draft delta proposal

Do not apply mechanically: each cell is a partial proposal requiring the content owner's review of the actual core. Prefix every suffix below with `sitov.topic.`; empty cells deliberately retain a documented gap. Preserve IDs, recordings, progress, streaks and answers. Seed is not edited here.

| Draft suffix | words | verbs | syntax | nominal |
|---|---|---|---|---|
| a11-01 | kennenlernen,tageszeit-a11 | kennenlernen,praesens-a11 | satzbau-a11 | nominativ,familie,akkusativ |
| a11-02 | essen-a11,wohnen-a11 | essen-a11,praesens-a11 | satzbau-a11 | akkusativ,nominativ |
| a11-03 | wohnen-a11 | praesens-a11,wohnen-a11 | satzbau-a11 | nominativ |
| a11-04 | kennenlernen | kennenlernen,praesens-a11 | satzbau-a11 | nominativ |
| a11-05 | tageszeit-a11 | praesens-a11,essen-a11 | satzbau-a11 | akkusativ,nominativ |
| a11-06 | wohnen-a11 | trennbare-verben,praesens-a11,wohnen-a11 | trennbare-verben,satzbau-a11 | nominativ,akkusativ |
| a11-07 | einkaufen-a11,essen-a11 | einkaufen-a11,praesens-a11 | satzbau-a11 | nominativ,akkusativ |
| a11-08 | familie | praesens-a11,kennenlernen | satzbau-a11 | familie,nominativ |
| a11-09 | tageszeit-a11,trennbare-verben | trennbare-verben,praesens-a11 | trennbare-verben,satzbau-a11,tageszeit-a11 |  |
| a11-10 | tageszeit-a11,wohnen-a11 | praesens-a11,essen-a11 | satzbau-a11 | nominativ,akkusativ |
| a12-01 | gesundheit-a12,zeit |  | zeit,ablauf-a12 | akkusativ-a12 |
| a12-02 |  |  | ablauf-a12 | akkusativ-a12 |

Exact cross-level corrections needed: a11-05 words currently refers to A1.2 zeit; a12-01 and a12-02 verbs refer to A1.1 trennbare-verben; a12-02 nominal refers to A1.1 akkusativ. All proposals above use same-level topics. M/S3 must resolve exact immutable definition/core IDs from the authored seed and review before changing hashes or reimporting; no old pass transfers to changed definitions.

Remaining substantive gaps: a11-09 nominal dative/prepositions; a11-08 nominal von meiner Familie; a11-10 locatives. A1.2 doctor verbs koennen/moechten/anrufen/mitnehmen and cooking verbs/food lack exact same-level verb or lexical targets; empty proposals reflect this. Gesundheit is contextual reading, not an exact verb exercise. Existing modal topic does not establish precise coverage of those forms. Path and reading practice cover only the documented subskills. Pending reasons should remain explicit for uncovered cores.

Release gates remain: M/S3 private seed review and update; independent content review; required local male Qwen audio and word timing import/proof for changed content; actual current-authorization recommendations/destination checks, visible flow acceptance, absent vocabulary references and publication decision. Nothing in this commit activates drafts. Revert this commit to roll back; no database rollback needed. WAIT for fresh START after handoff.
