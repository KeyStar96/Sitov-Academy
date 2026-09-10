# Tatsächlicher globaler Lernreset — 10. September 2026

Ausdrücklicher Auftrag: alle Lernfortschritte aller Studenten und alle gespeicherten Aufnahmen löschen. Die zuvor bestätigte Ausnahme für verbindliche Kursbuchungen gilt weiterhin. Dieser Vorgang wurde **live ausgeführt**; er ist von der vorherigen Implementierung der individuellen Profil-Reset-Funktion zu unterscheiden.

Projekt: `wcaslabeiwtvygxtzcio`. Abschluss erneut um **20:20:24 UTC (22:20:24 Europe/Berlin)** geprüft. Der innerhalb der Starttransaktion erfasste Bestand umfasste **sechs Schülerprofile**. Während der Vorprüfung war ein weiteres Schülerprofil hinzugekommen; deshalb wurde keine veraltete Fünferliste verwendet.

## Gelöschte Daten

| Bestand | Vorher | Nachher |
| --- | ---: | ---: |
| Schüler: `user_vocabulary_progress` | 462 | 0 |
| Schüler: `vocabulary_direction_progress` | 924 | 0 |
| Schüler: `user_exercise_progress` | 6 | 0 |
| Schüler: `vocabulary_learning_state` | 1 | 0 |
| Schüler: `vocabulary_onboarding` | 1 | 0 |
| Schüler: `vocabulary_private.answer_receipts` | 20 | 0 |
| `submissions` | 7 | 0 |
| `teacher_feedback` | 2 | 0 |
| `pronunciation_messages` | 1 | 0 |
| Storage `audio_submissions` | 18 | 0 |
| Storage `pronunciation_audio` | 2 | 0 |

Die Vokabeltabellen enthalten unterschiedliche Darstellungen derselben Lernstände; 462 und 924 sind keine addierte Zahl individueller Wörter. Auch verwaiste Aufnahmen und alte Lehrerfeedback-Dateien wurden entfernt: Elf der 20 Dateien waren keinem aktuellen Profil zuzuordnen und wären bei einem reinen Einzelkonto-Reset nicht vollständig erfasst worden.

## Ausführung und Verifikation

1. Vorherbestände und Prüfsummen erhaltenswerter Tabellen erfasst. Bestehende, geprüfte Reset-RPCs für alle aktuellen Profile gestartet, um während der Dateilöschung Schreibvorgänge zu sperren.
2. Eine zeitlich begrenzte Wartungsfunktion entfernte ausschließlich die **20 vorher erfassten Objektpfade** der zwei Aufnahme-Buckets über `storage.from(bucket).remove(names)`. JWT-Prüfung plus zusätzliche zufällige Einmal-Zugangsberechtigung mit SHA-256-Vergleich; keine freie Bucket-/Pfadwahl durch den Aufrufer. Unberechtigter Aufruf lieferte HTTP 403. Der Service-Schlüssel blieb ausschließlich in der Supabase-Laufzeit.
3. Storage-API bestätigte HTTP 200 und **18 + 2 gelöschte Dateien**. SQL las nur Storage-Metadaten; keine direkte SQL-Löschung von `storage.objects`.
4. Nach bestätigten leeren Aufnahme-Buckets wurden die sechs Schüler-Resets in einer Transaktion abgeschlossen. Beim Lehrer wurde ausschließlich die temporäre Sperre aufgehoben; seine zwei Grammatikfortschritte blieben erhalten.
5. Nachkontrolle: sämtliche oben genannten Zielbestände null, keine aktiven Resetjobs und keine verbliebenen Audio-Manifeste. Abgeschlossene interne Resetjobs bleiben als Vorgangshistorie erhalten.
6. Die Wartungsfunktion `maintenance-learning-audio-reset-20260910` wurde unmittelbar auf eine inaktive Antwortimplementierung ohne Datenbank-/Storage-Zugriff umgestellt. HTTP **410** geprüft; temporäre lokale Zugangsdatei gelöscht. Der Funktionsname bleibt als stillgelegter Eintrag bestehen.
7. Kein Datenbankschema, keine RLS-Regel, keine vorhandene Edge Function und kein Auth-Konto geändert. Schema und generierte Typen bleiben deshalb unverändert. Kein Frontend-Deployment.

## Erhaltenswerte Daten

Vorher-/Nachher-Prüfsummen vergleichen vollständige Tabellenzeilen; bei den erhaltenen Storage-Dateien Objekt-ID, Bucket und Pfad.

| Tabelle / Bestand | Vorher | Nachher | Prüfung |
| --- | ---: | ---: | --- |
| `profiles` | 7 | 7 | identisch |
| `users` | 78 | 78 | identisch |
| `registrations` | 84 | 84 | identisch |
| `enrollments` | 112 | 112 | identisch |
| `monthly_course_bookings` | 1 | 1 | identisch |
| `manual_invoice_status` | 0 | 0 | identisch |
| `exercises` | 604 | 604 | identisch |
| `vocabulary_cards` | 512 | 512 | identisch |
| `pronunciation_prompts` | 149 | 149 | identisch |
| `retained_storage` | 46 | 46 | identisch |
| `teacher_exercise_progress` | 2 | 2 | identisch |
| `courses` | 12 | 12 | identisch |
| `course_exceptions` | 46 | 46 | identisch |
| `cancellations` | 0 | 0 | identisch |
| `trial_lessons` | 15 | 15 | identisch |
| `teacher_student_notes` | 0 | 1 | zusätzliche Zeile während des Betriebs; kein Ziel der Löschung |
| `videos` | 3 | 3 | identisch |

Die während der Ausführung hinzugekommene Lehrernotiz wurde nicht gelesen oder verändert. Für diesen operativen Vorgang gab es keine Mutation an `teacher_student_notes`. Die übrigen Vergleichsbestände haben identische Anzahlen und Prüfsummen. Insbesondere bleiben 84 Registrierungen, 112 Einschreibungen, alle Kursinhalte sowie 44 generierte TTS-Dateien und zwei Assets erhalten.

Bereits offene Lernseiten sollten neu geladen werden. Ein extern ausgeführter globaler Reset sendet keinen Browser-Broadcast an entfernte Sitzungen; nach Abschluss ist neues Lernen wieder erlaubt. Die Nullprüfung beschreibt den bestätigten Abschlusszeitpunkt, keine dauerhafte Schreibsperre.

