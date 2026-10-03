'use client'

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Languages, Loader2, X } from 'lucide-react'
import { sitovReadingCopy } from '@/lib/sitov-reading-i18n'
import type { SitovWordMeaningResult } from '@/lib/sitov-word-meaning'
import styles from './KaraokeText.module.css'

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
export default function KaraokeText({ text, progress = null, activeWordIndex, className, wordLookup }: {
  text: string
  progress?: number | null
  activeWordIndex?: number | null
  className?: string
  wordLookup?: { promptId: string; level: string; locale: string; onSelect?: () => void }
}) {
  const { tokens, length } = useMemo(() => tokenize(text), [text])
  const copy = sitovReadingCopy(wordLookup?.locale ?? 'de')
  const bubbleId = useId()
  const trigger = useRef<HTMLButtonElement | null>(null)
  const bubble = useRef<HTMLDivElement | null>(null)
  const request = useRef(0)
  const cache = useRef(new Map<string, SitovWordMeaningResult>())
  const [selected, setSelected] = useState<{ index: number; word: string; key: string } | null>(null)
  const [meaning, setMeaning] = useState<SitovWordMeaningResult | null>(null)
  const [anchor, setAnchor] = useState<{ left: number; top: number; below: boolean } | null>(null)
  useEffect(() => () => { request.current += 1 }, [])
  useEffect(() => {
    request.current += 1
    setSelected(null); setMeaning(null)
  }, [text, wordLookup?.promptId, wordLookup?.locale])
  useEffect(() => {
    if (!selected) return
    const position = () => {
      const rect = trigger.current?.getBoundingClientRect()
      if (!rect) return
      if (rect.bottom < 0 || rect.top > window.innerHeight) { request.current += 1; setSelected(null); return }
      const half = Math.min(240, window.innerWidth - 32) / 2
      setAnchor({ left: Math.min(window.innerWidth - half - 16, Math.max(half + 16, rect.left + rect.width / 2)),
        top: rect.top > 150 ? rect.top - 10 : rect.bottom + 10, below: rect.top <= 150 })
    }
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !bubble.current?.contains(event.target) && !trigger.current?.contains(event.target)) { request.current += 1; setSelected(null) }
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { request.current += 1; setSelected(null); trigger.current?.focus() }
    }
    position()
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true)
      document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', key)
    }
  }, [selected])

  async function lookup(index: number, word: string, button: HTMLButtonElement, retry = false) {
    if (!wordLookup) return
    wordLookup.onSelect?.()
    trigger.current = button
    const key = `${wordLookup.promptId}:${wordLookup.locale}:${word.toLocaleLowerCase('de')}`
    const version = ++request.current
    setSelected({ index, word, key })
    const existing = retry ? undefined : cache.current.get(key)
    setMeaning(existing ?? null)
    if (existing) return
    let result: SitovWordMeaningResult
    try {
      const { getSitovWordMeaning } = await import('@/app/actions/sitov-word-meaning')
      result = await getSitovWordMeaning({ promptId: wordLookup.promptId, level: wordLookup.level, word, locale: wordLookup.locale })
    }
    catch { result = { ok: false } }
    if (result.ok) {
      if (cache.current.size >= 128) cache.current.clear()
      cache.current.set(key, result)
    }
    if (version === request.current) setMeaning(result)
  }
  const position = progress === null ? -1 : progress * length
  let current = -1
  if (activeWordIndex !== undefined) {
    if (activeWordIndex !== null) current = tokens.findIndex(token => token.word && token.wordIndex === activeWordIndex)
  } else if (progress !== null) {
    tokens.forEach((token, index) => { if (token.word && token.start <= position) current = index })
  }
  return <>
    <p lang="de" className={className} data-following={current !== -1}>
      {tokens.map((token, index) => token.word
        ? wordLookup
          ? <button key={index} type="button" className={`${styles.sitovWord} st-karaoke__word`} data-state={index === current ? 'current' : index < current ? 'read' : undefined}
              data-sitov-selected={selected?.index === index} aria-label={copy.lookup.replace('{word}', token.text)}
              aria-expanded={selected?.index === index} aria-controls={selected?.index === index ? bubbleId : undefined}
              onClick={event => { if (selected?.index === index) { request.current += 1; setSelected(null) } else void lookup(index, token.text, event.currentTarget) }}>{token.text}</button>
          : <span key={index} className="st-karaoke__word" data-state={index === current ? 'current' : index < current ? 'read' : undefined}>{token.text}</span>
        : <span key={index}>{token.text}</span>)}
    </p>
    {wordLookup && selected && anchor && createPortal(
      <div ref={bubble} id={bubbleId} key={selected.key} className={styles.sitovBubble} lang={wordLookup.locale}
        role="dialog" aria-label={copy.lookup.replace('{word}', selected.word)} data-placement={anchor.below ? 'below' : 'above'}
        style={{ left: anchor.left, top: anchor.top, '--sitov-bubble-origin': anchor.below ? 'top' : 'bottom' } as CSSProperties}>
        <span className={styles.sitovBubbleGlow} aria-hidden="true" />
        <div className={styles.sitovBubbleHead}><Languages size={17} aria-hidden="true" /><strong lang="de">{selected.word}</strong>
          <button type="button" aria-label={copy.close} onClick={() => { request.current += 1; setSelected(null); trigger.current?.focus() }}><X size={17} aria-hidden="true" /></button></div>
        <div className={styles.sitovMeaning} role="status" aria-live="polite">
          {meaning === null ? <span className={styles.sitovLoading}><Loader2 size={16} aria-hidden="true" />{copy.loading}</span>
            : !meaning.ok ? <><p>{copy.failed}</p><button type="button" className={styles.sitovRetry} onClick={() => { if (trigger.current) void lookup(selected.index, selected.word, trigger.current, true) }}>{copy.retry}</button></>
              : meaning.meaning ? <><p>{meaning.meaning.translation}</p>{meaning.meaning.base.toLocaleLowerCase('de') !== selected.word.replace(/[.,!?;:]+$/u, '').toLocaleLowerCase('de') && <span className={styles.sitovBase} lang="de">{meaning.meaning.base}</span>}</>
                : <p>{copy.missing}</p>}
        </div>
      </div>, document.body)}
  </>
}
