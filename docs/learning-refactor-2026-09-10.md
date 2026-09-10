# Lernbereich: Theme, sofortige Entscheidungen und Neural-Audio

Stand: 10. September 2026. Änderungen im Repository implementiert, Frontend noch nicht auf Vercel veröffentlicht.

## Sichtbares Verhalten

- Das gespeicherte Theme bzw. System-Theme wird mit einem synchronen Head-Script vor Paint gesetzt. Root, alle betroffenen Dashboard-/Auth-/Registrierungs-Ladezustände und Lernkarten beziehen dieselben Academy-Farben. Im Darkmode sind Canvas `#121417`, Surface `#1b1e23` und Skeleton `#252830`; es gibt keinen weißen Zwischenzustand. Der Lightmode bleibt verfügbar.
- Wörterliste, eigene Vokabeln, Reset-Dialog und Phasen-Verteilung verwenden gemeinsame Flächen, Schrift und Rundungen. Die reservierte Dialoghöhe bleibt beim Laden und Tabwechsel gleich. Phasen werden als beschriftete horizontale Balken ohne horizontale Scrollleiste dargestellt. Fokusfalle, Escape, Pfeiltasten-Tabs und mindestens 44px große Bedienelemente sind vorhanden.
- Profil-, Video-, Übungs- und Audioansichten verwenden ebenfalls die Academy-Tokens. Die bestehende Recorder-/Analyser-Logik blieb beim Klassenwechsel unverändert.
- Wortentscheidungen und Ersteinstufung wechseln synchron im Click-Handler zur nächsten Karte. Es gibt keine sichtbare Saving-/Autosave-Unterzeile und keine von laufenden Requests gesperrten Wortbuttons. Satzaufgaben warten auf das autoritative deutsche Rechtschreiburteil.
- Fehlgeschlagene und bereits nachfolgend eingegebene Entscheidungen bleiben in einer geordneten Queue. Retry verwendet dieselbe Request-ID. Exit und Assessment-Skip warten still auf Bestätigungen. Beim Logout/Kontowechsel lehnt der Server Antworten eines zuvor gebundenen Schülers ab. Blockiertes localStorage und UI-Callbackfehler können bestätigte Antworten nicht mehr erneut senden oder die Queue blockieren.

## Satzmatrix

| Oberfläche | Quellsatz | Ziel |
| --- | --- | --- |
| de | Fremde Muttersprache aus Profil; andernfalls ru, danach verfügbare en/uk/tr | Exaktes Deutsch |
| en | en | Exaktes Deutsch |
| ru | ru | Exaktes Deutsch |
| uk | uk | Exaktes Deutsch |
| tr | tr | Exaktes Deutsch |

Fehlende Quellen werden nicht auf Deutsch zurückgesetzt. Eine mit dem deutschen Ziel identische Quelle wird nicht angeboten. `promptLanguage` kennzeichnet die tatsächlich angezeigte Sprache. Die DB bewertet weiterhin bytegenau, inklusive Großschreibung, Umlauten, Leerzeichen und Satzzeichen; ein clientseitiges `isCorrect=true` kann die Satzprüfung nicht umgehen.

## Audiofluss und Grenzen

`components/exercises/SolutionAudioButton.tsx` wird vom tatsächlichen Vokabelclient `components/vocabulary/VocabCardSession.tsx` sowie Übungen und Aussprache verwendet. Im Repository existiert keine `VocabularyTrainer.tsx`.

1. Die sichtbare Vokabel lädt ihre vorhandene `audio_url` direkt in ein natives HTMLAudioElement. Fehlende Aufnahmen werden im Hintergrund vorbereitet; gleiche Anfragen sind dedupliziert.
2. `app/actions/generate-audio.ts` validiert Text, Sprachcode, authentifizierten Nutzer, explizite Rolle sowie bei Kartenbezug den Levelzugriff. Nur das kanonische deutsche Kopfwort einschließlich Artikel darf dessen Audiofeld aktualisieren.
3. Der SHA-256-Dateiname enthält normalisierten Text, Stimme, Format und Tempo. Der Server prüft zuerst Supabase Storage `audio_cache`.
4. Auf einem Cache-Miss synthetisiert `lib/audio/edge-tts.ts` im Node-Runtime eine MP3. Das gepinnte MIT-Paket [node-edge-tts](https://github.com/SchneeHertz/node-edge-tts) liefert die aktuelle Edge-Protokoll-/Token-Unterstützung. Der eigene Streamadapter besitzt den WebSocket, begrenzt Handshake auf 8s, Gesamtzeit auf 15s und Daten auf 1MiB; kein Python, temporärer Audiostream oder Browser-Speech-Fallback.
5. Service Role lädt die MP3 unveränderlich hoch. Bei parallelen Uploads wird der vorhandene Gewinner wiederverwendet. `audio_url` wird nur bei leerem Feld und unverändertem Kopfwort/Artikel gesetzt. Lehreraufnahmen und Übersetzungsaudios überschreiben dieses Feld nicht.
6. Beim Abspielen pausiert der zuletzt gewählte Player den vorherigen. Ein Kartenwechsel beendet alte Medien, verspätete Requests können sie nicht starten. Falls Safari nach asynchronem Laden eine weitere Geste benötigt, erscheinen native Controls und eine lokalisierte Aufforderung.

Stimmen: `de-DE-KatjaNeural`, `ru-RU-SvetlanaNeural`, `uk-UA-PolinaNeural`, `en-US-AriaNeural`, `tr-TR-EmelNeural`. Neue Audiohinweise stehen unter `neural_audio` in allen fünf Dictionaries. Native Browser-Controls verwenden zusätzlich die Browsersprache.

Es ist kein kostenpflichtiger TTS-API-Key nötig. Microsofts Edge-Endpunkt bietet jedoch keine von uns kontrollierte Verfügbarkeitsgarantie; Supabase Storage/Egress unterliegt dem jeweiligen Projekttarif. Auth-/Miss-Limits greifen über den vorhandenen Rate-Limiter. Ohne dessen gemeinsam konfigurierten Redis-Speicher gelten Fallback-Limits pro Prozess, nicht global über alle Serverinstanzen.

## Live-Migrationen

Projekt: `wcaslabeiwtvygxtzcio` (SitovAcademyv2). Schema und vorhandene Storage-Policies vor Ausführung geprüft.

| Repository-Migration | Live-Version | Ergebnis |
| --- | --- | --- |
| `20260910151457_neural_audio_cache.sql` | `20260910153135` | Öffentlicher MP3-Bucket, 1MiB-Dateilimit, nur `audio/mpeg`, keine Client-Schreib-/List-Policy |
| `20260910151533_vocabulary_answer_receipts.sql` | `20260910153144` | Private RLS-Tabelle und owner-geprüfter Retry-RPC; alte Grading-RPC unverändert |

Die private Receipt-Tabelle hat absichtlich weder direkte Client-Grants noch Policies. Nur die authentifizierte private Funktion liest/schreibt Belege. Der öffentliche Wrapper ist SECURITY INVOKER; beide neuen Funktionen besitzen einen festen leeren search_path. Authentifizierte Wiederholung mit gleicher Request-ID und demselben Payload liefert die ursprüngliche Antwort ohne erneute Bewertung oder Cursoränderung. Abweichende Payloads und fremde Nutzer werden abgewiesen. Belege bleiben bei einem Lektionsreset erhalten.

Datenintegrität unmittelbar vor/nach beiden Migrationen:

| Daten | Anzahl | Unveränderte Prüfsumme |
| --- | --- | --- |
| `vocabulary_cards` | 512 | `4315b61310179ab7d07ac2d49efe4e1d` |
| `vocabulary_direction_progress` | 390 | `543b9ee80bcd6c4b886c7ebca4986904` |

Keine vorhandenen Nutzerdaten wurden gelöscht oder zurückgesetzt. Vorhandene Storage-Buckets/-Policies wurden nicht verändert. `supabase/schema.sql` wurde ergänzt und `supabase/database.types.ts` mit den erneut generierten Live-Typen abgeglichen.

## Verifikation

- **775 Jest-Tests in 48 Suites bestanden**, darunter schnelle Entscheidungen bei langsamen Replies, letzte-Karte-Fehler, Reihenfolge/Retry, fremde Actor-IDs, blockierter Browserspeicher, Satzmatrix, Audio-Auth/Cache, WebSocket-Timeout/Frühschluss/SSML-Escaping, native Player und konkurrierende Requests.
- **72 isolierte PostgreSQL-Tests bestanden**, darunter additive Migrationen, unveränderte Altwerte, RLS, atomare Receipts, verloren gegangene Antworten, Payload-/Nutzerbindung, Satzurteil und neue Bucket-Kompatibilitätsprüfung. Diese Tests verwenden PGlite, keine Produktions-Testnutzer.
- Produktionsbuild einschließlich TypeScript erfolgreich. Vorhandene Hinweise zu Middleware-Konvention/Browserslist und fehlenden lokalen Supabase-Builddaten bleiben sichtbar; sie sind keine neu entstandenen Compilerfehler.
- Echter Microsoft-Aufruf mit dem finalen begrenzten Adapter: Katja 13.248 Bytes, Svetlana 16.128 Bytes, Polina 14.256 Bytes; gültige MP3-Frames erfolgreich empfangen.
- Browserprüfung mit den realen React-Komponenten und aktuellen Styles, gemockten Server Actions: Wörter-/Phasenmodal bei 320px, Darkmode-Skeletons bei 320/430px, helle ukrainische Oberfläche, russische Playertexte und simulierte Safari-Gestensperre. DE-Satzansicht zeigt russische Quelle und deutsches Eingabefeld bei 320×740px ohne horizontalen oder vertikalen Seitenüberlauf. Eine Wortentscheidung zeigt die Folgekarte bereits bei der ersten Browserbeobachtung (513ms inklusive Automationszeit), während der gemockte Write 5.000ms wartet.
- Echter Next.js-Produktionsserver: `/de/login` antwortet HTTP200, Theme-Bootstrap steht vor `<body>`. Browsermessung bei 320px bestätigt Root und Body `rgb(18,20,23)`, `data-theme=dark` und 320px Dokumentbreite. Dafür wurden ausschließlich lokale Preview-Platzhalter für die öffentlichen Supabase-Variablen verwendet.
- Ein vollständiger authentifizierter Live-Durchlauf vom lokalen Browser über Server Action bis zum Storage-Upload wurde ohne lokale Produktionszugangsdaten nicht ausgeführt. Provideraufrufe, Server-/Cachepfade und Live-Schema wurden getrennt verifiziert. Browserfixture nutzt synthetische Audiodateien und keine Schülerdaten.
- **Reload-Grenze:** Vollständiges Tab-Schließen/Hard-Reload kann noch nicht versandte In-Memory-Entscheidungen verlieren. Bestätigte Daten und RPC-Retries sind geschützt; eine dauerhafte lokale Outbox ist nicht Teil dieser Änderung.

## Vorhandene Supabase-Advisors

Die nachgelagerten Prüfungen melden keine neue exponierte Definer-RPC. Der Info-Hinweis [RLS ohne Policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) für die private Receipt-Tabelle ist beabsichtigt: direkte Zugriffe sind ausgeschlossen.

Vorhandene Hinweise bleiben: [änderbarer search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable) bei `handle_registration_confirmation`, ältere öffentlich aufrufbare [Definer-Funktionen](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [deaktivierter Schutz vor kompromittierten Passwörtern](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), ältere [RLS-Initplan-Hinweise](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan), [mehrfache Policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies) sowie [nicht indizierte Fremdschlüssel](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys). Bestehende Indizes wurden nicht aufgrund von Nutzungsstatistiken entfernt.
