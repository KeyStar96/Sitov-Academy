/** Shared appearance copy is supplied by the page dictionary for every locale. */
export interface AppearanceCopy {
  title: string
  description: string
  theme: string
  light: string
  dark: string
  contrast: string
  contrast_description: string
  system: string
  system_description: string
  close: string
}

/** Keeps isolated component previews readable without loading entire dictionaries. */
export const APPEARANCE_FALLBACKS: AppearanceCopy = {
  "title": "Darstellung & Lesbarkeit",
  "description": "Wähle die Darstellung, mit der du angenehm lernen kannst. Deine Auswahl gilt auf diesem Gerät für die gesamte Website.",
  "theme": "Farbschema",
  "light": "Hell",
  "dark": "Dunkel",
  "contrast": "Hoher Kontrast",
  "contrast_description": "Deutlichere Texte, kräftige Konturen und ruhige Hintergründe – im hellen und dunklen Design.",
  "system": "Systemeinstellungen verwenden",
  "system_description": "Folgt den Einstellungen deines Geräts.",
  "close": "Darstellung schließen"
}
