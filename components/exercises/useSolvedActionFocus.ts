'use client'

import { useLayoutEffect, useRef, type RefObject } from 'react'

/** Keep the next action reachable when feedback expands a solved exercise. */
export function useSolvedActionFocus(isSolved: boolean): RefObject<HTMLButtonElement | null> {
  const buttonRef = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    if (!isSolved || !buttonRef.current) return

    const button = buttonRef.current
    button.focus({ preventScroll: true })
  }, [isSolved])

  return buttonRef
}
