# Sitov Academy – S4 Epoch32: angewendete freigegebene Fassung

59 Aufgaben in31Definitionen angewendet:58 vollständig vonS7 akzeptierte Kandidaten plus die exakt akzeptierte Zeitmatrixkorrektur.94öffentliche Audioaliasse geändert,11richtige Antworttexte bewusst neu gefasst,16Unit-/Equivalence-Projektionen dokumentiert. Quelle, Quellspannen, IDs, Optionsreihenfolge, Lösungsschlüssel, ReviewForms, Versionierungsvertrag und89Legacyentwürfe erhalten. Alle60Entwürfe bleiben inaktiv; Audio-/Publikationsfreigabe bleibt gesperrt.

Der neue unabhängige Reviewbeleg enthält das vollständige S7-Audit mit Original-SHA, die exakte Zusatzkorrektur, sämtliche alten Definitionen und vollständigen Reviewmetadaten sowie alte/neue native SHA256(JSON.stringify)-Hashes. Alle31neuen Reviewmetadaten verweisen auf diesen tatsächlich committed Beleg und dessen Bytehash; keine alte Freigabe wird für die neue Fassung wiederverwendet.

Prüfungen:

- Aktueller Authoring-CLI:60/60privateDrafts,5760Audioaliasse,89inaktiveLegacy, PASS.
- epoch32-validate.mjs:59ganzeTaskänderungen,31Definitionen,94Aliases,11richtigeTextdeltas,16Unitänderungen,62nativeHashes, vollständige Reviewhistorie und unveränderte Originalquelle, PASS.
- Vorhandene historische Authoring-Suite:163/163PASS nach exakter, durch Bytehash belegter Rekonstruktion der vorherigen Fassung aus der neuen Reviewlage. Der private Runner ändert keine Repository-Testdatei.
- Die unveränderte Repository-Testsuite scheitert auf der neuen aktuellen Fassung bereits beim Laden, weil ihre bestehende historische Rückbaukette die neue59-Task-Lage noch nicht kennt. Dies ist kein163PASSaufderneuenSuite. epoch32-authoring-history-layer.patch enthält die konkrete notwendige Integration in den fremden Testpfad; gemäß Lease wurde dieser Pfad nicht verändert. M muss diese Lage in die historische Testkette übernehmen. Die neuen tatsächlichen Seeds werden separat durch CLI und Validator geprüft.

Der Folge-Audiokatalog enthält94eindeutige neue Texte im bestehenden rows/id/text/rate/sources-Format. Er ist nur eine Vorlage für Ms nachfolgenden erlaubten Mac-Autorenlauf mit Qwen3-TTS-12Hz-1.7B-Base und sitov-qwen-male-de-v1. S4 erzeugte, prüfte, importierte oder veröffentlichte keine Aufnahmen und keine Wortzeiten.

Korrigierte Triage:31REPAIR,29BENIGN,34AUDIO_REPAIR,20HOLD. Jahr/Ja und Café/Kaffee sind nur akustische Prüfaufträge; Originaltexte erhalten. Der ungebundene67-Hinweis bleibt separat HOLD,67→76 wird niemals als gleicher Zahlenwert normalisiert.
