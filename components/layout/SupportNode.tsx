'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowUpRight, MessageSquareText, X } from 'lucide-react'
import type { getDictionary } from '@/lib/dictionary'

type Dictionary = Awaited<ReturnType<typeof getDictionary>>
export default function SupportNode({ dictionary }: { dictionary: Dictionary }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const pathname = usePathname()
  const reduced = useReducedMotion()
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); button.current?.focus() } }
    const onPointer = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onPointer) }
  }, [open])
  if (!/^\/(de|en|uk|ru|tr)\/?$/.test(pathname)) return null
  const links = [
    { href: 'https://wa.me/491714758620', label: dictionary.academy.support_whatsapp },
    { href: `tel:${dictionary.Footer.Contact.phone.replace(/\s/g, '')}`, label: dictionary.Footer.Contact.phone_label },
    { href: 'https://t.me/Sprachschule_Anastasia', label: dictionary.Footer.Contact.telegram_button },
    { href: `mailto:${dictionary.Footer.Contact.email}`, label: dictionary.Footer.Contact.email_button },
  ]
  return <div className="academy-support" ref={root}>
    <AnimatePresence>{open && <motion.nav id="academy-support-links" aria-label={dictionary.Footer.Contact.title} initial={{ opacity: 0, y: reduced ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="academy-support-links">{links.map(link => <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">{link.label}<ArrowUpRight size={17} aria-hidden="true" /></a>)}</motion.nav>}</AnimatePresence>
    <button type="button" ref={button} onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="academy-support-links" aria-label={open ? dictionary.academy.menu_close : dictionary.Footer.Contact.title} className="academy-button academy-button-primary">{open ? <X size={20} aria-hidden="true" /> : <MessageSquareText size={20} aria-hidden="true" />}<span>{dictionary.Footer.Contact.title}</span></button>
  </div>
}
