'use client'

import { useLayoutEffect, useRef, type RefObject } from 'react'

/** Keep the next action reachable when feedback expands a solved exercise. */
export function useSolvedActionFocus(isSolved: boolean): RefObject<HTMLButtonElement | null> {
  const buttonRef = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    if (!isSolved || !buttonRef.current) return

    const button = buttonRef.current
    button.focus({ preventScroll: true })
    // The check and next actions can reuse an already-focused DOM node. A new
    // focus call alone will not reveal it after feedback pushes it offscreen.
    button.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    })
  }, [isSolved])

  return buttonRef
}
