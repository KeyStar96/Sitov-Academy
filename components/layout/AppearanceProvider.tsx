'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { APPEARANCE_FALLBACKS, type AppearanceCopy } from '@/lib/appearance-i18n'

const AppearanceContext = createContext<AppearanceCopy>(APPEARANCE_FALLBACKS)

export function AppearanceProvider({ copy, children }: { copy: AppearanceCopy; children: ReactNode }) {
  return <AppearanceContext.Provider value={copy}>{children}</AppearanceContext.Provider>
}

export function useAppearanceCopy() { return useContext(AppearanceContext) }
