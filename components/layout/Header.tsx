'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Menu, X, ArrowUpRight } from 'lucide-react'
import { AnimatePresence, motion, useScroll, useMotionValueEvent } from 'framer-motion'
import type { getDictionary } from '@/lib/dictionary'
import { cn } from '@/lib/utils'
import { EASE_OUT_SOFT, useReducedMotionSafe } from '@/lib/motion'
import BrandLogo from './BrandLogo'
import ThemeToggle from './ThemeToggle'
import SitovMarketingLanguageSwitcher from './SitovMarketingLanguageSwitcher'
import BetaBadge from '@/components/ui/BetaBadge'
import styles from './SitovMarketingHeader.module.css'

type Dictionary = Awaited<ReturnType<typeof getDictionary>>
const MotionLink = motion.create(Link)

export default function Header({ lang, dictionary }: { lang: string; dictionary: Dictionary }) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const header = useRef<HTMLElement>(null)
  const reduced = useReducedMotionSafe()
  const copy = dictionary.academy
  const links = [
    { id: 'science', label: dictionary.header.nav.science },
    { id: 'about', label: dictionary.Footer.Nav.about },
    { id: 'courses', label: dictionary.header.nav.courses },
  ]

  const { scrollY, scrollYProgress } = useScroll()
  useMotionValueEvent(scrollY, 'change', y => setScrolled(y > 8))

  useEffect(() => {
    if (!open) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); menuButton.current?.focus({ preventScroll: true }) }
    }
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !header.current?.contains(event.target)) setOpen(false)
    }
    window.addEventListener('keydown', close)
    document.addEventListener('pointerdown', outside)
    return () => {
      window.removeEventListener('keydown', close)
      document.removeEventListener('pointerdown', outside)
    }
  }, [open])

  const press = reduced ? {} : {
    whileHover: { y: -1 },
    whileTap: { scale: .98 },
    transition: { type: 'spring' as const, stiffness: 420, damping: 30 },
  }

  return (
    <header ref={header} className={cn('academy-header', styles.sitovHeader, scrolled && styles.sitovScrolled)}>
      <div className={cn('academy-container', styles.sitovInner)}>
        <Link href={`/${lang}`} className={cn('academy-brand-link', styles.sitovBrand)}><BrandLogo name={copy.brand_name} /></Link>
        <nav className={styles.sitovDesktopNav} aria-label={copy.navigation}>
          {links.map(link => <Link key={link.id} href={`/${lang}#${link.id}`}><span>{link.label}</span></Link>)}
        </nav>
        <div className={styles.sitovControls}>
          <div className={styles.sitovDesktopTheme}>
            <ThemeToggle lightLabel={dictionary.dashboard.toggle_theme_light} darkLabel={dictionary.dashboard.toggle_theme_dark} />
          </div>
          <SitovMarketingLanguageSwitcher current={lang} label={copy.language} onSelect={() => setOpen(false)} />
          <button ref={menuButton} type="button" className={cn('academy-icon-button', styles.sitovMenuToggle)}
            aria-expanded={open} aria-controls="sitov-marketing-menu" aria-label={open ? copy.menu_close : copy.menu_open}
            onClick={() => setOpen(value => !value)}>
            <span className={styles.sitovMenuIcon} data-open={open} aria-hidden="true"><Menu size={21} /><X size={21} /></span>
          </button>
        </div>
        <div className={styles.sitovPrimaryActions}>
          <MotionLink {...press} className={cn('academy-button academy-button-primary', styles.sitovBooking)} href={`/${lang}/registration`}>{copy.book_course}<ArrowUpRight size={17} aria-hidden="true" /></MotionLink>
          <MotionLink {...press} className={cn('academy-button academy-button-outline', styles.sitovLearning)} href={`/${lang}/dashboard`}>{copy.platform}<BetaBadge label={copy.beta_label} hint={copy.beta_hint} /><ArrowUpRight size={17} aria-hidden="true" /></MotionLink>
        </div>
      </div>
      <motion.div className={styles.sitovReadingProgress} style={{ scaleX: scrollYProgress }} aria-hidden="true" />
      <AnimatePresence initial={false}>
        {open && <motion.div id="sitov-marketing-menu" className={styles.sitovMobileMenu}
          initial={reduced ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, y: -6 }} transition={{ duration: reduced ? 0 : .24, ease: EASE_OUT_SOFT }}>
          <nav className={cn('academy-container', styles.sitovMobileNav)} aria-label={copy.navigation}>
            {links.map((link, index) => <MotionLink className={styles.sitovMenuLink} onClick={() => setOpen(false)} key={link.id}
              href={`/${lang}#${link.id}`} initial={reduced ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: reduced ? 0 : .3, delay: reduced ? 0 : .035 * index, ease: EASE_OUT_SOFT }}>
              {link.label}<ArrowUpRight size={18} aria-hidden="true" />
            </MotionLink>)}
            <div className={styles.sitovMenuFooter}>
              <Link className={cn('academy-button academy-button-outline', styles.sitovMenuLearning)} onClick={() => setOpen(false)} href={`/${lang}/dashboard`}>{copy.platform}<BetaBadge label={copy.beta_label} hint={copy.beta_hint} /><ArrowUpRight size={18} aria-hidden="true" /></Link>
              <div className={styles.sitovMobileTheme}><ThemeToggle lightLabel={dictionary.dashboard.toggle_theme_light} darkLabel={dictionary.dashboard.toggle_theme_dark} /></div>
            </div>
          </nav>
        </motion.div>}
      </AnimatePresence>
    </header>
  )
}
