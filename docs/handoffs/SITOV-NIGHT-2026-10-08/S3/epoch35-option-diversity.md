# Sitov Academy — S3 Epoch35: Optionskennungen und Reihenfolge der neuen Pools

Base `e732de03d5ff6fa2e680f313947aebf46dac80c2`; Branch `codex/sitov-night-s3-new-pool-option-diversity`. Lease bis 2026-10-09 11:06:59.152925 UTC, letzte Minute SAVE.

M hat zuvor alle72 neuen Fragen inhaltlich unabhängig gelesen und den semantischen Inhalt als korrekt/eindeutig gemeldet; diese Meldung ist keine exakte neue Definitionsfreigabe nach der folgenden Kennungs-/Reihenfolgeänderung. Hier ausschließlich S3-Selbstprüfung der Umordnung.

Die vorherige Regel „richtiger Schlüssel immer .a; Position1/3/2 in jedem Kern“ ist entfernt. Die72 Fragen in drei weiterhin unveröffentlichten Pools behalten alle deutschen Prompt-/Options-/Quell-/Begründungstexte, richtigen Antworttexte, Frage-/Kern-/Text-/Unit-IDs, Matrizen, Formen und Zuordnungen. Nur Optionskennungen, Optionsreihenfolge, correctOptionId und die daraus folgenden drei redaktionellen Definitionshashes ändern sich. Die ersten12 Definitionen einschließlich exakter M-Reviews bleiben unangetastet.

Erzeugung mit `secrets.SystemRandom` aus dem kryptografischen Zufallsgenerator des Betriebssystems: unabhängige gezogene ausgewogene Label-/Positionsfolgen und zufällige Bijectionen/Optionspermutationen. Gespeichert wird ausschließlich das konkrete Autorenresultat, kein Seed und keine öffentlich ableitbare Antwort-aus-Frage-ID-Funktion. Kein Runtime-Shuffle oder Bewertungs-/Berechtigungswechsel.

Je Sechserkern: korrekte Labels a/b/c jeweils zweimal; richtige Position1/2/3 jeweils zweimal. Zwölf unterschiedliche Labelfolgen und zwölf unterschiedliche unabhängig gezogene Positionsfolgen; jede Frageindex-Spalte enthält über die Kerne alle drei Labels und Positionen. Die Delta-Datei dokumentiert72 vollständige Vorher/Nachher-Datensätze:68 tatsächliche Options-/Schlüsseländerungen und vier zulässige Identitätsbijectionen innerhalb der neuen ausgewogenen Gesamtverteilung.

`epoch35-option-diversity-delta.json` enthält jede alte/neue Options-ID/Text/Order/Korrektkennung, deren vollständige ID-Bijection, gleichbleibenden richtigen Antworttext, alte/neue Alias-Einträge und Reihenfolge, alte/neue Reviews sowie genaue Manifest-/Alias-/Definitionshashes. Die unveränderte Epoch34-Auditdatei bleibt historische Quelle. Die Tests rekonstruieren daraus bytegenau den vorherigen15er-Manifeststand und die vorherige1440er-Aliasdatei, bevor sie frühere Audit-/Hashprüfungen anwenden. Tatsächlich aktuelle15Definitionen und1440Aliastexte werden zusätzlich direkt validiert.

Neue288 Alias-Einträge folgen exakt den aktuellen Optionskennungen und der Optionsreihenfolge; die ersten1152 bleiben mit gleicher Reihenfolge und gleichen Werten erhalten. Die Multimenge sämtlicher gesprochener deutscher Werte bleibt exakt gleich: SHA256 `99cf2c8e99ed40eccb14f6e46f34db5d42012fc1a486bac1485f30e3b18dfb8a`. Keine neuen gesprochenen Texte oder Tondateien.

## Aktuelle redaktionelle Definitionshashes

JSON.stringify-SHA256; keine Behauptung über PostgreSQL-JSONB-Testversionshashes:

- `924ee488-8b97-5070-ba23-eea0f03992e6`: `089bb0b29ca8d37446a0d57ea329b83650b2cd40bf4fd0f3bf2b10929d62781d`.
- `6e15b015-d482-58e4-9fa2-25ba0c8dea72`: `e88b65fc2b15cc33cfba37b53cd9c529ec55b23e2a6bef35086da9ee0a57cf17`.
- `93e4a1ed-cb70-5f0a-9dd2-cf6b2a9c9699`: `b956f39233aa4f67d4f159073e95afcf2abe62c979e9476c54ef47a52d3b13e2`.

Alle drei neuen Reviews bleiben unverändert S3-Autorenselbstprüfung mit `author_checked_independent_review_pending`, `humanReview=false`, `calibrationStatus=pending`; nur ihr exakter Definitionshash wird aktualisiert. Keine neue M-Prüfung behauptet. M muss das exakte neue Resultat unabhängig prüfen und über spätere unveränderliche DB-Testversionen, Alias-/Asset-Proof-Bindung und Veröffentlichung separat entscheiden. Keine Übertragung früherer Freigaben/Schlüssel oder alter Bestehensnachweise.

Validierung: `node --test scripts/sitov-pronunciation-pretests-authoring.test.mjs` **48 PASS,0fail,0skip**; Authoring-CLI **PASS15/60,45pending,1440aliases,89inactivelegacy**; `git diff --check` PASS. Neue Negativfälle erkennen den tatsächlich alten vorhersehbaren Stand, ausschließlich erste richtige Positionen und ausschließlich .a-Schlüssel. Bijection/Same-answer/sonstigeFelder/Bytehistory/Spoken-Multimenge/Aliasorder sind direkt geprüft. Vorige Quellen-/Kontext-/männlicheFiguren-/Mreview-/Form-/Poolprüfungen bleiben erhalten.

Keine Änderungen am Produktionsvalidator, Epoch34-Audit, SQL, Runtime, M-Checkout, TTS, Audioassets, QA, Import oder Publikation; kein fullTS/Build/fullJest/native/Browser-Lauf. Bestehende Lernerdaten unberührt. Insgesamt weiterhin15/60 private Entwürfe und **NOT_RELEASE_READY**. Nach Commit/atomarem Status/Übergabe WAIT ohne Verlängerung.
