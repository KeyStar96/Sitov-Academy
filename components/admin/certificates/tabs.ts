/**
 * Reiter der Zertifikats-Seite. Bewusst ohne `'use client'`: Die Server-Seite
 * wertet `?tab=` aus, und Exporte eines Client-Moduls wären dort nur
 * Client-Referenzen statt echter Werte.
 */
export type CertificateTab = 'resolve' | 'attendance' | 'certificates'
export const CERTIFICATE_TABS: readonly CertificateTab[] = ['resolve', 'attendance', 'certificates']

export function certificateTabFrom(value: string | undefined): CertificateTab {
  return CERTIFICATE_TABS.find(tab => tab === value) ?? 'resolve'
}
