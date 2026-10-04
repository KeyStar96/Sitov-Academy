'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Check, ChevronDown, Globe2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { LOCALES, UI_LOCALE_ENDONYMS, toUiLocale, withUiLocale, type UiLocale } from '@/lib/locale-routing'
import { EASE_OUT_SOFT, useReducedMotionSafe } from '@/lib/motion'
import styles from './SitovMarketingHeader.module.css'

/** Public-site locale navigation stays separate from the learning profile preference. */
export default function SitovMarketingLanguageSwitcher({ current, label, onSelect }: {
  current: string
  label: string
  onSelect?: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const locale = toUiLocale(current)
  const reduced = useReducedMotionSafe()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const options = useRef<(HTMLButtonElement | null)[]>([])
  const id = `sitov-language-${useId()}`

  useEffect(() => {
    if (!open) return
    options.current[LOCALES.indexOf(locale)]?.focus({ preventScroll: true })
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside, true)
    return () => document.removeEventListener('pointerdown', outside, true)
  }, [open, locale])

  function choose(next: UiLocale) {
    setOpen(false)
    onSelect?.()
    trigger.current?.focus({ preventScroll: true })
    if (next !== locale) router.push(`${withUiLocale(pathname || `/${locale}`, next)}${window.location.search}${window.location.hash}`)
  }

  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      trigger.current?.focus({ preventScroll: true })
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    if (!open) { setOpen(true); return }
    const active = options.current.findIndex(option => option === document.activeElement)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? LOCALES.length - 1
      : (active + (event.key === 'ArrowDown' ? 1 : -1) + LOCALES.length) % LOCALES.length
    options.current[next]?.focus({ preventScroll: true })
  }

  return (
    <div ref={root} className={styles.sitovLanguage} onKeyDown={keyboard} onBlur={event => {
      if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) setOpen(false)
    }}>
      <button ref={trigger} type="button" className={styles.sitovLanguageTrigger}
        aria-label={`${label}: ${UI_LOCALE_ENDONYMS[locale]}`} aria-haspopup="menu"
        aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(value => !value)}>
        <Globe2 size={17} aria-hidden="true" className={styles.sitovLanguageGlobe} />
        <span className={styles.sitovLanguageCode} aria-hidden="true">{locale.toUpperCase()}</span>
        <span className={styles.sitovLanguageName} lang={locale}>{UI_LOCALE_ENDONYMS[locale]}</span>
        <ChevronDown size={13} aria-hidden="true" className={styles.sitovLanguageChevron} />
      </button>
      <AnimatePresence initial={false}>
        {open && <motion.div id={id} role="menu" aria-label={label} className={styles.sitovLanguagePanel}
          initial={reduced ? false : { opacity: 0, y: -5, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? undefined : { opacity: 0, y: -3, scale: .98 }}
          transition={{ duration: reduced ? 0 : .22, ease: EASE_OUT_SOFT }}>
          {LOCALES.map((option, index) => <button key={option} ref={element => { options.current[index] = element }}
            type="button" role="menuitemradio" aria-checked={locale === option} lang={option}
            className={styles.sitovLanguageOption} onClick={() => choose(option)}>
            <span className={styles.sitovLocaleMark} aria-hidden="true">{option.toUpperCase()}</span>
            <span>{UI_LOCALE_ENDONYMS[option]}</span>
            {locale === option && <Check size={16} aria-hidden="true" />}
          </button>)}
        </motion.div>}
      </AnimatePresence>
    </div>
  )
}
