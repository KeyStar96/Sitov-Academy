'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Inbox } from 'lucide-react'
import PronunciationConversation from '@/components/audio/PronunciationConversation'
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
 const visible = conversations.filter((conversation) => filter === 'all' || conversation.status === filter)
 return <section className="min-w-0 space-y-5"><header className="flex flex-wrap items-end justify-between gap-5"><div><Heading className="text-2xl font-semibold tracking-tight">{t(staff ? 'teacher_queue_title' : 'history_title')}</Heading><p className="mt-2 max-w-2xl text-base leading-relaxed text-[var(--muted)]">{t(staff ? 'teacher_queue_hint' : 'conversation_hint')}</p></div>{staff && <div className="flex max-w-full flex-wrap gap-1 rounded-2xl bg-[var(--surface-muted)] p-1">{(['pending','reviewed','all'] as const).map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`min-h-12 rounded-xl px-4 py-3 text-sm font-semibold ${filter === value ? 'bg-[var(--surface)] text-[var(--foreground)] shadow-sm' : 'text-[var(--muted)]'}`}>{t(value === 'pending' ? 'pending_filter' : value === 'reviewed' ? 'completed_filter' : 'all_filter')} <span className="ml-1 text-xs">{conversations.filter((item) => value === 'all' || item.status === value).length}</span></button>)}</div>}</header>{visible.length ? visible.map((conversation) => <PronunciationConversation key={conversation.id} conversation={conversation} staff={staff} lang={lang} translations={translations}/>) : <div className="rounded-3xl border border-dashed border-[var(--border)] p-8 text-center"><Inbox className="mx-auto mb-4 text-[var(--accent-text)]" size={30}/><p className="font-semibold">{t(staff ? 'empty_queue' : 'history_empty')}</p>{!staff && <p className="mt-2 text-sm text-[var(--muted)]">{t('history_empty_hint')}</p>}</div>}</section>
}
