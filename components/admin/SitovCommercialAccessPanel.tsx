'use client'
import { useEffect, useState, useTransition } from 'react'
import { useParams } from 'next/navigation'
import { getSitovStaffCommercialAccess, getSitovStaffCommercialCatalog, saveSitovStaffCommercialAccess } from '@/app/actions/sitov-commercial-access'
import type { SitovStaffAccess, SitovStaffCatalog } from '@/lib/access/sitov-commercial-staff'
import type { SitovTrialManifest, SitovContentRef } from '@/lib/access/sitov-commercial'
import { ACCESS_LEVELS, sitovLevelTrainers, type AccessLevel, type Trainer } from '@/lib/access/levels'
import { getSitovCommercialAdminCopy, getSitovCommercialKindLabel } from '@/lib/admin-i18n'
import SitovTrainerHelp from '@/components/motion/SitovTrainerHelp'
import PressableCard from '@/components/motion/PressableCard'
import { useAdminTranslator } from './AdminI18nProvider'
import { adminButton, adminInput } from './ui'
import styles from './SitovCommercialAccessPanel.module.css'

type Rule = SitovTrialManifest['rules'][number]
const sameRef = (a: SitovContentRef, b: SitovContentRef) => a.kind === b.kind && a.id === b.id
export default function SitovCommercialAccessPanel({ studentId, onBusyChange }: { studentId: string; onBusyChange: (busy: boolean) => void }) {
  const { lang } = useParams<{ lang: string }>()
  const copy = getSitovCommercialAdminCopy(lang), t = useAdminTranslator()
  const [access, setAccess] = useState<SitovStaffAccess | null>(null)
  const [level, setLevel] = useState<AccessLevel>('A1.1')
  const [trainer, setTrainer] = useState<Trainer>('vocabulary')
  const [catalog, setCatalog] = useState<SitovStaffCatalog | null>(null)
  const [rule, setRule] = useState<Rule>({ level, trainer, unit_ids: [], items: null })
  const [attempt, setAttempt] = useState(0)
  const [message, setMessage] = useState<'error' | 'stale' | 'saved' | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()
  useEffect(() => { onBusyChange(pending); return () => onBusyChange(false) }, [pending, onBusyChange])
  useEffect(() => {
    let active = true
    setLoading(true); setCatalog(null); setMessage(null)
    startTransition(async () => {
      try {
        const current = await getSitovStaffCommercialAccess(studentId)
        const content = await getSitovStaffCommercialCatalog({ level, trainer })
        if (!active) return
        if (!current.ok || !content.ok) { setAccess(null); setMessage('error'); return }
        setAccess(current.data); setCatalog(content.data)
        setRule(current.data.trial.rules.find(r => r.level === level && r.trainer === trainer) ?? { level, trainer, unit_ids: [], items: null })
      } catch { if (active) { setAccess(null); setMessage('error') } }
      finally { if (active) setLoading(false) }
    })
    return () => { active = false }
  }, [studentId, level, trainer, attempt])
  const units = catalog?.units.filter(u => u.id !== null && u.items.some(i => i.published)) ?? []
  const selectedIds = rule.unit_ids ?? (rule.items?.map(b => b.unit_id) ?? [])
  const mode = rule.items !== null ? 'selected' : rule.unit_ids === null ? 'all' : rule.unit_ids.length === 0 ? 'none' : 'selected'
  const missing = mode === 'selected' && (selectedIds.some(id => !units.some(u => u.id === id))
    || !!rule.items?.some(b => b.refs?.some(ref => !units.find(u => u.id === b.unit_id)?.items.some(i => i.published && sameRef(i, ref)))))
  function changeMode(value: string) {
    setMessage(null)
    setRule({ level, trainer, unit_ids: value === 'all' ? null : [], items: value === 'selected' ? [] : null })
  }
  function selectUnit(id: string, checked: boolean) {
    setMessage(null)
    const ids = checked ? [...new Set([...selectedIds, id])] : selectedIds.filter(x => x !== id)
    setRule({ level, trainer, unit_ids: ids, items: ids.map(unit_id => rule.items?.find(b => b.unit_id === unit_id) ?? { unit_id, refs: [] }) })
  }
  function setRefs(unitId: string, refs: SitovContentRef[] | null) {
    setMessage(null)
    setRule({ ...rule, unit_ids: selectedIds, items: selectedIds.map(unit_id => unit_id === unitId ? { unit_id, refs } : rule.items?.find(b => b.unit_id === unit_id) ?? { unit_id, refs: null }) })
  }
  function save(kind: 'vip' | 'trial') {
    if (!access || pending || loading || (kind === 'trial' && missing)) return
    setMessage(null)
    startTransition(async () => {
      try {
        const input = kind === 'vip' ? { kind, studentId, enabled: !access.vip_enabled, revision: access.revision }
          : { kind, studentId, manifest: { version: 1, rules: [...access.trial.rules.filter(r => r.level !== level || r.trainer !== trainer), rule] }, revision: access.revision }
        const result = await saveSitovStaffCommercialAccess(input)
        if (result.ok === false) { setMessage(result.error === 'revision_conflict' ? 'stale' : 'error'); return }
        setAccess({ ...access, revision: result.data.revision, ...(kind === 'vip' ? { vip_enabled: !access.vip_enabled } : { trial: { version: 1, rules: [...access.trial.rules.filter(r => r.level !== level || r.trainer !== trainer), rule] } }) })
        setMessage('saved')
      } catch { setMessage('error') }
    })
  }
  const disabled = loading || pending || !access || message === 'stale'
  return <section className={styles.panel} aria-label={copy.title} aria-busy={loading || pending}>
    <h3 className="text-base font-semibold">{copy.title}</h3>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span>{copy.vip}</span>
      <PressableCard type="button" disabled={disabled} aria-pressed={access?.vip_enabled ?? false} onClick={() => save('vip')} className={adminButton('secondary', 'md')}>{access?.vip_enabled ? copy.revoke : copy.grant}</PressableCard>
    </div>
    <fieldset disabled={pending || loading} className="grid gap-3 sm:grid-cols-2">
      <legend className="mb-2 font-semibold">{copy.trial}</legend>
      <label>{t('access_level_select')}<select className={adminInput} value={level} onChange={e => { const value = e.target.value as AccessLevel; setLevel(value); if (!sitovLevelTrainers(value).includes(trainer)) setTrainer('vocabulary') }}>{ACCESS_LEVELS.map(v => <option key={v}>{v}</option>)}</select></label>
      <label>{t('trainer_access_title')}<select className={adminInput} value={trainer} onChange={e => setTrainer(e.target.value as Trainer)}>{sitovLevelTrainers(level).map(v => <option key={v} value={v}>{t(`trainer_${v}`)}</option>)}</select></label>
    </fieldset>
    {loading ? <p role="status">{copy.loading}</p> : access && <fieldset disabled={disabled} className="space-y-3">
      <legend className="sr-only">{copy.units}</legend>
      <label>{copy.units}<select className={adminInput} value={mode} onChange={e => changeMode(e.target.value)}><option value="none">{copy.none}</option><option value="all">{copy.all}</option><option value="selected">{copy.selected}</option></select></label>
      {mode === 'selected' && units.map(unit => {
        const id = unit.id!, checked = selectedIds.includes(id), bucket = rule.items?.find(b => b.unit_id === id)
        const refs = rule.items === null ? null : bucket?.refs ?? []
        return <div key={id} className="rounded-xl border border-[var(--admin-line)] p-3">
          <label className={styles.choice}><input type="checkbox" checked={checked} onChange={e => selectUnit(id, e.target.checked)} /><span lang="de" translate="no">{unit.label}</span></label>
          {checked && <div className="pl-3">
            <label className={styles.choice}><input type="checkbox" checked={refs === null} onChange={e => setRefs(id, e.target.checked ? null : [])} /><span>{copy.allItems}</span></label>
            {refs !== null && unit.items.filter(i => i.published).map(item => <label key={`${item.kind}:${item.id}`} className={styles.choice}>
              <input type="checkbox" checked={refs.some(r => sameRef(r, item))} onChange={e => setRefs(id, e.target.checked ? [...refs, { kind: item.kind, id: item.id }] : refs.filter(r => !sameRef(r, item)))} />
              <span>{getSitovCommercialKindLabel(lang, item.kind)} · <span lang="de" translate="no">{item.label}</span> <small className="break-all" title={item.id}>{item.id.slice(-8)}</small></span>
            </label>)}
          </div>}
        </div>
      })}
      {units.length === 0 && <p>{copy.empty}</p>}
      {missing && <p role="alert">{copy.unavailable}</p>}
      <PressableCard type="button" disabled={disabled || missing} onClick={() => save('trial')} className={adminButton('primary', 'md', 'w-full')}>{copy.save}</PressableCard>
    </fieldset>}
    {message && <p role={message === 'saved' ? 'status' : 'alert'}>{copy[message]}</p>}
    {(message === 'error' || message === 'stale') && <PressableCard type="button" disabled={pending} onClick={() => setAttempt(v => v + 1)} className={adminButton('secondary', 'md')}>{copy.retry}</PressableCard>}
    <SitovTrainerHelp title={copy.help}><p>{copy.info}</p></SitovTrainerHelp>
  </section>
}
