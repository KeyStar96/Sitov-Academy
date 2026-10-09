# Sitov Academy: Lernpfad-Extras im Lehrkraftmenü

Epoch 10, Basis `9727a61b01366dd777036498e0f117194616e063`, Branch `codex/sitov-night-s1-special-staff-navigation`. Die eingefrorenen Verträge wurden gelesen; die bereits implementierte geschützte Route wurde am zugewiesenen HEAD bestätigt. Kein Cherry-Pick oder Basiswechsel während der Arbeit.

Das gemeinsame Menü enthält im vorhandenen Inhaltsbereich den tatsächlichen Link `/{lang}/teacher/content/learning-path/specials`. Stabile Navigationskennung und Icon-Key: `sitov_learning_path_specials`; Icon: GitBranch. Die fünf eingefrorenen Beschriftungen sind Lernpfad-Extras / Learning path extras / Дополнения к учебному пути / Доповнення до навчального шляху / Öğrenme yolu ekleri. Locale-Schlüssel ergänzen wie beim bestehenden Billing-Link die gemeinsame Übersetzung, sodass alle vorhandenen Shell-Verbraucher die gewählte Beschriftung erhalten.

Die vorhandene längste-Pfad-Erkennung ordnet Route und Unterseiten dem Inhaltsbereich zu. Sidebar-Aktivzustand, mobile Abschnittsreiter und Desktop-Brotkrumen verwenden dadurch die vorhandene Shell ohne zusätzliche Komponenten oder Layoutänderungen. Bestehende Aussprache- und Billing-Links bleiben erhalten.

Gezielte Jest-Prüfung: zehn Fälle für fünf exakte Routen/Beschriftungen, tatsächliche Sidebar/GitBranch/aria-current/48px, Pfadgrenzen sowie vorhandene Shell-Brotkrumen und Abschnittsreiter. Scoped ESLint und Diff-Checks bestanden. Kein Browser, Build, QA, SQL, Billing- oder Rechteeingriff.

Integrationshinweis an M: Der historische Test `sitov-billing-ui.test.tsx` behauptet noch, das Menü enthalte keinen Special-Link. Diese alte, damals zutreffende negative Behauptung ist durch die nun tatsächlich implementierte Route überholt. Die Datei liegt außerhalb dieser Lease und wurde nicht geändert; M muss die Assertion beim Integrieren ersetzen. Browserabnahme übernimmt M/S5. Release bleibt nicht freigegeben.
