/** Auswahllisten der Lernanalyse: lernende Personen und unabhängige Trainer-Niveaus. */
export interface AnalyticsOptions {
  students: { id: string; name: string }[]
  levels: { code: string }[]
}
