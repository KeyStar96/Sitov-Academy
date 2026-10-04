# Sitov Academy: zweite Anmeldung für Administratorkonten

**Aktueller Stand nach Nutzerentscheidung vom 4. Oktober 2026:** Lehrkräfte melden sich ausschließlich mit E-Mail und Passwort an. Migration 83 entfernt ihre MFA-Pflicht für bestehende und neue Konten. Das MFA-Symbol wird für Lehrkräfte nicht mehr gezeigt; ältere Einrichtungslinks führen zur Lehrkraftverwaltung. Die zweite Anmeldung bleibt für Administratorkonten bestehen.

Die Seite `/{Sprache}/staff-security` bietet für Administratoren die Einrichtung und Bestätigung einer TOTP-Authenticator-App in Deutsch, Englisch, Russisch, Ukrainisch und Türkisch. Die Verwaltung verlinkt sie über das Schildsymbol. Der QR-Code und Einrichtungsschlüssel bleiben nur im aktuellen Bildschirm; sie werden nicht in Logs oder Local Storage gespeichert. Nach erfolgreicher Codeprüfung aktiviert die Anwendung die Datenbankpflicht für das eigene Konto. Andere Sitzungen dieses Kontos benötigen dann ebenfalls die zweite Anmeldung.

Migration 80 führte ursprünglich MFA für Staff ein. Die spätere Migration `83_sitov_teacher_password_login.sql` begrenzt die Pflicht auf Administratoren. Neue Administratorkonten und Beförderungen von Schülern oder Lehrkräften zu Administratoren verlangen sie automatisch. Ein Wechsel zur Lehrkraftrolle entfernt die Pflicht. Bestehende Adminflags und deren geprüfter SQL-Wiederherstellungsweg bleiben erhalten.

## Einführung

1. Migration anwenden, danach Anwendung veröffentlichen. Auth muss TOTP-Einrichtung und -Prüfung erlauben (`GOTRUE_MFA_TOTP_ENROLL_ENABLED=true`, `GOTRUE_MFA_TOTP_VERIFY_ENABLED=true`). Der PostgREST-Hook `sitov_security_private.sitov_pre_request` muss nach dem Konfigurationsreload aktiv sein; bestehende abweichende Hooks werden von der Migration nicht überschrieben.
2. In einer isolierten Auth-/Datenbankkopie die vollständige Einrichtung, Abmeldung und erneute Codeprüfung testen. Prüfen, dass `aal1` private Daten/RPCs verweigert, die eigene Profillesung und MFA-Seite aber funktionieren. Ein `aal2`-Token ohne verbliebenen verifizierten TOTP-Faktor wird ebenfalls abgewiesen.
3. Bestehende Administratoren öffnen die Sicherheitsseite und richten ihre eigene App ein. Ein bestätigter Faktor aktiviert die Pflicht automatisch. Nach geprüfter Einrichtung und vorhandenem SQL-Wiederherstellungszugang kann der Betreiber sie für alle übrigen bestehenden Administratorkonten einschalten:

```sql
UPDATE public.profiles
SET sitov_mfa_required=true
WHERE role='admin';
```

Bei noch nicht eingerichteten Konten führt die nächste Verwaltungsanmeldung zur Einrichtung. Die MFA-Seite liegt außerhalb des geschützten Verwaltungslayouts.

## Schutzbereiche

Der PostgREST-Hook schützt angemeldete, verpflichtete Administratorkonten vor jeder REST-/RPC-Abfrage mit unzureichender Authentifizierung, einschließlich `SECURITY DEFINER`-RPCs. Die eigene Profillesung und die beiden geprüften MFA-RPCs bleiben erreichbar. Restriktive Regeln ergänzen die bisherigen Eigentums- und Freigaberegeln für alle bei der Migration vorhandenen öffentlichen RLS-Tabellen sowie `storage.objects` und `storage.buckets`; die Profilregel erlaubt vor der zweiten Anmeldung ausschließlich das eigene Profil zu lesen.

Serverguards prüfen vor Verwaltungszugriffen und vor Service-Client-Abfragen die Pflicht aus der Datenbank. Erfasst sind das Verwaltungslayout, der gemeinsame Backendkontext, der ältere Verwaltungshelfer, die gemeinsame Niveau-Zugriffsprüfung (einschließlich Prüfungsserver) sowie die Verwaltung von Hörproduktionen. Lehrkraft- und Schülerrollen behalten ihre bisherigen Berechtigungen ohne MFA-Pflicht. Öffentliche Formulare und ausschließlich eigene Schülerfunktionen sind keine zusätzlichen Staff-Rechte.

Neue ausdrücklich freigegebene Tabellen müssen dieselbe restriktive RLS-Regel erhalten; der API-Hook schützt bereits neue REST-/RPC-Endpunkte. Direkter privilegierter SQL-Zugriff und der geheime Service-Key bleiben betriebliche Vertrauensgrenzen. Sie müssen weiterhin ausschließlich serverseitig verfügbar sein.

## Auth-Sitzung und ältere Tokens

Supabase Auth `v2.186.0` prüft bei der Verwaltung von Faktoren den aktuellen AAL-Status der gespeicherten Sitzung. Nach erfolgreicher TOTP-Prüfung kann daher auch ein noch gültiges älteres `aal1`-Token **derselben inzwischen bestätigten Sitzung** einen weiteren Faktor anlegen. Das ist im [versionsgenauen Auth-Code](https://github.com/supabase/auth/blob/v2.186.0/internal/api/mfa.go#L129-L163) umgesetzt; der [offizielle Test](https://github.com/supabase/auth/blob/v2.186.0/internal/api/mfa_test.go#L598-L639) bestätigt dieselbe Regel für das Entfernen verifizierter Faktoren. Ein frischer Passwortlogin eröffnet dagegen eine eigene `aal1`-Sitzung und darf bei vorhandenem verifiziertem Faktor keinen weiteren Faktor anlegen. Die isolierte Integration mit Auth `v2.186.0` hat beide Fälle geprüft: ältere Sitzung erlaubt, frischer Passwortlogin mit HTTP 403 verweigert.

Unsere Datenbankguards prüfen weiterhin den AAL-Claim des tatsächlich verwendeten JWT plus einen vorhandenen verifizierten TOTP-Faktor. Ein altes `aal1`-Token bekommt dadurch keine privaten Staff-Datenrechte. Auth behandelt die bereits bestätigte Sitzung jedoch als vertrauenswürdig: Ein gestohlenes Token dieser Sitzung kann deren Faktorverwaltung ermöglichen, auch wenn der gedruckte AAL-Claim älter ist. Bei vermutetem Sitzungsdiebstahl sind deshalb die betroffenen Auth-Sitzungen zu widerrufen; MFA ersetzt diesen Widerruf nicht.

## Verlust des Authenticators

Es gibt keine Möglichkeit, die Pflicht über ein Profil-PATCH oder eine unbestätigte MFA-Abfrage auszuschalten. Die Schulverwaltung muss die Identität außerhalb der kompromittierbaren Sitzung prüfen. Der Betreiber kann mit seinem unabhängigen SQL-Zugang für **das geprüfte einzelne Konto** die Pflicht zurücksetzen:

```sql
UPDATE public.profiles SET sitov_mfa_required=false WHERE id='<geprüfte Konto-UUID>';
```

Danach den verlorenen Faktor über die Auth-Verwaltung entfernen, vorhandene Sitzungen widerrufen und das Konto erneut einrichten lassen. Das Zurücksetzen der Pflicht allein entfernt keinen Faktor und ersetzt keine Identitätsprüfung.

Die SQL-Migration verändert keine Authenticator-Schlüssel in Auth. Bei der produktiven Umstellung gab es keinen verifizierten Lehrkraftfaktor. Die eine noch unbestätigte Einrichtung wurde über die offizielle Auth-Admin-API entfernt, damit ein alter QR-Code sie nicht nachträglich bestätigt. Beide realen Lehrkraftkonten wurden danach mit `aal1` über Auth, den öffentlichen REST-Endpunkt und die tatsächliche Verwaltungsseite geprüft; es gibt keine verbliebenen Lehrkraftfaktoren.

Die Implementierung verwendet die offiziellen [Supabase-TOTP-APIs](https://supabase.com/docs/guides/auth/auth-mfa/totp) und die dokumentierte [PostgREST-Konfiguration](https://docs.postgrest.org/en/stable/references/configuration.html#db-pre-request). Lokale Prüfung: `node --test supabase/tests/sitov-staff-mfa.test.mjs` und `npx jest --runInBand __tests__/sitov-staff-mfa.test.ts __tests__/sitov-staff-mfa-ui.test.tsx`.
