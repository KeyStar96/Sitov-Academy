'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { Check, KeyRound, Loader2, Route } from 'lucide-react'
import { getSitovPronunciationReadiness, setSitovPronunciationAccess } from '@/app/actions/sitov-pronunciation-access'
import type { SitovPronunciationMode, SitovPronunciationReadiness } from '@/lib/sitov-pronunciation-readiness'
import { sitovPronunciationAccessCopy } from '@/lib/sitov-pronunciation-access-i18n'
import { adminInput, adminFocus } from './ui'
import { dashboardPanel } from './TeacherDashboardShared'

export default function SitovPronunciationAccess({ studentId, levels, lang, initialReadiness }: {
 studentId: string; levels: string[]; lang: string; initialReadiness: SitovPronunciationReadiness | null
}) {
 const t = sitovPronunciationAccessCopy(lang)
 const router = useRouter()
 const reducedMotion = useReducedMotion()
 const [level, setLevel] = useState(initialReadiness?.level ?? levels[0] ?? '')
 const [readiness, setReadiness] = useState(initialReadiness)
 const [busy, setBusy] = useState(false)
 const [message, setMessage] = useState('')
 const [failed, setFailed] = useState(false)
 async function changeLevel(next: string) {
  setLevel(next); setBusy(true); setMessage(''); setReadiness(null)
  try { setReadiness(await getSitovPronunciationReadiness(next, studentId)) }
  finally { setBusy(false) }
 }
 async function save(mode: SitovPronunciationMode) {
  if (busy || !readiness || mode === readiness.mode) return
  setBusy(true); setMessage(''); setFailed(false)
  try {
   const result = await setSitovPronunciationAccess({ studentId, level, mode })
   if (!result.success) { setFailed(true); setMessage(t.failed); return }
   setReadiness(await getSitovPronunciationReadiness(level, studentId)); setMessage(t.saved); router.refresh()
  } catch { setFailed(true); setMessage(t.failed) }
  finally { setBusy(false) }
 }
 return <section className={dashboardPanel} aria-labelledby="sitov-pronunciation-access-title">
  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
   <h2 id="sitov-pronunciation-access-title" className="text-base font-semibold">{t.title}</h2>
   {levels.length>0 && <label className="flex items-center gap-2 text-sm"><span>{t.level}</span><select className={adminInput} value={level} disabled={busy} onChange={event => void changeLevel(event.target.value)}>{levels.map(value => <option key={value} value={value}>{value}</option>)}</select></label>}
  </div>
  {!levels.length ? <p className="text-sm text-[var(--muted)]">{t.noLevel}</p> : <>
   <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label={t.title}>
    {(['logical','hard'] as const).map(mode => {
     const selected = readiness?.mode === mode
     const Icon = mode === 'logical' ? Route : KeyRound
     return <motion.button key={mode} type="button" aria-pressed={selected} disabled={busy || !readiness} onClick={() => void save(mode)}
      whileTap={reducedMotion ? undefined : { scale: 0.98 }} transition={{ duration: 0.18 }}
      className={`relative min-h-32 rounded-xl border p-4 text-left disabled:cursor-wait ${adminFocus} ${selected ? 'border-[var(--accent-strong)] bg-[var(--accent-soft)]' : 'border-[var(--admin-line)] bg-[var(--surface)]'}`}>
      <span className="mb-2 flex items-center gap-2 text-sm font-semibold"><Icon size={20} aria-hidden="true" />{t[mode]}{selected && <Check size={18} className="ml-auto" aria-hidden="true" />}</span>
      <span className="block text-sm leading-relaxed text-[var(--muted)]">{t[mode === 'logical' ? 'logicalHint' : 'hardHint']}</span>
     </motion.button>
    })}
   </div>
   {readiness && <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label={t.status}>
    {[[t.vocabulary,readiness.stats.knownWords],[t.grammar,readiness.stats.grammarNodes],[t.verbs,readiness.stats.confidentVerbForms],[t.ready,`${readiness.texts.filter(text => text.ready).length}/${readiness.texts.length}`]].map(([label,value]) => <div key={label} className="rounded-lg bg-[var(--surface-muted)] p-3"><dt className="text-xs text-[var(--muted)]">{label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd></div>)}
   </dl>}
   {!busy && !readiness && <p className="mt-3 text-sm text-[var(--muted)]" role="alert">{t.unavailable}</p>}
   <p className={`mt-3 flex min-h-6 items-center gap-2 text-sm ${failed ? 'text-[var(--danger)]' : 'text-[var(--muted)]'}`} role={failed ? 'alert' : 'status'}>{busy ? <><Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />{t.save}</> : message}</p>
  </>}
 </section>
}
