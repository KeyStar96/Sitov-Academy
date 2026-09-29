'use client'

import { useMemo } from 'react'

interface Token { text: string; word: boolean; start: number; wordIndex: number }

/** Zerlegt den Text in Wörter und Zwischenräume; Zeilenumbrüche bleiben erhalten. */
function tokenize(text: string): { tokens: Token[]; length: number } {
  const tokens: Token[] = []
  let letters = 0
  let wordIndex = 0
  for (const part of text.split(/(\s+)/)) {
    if (!part) continue
    const word = !/^\s+$/.test(part)
    tokens.push({ text: part, word, start: letters, wordIndex: word ? wordIndex++ : -1 })
    if (word) letters += part.length
  }
  return { tokens, length: letters }
}

/**
 * Mitlesen: Während das Vorbild abgespielt wird, wandert die Hervorhebung Wort
 * für Wort durch den Text. Synthetisierte Sprache liefert den tatsächlichen
 * Wortindex. Bei Lehrkraft-Aufnahmen ohne Wortzeitmarken ist `progress` nur
 * eine Annäherung anhand der Buchstabenzahl.
 * `activeWordIndex: null` löscht die exakte Hervorhebung; `undefined` nutzt
 * die Annäherung aus `progress`.
 */
export default function KaraokeText({ text, progress = null, activeWordIndex, className }: {
  text: string
  progress?: number | null
  activeWordIndex?: number | null
  className?: string
}) {
  const { tokens, length } = useMemo(() => tokenize(text), [text])
  const position = progress === null ? -1 : progress * length
  let current = -1
  if (activeWordIndex !== undefined) {
    if (activeWordIndex !== null) current = tokens.findIndex(token => token.word && token.wordIndex === activeWordIndex)
  } else if (progress !== null) {
    tokens.forEach((token, index) => { if (token.word && token.start <= position) current = index })
  }
  return (
    <p lang="de" className={className} data-following={current !== -1}>
      {tokens.map((token, index) => token.word
        ? <span key={index} className="st-karaoke__word" data-state={index === current ? 'current' : index < current ? 'read' : undefined}>{token.text}</span>
        : <span key={index}>{token.text}</span>)}
    </p>
  )
}
