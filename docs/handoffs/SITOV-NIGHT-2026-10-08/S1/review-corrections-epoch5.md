# Sitov Academy S1 – Epoch 5: drei Reviewkorrekturen

Basis eigener Commit3184af5, keine neuen Dependencies. Nur M-Reviewpunkte korrigiert; weiterhin DRAFT_PARTIALLY_ENFORCED.

1. get_sitov_access_catalog schließt private Items nicht pauschal aus: nur owner_id IS NULL ODER exakter aktueller Besitzer. item_allowed bleibt zusätzliche Autorisierung. Damit findet currentUserHasContentAccess bestehende erlaubte Privatwörter. Native Originalguard vor93 beweist: eigene private A1.1-Unit ist für normale Vollfreigabe sowie selected-empty/selected-subset erlaubt, sofern Trainer enabled; disabled und fehlende Niveau-Freigabe bleiben verboten. Diese Ausnahme ignoriert lediglich öffentliche Unit-Auswahl, nicht Niveau/Trainer. Alle fremden Privatkarten fehlen in Schüler- und Staffkatalogen.

2. legacy_unit_allowed wertet Schüler-Altgrants nur für freigegebene Teilniveaus A1.1–C1.2 aus, ohne C1-Verben zu erfinden. Native Originalguard vor93 und neuer Guard nach93 verweigern aktive C2.1-Unit, alte grobe B2-Unit sowie private C2.1-Unit trotz gespeicherter Niveaugrants. Staff-Autorenrechte bleiben unverändert. Keine Profil-/Grant-/Inhaltszeilen außerhalb synthetischer Fixtures geändert.

3. level_allowed verlangt für Item-Buckets entweder ausdrückliche all-refs=null oder mindestens einen ausgewählten Ref innerhalb der erlaubten Einheit. [{unit_id,refs:[]}] verleiht ohne andere Quelle kein Level; eine exakt erlaubte Karte verleiht das Auswahlcontainerrecht. Dies entspricht dem TS-Scopeverhalten. Keine neue Lern-/Bezahl-/Aussprachefreigabe.

Neue native Fixturefälle bauen eigene Units/Karten und unreleased/coarse Grantzeilen vor93 auf und vergleichen tatsächliche Originalguards; fremde Privatinhalte und disabled/none/selected-Vererbung werden geprüft. Bisherige Media/Historie/Replay/Rollback/de-Erweiterungsfälle bleiben erhalten.

Tatsächlich ausgeführt: SITOV_NIGHT_NATIVE=1 node --test supabase/tests/sitov-commercial-current-db.test.mjs (7 bestanden, PostgreSQL17 voller kanonischer Current92 +93); node --test supabase/tests/sitov-commercial-access.test.mjs (8 bestanden); npx jest __tests__/sitov-commercial-access.test.ts __tests__/sitov-commercial-access-integration.test.ts --runInBand --silent (14 bestanden); npx tsc --noEmit (Exit0); ESLint berührter Guard-TS-Dateien (Exit0, drei bereits bekannte unused-catch-Warnungen); git diff --check. Migration/VPS bytegleich. Keine Browser-/HTTP-/Audio-/Deploymentprüfung. S3 arbeitet weiter gepinnt3184; Änderungen werden ausschließlich viaM koordiniert. Noch alte Guards/Gates stehen unverändert in guarded-integration-epoch4.md; keine UI-/Fach-/Providererweiterung.

Nach Commit an M: WAIT. Der vollständige reale Kontenvergleich vor/nach einer späteren Produktionsmigration bleibt verpflichtend und ausstehend; keine RELEASE_READY-Aussage.
