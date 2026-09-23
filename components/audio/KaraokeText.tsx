'use client'

import { useMemo } from 'react'

interface Token { text: string; word: boolean; start: number }

/** Zerlegt den Text in Wörter und Zwischenräume; Zeilenumbrüche bleiben erhalten. */
function tokenize(text: string): { tokens: Token[]; length: number } {
  const tokens: Token[] = []
  let letters = 0
  for (const part of text.split(/(\s+)/)) {
    if (!part) continue
    const word = !/^\s+$/.test(part)
    tokens.push({ text: part, word, start: letters })
    if (word) letters += part.length
  }
  return { tokens, length: letters }
}

/**
 * Mitlesen: Während das Vorbild abgespielt wird, wandert die Hervorhebung Wort
 * für Wort durch den Text. Ohne Zeitmarken je Wort schätzt sie die Stelle aus
 * der Buchstabenzahl — für Vorlesetexte in ruhigem Tempo genau genug.
 * `progress` ist `null`, solange nichts läuft; dann bleibt der Text ruhig.
 */
export default function KaraokeText({ text, progress, className }: { text: string; progress: number | null; className?: string }) {
  const { tokens, length } = useMemo(() => tokenize(text), [text])
  const position = progress === null ? -1 : progress * length
  let current = -1
  if (progress !== null) {
    tokens.forEach((token, index) => { if (token.word && token.start <= position) current = index })
  }
  return (
    <p lang="de" className={className} data-following={progress !== null}>
      {tokens.map((token, index) => token.word
        ? <span key={index} className="st-karaoke__word" data-state={index === current ? 'current' : index < current ? 'read' : undefined}>{token.text}</span>
        : <span key={index}>{token.text}</span>)}
    </p>
  )
}
