# Sitov Academy – S2 epoch34: erste acht Elternkontext-HOLDs

Basis `58fa57c76e6a30feca1a2729d21fa661483c2b96`, eigener Branch `codex/sitov-night-s2-parent-holds-34`. Ausschließlich die freigegebenen S4-Indizes **1, 4, 5, 9, 10, 11, 12, 13** wurden bearbeitet. Die vollständigen acht Kontexte umfassen 62 Aufgaben und fünfsprachige Regeln/Hinweise/Erklärungen. Die übrigen elf HOLDs sind nicht bearbeitet.

| Index | Kontext | Gezielte Reparatur |
|---|---|---|
| 1 | A1.1/P7-N6 | Partizipregel und Hinweise auf die hier geübten starken Verben begrenzt, fünf Sprachfassungen. E05 Lehrer statt Lehrerin, ru/uk passend; geschrieben unverändert. |
| 4 | A1.1/P1-N9 | In vier tatsächlich noch veralteten Kind-Erklärungen ausschließlich Olena zu Oleh, jeweils fünf Sprachfassungen. Ein Kind war bereits richtig; alle fünf sind nun konsistent. |
| 5 | A1.1/P3-N5 | E05 Englisch exakt: I would like half a kilo of tomatoes. Deutsch und Lösung unverändert. |
| 9 | A1.2/P6-N4 | Türkisch er/es → ihm (ona); es wird nicht mehr als männlich glossiert. Feminine sie/ihr-Tabelle und Aufgaben unverändert erhalten. |
| 10 | A1.1/P5-N6 | E05 ru/uk Arztpraxis korrekt. E10 auf ausdrücklich autorisierten Vater-Kontext umgestellt, einschließlich Satzteilen und beiden Lösungssätzen. |
| 11 | A1.2/P1-N3 | Kartenbeispiel Amir/Koch, E03 Amir/Kellner, E05 Hannes/Erzieher; vier Taskübersetzungen passend, als-Schlüssel unverändert. |
| 12 | A2.1/P1-N4 | Komma zwischen Hauptsatz und weil-Satz in fünf Regel-/Erklärungsfassungen. E08 Oleg/seine Familie/ihn, besucht unverändert. Vorgezogener weil-Satz bleibt akzeptiert. |
| 13 | A2.1/P6-N6 | E03 Lehrer in Deutsch und ru/uk; streng unverändert. Die tatsächlich in E09 gezeigte Modal-Präteritum-Erklärung sagt häufig statt eines Perfektverbots, fünf Sprachfassungen. |

Die separate, nicht zugewiesene Parentkarte p6_modal_prt und andere Stationen werden durch E09 nicht pauschal umgeschrieben. Native aufgabenspezifische Erklärungen bilden diesen engen Kontext ab. Auch Änderungen gemeinsamer Autorenkarten dürfen keine nicht zugewiesenen Seedaufgaben verändern; native Task-Overrides bewahren deren bisherige Fassung. Fünf unnötige neue Optionsreihenfolge-Overrides wurden entfernt. Es gibt keine neue Compilerfunktion oder Teständerung.

**Umfang:** 35 Aufgaben, vier tatsächliche Merkkarten in acht Kontexten, 178 skalare Diff-Einträge. Alle 9.569 Übungen wurden gegen die Basis auf unveränderte Identität und unveränderte Inhalte außerhalb der acht Kontexte geprüft. Pfad-/Node-IDs, Art, Ziele, Reihenfolge, Topic, Übersetzungs-Titel und Kartenkennungen sind erhalten. Sämtliche anderen Schlüssel, akzeptierten Varianten und Optionsreihenfolgen bleiben exakt gleich.

Die einzige autorisierte Schlüsseländerung betrifft **934dd6d1-6a25-59ca-aebe-a00e058c0eee / P5-N6-E10**:

- Alt: `Am Abend ruft Emre seine Mutter an.` / `Emre ruft am Abend seine Mutter an.`
- Neu: `Am Abend ruft Emre seinen Vater an.` / `Emre ruft am Abend seinen Vater an.`

Die Anzahl und jeweilige Wortstellung der zwei Varianten bleiben erhalten. Alte komplette Aufgaben und Antworten liegen separat im privaten Before/After-Archiv. Diese Source-Änderung überschreibt keine historische DB-Antwort, keinen Fortschritt und keinen Streak. Übernahme ausschließlich als neu geprüfte, unveränderliche Revision durch M; gewöhnlicher Import nicht freigegeben.

**Schmale Validierung:** Die drei geänderten Level mit 2.752 Übungen bestehen das tatsächliche Importschema ohne Datenmutation. A1.2 und A2.1 werden bytegenau aus ihren nativen Autorenquellen erzeugt. A1.1 hat keine native Autorenquelle. Feminine Grammatik, alle nicht betroffenen Schlüssel und der akzeptierte vorgezogene weil-Satz sind gezielt geprüft. ESLint der sechs Autorenquellen: null Fehler, null Warnungen. Diffchecks bestehen. Kein vollständiger Next-Build, keine vollständige Jest-/PGlite-Suite und keine Modell-/Audioarbeit während M lokal MLX nutzt.

Der tatsächliche gemeinsame Audio-Katalog und Prepared-Adapter stimmen für alle 35 geänderten Aufgaben überein: **55 finale Aliase, sechs geänderte Aliase in sechs Aufgaben**. Lückenwort/Vollsatz bleiben erhalten; keine Distraktoren oder frei normalisierten Sätze. Exakte alte/neue Hörtexte liegen privat in `S2/epoch34-final-canonical-audio.json`; keine Aufnahme oder Wortzeit wurde erzeugt, importiert oder freigegeben.

`epoch34-first-eight-parent-holds-proof.json` bindet alle privaten Artefakte durch Byte-SHAs, sämtliche zehn Seed-Vorher/Nachher-SHAs und die unabhängige Ausgangsprüfung. Privat erhalten: vollständige alte und neue Seeds, alle acht vollständigen Kontexte, 35 volle alte/neue Aufgaben, vollständige native Quell-Dateien vor/nach Änderung, skalare Diffs und Audio-Aliase. Die Aggregatinventare aus epoch33 sind für die hier geänderten Fassungen vor Übernahme neu abzuleiten.

Alle acht Reparaturen benötigen unabhängige Nachprüfung durch M/S4. Keine DB-, SSH-, API-, TTS-, Import- oder Veröffentlichungsschritte. S2 sichert eigenen Commit und WAIT innerhalb der unveränderten Lease; keine nächste Arbeitseinheit begonnen.

## Auf ausdrücklichen SAVE-Hinweis markierte Folge-Refs

Nur aus dem bereits gesicherten finalen Seed-Inventar abgelesen, keine zusätzliche Inhaltsprüfung oder Änderung: separate p6_modal_prt-Parentkarte A2.1/P6-N3. Die bereits korrigierte Kindfassung A2.1/P6-N6-E09 bleibt der einzige bearbeitete Modal-Kontext dieser Einheit. Für eine neue begrenzte Einheit bleiben folgende unveränderte Referenzen derselben Karte markiert:

- A2.1/P6-N3-E01 (`57923dad-94ca-5bde-a136-8fd090ef8c30`)
- A2.1/P6-N3-E02 (`b15c7121-dc69-5e54-afee-90d5edca7f81`)
- A2.1/P6-N3-E03 (`14170380-75a3-5fc0-ae7d-e0e9048e0048`)
- A2.1/P6-N3-E04 (`d691532b-d7f8-511f-aed5-9e2eee359722`)
- A2.1/P6-N3-E05 (`ccf6f21a-3797-50ee-ab93-0c4837f4a5d8`)
- A2.1/P6-N3-E06 (`7b3e2def-1515-5887-a5ca-e5f65763022b`)
- A2.1/P6-N3-E07 (`f96a8a6a-f832-5bc6-aebd-68ffbe70ee11`)
- A2.1/P6-N3-E08 (`8b44e7f8-e333-5b43-a519-b62c3fee06a3`)
- A2.1/P6-N3-E09 (`c946e200-55fc-5a6e-abba-f52025da6736`)
- A2.1/P6-N3-E10 (`311f95df-562a-54cb-a617-99479fdb0632`)
- A2.1/P6-N12-E10 (`4ddc7ce2-155f-5837-a79d-6c1df0b2dc48`)
- A2.1/P6-N13-E05 (`51d42ff1-54fb-55c7-a06f-01f47a756d68`)
- A2.1/P6-N13-E06 (`54c7eb24-d056-5607-a4bb-6e40963795a8`)
- A2.1/P6-N13-E20 (`a8c9c7f6-7c0e-571c-a158-b1d3938db61e`)
- A2.1/P6-N13-E21 (`309e481c-79db-5ce2-aa2b-8635b5ffdd9c`)
- A2.1/P6-N13-E32 (`b2eb97ce-e832-5ac3-a250-11788f4dbce5`)
