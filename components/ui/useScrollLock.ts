'use client'

import { useEffect } from 'react'

/**
 * Sperrt das Scrollen der Seite, solange `active` gilt.
 *
 * Die Sperre muss am `<html>` sitzen: globals.css setzt dort
 * `overflow-y: scroll`, und dann gibt der Browser das `overflow` des `<body>`
 * nicht mehr an den Viewport weiter — `body { overflow: hidden }` allein lässt
 * die Seite hinter einem Blatt weiterscrollen. `scrollbar-gutter: stable` hält
 * die Rinne der Scrollleiste frei, damit die Seite beim Sperren nicht zur
 * Seite springt.
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const root = document.documentElement
    const previous = { overflow: root.style.overflow, gutter: root.style.scrollbarGutter, body: document.body.style.overflow }
    root.style.scrollbarGutter = 'stable'
    root.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      root.style.overflow = previous.overflow
      root.style.scrollbarGutter = previous.gutter
      document.body.style.overflow = previous.body
    }
  }, [active])
}
