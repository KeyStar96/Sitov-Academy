import BrandLogo from '@/components/layout/BrandLogo'
import AuthLanguageSelect from '@/components/auth/AuthLanguageSelect'
import { getDictionary } from '@/lib/dictionary'
import { registrationLabels } from '@/lib/admin-registration-i18n'
import { ArrowLeft, BookOpen, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

export default async function AuthShell({lang,title,description,children}:{lang:string;title:string;description?:ReactNode;children:ReactNode}) {
  const dict=await getDictionary(lang)
  const t=registrationLabels(lang)
  return <div className="relative min-h-dvh overflow-hidden bg-[var(--canvas)] px-4 pt-[calc(env(safe-area-inset-top,0px)+1.25rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] text-[var(--foreground)] sm:px-7 sm:pt-[calc(env(safe-area-inset-top,0px)+1.75rem)] sm:pb-[calc(env(safe-area-inset-bottom,0px)+1.75rem)]">
    {/* Dezente, warme Deko-Glow — gibt der Glass-Karte etwas zum Bluren. */}
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0" style={{ background: 'radial-gradient(42rem 42rem at 12% 8%, color-mix(in srgb, var(--violet) 12%, transparent), transparent 60%), radial-gradient(38rem 38rem at 92% 96%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 62%)' }} />
    <header className="relative z-10 mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4">
      <Link href={`/${lang}`} className="inline-flex min-h-14 items-center rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"><BrandLogo name={dict.academy.brand_name} descriptor={dict.academy.brand_descriptor}/></Link>
      <div className="flex flex-wrap items-center gap-3"><AuthLanguageSelect lang={lang} label={dict.academy.language}/>
      <Link href={`/${lang}`} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 text-sm font-semibold hover:border-[var(--violet)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"><ArrowLeft size={18} aria-hidden="true"/>{t.home}</Link></div>
    </header>
    <div className="relative z-10 mx-auto grid w-full max-w-6xl min-w-0 items-center gap-7 py-10 sm:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
      <section className="relative min-w-0 lg:py-12">
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--violet)]"><Sparkles size={16} aria-hidden="true"/>{t.learning}</p>
        <h2 className="max-w-lg text-4xl font-semibold leading-[1.08] tracking-[-0.045em] sm:text-5xl lg:text-6xl">{t.auth_headline}</h2>
        <p className="mt-5 max-w-md text-base leading-relaxed text-[var(--muted)] sm:text-lg">{t.auth_intro}</p>
        <div className="mt-9 hidden max-w-sm items-center gap-4 lg:flex" aria-hidden="true"><span className="flex h-20 w-20 items-center justify-center rounded-3xl border border-[var(--border)] bg-[var(--surface)] text-[var(--violet)] shadow-sm"><BookOpen size={30}/></span><span className="h-px flex-1 bg-[var(--border)]"/><span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[var(--accent-strong)] text-[var(--accent-foreground)] shadow-sm"><MessageCircle size={30}/></span></div>
      </section>
      <section className="relative min-w-0 overflow-hidden rounded-[2rem] border border-[var(--border)] p-5 shadow-lg backdrop-blur-xl sm:p-8" style={{ background: 'color-mix(in srgb, var(--surface) 82%, transparent)' }}>
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60" style={{ backgroundImage: 'var(--gold)' }} />
        <div className="mb-7 space-y-3"><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>{description&&<div className="text-base leading-relaxed text-[var(--muted)]">{description}</div>}</div>
        <div className="space-y-6">{children}</div>
        <p className="mt-7 flex items-start gap-3 border-t border-[var(--border)] pt-5 text-sm leading-relaxed text-[var(--muted)]"><ShieldCheck size={20} className="mt-0.5 shrink-0 text-[var(--violet)]" aria-hidden="true"/>{t.auth_security}</p>
      </section>
    </div>
  </div>
}
