# Mailvorlagen live aktualisiert — 10. September 2026

Der Nutzer hat ausdrücklich beauftragt, die bereits vorbereiteten Mailvorlagen selbstständig auch produktiv zu übernehmen. Dieser Nachtrag ersetzt den offenen Veröffentlichungsstand im vorherigen Markenbericht.

## Supabase-Mails

Ausschließlich Projekt `wcaslabeiwtvygxtzcio`. Bestehende Dateien vor Deployment mit den lokalen Quellen verglichen; keine fremden Änderungen an Authentifizierung oder Versand überschrieben. Sämtliche Funktionen nach Deployment erneut ausgelesen und auf exakte Übereinstimmung geprüft:

| Live-Funktion | Veröffentlichte Version | Status |
| --- | ---: | --- |
| send-confirmation-email | 21 | ACTIVE |
| send-cancelation-email | 7 | ACTIVE |
| send-cancellation-confirmation | 6 | ACTIVE |
| send-trial-cancellation-email | 6 | ACTIVE |
| send-trial-confirmation-email | 6 | ACTIVE |
| notify-new-enrollment | 4 | ACTIVE |

Die bestehende Schreibweise `send-cancelation-email` (ein l) ist absichtlich erhalten; die lokale Quelle heißt weiterhin `send-cancellation-email`. Keine zusätzliche Funktion angelegt. Alle bisherigen `verify_jwt=false`-Einstellungen und die bestehenden Handler-/Trigger-Authentifizierungen bleiben erhalten.

Angepasst sind Markenname, Logo, Hintergrund-/Akzentfarben sowie bei den fünf Kunden-Mails die sauber getrennten Unterrichts- und Firmenadressen. Telefon und deutsche Rechtslinks sind anklickbar. TypeScript-AST-Vergleich bestätigt unveränderte Versand-, Abfrage- und Update-Logik. Aktuelles Logo und drei Rechtslinks liefern HTTP 200.

## Supabase-Authentifizierung

Die beiden Auth-Mailvorlagen und ihre Betreffzeilen wurden direkt im angemeldeten Dashboard gespeichert:

| Vorlage | Lokale Quelle | Betreff |
| --- | --- | --- |
| Confirm sign up | `supabase/templates/confirmation.html` | Sitov Academy – E-Mail-Adresse bestätigen |
| Reset password | `supabase/templates/recovery.html` | Sitov Academy – Neues Passwort festlegen |

Die nach erneutem Laden aus dem Editor kopierten vollständigen HTML-Inhalte stimmen exakt mit der gespeicherten Fassung und den lokalen Dateien überein. Die Reihenfolge und Inhalte sämtlicher Go-Template-Platzhalter für `RedirectTo`, `TokenHash`, `SiteURL` und die jeweiligen Aktionstypen bleiben unverändert. Vorschauen zeigen die neue Marke, die Firmenadresse und die Kontakt-/Rechtslinks.

Auch der SMTP-Anzeigename wurde im Dashboard von der alten Marke auf **Sitov Academy** geändert. SMTP-Zugangsdaten wurden weder geändert noch in Protokollen ausgegeben. Nicht genutzte Auth-/Sicherheitsbenachrichtigungen wurden nicht neu aktiviert.

## Feedback-Mail des Lernraums

`lib/feedback-email.ts` rendert die Feedback-Benachrichtigung mit dem aktuellen Logo, warmem Hintergrund, großem Aktionsbutton, Klartext-Link und Kontakt-/Rechtsfooter. `app/actions/feedback.ts` verwendet diesen Renderer; Empfänger, Betreff und Versandzeitpunkt bleiben unverändert.

Namen und URLs werden für HTML maskiert. Feedback-Links erlauben nur HTTP(S) ohne eingebettete Zugangsdaten. TypeScript und 42 bestehende Tests für URL-Konfiguration und Aussprache-Aktionen bestanden; zusätzliche lokale Prüfungen für HTML-Injection und URL-Validierung erfolgreich.

Die Feedback-Mail wird über die bereits vorhandene GitHub/Vercel-Integration veröffentlicht; der Status wird nach dem Deployment ergänzt. Die kanonischen Domains zeigen derzeit einen separaten Netlify-Auftritt. DNS und Hosting-Zuordnung werden durch diese Mail-Anpassung nicht verändert.

## Grenzen der Prüfung

Keine echten Testmails an Schüler versandt, keine Reset-/Registrierungsabläufe ausgelöst und keine Lern-, Buchungs- oder Zahlungsdaten verändert. Die Prüfung umfasst gespeicherten Code/HTML, Vorschauen, Link-Erreichbarkeit und die vorhandenen automatisierten Tests, keinen Zustelltest bei einem Mailanbieter.

