'use client'
import { useEffect, useId, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { courseQuantityCopy } from '@/lib/course-quantity-i18n'

export default function CourseQuantityInput({value,onChange,unitMinutes,unitPrice,lang,disabled=false}:{value:number;onChange:(value:number)=>void;unitMinutes:number;unitPrice:number;lang:string;disabled?:boolean}) {
  const id=useId(),copy=courseQuantityCopy(lang)
  const [draft,setDraft]=useState(String(value))
  useEffect(()=>setDraft(String(value)),[value])
  const valid=/^\d+$/.test(draft)&&Number(draft)>=1&&Number(draft)<=1000
  const control='flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-40'
  return <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
    <label htmlFor={id} className="block text-base font-semibold">{copy.label}</label>
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={disabled||value<=1} className={control} aria-label={copy.decrease} onClick={()=>onChange(value-1)}><Minus size={18} aria-hidden="true"/></button>
      <input id={id} type="number" inputMode="numeric" min={1} max={1000} step={1} value={draft} disabled={disabled} aria-invalid={!valid} aria-describedby={`${id}-hint`} className={`${control} w-24 px-3 text-center text-lg tabular-nums`}
        onChange={event=>{const next=event.target.value;setDraft(next);if(/^\d+$/.test(next)&&Number(next)>=1&&Number(next)<=1000)onChange(Number(next))}}
        onBlur={()=>{if(!valid)setDraft(String(value))}}/>
      <button type="button" disabled={disabled||value>=1000} className={control} aria-label={copy.increase} onClick={()=>onChange(value+1)}><Plus size={18} aria-hidden="true"/></button>
      <strong className="text-lg tabular-nums text-[var(--accent-text)]">{new Intl.NumberFormat(lang,{style:'currency',currency:'EUR'}).format(value*unitPrice)}</strong>
    </div>
    <p id={`${id}-hint`} className="text-base leading-relaxed text-[var(--muted)]">{copy.hint.replace('{minutes}',String(unitMinutes))}</p>
    {!valid&&<p role="alert" className="text-base text-red-700 dark:text-red-300">{copy.range}</p>}
  </div>
}
