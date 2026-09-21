'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, X, ArrowUpRight } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion, useScroll, useMotionValueEvent } from 'framer-motion'
import type { getDictionary } from '@/lib/dictionary'
import { LOCALES, UI_LOCALE_ENDONYMS } from '@/lib/locale-routing'
import { cn } from '@/lib/utils'
import BrandLogo from './BrandLogo'
import ThemeToggle from './ThemeToggle'

type Dictionary = Awaited<ReturnType<typeof getDictionary>>
const MotionLink = motion.create(Link)
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

export default function Header({ lang, dictionary }: { lang: string; dictionary: Dictionary }) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const reduced = useReducedMotion()
  const copy = dictionary.academy
  const links = [
    { id: 'science', label: dictionary.header.nav.science },
    { id: 'about', label: dictionary.Footer.Nav.about },
    { id: 'courses', label: dictionary.header.nav.courses },
  ]

  const { scrollY } = useScroll()
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 8))

  useEffect(() => {
    if (!open) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); menuButton.current?.focus() }
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])

  // Dezentes Hover/Tap-Skalieren — nur ohne reduced-motion; sonst leeres Objekt (kein Effekt).
  const press = reduced
    ? {}
    : {
        whileHover: { scale: 1.03 },
        whileTap: { scale: 0.97 },
        transition: { type: 'spring' as const, stiffness: 420, damping: 30 },
      }

  return (
    <motion.header
      className={cn('academy-header', scrolled && 'is-scrolled')}
      initial={reduced ? false : { y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <div className="academy-header-inner academy-container">
        <Link href={`/${lang}`} className="academy-brand-link"><BrandLogo name={copy.brand_name} /></Link>
        <nav className="academy-desktop-nav" aria-label={copy.navigation}>
          {links.map(link => <Link key={link.id} href={`/${lang}#${link.id}`}>{link.label}</Link>)}
        </nav>
        <div className="academy-header-actions">
          <div className="academy-header-utilities">
            <ThemeToggle lightLabel={dictionary.dashboard.toggle_theme_light} darkLabel={dictionary.dashboard.toggle_theme_dark} />
            <label><span className="sr-only">{copy.language}</span><select className="academy-language" value={lang} onChange={event => router.push(pathname.replace(/^\/[^/]+/, `/${event.target.value}`))}>{LOCALES.map(locale => <option key={locale} value={locale}>{UI_LOCALE_ENDONYMS[locale]}</option>)}</select></label>
          </div>
          <div className="academy-header-primary-actions">
            <MotionLink {...press} className="academy-button academy-button-primary academy-header-booking" href={`/${lang}/registration`}>{copy.book_course}<ArrowUpRight size={17} aria-hidden="true" /></MotionLink>
            <MotionLink {...press} className="academy-button academy-button-outline academy-header-learning" href={`/${lang}/dashboard`}>{copy.platform}<ArrowUpRight size={17} aria-hidden="true" /></MotionLink>
          </div>
          <button ref={menuButton} type="button" className="academy-icon-button academy-menu-toggle" aria-expanded={open} aria-controls="academy-mobile-menu" aria-label={open ? copy.menu_close : copy.menu_open} onClick={() => setOpen(!open)}>{open ? <X size={22} /> : <Menu size={22} />}</button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && <motion.div id="academy-mobile-menu" className="academy-mobile-menu xl:hidden" initial={{ opacity: 0, y: reduced ? 0 : -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -8 }} transition={{ duration: .18 }}>
          <nav className="academy-container flex flex-col gap-1" aria-label={copy.navigation}>
            {links.map(link => <Link className="academy-menu-link" onClick={() => setOpen(false)} key={link.id} href={`/${lang}#${link.id}`}>{link.label}<ArrowUpRight size={18} aria-hidden="true" /></Link>)}
            <Link className="academy-button academy-button-outline my-3" onClick={() => setOpen(false)} href={`/${lang}/dashboard`}>{copy.platform}<ArrowUpRight size={18} aria-hidden="true" /></Link>
            <div className="flex items-center justify-between gap-4 py-2"><label className="flex min-w-0 flex-col gap-2 text-sm font-semibold">{copy.language}<select className="academy-language" value={lang} onChange={event => {setOpen(false); router.push(pathname.replace(/^\/[^/]+/, `/${event.target.value}`))}}>{LOCALES.map(locale => <option key={locale} value={locale}>{UI_LOCALE_ENDONYMS[locale]}</option>)}</select></label><ThemeToggle lightLabel={dictionary.dashboard.toggle_theme_light} darkLabel={dictionary.dashboard.toggle_theme_dark} /></div>
          </nav>
        </motion.div>}
      </AnimatePresence>
    </motion.header>
  )
}
