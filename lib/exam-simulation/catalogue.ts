import type { SimulationFamily, SimulationLevel, SimulationProfile, SimulationProvider, SimulationSkill } from './types'

export const SIMULATION_LEVELS: SimulationLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
export const SIMULATION_PROVIDERS: { id: Exclude<SimulationProvider, 'sitov'>; title: string; description: string }[] = [
  { id: 'telc', title: 'telc', description: 'Alltag, Beruf und gemeinsam planen' },
  { id: 'goethe', title: 'Goethe', description: 'Vier Fertigkeiten und eigene Module' },
  { id: 'oesd', title: 'ÖSD', description: 'Österreich, Deutschland und die Schweiz' },
  { id: 'dtz', title: 'DTZ', description: 'Deutsch-Test für Zuwanderer · A2–B1' },
]
export const SIMULATION_SKILL_LABELS: Record<SimulationSkill, string> = {
  reading: 'Lesen', language: 'Sprachbausteine', listening: 'Hören', writing: 'Schreiben', speaking: 'Sprechen',
}

const family = (id: string, skill: SimulationSkill, title: string, practiceTasks = 1): SimulationFamily => ({
  id, skill, title, practiceTasks, requiresAudio: skill === 'listening',
})
const reading = [
  family('reading-global', 'reading', 'Das Thema eines Textes erkennen'),
  family('reading-detail', 'reading', 'Einzelheiten im Text verstehen'),
  family('reading-selective', 'reading', 'Passende Angebote und Anzeigen finden'),
  family('reading-opinion', 'reading', 'Meinungen und Begründungen verstehen'),
  family('reading-instructions', 'reading', 'Hinweise und Regeln verstehen'),
]
const listening = [
  family('listening-announcement', 'listening', 'Ansagen und Nachrichten verstehen'),
  family('listening-detail', 'listening', 'Einzelheiten im Hörtext verstehen'),
  family('listening-conversation', 'listening', 'Gespräche verstehen'),
  family('listening-opinion', 'listening', 'Meinungen im Hörtext unterscheiden'),
]
const writing = [
  family('writing-personal', 'writing', 'Eine persönliche Nachricht schreiben'),
  family('writing-formal', 'writing', 'Eine formelle Nachricht schreiben'),
  family('writing-opinion', 'writing', 'Eine Meinung begründen'),
]
const speaking = [
  family('speaking-introduction', 'speaking', 'Sich vorstellen und Rückfragen beantworten'),
  family('speaking-presentation', 'speaking', 'Ein Thema vorstellen und Rückfragen beantworten'),
  family('speaking-planning', 'speaking', 'Gemeinsam eine Aufgabe planen'),
]

/** Distinct B1 formats. A practice question is a sample, never an official full part. */
function familiesFor(level: SimulationLevel, provider: SimulationProvider): SimulationFamily[] {
  if (provider === 'dtz') return [
    family('reading-selective', 'reading', 'Verzeichnisse und Anzeigen'),
    family('reading-detail', 'reading', 'Mitteilungen und Pressetexte'),
    family('reading-instructions', 'reading', 'Bedingungen und Informationsbroschüren'),
    family('language-cloze', 'language', 'Textlücken in Mitteilungen'),
    ...listening,
    family('writing-formal', 'writing', 'Eine Mitteilung zu vier Inhaltspunkten'),
    speaking[0], family('speaking-experience', 'speaking', 'Über Erfahrungen und einen Bildimpuls sprechen'), speaking[2],
  ]
  if (provider === 'telc' && level === 'B1') return [
    ...reading.slice(0, 3),
    family('language-choice', 'language', 'Sprachbausteine: passende Form wählen'),
    family('language-cloze', 'language', 'Sprachbausteine: Textlücken ergänzen'),
    listening[0], listening[1], listening[2],
    family('writing-formal', 'writing', 'Eine E-Mail zu vier Leitpunkten'),
    speaking[0], family('speaking-opinion', 'speaking', 'Ein Gespräch über ein Thema führen'), speaking[2],
  ]
  if ((provider === 'goethe' || provider === 'oesd') && level === 'B1') return [
    ...reading, ...listening, ...writing,
    speaking[2], speaking[1], family('speaking-opinion', 'speaking', 'Rückmeldung geben und Rückfragen stellen'),
  ]
  if (level === 'A1' || level === 'A2') return [
    ...reading.filter(item => ['reading-detail', 'reading-selective', 'reading-instructions'].includes(item.id)),
    listening[0], listening[1], listening[2], writing[0], writing[1], speaking[0], speaking[2],
  ]
  return [...reading, ...listening, ...writing, ...speaking,
    ...(provider === 'telc' || provider === 'oesd' ? [family('language-cloze', 'language', 'Textlücken und Sprachgebrauch')] : []),
    ...(provider === 'telc' && level === 'C2' ? [family('integrated-listening-writing', 'listening', 'Hörinformationen zusammenfassen und schriftlich weitergeben')] : []),
  ]
}

const sources: Record<Exclude<SimulationProvider, 'sitov'>, string> = {
  telc: 'https://www.telc.net/sprachpruefungen/deutsch/',
  goethe: 'https://www.goethe.de/de/spr/prf.html',
  oesd: 'https://www.osd.at/pruefungen/oesd-pruefungen/',
  dtz: 'https://www.gast.de/de/forschung-entwicklung/entwicklung/auftraege/deutsch-test-fuer-zuwanderer-dtz/der-dtz-auf-einen-blick',
}

/** Current adult general certificates; Beruf/Hochschule/other variants need separate profiles. */
const providerPassRules: Record<'telc' | 'oesd', Record<SimulationLevel, string>> = {
  telc: {
    A1: 'Mindestens 36/60 Punkte insgesamt. Die vier Fertigkeiten zählen je 15 Punkte.',
    A2: 'Mindestens 36/60 Punkte insgesamt nach dem aktuellen allgemeinen telc-A2-Format.',
    B1: 'Mindestens 135/225 Punkte im schriftlichen und 45/75 im mündlichen Teil. Beide Teilgrenzen müssen erreicht werden.',
    B2: 'Mindestens 135/225 Punkte im schriftlichen und 45/75 im mündlichen Teil. Beide Teilgrenzen müssen erreicht werden.',
    C1: 'Allgemeines telc Deutsch C1: schriftlich mindestens 99/166 und mündlich mindestens 29/48; insgesamt mindestens 128/214. C1 Hochschule ist ein eigenes Format.',
    C2: 'Schriftlich mindestens 72/120 und mündlich mindestens 24/40. Der schriftliche Teil enthält auch die Übertragung von Hörinformationen in einen eigenen Text.',
  },
  oesd: {
    A1: 'Schriftlich mindestens 38/75 und mündlich 12/25. Zusätzlich: Lesen mindestens 6/30, Hören 6/30 und Schreiben 4/15.',
    A2: 'Schriftlich mindestens 35/70 und mündlich 10/20. Zusätzlich: Lesen mindestens 5/25, Hören 6/30 und Schreiben 3/15.',
    B1: 'Mindestens 60/100 in jedem Modul Lesen, Hören, Schreiben und Sprechen.',
    B2: 'Schriftlich mindestens 42/70 und mündlich 18/30. Zusätzlich: Lesen mindestens 10/20, Hören 10/20 und Schreiben 15/30.',
    C1: 'Schriftlich mindestens 42/70 und mündlich 18/30. Zusätzlich: Lesen 10/20, Hören 10/20 und Schreiben 15/30; beide Schreibaufgaben benötigen jeweils mindestens 7/15.',
    C2: 'Jedes der vier getrennten Module benötigt mindestens 24/40. Zusätzliche Mindestpunkte der Schreibaufgaben werden vor Freigabe verbindlich geprüft.',
  },
}

function profileFor(level: SimulationLevel, provider: Exclude<SimulationProvider, 'sitov'>): SimulationProfile {
  const available = provider !== 'dtz' || level === 'A2' || level === 'B1'
  const title = provider === 'dtz' ? `DTZ · Ziel ${level}` : `${SIMULATION_PROVIDERS.find(item => item.id === provider)!.title} ${level}`
  const officialMinutes = level === 'B1'
    ? provider === 'telc' ? 'Lesen/Sprachbausteine 90 · Hören ca. 30 · Schreiben 30 · Sprechen ca. 15 Minuten'
      : provider === 'dtz' ? 'Hören ca. 25 · Lesen 45 · Schreiben 30 · Sprechen ca. 16 Minuten'
        : 'Lesen 65 · Hören 40 · Schreiben 60 · Sprechen ca. 15 Minuten'
    : 'Die vollständigen Zeiten werden vor der Freigabe anhand des gewählten Prüfungsformats geprüft.'
  const passRule = provider === 'dtz'
    ? 'B1: Sprechen mindestens 75/100 und zusätzlich entweder Hören/Lesen mindestens 33/45 oder Schreiben mindestens 15/20. A2: 35/100 sowie 20/45 oder 7/20.'
    : provider === 'goethe' && !['A1', 'A2'].includes(level)
      ? 'Mindestens 60/100 Punkte in jedem der vier Module. Schreiben und Sprechen werden von einer Lehrkraft bewertet.'
      : provider === 'goethe' && level === 'A1'
        ? 'Mindestens 60/100 Punkte insgesamt. Schreiben und Sprechen werden von einer Lehrkraft bewertet.'
        : provider === 'goethe' && level === 'A2'
          ? 'Mindestens 45/75 im schriftlichen Teil und 15/25 im mündlichen Teil.'
          : providerPassRules[provider as 'telc' | 'oesd'][level]
  return {
    id: `${provider}_${level.toLowerCase()}`, level, provider, title,
    description: `${title}: eigene Aufgaben von Sitov Academy in ausgewählten Aufgabenformen.`,
    available, fullExamReleased: false, practiceAvailable: available,
    practiceMinutes: level === 'A1' || level === 'A2' ? 35 : 60,
    officialMinutes, officialSource: sources[provider], checkedAt: '2026-10-04',
    families: available ? familiesFor(level, provider) : [],
    blockers: available ? [
      'Vollständige Originalumfänge, Aufgabenzahlen und Zeitvorgaben sind noch nicht fachlich freigegeben.',
      'Hörtexte dürfen erst nach lokal vorberechneter Aufnahme, geprüften Wortzeitmarken und Storage-Import erscheinen.',
      'Schreiben und Sprechen benötigen eine Bewertung durch die Lehrkraft; das System vergibt dafür keine automatische Bestehenszusage.',
    ] : ['Den DTZ gibt es als skalierte Prüfung A2–B1. Wählen Sie A2 oder B1.'],
    passRule,
  }
}

function universalFamilies(level: SimulationLevel): SimulationFamily[] {
  const lower = level === 'A1' || level === 'A2'
  const families: SimulationFamily[] = [
    ...reading.filter(item => !lower || item.id !== 'reading-opinion').map(item => ({ ...item, practiceTasks: item.id === 'reading-selective' ? 1 : 2 })),
    ...(['B2', 'C1', 'C2'].includes(level) ? [family('reading-coherence', 'reading', 'Eine Argumentation zusammenhängend ordnen')] : []),
    ...(level !== 'A1' ? [family('language-choice', 'language', 'Sprachgebrauch und grammatische Formen', 2), family('language-cloze', 'language', 'Textlücken und Zusammenhang', 2)] : []),
    ...listening.map(item => ({ ...item, practiceTasks: 2 })),
    ...(level === 'A1' ? [family('writing-form', 'writing', 'Ein Formular ausfüllen'), writing[0]] : lower ? writing.slice(0, 2) : writing),
    ...(level === 'B2' || level === 'C1' || level === 'C2' ? [family('writing-report', 'writing', 'Informationen geordnet berichten')] : []),
    ...(level === 'C1' || level === 'C2' ? [{ ...family('integrated-listening-writing', 'writing', 'Hörinformationen schriftlich vermitteln'), requiresAudio: true }] : []),
    ...(level === 'C2' ? [family('writing-reformulation', 'writing', 'Bedeutungen in einem anderen Register wiedergeben')] : []),
    speaking[0], speaking[2],
    ...(level === 'A1' ? [family('speaking-requests', 'speaking', 'Fragen stellen und auf Bitten reagieren')] : []),
    ...(!lower ? [family('speaking-experience', 'speaking', 'Einen Bildimpuls beschreiben und Erfahrungen vergleichen'), speaking[1], family('speaking-opinion', 'speaking', 'Diskutieren, Rückfragen stellen und darauf reagieren')] : []),
  ]
  return families
}

export const SIMULATION_UNIVERSAL_PROFILES: SimulationProfile[] = SIMULATION_LEVELS.map(level => ({
  id: `sitov_${level.toLowerCase()}`, provider: 'sitov', level, title: `Simulierte Prüfung · ${level}`,
  description: 'Eine umfassende Prüfung von Sitov Academy mit wichtigen Aufgabenformen verschiedener Prüfungsinstitute. Alle Fertigkeiten gehören dazu.',
  available: true, practiceAvailable: true, fullExamReleased: false,
  practiceMinutes: ({ A1: 80, A2: 100, B1: 150, B2: 180, C1: 210, C2: 240 })[level],
  officialMinutes: 'Eigene Zeitvorgabe von Sitov Academy; keine institutsgebundene Originalprüfung.',
  officialSource: '', checkedAt: '2026-10-04', families: universalFamilies(level),
  blockers: ['Der Start wird auf alle Pflichtaufgaben, lokal vorberechnete Hörtexte und geprüfte Wortzeitmarken geprüft.'],
  passRule: 'Eigene Sitov-Einschätzung: mindestens 70 % je Fertigkeit einschließlich Sprachgebrauch und mindestens 50 % je Schreib- und Sprechaufgabe. Alle produktiven Leistungen und echten Gespräche müssen eingereicht und von der Lehrkraft bewertet werden. Diese strenge Orientierung garantiert nicht das Bestehen einer realen Prüfung.',
}))
export const SIMULATION_PROFILES = [
  ...SIMULATION_LEVELS.flatMap(level => SIMULATION_PROVIDERS.map(provider => profileFor(level, provider.id))),
  ...SIMULATION_UNIVERSAL_PROFILES,
]

export function getSimulationProfile(level: SimulationLevel, provider: SimulationProvider): SimulationProfile {
  const profile = SIMULATION_PROFILES.find(item => item.level === level && item.provider === provider)
  if (!profile) throw new Error('Dieses Prüfungsformat ist nicht verfügbar.')
  return profile
}

export function getSimulationProfileById(id: string): SimulationProfile | undefined {
  return SIMULATION_PROFILES.find(item => item.id === id)
}

export function simulationProvidersForLevel(level: SimulationLevel): typeof SIMULATION_PROVIDERS {
  return SIMULATION_PROVIDERS.filter(provider => getSimulationProfile(level, provider.id).available)
}
