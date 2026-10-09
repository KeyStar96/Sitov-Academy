'use client'

import type { ReactNode } from 'react'
import { useIsHydrating } from '@/lib/motion'

/** Keep the initial document bootstrap out of client-only locale renders. */
export function SitovDocumentBootstrap({ children }: { children: ReactNode }) {
  const initialDocument = useIsHydrating()
  // Next's beforeInteractive queue runs once per document. Returning its inline
  // script during a later client mount creates an inert script and React error.
  // The server snapshot also matches hydration; ongoing preferences are handled
  // by ThemeInit and ConsentManager, without executing the bootstrap again.
  if (!initialDocument) return null

  return children
}
