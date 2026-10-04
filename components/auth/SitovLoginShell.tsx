import Link from 'next/link'
import { ArrowLeft, ShieldCheck, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import BrandLogo from '@/components/layout/BrandLogo'
import SitovMotionStage from '@/components/motion/SitovMotionStage'
import AuthLanguageSelect from './AuthLanguageSelect'
import SitovLoginGraphic from './SitovLoginGraphic'
import { registrationLabels } from '@/lib/admin-registration-i18n'
import type { getDictionary } from '@/lib/dictionary'
import styles from './SitovLoginShell.module.css'

type Dictionary = Awaited<ReturnType<typeof getDictionary>>

export default function SitovLoginShell({ lang, title, description, children, dictionary }: {
  lang: string
  title: string
  description?: ReactNode
  children: ReactNode
  dictionary: Dictionary
}) {
  const copy = registrationLabels(lang)

  return <div className={styles.sitovShell} data-sitov-login-shell>
    <div className={styles.sitovAtmosphere} aria-hidden="true" />
    <header className={styles.sitovHeader}>
      <Link href={`/${lang}`} className={styles.sitovBrand}>
        <BrandLogo name={dictionary.academy.brand_name} descriptor={dictionary.academy.brand_descriptor} />
      </Link>
      <div className={styles.sitovHeaderActions}>
        <AuthLanguageSelect lang={lang} label={dictionary.academy.language} />
        <Link href={`/${lang}`} className={styles.sitovHome} aria-label={copy.home}>
          <ArrowLeft size={18} aria-hidden="true" /><span>{copy.home}</span>
        </Link>
      </div>
    </header>

    <div className={styles.sitovLayout}>
      <SitovMotionStage className={styles.sitovFormStage}>
        <section className={styles.sitovCard} aria-labelledby="sitov-login-title" data-sitov-surface>
          <div className={styles.sitovCardBeam} aria-hidden="true" />
          <div className={styles.sitovCardHeading}>
            <p className={styles.sitovEyebrow}><Sparkles size={15} aria-hidden="true" />{copy.learning}</p>
            <h1 id="sitov-login-title">{title}</h1>
            {description && <div className={styles.sitovDescription}>{description}</div>}
          </div>
          <div className={styles.sitovFormContent}>{children}</div>
          <p className={styles.sitovSecurity}><ShieldCheck size={18} aria-hidden="true" />{copy.auth_security}</p>
        </section>
      </SitovMotionStage>

      <section className={styles.sitovWelcome} aria-labelledby="sitov-login-welcome">
        <div className={styles.sitovWelcomeCopy}>
          <p className={styles.sitovEyebrow}><span className={styles.sitovStatusDot} aria-hidden="true" />{dictionary.academy.brand_descriptor}</p>
          <h2 id="sitov-login-welcome">{copy.auth_headline}</h2>
          <p className={styles.sitovIntro}>{copy.auth_intro}</p>
        </div>
        <SitovMotionStage className={styles.sitovGraphicStage}><SitovLoginGraphic /></SitovMotionStage>
      </section>
    </div>
  </div>
}
