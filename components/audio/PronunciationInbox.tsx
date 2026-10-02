'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Inbox, Undo2 } from 'lucide-react'
import PronunciationConversation from '@/components/audio/PronunciationConversation'
import { setPronunciationSubmissionHidden } from '@/app/actions/pronunciation-conversations'
import type { PronunciationConversation as Conversation } from '@/lib/pronunciation-conversations'
import { createPronunciationTranslator, type PronunciationTranslations } from '@/lib/pronunciation-i18n'
export default function PronunciationInbox({ conversations, lang, translations, staff = false, initialFilter }: { conversations: Conversation[]; lang: string; translations: PronunciationTranslations; staff?: boolean; initialFilter?: 'pending'|'reviewed'|'all' }) {
 const t = createPronunciationTranslator(translations)
 const router = useRouter()
 useEffect(() => {
  const refresh = () => { if (document.visibilityState === 'visible') router.refresh() }
  const timer = window.setInterval(refresh, 30000)
  window.addEventListener('focus', refresh)
  return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh) }
 }, [router])
 const Heading = staff ? 'h1' : 'h2'
 const [filter, setFilter] = useState<'pending'|'reviewed'|'all'>(initialFilter ?? (staff ? 'pending' : 'all'))
 // Aus der Lehreransicht entfernte Einreichungen verschwinden sofort; der Server-Abgleich folgt mit router.refresh().
 const [removed, setRemoved] = useState<ReadonlySet<string>>(() => new Set())
 const [notice, setNotice] = useState<{ text: string; undo?: string; failed?: boolean } | null>(null)
 const [restoring, setRestoring] = useState(false)
 const noticeRef = useRef<HTMLDivElement>(null)
 useEffect(() => { if (notice) noticeRef.current?.focus({ preventScroll: true }) }, [notice])
 // Ein geöffnetes Gespräch bleibt in der Liste, auch wenn eine Antwort oder eine aus der Lehreransicht entfernte Nachricht
 // seinen Status ändert – sonst würde sich der Dialog mitten in der Arbeit schließen.
 const [openId, setOpenId] = useState<string | null>(null)
 const remaining = conversations.filter((conversation) => !removed.has(conversation.id))
 const visible = remaining.filter((conversation) => filter === 'all' || conversation.status === filter || conversation.id === openId)
 const handleRemoved = (conversation: Conversation) => {
  setRemoved(previous => new Set(previous).add(conversation.id))
  setNotice({ text: t('submission_removed'), undo: conversation.id })
  router.refresh()
 }
 const undoRemoved = async (id: string) => {
  if (restoring) return
  setRestoring(true)
  try {
   const result = await setPronunciationSubmissionHidden(id, false)
   if (!result.success) { setNotice({ text: t('undo_failed'), undo: id, failed: true }); return }
   setRemoved(previous => { const next = new Set(previous); next.delete(id); return next })
   setNotice({ text: t('submission_restored') })
   router.refresh()
  } catch { setNotice({ text: t('undo_failed'), undo: id, failed: true }) }
  finally { setRestoring(false) }
 }
 return <section className="min-w-0 space-y-5"><header className="flex flex-wrap items-end justify-between gap-5"><div><Heading className="text-2xl font-semibold tracking-tight">{t(staff ? 'teacher_queue_title' : 'history_title')}</Heading><p className="mt-2 max-w-2xl text-base leading-relaxed text-[var(--muted)]">{t(staff ? 'teacher_queue_hint' : 'conversation_hint')}</p></div>{staff && <div className="flex max-w-full flex-wrap gap-1 rounded-2xl bg-[var(--surface-muted)] p-1">{(['pending','reviewed','all'] as const).map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`min-h-12 rounded-xl px-4 py-3 text-sm font-semibold ${filter === value ? 'bg-[var(--surface)] text-[var(--foreground)] shadow-sm' : 'text-[var(--muted)]'}`}>{t(value === 'pending' ? 'pending_filter' : value === 'reviewed' ? 'completed_filter' : 'all_filter')} <span className="ml-1 text-xs">{remaining.filter((item) => value === 'all' || item.status === value).length}</span></button>)}</div>}</header>{notice && <div ref={noticeRef} tabIndex={-1} role="status" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl bg-[var(--surface-muted)] px-4 py-2 text-base focus:outline-none"><p className={`py-1 font-semibold ${notice.failed ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>{notice.text}</p>{notice.undo && <button type="button" disabled={restoring} onClick={() => { void undoRemoved(notice.undo!) }} className="inline-flex min-h-12 items-center gap-2 rounded-xl px-3 font-semibold underline underline-offset-4 hover:bg-[var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-50"><Undo2 size={18} aria-hidden="true" />{t('undo')}</button>}</div>}{visible.length ? visible.map((conversation) => <PronunciationConversation key={conversation.id} conversation={conversation} staff={staff} lang={lang} translations={translations} onRemoved={staff ? handleRemoved : undefined} onOpenChange={(open) => setOpenId(current => open ? conversation.id : current === conversation.id ? null : current)}/>) : <div className="rounded-3xl border border-dashed border-[var(--border)] p-8 text-center"><Inbox className="mx-auto mb-4 text-[var(--accent-text)]" size={30}/><p className="font-semibold">{t(staff ? 'empty_queue' : 'history_empty')}</p>{!staff && <p className="mt-2 text-sm text-[var(--muted)]">{t('history_empty_hint')}</p>}</div>}</section>
}
