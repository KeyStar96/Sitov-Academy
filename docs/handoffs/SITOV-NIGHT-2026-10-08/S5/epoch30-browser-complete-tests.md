# S5 epoch30 – vollständiger Browser-Vortest (begrenzt)

Assigned source `2eb7c98897d44338395db6d6921930bbb0fda55a`; bestehende QA109 und Loopback3143 production build `1c041c6f1e57191ac0955092a635b21ebeed690e` laut M. DE390×844. Lease 17:17:44.819461Z–17:26:44.819461Z; SAVE ab 17:24:44.819461Z.

Genau ein eigener Schüler; vorher null Vokabel-, Verb-, Lernpfad-, Vortest- und PASS-Nachweise. Normale sichtbare Passwort-Anmeldung; canonical erster Text „Guten Tag, das bin ich“. Zwölf sichtbare Fragen wurden absichtlich falsch beantwortet und jeweils über „Speichern und weiter“ bzw. zuletzt „Antworten prüfen“ gespeichert. Keine direkte Start-/Submit-RPC, keine PASS-Injektion, keine Browser-Token-/Cookie-/React-State-Manipulation.

Um 17:24:19Z zeigte die letzte Frage nach „Antworten prüfen“ noch „Wird gespeichert …“ bei deaktivierten Antwort- und Navigationskontrollen. Das ist eine begrenzte Beobachtung, keine gemessene Latenz oder Ursachenbestimmung. Weitere tatsächliche Zustände, Cleanup und Ergebnis stehen in den epoch30 JSON-Belegen. FAIL/Review/Retake/PASS/Audio gelten nur bei explizitem tatsächlichem Nachweis. Keine Release-Freigabe.

Tatsächliches FAIL-Ergebnis beim Übergang zur regulären Logout-Bestätigung sichtbar: **0/12, Noch nicht bestanden**, zwei Weiterlernlinks und „Erneut versuchen“. Keine Wiederholung gestartet. Native SQL vor Cleanup bestätigt exakt einen failed-Versuch, null in-progress, null passed und null PASS-Nachweise. Normaler UI-Logout `/de/login?status=logout_success` mit „Du bist abgemeldet. Bis bald!“ bestätigt, temporärer Tab geschlossen und Viewport zurückgesetzt.

Exakte eigene Actor-/People-/Audit-/Outbox-/Account-Rate-Key-Bereinigung abgeschlossen. Basiszählungen und fachliche Hashes gleich; **187/188 vollständige Tabellenhashes gleich**, ausschließlich `platform_private.rate_limits` durch normalen Browser-Login unterschiedlich. Gemeinsamer Quellzähler wurde weder zurückgesetzt noch vermindert. Cleanup-Readback wurde zunächst vor Mutation wegen falscher `text_id`-Annahme bei `pretest_passes` abgebrochen; nach read-only Spaltenprüfung auf tatsächliches Schema korrigiert. Kein Produktcode geändert.

Gesamtergebnis **PARTIAL, keine Release-Freigabe**: echter vollständiger FAIL belegt; Review, Retake, PASS, Text-/Audiofreigabe bleiben offen. JSON-Struktur und Secret-Abwesenheit sowie `git diff --check` geprüft.
