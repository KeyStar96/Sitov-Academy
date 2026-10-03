import type { ExamProfileId, ExamSkill } from './types'

export interface ExamPart {
  id: string; title: string; skill: ExamSkill; family: string
  decisions: number | null; playback: number | null; verified: boolean
}
export interface ExamProfile {
  id: ExamProfileId; title: string; description: string; source: string | null; checkedAt: string
  times: string; preparation: string; parts: ExamPart[]; simulationReleased: boolean
  /** Primary documents used for details beyond the provider's overview. */
  detailSources?: string[]
}
const parts = (skill: ExamSkill, names: string[], family: string): ExamPart[] => names.map((title, i) => ({
  id: `${skill}-${i + 1}`, title, skill, family, decisions: null, playback: null, verified: false,
}))
const presentation = [
  ...parts('speaking', ['Gemeinsam planen', 'Ein Thema präsentieren', 'Rückmeldung und Rückfragen'], 'presentation'),
]
const common = [
  ...parts('listening', ['Ansagen verstehen', 'Gespräche verstehen', 'Meinungen unterscheiden'], 'listening'),
  ...parts('reading', ['Anzeigen und Hinweise', 'Mitteilungen und Artikel'], 'reading'),
  ...parts('writing', ['Nachrichten und E-Mails', 'Meinungsbeitrag', 'Informationen in Notizen übertragen'], 'writing'),
  ...parts('speaking', ['Kontaktaufnahme', 'Bildbeschreibung', 'Erfahrung', 'Kurzpräsentation', 'Rückfragen', 'Gemeinsam planen'], 'speaking'),
]
export const EXAM_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
/** Overview verified at official sources; full subpart rules remain gated until a reviewed simulation exists. */
export const EXAM_PROFILES: ExamProfile[] = [
  { id: 'general_b1', title: 'Allgemein auf B1 vorbereiten', description: 'Alle vier Fertigkeiten üben. Die Zielprüfung kannst du später wählen.', source: null, checkedAt: '2026-10-03', times: 'Kurze Einheiten, ohne Zeitdruck', preparation: 'Hilfen werden Schritt für Schritt weniger.', parts: common, simulationReleased: false },
  { id: 'dtz_a2_b1', title: 'DTZ A2–B1', description: 'Alltag verstehen, eine Mitteilung schreiben, sich vorstellen, ein Bild besprechen und gemeinsam planen.', source: 'https://www.gast.de/de/forschung-entwicklung/entwicklung/auftraege/deutsch-test-fuer-zuwanderer-dtz/der-dtz-auf-einen-blick', checkedAt: '2026-10-03', times: 'Hören ca. 25 · Lesen 45 · Schreiben 30 · Sprechen ca. 16 Minuten', preparation: 'Keine Sprechvorbereitung. Die Hörtexte werden einmal gehört.', parts: [
    ...parts('listening', ['Hören 1: Telefonansagen und öffentliche Durchsagen', 'Hören 2: Kurze Medieninformationen', 'Hören 3: Gespräche', 'Hören 4: Meinungen'], 'listening').map((p, i) => ({ ...p, decisions: [4, 5, 8, 3][i], playback: 1, verified: true })),
    ...parts('reading', ['Lesen 1: Verzeichnisse', 'Lesen 2: Anzeigen', 'Lesen 3: Pressetexte und formelle Mitteilungen', 'Lesen 4: Informationsbroschüren und Bedingungen', 'Lesen 5: Textlücken'], 'reading').map((p, i) => ({ ...p, decisions: [5, 5, 6, 3, 6][i] })),
    ...parts('writing', ['Mitteilung mit vier Inhaltspunkten; zwei Anlässe zur Wahl'], 'writing'),
    ...parts('speaking', ['Sprechen 1A: Vorstellen', 'Sprechen 1B: Rückfragen zur Vorstellung', 'Sprechen 2A: Über Erfahrungen mit Bildimpuls sprechen', 'Sprechen 2B: Rückfragen zu Erfahrungen', 'Sprechen 3: Gemeinsam planen'], 'speaking'),
  ], simulationReleased: false },
  { id: 'telc_deutsch_b1', title: 'telc Deutsch B1', description: 'Lesen, Sprachbausteine, E-Mail, Kontaktaufnahme, Themengespräch und Planung.', source: 'https://www.telc.net/sprachpruefungen/deutsch/zertifikat-deutsch-telc-deutsch-b1/', checkedAt: '2026-10-03', times: 'Lesen/Sprachbausteine 90 · Hören ca. 30 · Schreiben 30 · Sprechen ca. 15 Minuten', preparation: '20 Minuten Sprechvorbereitung. Hörregeln unterscheiden sich je Teil.', parts: [
    ...parts('reading', ['Lesen 1: Globalverstehen', 'Lesen 2: Detailverstehen', 'Lesen 3: Selektives Verstehen'], 'reading'),
    ...parts('vocabulary', ['Sprachbausteine 1', 'Sprachbausteine 2'], 'language-elements'),
    ...parts('listening', ['Hören 1: Globalverstehen', 'Hören 2: Detailverstehen', 'Hören 3: Selektives Verstehen'], 'listening'),
    ...parts('writing', ['E-Mail mit Leitpunkten'], 'writing'),
    ...parts('speaking', ['Kontaktaufnahme', 'Gespräch über ein Thema', 'Gemeinsam eine Aufgabe lösen'], 'interaction'),
  ], simulationReleased: false },
  ...(['goethe_b1', 'oesd_zb1'] as const).map(id => ({ id, title: id === 'goethe_b1' ? 'Goethe-Zertifikat B1' : 'ÖSD Zertifikat B1 (ZB1)', description: 'Nachrichten, Meinungsbeitrag, Kurzpräsentation, Rückmeldung und Planung.', source: id === 'goethe_b1' ? 'https://www.goethe.de/ins/de/de/m/prf/prf/gzb1/inf.html' : 'https://osd.at/portfolio-item/osd-zertifikat-b1-zb1/', checkedAt: '2026-10-03', times: 'Lesen 65 · Hören 40 · Schreiben 60 · Sprechen ca. 15 Minuten', preparation: '15 Minuten Sprechvorbereitung. Hörregeln unterscheiden sich je Teil.', parts: [
    ...parts('reading', ['Lesen 1: Blog', 'Lesen 2: Artikel', 'Lesen 3: Anzeigen', 'Lesen 4: Meinungen', 'Lesen 5: Anweisungen'], 'reading'),
    ...parts('listening', ['Hören 1: Kurze Texte', 'Hören 2: Vortrag', 'Hören 3: Gespräch', 'Hören 4: Diskussion'], 'listening'),
    ...parts('writing', ['Persönliche Nachricht', 'Meinungsbeitrag', 'Formelle Nachricht'], 'writing'), ...presentation,
  ], simulationReleased: false })),
  { id: 'telc_deutsch_a2_b1', title: 'telc Deutsch A2–B1', description: 'Zusätzlich Informationen aus Texten und Hörtexten in eigene Notizen übertragen.', source: 'https://www.telc.net/sprachpruefungen/zertifikatspruefung/deutsch/telc-deutsch-a2b1/', detailSources: ['https://shop.telc.net/media/catalog/product/file/5/0/5060-b00-020101_bib.pdf'], checkedAt: '2026-10-03', times: 'Lesen 45 · Sprachbausteine/Lesen/Schreiben 35 · Hören/Schreiben 35 · Schreiben 10 · Sprechen ca. 15 Minuten', preparation: 'Keine Sprechvorbereitung. Eigene integrierte Aufgaben; ein anderes Format als der DTZ.', parts: [
    ...parts('reading', ['Lesen 1: Kleinanzeigen zuordnen', 'Lesen 2: Kurzen Text im Detail verstehen', 'Lesen 3: E-Mails global verstehen', 'Lesen 4: Längeren Text im Detail verstehen'], 'reading').map((p, i) => ({ ...p, decisions: [5, 4, 4, 5][i] })),
    ...parts('vocabulary', ['Sprachbausteine/Lesen und Schreiben 1: Textlücken'], 'language-elements').map(p => ({ ...p, decisions: 10 })),
    { id: 'integrated-reading-2', title: 'Sprachbausteine/Lesen und Schreiben 2: E-Mail verstehen', skill: 'reading', family: 'integrated', decisions: 2, playback: null, verified: false },
    ...parts('writing', ['Sprachbausteine/Lesen und Schreiben 3: E-Mail beantworten', 'Hören und Schreiben 5: Anrufbeantworter verstehen und Notiz schreiben', 'Schreiben: Auf eine Frage mit einer Kurznachricht reagieren'], 'integrated'),
    ...parts('listening', ['Hören 1: Alltagsgespräche zuordnen', 'Hören 2: Berufliches Gespräch verstehen', 'Hören 3: Ansagen verstehen', 'Hören 4: Meinungen zuordnen'], 'listening').map(p => ({ ...p, decisions: 5 })),
    ...parts('speaking', ['Sprechen 1A: Sich vorstellen', 'Sprechen 1B: Anschlussfragen beantworten', 'Sprechen 2: Gemeinsam planen', 'Sprechen 3: Meinung begründen und diskutieren'], 'interaction'),
  ], simulationReleased: false },
  { id: 'oesd_zdoe_b1', title: 'ÖSD Zertifikat Deutsch Österreich B1 (ZDÖ)', description: 'Alltag in Österreich, Antwort-E-Mail, Kontakt, Themengespräch und Planung.', source: 'https://osd.at/portfolio-item/osd-zertifikat-deutsch-osterreich-b1-zdo-b1/', detailSources: ['https://www.osd.at/wp-content/uploads/2023/09/ZDO-B1-Durchfuhrungsbestimmungen_10_2023.pdf'], checkedAt: '2026-10-03', times: 'Lesen/Sprachbausteine 90 · Hören ca. 30 · Schreiben 40 · Sprechen ca. 15 Minuten', preparation: '10 Minuten Sprechvorbereitung. Hörregeln folgen dem eigenen ZDÖ-Modellsatz.', parts: [
    ...parts('reading', ['Lesen 1', 'Lesen 2', 'Lesen 3'], 'reading'),
    ...parts('vocabulary', ['Sprachbausteine 1', 'Sprachbausteine 2'], 'language-elements'),
    ...parts('listening', ['Hören 1', 'Hören 2', 'Hören 3'], 'listening'),
    ...parts('writing', ['Antwort-E-Mail'], 'writing'),
    ...parts('speaking', ['Kontaktaufnahme', 'Themengespräch', 'Gemeinsam planen'], 'interaction'),
  ], simulationReleased: false },
]
export const EXAM_SKILL_LABELS = { vocabulary: 'Wortschatz', listening: 'Hören', reading: 'Lesen', writing: 'Schreiben', speaking: 'Sprechen' } as const
export function examProfile(id: string): ExamProfile { return EXAM_PROFILES.find(profile => profile.id === id) ?? EXAM_PROFILES[0] }
