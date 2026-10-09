# S4 Epoch33 – historischer Testloader und aktuelle Review-Schicht

Exakte Basis: `e425214272e86c11bbe44e902ab80a88afa69fb9`. Geändert ist ausschließlich die autorisierte Authoring-Testdatei sowie diese Epoch33-Nachweise.

Die Repository-Suite besteht direkt mit **178/178 Tests**: alle **163 bisherigen historischen Tests** plus **15 neue Tests**. Der vollständige bisherige Loader und sämtliche bisherigen Assertions nach dem ersten Snapshot sind bytegleich erhalten (SHA256 `6875f1653293c10a02e4704c32f700e0c6d21e635e1385a821c5c6c03845b157`). Historische Fixtures wurden weder angepasst noch neu verankert.

Vor jedem Rücklauf werden die tatsächlichen Manifest- und Aliasobjekte separat gespeichert. Ausschließlich die historischen Snapshots erhalten die exakten alten Definitionen, Reviews und Aliastexte aus der SHA-geprüften Epoch32-Review-Schicht. Ihre rekonstruierten vollständigen Manifest-/Aliasbytes müssen die ursprünglichen festen Vorher-Hashes ergeben.

Die neuen Tests prüfen die aktuellen gespeicherten Objekte direkt: 60 inaktive Entwürfe, 59 Änderungen in 31 Definitionen, 94 Aliasänderungen, 11 korrekte Antworttextänderungen, 62 native Definitionshashes sowie 15 eindeutige S7-Konstruktspuren plus die exakte zusätzliche Zeitbeziehungsreparatur. Unveränderte Aufgaben, historische Reviews, 89 Legacy-Einträge, Lesetextbytes, IDs, Schlüssel, Quellspannen, Optionsreihenfolge und Review-Formulare bleiben überprüft. Alle 31 Reviewverknüpfungen müssen exakt zur fest verankerten Review-SHA passen. Die echten kanonischen Quellen und öffentlichen Aliastexte werden außerdem durch die bestehenden Validatoren geprüft.

17 gezielte Manipulationen in 14 Negativtests müssen scheitern, einschließlich eines geänderten Schlüssels mit neu berechnetem Definitionshash und einer koordinierten Änderung an aktuellem Objekt und Review-Dokument. Der positive aktuelle Test verhindert, dass allein ein historischer Rücklauf als Prüfung des heutigen Zustands ausgegeben wird.

Weitere Prüfungen: aktuelle Authoring-CLI **PASS 60/60**, unabhängiger Epoch32-Anwendungsvalidator **PASS**, `git diff --check` **PASS**. Manifest, Audio-Aliasdatei, Lesekatalog und Review-Dokument sind bytegleich zur Basis; maschinenlesbare Hashes und Vollsuite-Log liegen daneben.

Keine Audioerzeugung, Datenbankaktion, Veröffentlichung oder Änderung der Inhaltsdefinitionen. Die Prüfungen belegen keinen Hörtest und keine empirische Kalibrierung. Die Audio-Pipeline und spätere versionsgenaue Bindungen verbleiben bei M.
