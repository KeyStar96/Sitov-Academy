# Lesbarkeit und Grammatiknavigation — 10. September 2026

## Ergebnis

Die Grammatiknavigation hält gelöste Auswahlfelder stehen, macht die Weiter-Aktion nach dem Feedback sichtbar und zeigt beim Kartenwechsel die neue Aufgabe unter der festen Kopfzeile. Die Position wird nur bei bewusstem Navigieren oder beim Lösen angepasst; Antworten, Hinweise und Speichervorgänge ziehen Lernende nicht wieder zum Kartenanfang.

Kleine unterstützende Texte wurden gezielt vergrößert: Lernstatus, Vokabelbeschriftungen, Aussprachehinweise, Textauswahl, Chat-Bedienung, Profilformulare und Videoverweise verwenden jetzt überwiegend 1rem statt 12–15px. Grammatik-Anweisungen und Erklärungen verwenden 1.125rem. Große Aufgabenwörter und Vorlesetexte bleiben erhalten. Im Vokabel-Vollbild bleiben Beispielsätze auch bei geringer Bildschirmhöhe erreichbar; die Arbeitsfläche darf scrollen.

Das bisherige Theme-Symbol öffnet jetzt „Darstellung & Lesbarkeit“. Hell und Dunkel lassen sich jeweils mit hohem Kontrast kombinieren. Dieselben Einstellungen stehen unter der Sprachauswahl im Profil. Die Auswahl gilt auf dem jeweiligen Gerät und ist in DE/EN/RU/UK/TR übersetzt. Gerätevorgaben, Neuladen, Tab-Synchronisierung und blockierter Browser-Speicher werden berücksichtigt.

## Prüfung der Oberflächen

Vor den visuellen Änderungen wurden Ansichten des bestehenden Grammatik- und Vokabeltrainers aufgenommen. Der Prüf-Browser war nicht als Schüler angemeldet. Für den Lernablauf wurden deshalb dieselben Komponenten mit lokalen Beispieldaten und ersetzten Persistenz-/Audioaufrufen gerendert. Die temporäre Route wurde anschließend vollständig entfernt. Kopfzeile und Breadcrumb der Vorschau waren eine Nachbildung des gemeinsamen Layouts; Profil-Einstellung, Vokabel-Lernbildschirm und Lernkomponenten stammten aus dem Produktcode.

| Schritt | Befund vorher | Ergebnis nachher |
| --- | --- | --- |
| 1. Grammatik lösen und weitergehen, 390 × 650 | Reiner Fokus positioniert die wiederverwendete Schaltfläche nicht zuverlässig; gelöste Lückentext-Chips verschwinden. | Chips bleiben deaktiviert sichtbar. Nach dem Lösen sind Feedback und Weiter-Aktion erreichbar, die nächste Überschrift erscheint unter dem Header. Auch Abschlussansicht geprüft. |
| 2. Vokabelkarte, 390 × 844 | Beschriftungen und Metadaten teilweise 12–13px. | Unterstützende Texte 16px; große Lernwörter unverändert. Heller und dunkler Hochkontrast visuell geprüft. |
| 3. Vokabelkarte, 640 × 360 | Die Beispielsätze wurden unter 450px Höhe ausgeblendet. | Beispielsatz und Antwortaktionen bleiben in der scrollbaren Arbeitsfläche erreichbar. |
| 4. Einstellungen, 320 × 568 | Nur Hell-/Dunkel-Schalter. | Neues Menü passt in die schmale Ansicht. Fokus beim Öffnen, Escape, Auswahl und Beibehaltung nach Reload geprüft. Deutsche und längere russische Texte umbrechen. Eine zusätzliche Prüfung des mobilen Hauptmenüs deckte ein Abschneiden durch dessen Scrollcontainer auf; das Darstellungsfenster wird deshalb als festes Body-Portal gerendert. Mobile Navigation und Vokabel-Vollbild wurden anschließend erneut geprüft. |
| 5. Aussprache, 1280 × 900 | Textauswahl, Schwerpunkt und Lesetipp überwiegend 14px. | Diese Informationen sind 16px; der eigentliche Lesetext bleibt 20px. Waveform-/Aufnahmefunktionen werden nicht geändert. |

Die geschützten Seiten wurden nicht mit echten Schülerdaten durchlaufen. Aufnahme, Upload, Feedbackversand und Fortschrittspersistenz waren kein Gegenstand dieses UI-Tests. Keine Testbuchungen oder Schüler-Lerndaten wurden angelegt. Eine vollständige WCAG-Zertifizierung oder Prüfung jeder Kombination aus Browser, Hilfstechnologie und Schriftvergrößerung wird damit nicht behauptet.

## Technische Nachweise

- 950 isolierte Anwendungstests in 66 Suites bestanden. Darunter neue Regressionen für Karten-/Weiter-Fokus, erhaltene Antwortchips, reduzierte Bewegung, Kontrastpräferenzen und Tastaturbedienung.
- 22 Farbprüfungen sichern für die gemeinsame Hochkontrastpalette mindestens 7:1 bei den getesteten Text-/Flächenkombinationen sowie 3:1 bei Bedienelement-Konturen. Das Ziel folgt der [W3C-Erläuterung zu erhöhtem Textkontrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html); diese Paletteprüfung ersetzt keinen vollständigen Seitenaudit.
- TypeScript ohne Fehler; `git diff --check` ohne Befund.
- Produktionsbuild mit Webpack erfolgreich, einschließlich Typprüfung und Erzeugung der Seiten. Die temporäre Vorschau ist nicht im Build enthalten.
- Live-Datenbanktests und die separaten Playwright-E2E-Suites sind vom isolierten Jest-Lauf ausgenommen. Browserprüfungen dieses Berichts erfolgten im In-App-Browser.
- Die vier übergeordneten Projektdokumente wurden aktualisiert. Keine Migration, Server-Action- oder Berechtigungsänderung.

## Bereitstellung

Die Änderung wird über den bestehenden `main`-Branch und die GitHub/Vercel-Integration bereitgestellt. Der erfolgreiche Commitstatus ist im GitHub-Verlauf nachvollziehbar. Hosting- und Domain-Zuordnungen werden durch diese UI-Korrektur nicht geändert.
