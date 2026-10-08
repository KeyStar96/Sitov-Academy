# Sitov Academy – S1 Vertrags- und Bestandsaufnahme v0.1

Stand: 8. Oktober 2026, Arbeitseinheit 2. Basis `966a380f7a6118654f19750a9d62200795feb8c2`. **Vorschlag zur Freigabe durch M; keine Implementierung, Migration oder RELEASE_READY-Aussage.** Nur dieser Bericht und das Vertrags-JSON werden committet.

## Nachgewiesener Repository-Bestand

`lib/access/levels.ts`, `server.ts`, `units.ts`, `app/actions/admin.ts`, `StudentAccessModal`, `LessonAccessModal`, `useStudentAccess`, `lib/admin-navigation.ts`, normalisiertes Schema und SQL-Helfer wurden gelesen. Der Zahlungsentwurf liegt tatsächlich im Obsidian-Projekt unter `19_Bezahlsystem_und_Trial_Entwurf_2026-10-02.md`; gelesen, nicht geändert. Sein Vorschlag einer Profilrolle trial, feste A1.1-Stückzahlen und Abos werden durch den aktuellen Nutzerauftrag abgelöst.

Die Tabellen `student_level_access(auth_user_id,level)`, `learning_trainer_grants(auth_user_id,level,trainer,enabled,unit_mode)` und `learning_unit_grants` bleiben Quelle manueller Rechte. Fehlender Traineroverride bedeutet vorhandene Niveau-Freigabe für den Trainer; deaktiviert bedeutet kein manueller Trainerzugriff. `unit_mode=all` wird als `unit_ids=null` geliefert; `selected` mit null Grantzeilen als `[]`; mit Grantzeilen als exakte IDs. Keine Bestandskonvertierung, kein VIP-Backfill, kein Standardtrial und keine Ableitung aus Rechnungen/Buchungen.

Wichtig: Hochgeladene Videos und Präsentationen verwenden zusätzlich **niveauabhängige** Rechte über `media_private.published_video_unit_ids()` und `folder_allowed(uuid)`. Der aktuelle Test `sitov-learning-progress-media-visibility.test.mjs` dokumentiert ausdrücklich, dass Uploads und Dokumente unabhängig von ausgewählten Link-Einheiten erreichbar bleiben. Dies ist ein zu erhaltendes Bestandsrecht, kein Anlass, allen bisherigen Schülern eine neue Trainereinschränkung aufzuerlegen.

`loadLevelAccessProfile` nutzt React `cache`, keine persistente Next-Rechteablage. Neue Requests müssen Datenbankrechte erneut laden; innerhalb eines Requests darf dedupliziert werden. UI-Auswahl-/Query-Caches verleihen keine Rechte.

## Kommerzieller Vertrag

Profilrollen bleiben `student|teacher|admin`. VIP ist eine zusätzliche, ausschließlich serverseitig vergebene Schülerfreigabe. Sie erteilt sämtliche tatsächlich angebotenen Inhalte und Niveaus, keine Staffaktionen, keine fremden privaten Wörter und keinen Ersatz für den individuellen Aussprache-Vortest. C1-Verben werden dadurch nicht erfunden; unveröffentlichte Inhalte werden nicht sichtbar.

Effektive kommerzielle Rechte sind die Vereinigung unabhängiger Quellen: **bestehende manuelle Rechte ODER VIP ODER exakte Trial-Auswahl ODER gültiger bestätigter Niveaukauf**. Manuelle Einschränkungen wirken innerhalb ihrer Quelle; VIP-/Trial-/Kaufwiderruf ändert keine andere Quelle. Der Kauf eines Teilniveaus umfasst dessen angebotene Plattforminhalte. Eine neue globale Negativsperre ist nicht Bestandteil dieses Durchlaufs. Kontoeigene Inhalte bleiben kontoeigen; Empfehlungen, Fortschritt, Imports und UI-Sprache erzeugen keine weitere Quelle.

Trial heißt in der UI **Testzugang**, ist ein zusätzlicher Zugangsumfang eines student-Profils und kein Wissenstest/Abo. Ein gewähltes Niveau ist nur Auswahlcontainer: ohne expliziten Trainergrant gibt es aus Trial keinerlei Zugriff. Pro ausgewähltem Trainer muss die Auswahl Einheiten und deren Gegenstände enthalten. `unit_ids=null`: ausdrücklich alle aktuellen und künftigen veröffentlichten Einheiten. `[]`: keine. Ausgewählte IDs: nur diese, auch nach Seedimport. Item-Auswahl pro Einheit hat dieselbe all/none/selected-Semantik; bei selected dürfen spätere Imports den Umfang nicht vergrößern. Elternmetadaten sind nur Navigationscontainer; sie erlauben keine fremden Geschwister, Lösungen, Audios, Sidequests oder Folgeaufgaben. Itemzugriff prüft kanonische Niveau-/Trainer-/Einheitzugehörigkeit in SQL; unbekannte, fremde, deaktivierte oder falsch typisierte IDs werden abgewiesen, nicht still entfernt.

Trial wird **nicht** in `student_level_access` geschrieben. Dadurch entsteht keine versteckte Niveau-/Ordnerfreigabe. Trial-only eigene Wörter bleiben ohne separate ausdrücklich erteilte Featurefreigabe gesperrt. Bestandsnutzer behalten ihre bisherige Eigene-Wörter-Regel. Generische oder ungebundene Audioanfragen sind keine Trial-Funktion.

## Vorgeschlagene Schnittstellen (noch nicht eingefroren)

Bestehende SQL-Signaturen bleiben unverändert:

```sql
public.set_student_level_access(p_user_id uuid,p_levels text[]) RETURNS jsonb
public.set_student_trainer_access(p_user_id uuid,p_level text,p_trainer text,
 p_enabled boolean,p_unit_ids uuid[] DEFAULT NULL,p_replace_units boolean DEFAULT false) RETURNS jsonb
trainer_access_private.allowed(p_level text,p_trainer text) RETURNS boolean
trainer_access_private.unit_allowed(p_level text,p_trainer text,p_unit text) RETURNS boolean
learning_private.unit_allowed(p_unit_id uuid) RETURNS boolean
```

Neue Vorschläge:

```sql
public.get_sitov_access_context(p_student uuid DEFAULT NULL) RETURNS jsonb
public.set_sitov_student_vip(p_student uuid,p_enabled boolean,p_expected_revision bigint) RETURNS jsonb
public.set_sitov_student_trial(p_student uuid,p_manifest jsonb,p_expected_revision bigint) RETURNS jsonb
public.get_sitov_access_catalog(p_level text,p_trainer text) RETURNS jsonb
sitov_access_private.level_allowed(p_student uuid,p_level text) RETURNS boolean
sitov_access_private.unit_allowed(p_student uuid,p_unit uuid) RETURNS boolean
sitov_access_private.item_allowed(p_student uuid,p_kind text,p_item_id text) RETURNS boolean
public.get_sitov_billing_settings() RETURNS jsonb
public.set_sitov_billing_enabled(p_enabled boolean,p_expected_revision bigint) RETURNS jsonb
public.set_sitov_product_price(p_level text,p_amount_minor bigint,p_currency text,p_expected_revision bigint) RETURNS jsonb
public.start_sitov_checkout(p_level text,p_request_id uuid) RETURNS jsonb
```

`get_sitov_access_context(NULL)` liefert nur eigene Rechte; fremdes Profil nur autorisierte Staffsession. Private Helfer lesen kanonische Datenbankrechte und prüfen Actor/Self/Staff. Neue Public-RPCs entziehen PUBLIC/anon-Execute, erteilen nur nötige authenticated-Rechte und prüfen Staff/MFA bei Änderungen. Neue Tabellen erhalten explizite Grants/RLS beziehungsweise bleiben im privaten Schema. Keine JWT- oder user_metadata-Rechte.

Vorgeschlagene TS-Exports: `SitovContentRef={kind,id}`, `SitovTrialManifest`, `SitovAccessContext`; `currentUserHasContentAccess(ref):Promise<boolean>` als **kommerzieller** Guard neben bestehenden Level-/Trainer-/Unitfunktionen. S3 kombiniert ihn mit dem eigenen aktuellen Textvortest; der kommerzielle Guard allein berechtigt niemals zum Lesetext-/Audio-/Aufnahmeabruf. Metadatenkatalog und Vorteststart dürfen dagegen kommerziell autorisierte Texte vor dem Bestehen benennen, ohne Textlösungen auszuleiten.

Katalog-DTO: `{version:1,level,trainer,units:[{id,label,items:[{kind,id,label,published}]}]}`. Bestehende UUIDs/Textkennungen bleiben bestehen. Bekannte Arten: vocabulary_card, exercise, reading_text, video, verb, path_node, path_task, presentation; S2 liefert Special-Art und Zuordnung vor Freeze. S3 liefert reading_text-ID und Testversion; Bonus hängt am selben Vertrag. Katalog ist Metadatenquelle, keine Berechtigung. Pagination darf Auswahl nicht abschneiden. Verben müssen auf ihren kanonischen Katalogschlüssel und tatsächlichen Kontext aufgelöst werden.

Grantänderungen sperren dieselbe Schüler-Revisionszeile transaktional; erwartete Revision verhindert verlorene parallele Speicherungen. `revision_conflict` lädt aktuelle Auswahl neu; nie unbemerktes Überschreiben. Stabile Fehler: unauthenticated, forbidden, invalid_input, unknown_content, revision_conflict, payment_disabled, provider_not_configured, configuration_incomplete, unavailable. UI lokalisiert diese in de/en/ru/uk/tr.

## Deaktiviertes Bezahlgerüst

Zehn Produkte A1.1–C1.2, keine erfundenen Preise/Währungen/Abos. Preis bleibt NULL bis expliziter Administration. Neuer privater sitov-Billingbereich enthält Singletoneinstellung, Produkte/Preisrevisionen, Bestellungen und zugeordnetes Zahlungsereignis; bestätigte Kaufrechte haben eigene Quelle. Initiales `enabled=false,provider=none` wird mit `ON CONFLICT DO NOTHING` angelegt; Wiederanwendung überschreibt keine gespeicherte Einstellung.

Provideradapter ist server-only. `none` meldet ehrlich provider_not_configured und kann weder Checkout-URL noch erfolgreiche Bestätigung erzeugen. Stripe bleibt spätere Adapteroption ohne SDK/ausgehende Verbindung in dieser Einheit. Einschalten validiert Provider, serverseitige Konfiguration, Netzfreigabe und aktive Produktpreise; ohne betriebsfähigen Provider scheitert es. Jeder Start-/Checkoutpfad prüft den Schalter erneut serverseitig, inklusive direktem RPC. Ausschalten verhindert neue Kaufvorgänge, entzieht keinen bestehenden bestätigten Kauf.

Bestellstatus: created/pending/paid/failed/cancelled/refunded. Kein Client-Successparameter und keine offene Bestellung verleiht Rechte. Ein späterer bestätigender Adapter braucht rohe Signaturprüfung, eindeutige Provider-Event-ID, atomare Bestellung+Entitlement-Verarbeitung, Vergleich gespeicherter Nutzer/Produkt/Preis/Währung und Providerstatus sowie Reihenfolge-/Duplicate-Regeln. Solange diese nicht umgesetzt und getestet sind, gibt es keinen Bestätigungsendpoint und keine Liveaktivierung. Bestehende Buchhaltungsrechnungen bleiben eigenständig.

## Konkrete Datei- und Shared-Anforderungen

S1 nach gesonderter Codefreigabe: lib/access/{levels,server,units}.ts und neue sitov-Vertragsdatei; app/actions/admin.ts und neue Billingactions; StudentAccessModal/LessonAccessModal/useStudentAccess; lib/types/admin-staff.ts; neue Adminfenster/Seiten; lib/admin-navigation.ts und Shell-Iconzuordnung; lib/admin-i18n.ts/dictionaries nach genauem Ownership-Abgleich. Ziele: `/<lang>/admin/platform-access`, `/<lang>/admin/billing`; Schülerdetail-Link `platform-access?student=<uuid>`. S2/S4 liefern gewünschte Menüzielpfade/Schlüssel; S1 registriert sie, implementiert keine fremden Fachkomponenten. AdminDialog/Motion/TrainerHelp bleiben gemeinsame Grundlage.

SQL: reserviert `20261008213000_sitov_commercial_access.sql` und VPS `93_sitov_commercial_access.sql`, identischer Inhalt, eigener guarded Rollback. 66/90 nicht ändern. Bestehende private Guards werden erweitert; Item-RLS/RPCs prüfen zusätzlich echte Gegenstandsrechte. Alt-Medienpfade werden getrennt von neuen Trial-Medienrechten ausgewertet, nicht pauschal gekappt.

M besitzt supabase/schema.sql, standardization/learning.sql, lib/types/backend.ts, package.json, app/globals.css. Benötigt werden generierte neue DB-Signaturen/Tabellen, kanonische SQL-Spiegel und sprachneutrale Shared-Guards; keine Änderungen durch S1 in dieser Einheit. Der folgende Sprach-/Audioblock erfordert gesonderte Eigentümerzuordnung.

## Sprachsperren und Audio – konkrete offene Integrationspunkte

TS: lib/access/levels.ts:158; components/dashboard/TrainerAccessGuard.tsx:17; Levelpage:52/55 und path/pronunciation/vocabulary/vocabulary-focus/assess/train/videos-[id]-Routen. app/actions/vocabulary.ts:121/232/531/749 und vocabulary-focus.ts:24 geben für de leere Inhalte bzw. Sprachfehler zurück. lib/vocabulary-languages.ts koppelt Trainingsquellsprache an UI; diese Kopplung muss M fachlich lösen: de-Oberfläche darf Rechte nicht sperren, aber identische deutsche Übersetzungsfragen sind keine valide Übung. Gespeicherte Inhalts-/Antwortsprache bleibt unabhängig von UI. Keine erfundene stille Sprachumschaltung.

SQL-Mindestliste im normalisierten Schema: learning_private.allowed_unit_ids; trainer_access_private.allowed; teacher_dashboard_private.students/unit_allowed; vocabulary_private.check_retry_answer, submit_answer, submit_answer_once, submit_self_rating, submit_self_rating_once **einschließlich bestehender Overloads**; sitov_pronunciation_private.unit_allowed; zusätzliche Front-RPC-Sprachprüfungen um Schemazeilen 15720/15807. Historische Definitionen können durch spätere Migrationen überschrieben werden: endgültige Liste im nächsten Block durch pg_proc auf vollständig installierten 01–92 prüfen. 66/90-S3-Spiegelfunktionen gemeinsam koordinieren. Die German-Audio-Synthesesperren bleiben korrekt und werden nicht entfernt.

**Kritische Lücke:** lib/audio/neural-cache.ts:29/52 verwendet getPublicUrl. Ein öffentlicher Cache erlaubt bekannte Objekt-URLs unabhängig von neuem Trial/RLS. Für belastbare Zugriffssperren muss M Cache-Bucket/Autorenimport auf privat umstellen und eine authentifizierte, itemgebundene Ausgabe beziehungsweise private signierte URL koordinieren. Bestehende Audioobjekte/Text-Hashes/Wortmarken bleiben erhalten. Prepared-content-Aufrufer müssen ihre kanonischen ContentRefs mitliefern; keine Text-Hash-Alleinfreigabe. Dies ist vor RELEASE_READY zu lösen, nicht durch UI zu verdecken.

Vorgeschlagener gemeinsamer Audiovertrag:

```sql
sitov_access_private.audio_allowed(p_student uuid,p_kind text,p_item_id text,p_audio_path text) RETURNS boolean
public.authorize_sitov_content_audio(p_kind text,p_item_id text,p_audio_path text) RETURNS jsonb
```

Der Public-RPC bindet p_student stets an auth.uid(); Fremdnutzung ist kein Clientparameter. Er prüft kommerzielles Itemrecht, kanonische Audiozuordnung zum gespeicherten Inhalt und für reading_text zusätzlich S3s aktuellen bestandenen Texttest. Ein vom Client gelieferter Pfad oder Text-Hash genügt nie. Shared Assets dürfen über eine tatsächlich zugängliche kanonische ContentRef wiederverwendet werden; keine Freigabe durch bloße Cacheexistenz. Die deutsche Assetzuordnung enthält unveränderten gespeicherten Wortlaut, Qwen-Profilfingerprint und vorhandene Wortmarken. DTO enthält nur autorisierten privaten Bucket/Pfad beziehungsweise maschinenlesbaren Fehler; ausschließlich der authentifizierte Server signiert nach erneuter Prüfung (vorgeschlagene Frist 60 Sekunden, private/no-store). M koordiniert lib/audio/neural-cache.ts, prepared-content.ts, alle Prepared-content-Aufrufer/Audioactions, Bucketpolicies, Importadapter und Schema/DB-Typen. Keine Neuaufnahme-/Importpflicht bei unverändert passenden existierenden Assets; kein deutscher Synthese-Fallback.

Historische Schüler-/Lehreraufnahmen verwenden einen getrennten gespeicherten Submission-/Message-Bezug mit bestehender Ownership/Staffprüfung; sie dürfen keinen neuen Text-/Audio-/Aufnahme-/Submitzugriff öffnen. S3s gemeldeter can_record-Bypass benötigt text-/testversionsgebundene neue Uploadtickets: ein beliebiger historischer Erfolg oder eine frühere Aufnahme darf keine neue Storage-Schreibberechtigung liefern. Globale can_record-Berechtigung ist kein Ersatz für eine aktuelle Textautorisierung. M/S3 besitzen diesen Uploadteil; S1 liefert nur kommerzielles Itemrecht.

Bestehende signierte URLs: course-assets 60 Sekunden (`app/api/course-assets/route.ts`); Ausspracheaufnahmen 3600 Sekunden (`lib/pronunciation-playback-server.ts`). Nach Widerruf werden neue Signierungen abgewiesen, bereits ausgegebene URLs haben Restgültigkeit. [Supabase dokumentiert ihre Gültigkeit bis zum Ablauf](https://supabase.com/docs/guides/storage/serving/downloads). Öffentliche Cache-URLs haben dagegen keine solche kurze Restfrist. Echtes Storage-HTTP-Verhalten muss zusätzlich zum SQL-Test verifiziert werden.

## Reproduzierbarer nächster Testblock und Rückweg

Vorhandenes PGlite 0.3.14/Jest 29.7.0/Next 16.3.8 verfügbar; keine Live-DB verwendet. `createCurrentDatabase` allein endet standardmäßig bei Migration 58, **nicht** aktuellem 92-Stand. Neuer isolierter Full-Runner muss normalisierte Basistoolchain plus sämtliche VPS-Migrationen 59–92 in Runnerreihenfolge inklusive Enum-Transaktionsgrenzen, Security- und Storage-Prerequisites anwenden. Bestehender 91-Test ist Vorlage für aktuelle Medienrechte; historische trainer-access-Suite bleibt Ergänzung.

Vor 93: vollständige Fixtures mit Vollniveau, Trainerdeny, fehlendem Override, all/none/selected Units, eigener Karte, veröffentlichtem Upload/Präsentation, Link, vorbereitetem Audio und historischer Aufnahme/Review/Progress/Streak. Für jede Fixture alle zehn Niveaus, vorhandenen Trainer und kanonischen Unit-/Item-/Medienobjekte als effektive kommerzielle Rechte erfassen. Nach 93, Wiederanwendung, Anmeldung, Sprachwechsel, Seedimport und Payment-off dieselbe Matrix vergleichen; **keine neue Einschränkung**, nur explizit gewünschte de-Sprachneutralität separat als erwartete Erweiterung markieren. Rechtequellen und Fortschritts-/Historienzeilen zusätzlich byte-/zeilengetreu vergleichen. Keine persönlichen Bestandsdaten in Logs/Git.

Codeblock-Befehle (hier **nicht ausgeführt**): `node --test supabase/tests/sitov-commercial-access.test.mjs`; gezielte Jest-Access-/Actions-Suites; `npx tsc --noEmit`; ESLint berührter Dateien; relevanter Build; Browserfälle 320/390/1440, fünf Sprachen, Tastatur/Fokus/Screenreader/Reduced Motion. Sicherheitsmatrix: VIP ohne Staffrechte; Trial all/none/selected Items; fremde/unbekannte IDs; direkte RPC/REST/Storage; Selbstgrant/Schalter; parallele Grants/Widerruf; pending/manipulierter Checkout; Provider fehlt; gekaufte Rechte überleben Payment-off/VIP-Widerruf.

Migrationsrückweg darf neue aktive Rechte nicht still vernichten: zunächst Schalter aus und neue Schreibwege stoppen; guarded Rollback bei neuen Grants/Käufen verweigern bzw. gesicherten Rückweg verlangen. Legacytabellen bleiben unverändert. Vor/nach Produktionsmigration ist der tatsächliche vollständige Kontenvergleich ein **ausstehendes verpflichtendes Deployment-Gate** unter M; keine Produktivmigration in COMMIT_AND_HANDOFF.

Nachweise dieser Einheit: nur Repository-/Dokumentlektüre und Setup-Toolchain; **keine Tests, Browserprüfung, DB-Migration, Audio-/Publikationsänderung oder Deployment**. Offene Punkte: M-Vertragsfreeze, S2/S3-Kataloge, genaue Code-Dateifreigabe, private Audioausgabe, vollständige 92-Fixture, UI-unabhängige Trainingsquellsprache und Livevergleich. Nächste Phase erst mit neuer START-Epoch.
