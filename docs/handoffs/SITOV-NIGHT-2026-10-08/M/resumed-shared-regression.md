# Sitov Academy – gemeinsame Regression nach Wiederaufnahme

Basis: f8a798d24f7b0ae3750aae0561b65b4700e11d11. Der volle Jest-Lauf auf acea8048 fand 18 fehlgeschlagene/299 bestandene/2 übersprungene Suiten; 40 fehlgeschlagene/3998 bestandene/2 übersprungene Tests. Kein Gesamt-PASS. Der Lauf lief vor der Integration des S2-Themencommits vollständig zu Ende. Log: /tmp/sitov-night-m-jest-all-acea8048.log.

M korrigiert die gemeinsamen Navigationsübersetzungen: Billing und Lernpfad-Extras verwenden jetzt zwei normale Schlüssel in jedem der fünf Dictionaries. Sprachsuffixe und sprachübergreifende Fallback-Schlüssel entfallen; die gewählte UI-Sprache bestimmt die tatsächliche Übersetzung. Routen/Icons/Rollen und Zugriff bleiben unverändert. Der bestehende Navigationstest enthält den tatsächlich implementierten Special-Editor; fünf gerenderte Sidebar-Fälle prüfen beide Ziele in ihrer gewählten Sprache.

Der private Offline-Vortest-CLI schreibt bei ungültigem Autorinhalt ein statisches Fehlerereignis. Strukturierte Detaildiagnosen bleiben über sitovValidatePretestDrafts/sitovValidatePretestAudioAliases verfügbar; keine rohen Autorfehler im Errorlog. Die Validierung und ihr Exitcode bleiben erhalten.

Prüfung: drei relevante bestehende Jest-Suiten, 34 Tests PASS; ScopedESLint Exit0; git diff --check. Lokale Next-Dokumentation zu Internationalisierung und Jest gelesen. Keine neue reale Browser-/Produktions-/Audio-/DB-Abnahme. S1 und S4 reparieren getrennt zugewiesene weitere Regressionen.
