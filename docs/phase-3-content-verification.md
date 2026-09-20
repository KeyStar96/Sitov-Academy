# Phase 3.4–3.5 — Zielwerte und Inhaltslektorat

Freigabe: 20.09.2026. S2 wurde vor Umsetzung anhand Repository und produktivem, ausschließlich lesendem Datenbankzugriff durchgeführt. Keine gravierenden technischen Blocker; die ausdrücklich geforderte Freigabesperre betrifft alle 604 vorhandenen Grammatikaufgaben.

## S2 — Verifikation

| Datei / Tabelle / Spalte | Erwartet | Gefunden | Delta |
|---|---|---|---|
| `lib/grammar-validation.ts`, `grammarWriteSchema` | Pflicht-Zielwerte | Vorhandener Write-Validator, kein `target_form` | Pflichtarray nichtleerer Strings ergänzen |
| `components/admin/ExerciseCMS.tsx` | Eingabe, Sperre, Bestandsstatus | Editor vorhanden, keine Zielwerte oder Unvollständig-Markierung | Eingabe und Validierung in fünf Sprachen |
| Schülerkarten / `app/actions/exercises.ts` | Prompt mit `[Zielwert]` | Deutsche Satz-/Fragefelder, keine Zielwertanzeige | Zielwertanzeige und Auslieferungsfilter |
| `learning_exercises.content` | Bestehende Zielwerte / sichere Sperre | 604 Aufgaben; 0 mit Zielwerten | Bestand erhalten, Status berechnen, Schüler-RLS und Bewertungs-RPC sperren |
| `grammar_translations` | Lokalisierte Übersetzungsaufforderung | Nur `hint`, `smart_hint`, `explanation` | Eigenes `prompt`-Feld; normalisierter CMS-Schreibweg |
| `vocabulary_translations`, `grammar_translations`, `course_translations` | Audit de/en/ru/uk/tr | Alle Tabellen vorhanden; deutsche Vokabeln/Kurstexte teilweise kanonisch in Basistabellen | Zeilen-/Feldlücken und Sprachheuristiken getrennt erfassen |
| `learning_exercises`, `learning_reading_texts` | Deutsche Inhalte geschützt | 604 Aufgaben und 149 Lesetexte ohne Sperrzeichen; Schutz fehlt | INSERT-/UPDATE-Trigger, NFC-/Unicode-Prüfung |
| `docs/audit/content-lektorat.md` | Lektoratsbericht | Noch nicht vorhanden | Reproduzierbaren Bericht mit allen 15 Tabelle/Locale-Kombinationen anlegen |

## Verhalten

`target_form` liegt im kanonischen Aufgabeninhalt. PostgreSQL berechnet `content_status` als ENUM; Staff sieht unvollständige Aufgaben, Schüler können diese weder lesen noch per direkter Bewertungs-RPC abschließen. Die Migration erfindet keine Zielwerte und verändert keine vorhandenen Aufgabentexte. Der CMS-Editor und der aktive Manuskriptimport verlangen ausdrücklich gepflegte Zielwerte.

Übersetzungsaufforderungen werden in `grammar_translations.prompt` gespeichert und in der gewählten UI-Sprache mit deutschen Zielwerten angezeigt, etwa `Как вас зовут? [heißen]`. Fehlt diese Sprachfassung, liefert die App die Übersetzungsaufgabe nicht aus. Übersetzte Hinweise bleiben von deutschen Satzfeldern getrennt.

Die Trigger schützen deutsche Satz-, Antwort-, Auswahl-, Zielwert- und Themenfelder sowie Lesetext/Fokus. NFC-Normalisierung verhindert Umgehungen mit zerlegten Buchstaben; kyrillische Erweiterungsblöcke und die sechs geforderten türkischen Zeichen werden geprüft. Unveränderte Altdaten erlauben Metadatenpflege; inhaltliche Änderungen müssen die gesamten geprüften Felder bereinigen. Öffentliche Speicher-RPCs liefern explizite JSONB-Fehler und rollen fehlgeschlagene Schreibvorgänge atomar zurück.

Audit und redaktioneller Befund: [content-lektorat.md](audit/content-lektorat.md), vollständige IDs/Feldpfade im zugehörigen JSON. Der Audit ist keine automatische Übersetzung. Die 604 Zielwerte sowie die dokumentierten Übersetzungslücken und zwei deutschen Hinweise in russischen Zeilen müssen redaktionell bearbeitet werden.

## Abnahme und Betrieb

Die abschließenden Test-, Backup-, Rollback- und Aktivierungsnachweise werden nach produktiver Abnahme hier ergänzt. RAM-/CPU-Limits bleiben unverändert.
