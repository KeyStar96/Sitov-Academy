'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import BrandLogo from '@/components/layout/BrandLogo'
import ThemeToggle from '@/components/layout/ThemeToggle'
import { useAppearanceCopy } from '@/components/layout/AppearanceProvider'

export default function SitovRegistrationHeader({ lang, home, brand }: { lang: string; home: string; brand: string }) {
  const appearance = useAppearanceCopy()
  return (
    <header className="reg-bar">
      <Link href={`/${lang}`} className="reg-brand"><BrandLogo name={brand} /></Link>
      <div className="sitov-registration-header__actions">
        <Link href={`/${lang}`} className="reg-home"><ArrowLeft size={19} aria-hidden="true" /><span>{home}</span></Link>
        <ThemeToggle lightLabel={appearance.light} darkLabel={appearance.dark} />
      </div>
    </header>
  )
}
