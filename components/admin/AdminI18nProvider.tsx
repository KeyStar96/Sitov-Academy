'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { ADMIN_FALLBACKS, createAdminTranslator, type AdminTranslations } from '@/lib/admin-i18n'

const AdminI18nContext = createContext<AdminTranslations>(ADMIN_FALLBACKS)

export function AdminI18nProvider({ translations, children }: { translations: AdminTranslations; children: ReactNode }) {
  return <AdminI18nContext.Provider value={translations}>{children}</AdminI18nContext.Provider>
}

export function useAdminTranslator() {
  return createAdminTranslator(useContext(AdminI18nContext))
}

export function useAdminTranslations() {
  return useContext(AdminI18nContext)
}
