'use client'

import { useState, useTransition } from 'react'
import { Loader2, LogOut } from 'lucide-react'
import { logout } from '@/app/actions/auth'
import BottomSheet from '@/components/ui/BottomSheet'
import { studentTranslator } from '@/lib/student-ui-i18n'

/** Abmelden nur nach kurzer Rückfrage — ein versehentlicher Tipp wirft niemanden aus der Lernsitzung. */
export default function LogoutButton({ lang }: { lang: string }) {
  const t = studentTranslator(lang)
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="st-toolbar-button st-press">
        <LogOut size={21} aria-hidden="true" /><span>{t('nav_logout')}</span>
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={t('logout_title')} description={t('logout_text')}
        closeLabel={t('close')} dismissible={!pending} icon={<LogOut size={24} />}
        footer={<div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => setOpen(false)} disabled={pending} className="st-button st-button--soft st-press">{t('logout_cancel')}</button>
          <button type="button" disabled={pending} onClick={() => start(async () => { await logout(lang) })} className="st-button st-button--primary st-press">
            {pending ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : <LogOut size={20} aria-hidden="true" />}{t('logout_confirm')}
          </button>
        </div>} />
    </>
  )
}
