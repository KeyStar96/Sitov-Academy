# S5 epoch37 — Fokus-Fix und authentisches Reduced Motion abgenommen

Geprüfte Basis und Produktionsbuild: b06843194db2e4c5ad5fea3cf40b12394f941f04 / BUILD_ID XLm2trsHZX8ZGja1yykY-, M-owned PID32305/Port3143. App-Diff zur zugewiesenen Basis exit0. Ausschließlich eigene Dokumentation/Evidenz; keine Produktänderung, kein Runtimeeingriff.

Der epoch36-Ausreißer wurde mit demselben retained Schüler und demselben echten PASS auf dem neuen Build gezielt nachgeprüft. Normales türkisches Login, normale Darstellungskontrollen auf light/high. Keine neuen Actors, Tests, Antworten oder Retakes.

## Fokus-Abnahme

TR390×844/light/high: Vier native Hilfe→Shift+Tab-Aufnahmefolgen aus unterschiedlichen Positionen (initial, nach PageUp, nach End+Up, nahe unterer Navigation), dazu normale Vorwärtsfolge ab Listen→Repeat→From start→Speed→Record. Alle fokussierten Aufnahmefälle liegen vollständig im Viewport. Tatsächlicher computed scroll-margin-block-end112px. Ursprüngliche Folge jetzt Aufnahmebottom731.75 statt epoch36bottom843.75; kein verdeckter Button im geprüften Repro. Bei tatsächlich sichtbarer unterer Navigation (opacity1/visibilityvisible, top760.8125) ist der kleinste gemessene Abstand zum Button34.0625px. Fokusrahmen visuell frei. Kein deutscher Wortbutton vom Aufnahmebutton überdeckt, keine horizontale Überbreite390/390. Nativer PageUp zeigt den deutschen Text ohne Aufnahmeoverlay. Vorbereitende PageUp-Zustände dürfen bewusst das noch nicht wieder fokussierte Element außerhalb des Viewports zeigen; sie sind keine Fokus-PASS-Fälle.

13 Beobachtungen jeweils nach900ms, anschließend Screenshot und zweite read-only Geometriemessung. ScrollTop und Aufnahme-Y stimmen vor/nach jedem Screenshot exakt überein. Maßgebliche Repro-, sichtbare-Nav-, Nahgrenzen- und Reduced-Motion-Screenshots visuell geprüft. Keine Mikrofonfreigabe, Aufnahmeaktivierung oder physisches Hören behauptet.

## Authentisches Reduced Motion

Browser-Fähigkeitsliste enthält nur viewport/visibility. Über die tatsächliche macOS-UI: Systemeinstellungen→Bedienungshilfen→Bewegung→Bewegung reduzieren, ursprünglicher Wert off sichtbar abgelesen. Im ausdrücklich zugewiesenen Umfang nativ eingeschaltet; reales Browser-matchMedia wurde true. Bei diesem echten Systemzustand wurden Rückwärtsfokus mit sichtbarer unterer Navigation, Repeat-Fokus und normaler Vorwärtsfokus auf Aufnahme geprüft, inklusive900ms-Geometrie/Screenshots. Alle bedienbar und frei. Keine Media/CSS/React/OS-Mocks.

Danach dieselbe native Systemeinstellung sofort auf off zurückgesetzt; AX bestätigt off, reales Browser-Mediaquery wieder false. Systemeinstellungen-Ansicht auf ursprüngliches Allgemein zurückgestellt. QA-Darstellung über normale Website-Kontrollen wieder tr/dark/standard. Die Abnahme betrifft diese konkreten Lese-/Fokusfolgen; kein vollständiger visueller Audit sämtlicher Animationen.

## Tatsächliche Messungen

Negative Abstände in vorbereitenden/Lesetext-Zuständen beschreiben einen außerhalb des Viewports liegenden, nicht gerade per Tab angewählten Aufnahmebutton. Fokusabnahmen sind die Zeilen mit aktiver Aufnahme nach Rückwärts-/Vorwärts-Tab.

| Fall | Aktiv | ScrollTop | Aufnahmebottom | Nav | Abstand | Reduced |
| --- | --- | --- | --- | --- | --- | --- |
| tr390-light-high-repeat-focus | Yavaş tekrar et | 2435.5 | 940.25 | hidden | -88.7862548828125 | False |
| tr390-light-high-reverse-initial | Kayda başla | 2644 | 731.75 | hidden | 119.7137451171875 | False |
| tr390-light-high-help-pageup-before-reverse | Yardım | 2251.5 | 1124.25 | visible | -363.4375 | False |
| tr390-light-high-reverse-from-pageup | Kayda başla | 2926 | 447.75 | hidden | 403.7137451171875 | False |
| tr390-light-high-help-end-up-before-reverse | Yardım | 2849 | 526.75 | visible | 234.0625 | False |
| tr390-light-high-reverse-visible-nav | Kayda başla | 2849 | 526.75 | visible | 234.0625 | False |
| tr390-light-high-help-near-nav-before-reverse | Yardım | 2649 | 726.75 | visible | 34.0625 | False |
| tr390-light-high-reverse-near-nav | Kayda başla | 2649 | 726.75 | visible | 34.0625 | False |
| tr390-light-high-forward-record | Kayda başla | 2644 | 731.75 | hidden | 119.7137451171875 | False |
| tr390-light-high-reading-pageup | Kayda başla | 1916 | 1459.75 | visible | -698.9375 | False |
| tr390-light-high-reduced-reverse | Kayda başla | 2849 | 526.75 | visible | 234.0625 | True |
| tr390-light-high-reduced-repeat | Yavaş tekrar et | 2375 | 1000.75 | visible | -239.9375 | True |
| tr390-light-high-reduced-forward-record | Kayda başla | 2926 | 449.75 | hidden | 401.7137451171875 | True |

## Erhaltung und Abschluss

Initial/final eigene native Versuch-/PASS-Hashes exakt identisch:1 passed Versuch und1 PASS. Eigene Authuser1, sessions0, refresh_tokens0 vor Login und nach normalem sichtbar bestätigtem türkischem Logout. UUID+E-Mail-Guard schützt die eigenen Authzeilen. Health initial/final3×200, genaue960MiB/2CPU, RAM≥1984MiB, private unveränderte Namespace/Images, keine veröffentlichten Ports, kein OOM. Browser-Warn-/Fehlerlog leer. Kein Shared-Rate-Reset, keine Runtimeänderung.

Gemäß M kein wiederholter Voll188-Scan, epoch35-Baseline bleibt gebunden. Kein finaler globaler Vergleich und kein Cleanup. Eigener Tab geschlossen/Viewportreset; aktueller Zustand tr/dark/standard/reducedfalse. Neueste private Resume-Ledger: S5/epoch37-private.json und remote /tmp/sitov-night-20261008-qa-master/s5-epoch37-ledger.json,0600 in0700-Verzeichnis. Exakt denselben Actor/PASS für finale M-Review erhalten. Verbleibend ist der separat zuzuweisende finale Voll188-Vergleich und reviewedownfixtureCleanup. Kein Release-ready-Urteil.
