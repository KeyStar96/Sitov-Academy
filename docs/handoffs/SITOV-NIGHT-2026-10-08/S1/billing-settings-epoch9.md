# Sitov Academy: deaktiviertes Bezahlgerüst, Epoch 9

Status: DRAFT_PARTIALLY_ENFORCED. Kein Deployment, keine Produktionsänderung.

Die reale Route `/[lang]/admin/settings/billing` liest das bestehende RPC `get_sitov_billing_settings` über Cookie-Authentifizierung, Staff-Rolle und vorhandene MFA-Prüfung. Das strikte DTO verlangt die zehn vorhandenen Teilniveau-Produkte und die tatsächlichen Felder einschließlich `configuration_ready: false` und `missing: [provider_adapter]`. Nicht konfigurierte Preise und Währungen bleiben leere Eingaben. Es gibt keine erfundenen Tarife oder Aktivierungssteuerung.

Preise werden als ausdrücklich eingegebene positive ganzzahlige kleinste Währungseinheiten mit gültigem ISO-Währungscode und Produktrevision gespeichert. Die Antwort wird auf `{success, revision}` geprüft. Die Abschaltaktion nimmt ausschließlich eine Revision an und sendet immer `p_enabled: false`; die Antwort muss `{success, revision, enabled: false}` sein. Konflikte verlangen erneutes Laden. Provider, Checkout, Bestellungen, Kaufrechte und bestehende manuelle/VIP/Probezugänge wurden nicht geändert.

Die vorhandene Teacher-Navigation enthält den tatsächlichen Link mit CreditCard-Icon und Beschriftungen für de/en/ru/uk/tr. Der bestehende Aussprache-Link mit Mic-Icon bleibt erhalten. Ein eigenständiges Special-Verwaltungsziel existiert im zugewiesenen Navigationsbereich nicht; daher wurde keines erfunden. Die Seite nutzt gemeinsame PressableCard-/Hilfekomponenten, 48px-Eingaben, transform/opacity-Auftritt und ruhige Reduced-Motion-Darstellung.

Validierung: 46 Jest-Tests bestanden (Billing-DAL/UI einschließlich echter TeacherSidebar und bestehender VIP-/Probezugang-DAL/UI), vollständige TypeScript-Prüfung und scoped ESLint bestanden. Der zusätzliche native PG17-Test bestand gegen eine eigene synthetische Datenbank mit unverändertem, gepinntem Baseline-92 und Migration 93: tatsächliches Nullpreis-DTO, explizites Speichern/Revision, Konflikt, verweigerte Aktivierung, Abschalten und verweigerter Fremdzugriff. Die Testdatenbank wird abschließend gelöscht. Kein HTTP-/Storage- oder authentifizierter Browsernachweis wird behauptet.

Zugewiesene Abhängigkeit: M `7e5692a6a5627499b25749e16116c7f9a590797e`, lokal `2c29075`; geänderte Dateien bytegleich, Patch-ID `a367e205e375bb8f3e315b7dc7907eba21f7b1b6`. Eigener Epoch-8-Commit bleibt erhalten.

Offene Gates: authentifizierte Browserprüfung bei 320/390/1440px, Tastatur, Themes/High Contrast, Reduced Motion und allen fünf Sprachen; integrierte Build-/HTTP-/Storage-/Audio-/Concurrency-/Release-Prüfungen. Release nicht freigegeben.
