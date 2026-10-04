'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import {
  consentStatus,
  saveConsent,
  subscribeConsent,
  subscribeConsentSettings,
  type ConsentStatus,
} from '@/lib/analytics/consent'
import { isMetaMarketingPath, revokeMetaPixel, trackMetaEvent } from '@/lib/analytics/meta-pixel'

export interface ConsentCopy {
  title: string
  description: string
  privacy_link: string
  necessary_label: string
  necessary_description: string
  always_active: string
  marketing_label: string
  marketing_description: string
  accept_all: string
  reject_all: string
  customize: string
  save: string
  settings_button: string
}

/** Learning, administration and MFA: keep the task surface unobstructed. */
const APP_AREA = /^\/[a-z]{2}\/(dashboard|admin|staff-security)(\/|$)/

const serverStatus = (): ConsentStatus | 'pending' => 'pending'

export default function ConsentManager({ lang, copy }: { lang: string; copy: ConsentCopy }) {
  const pathname = usePathname() ?? ''
  const status = useSyncExternalStore<ConsentStatus | 'pending'>(subscribeConsent, consentStatus, serverStatus)
  const [reopened, setReopened] = useState(false)
  const [customizing, setCustomizing] = useState(false)
  const [marketing, setMarketing] = useState(false)
  const panel = useRef<HTMLElement>(null)
  const marketingSwitch = useRef<HTMLInputElement>(null)
  const opener = useRef<Element | null>(null)
  const titleId = useId()
  const marketingId = useId()

  useEffect(() => subscribeConsentSettings(() => {
    opener.current = document.activeElement
    setMarketing(consentStatus() === 'granted')
    setCustomizing(true)
    setReopened(true)
  }), [])

  const marketingPath = isMetaMarketingPath(pathname)
  const lastPageView = useRef<string | null>(null)

  // Explicit public page events. Withdrawal, removal, expiry and private-route
  // navigation also revoke an SDK left resident by an earlier release.
  useEffect(() => {
    if (status !== 'granted' || !marketingPath) {
      revokeMetaPixel()
      lastPageView.current = null
      return
    }
    if (lastPageView.current !== pathname) {
      trackMetaEvent('PageView')
      lastPageView.current = pathname
    }
  }, [status, marketingPath, pathname])

  useEffect(() => {
    if (reopened) panel.current?.focus()
  }, [reopened])

  function customize() {
    setMarketing(status === 'granted')
    setCustomizing(true)
    // Der Button verschwindet; der Fokus wandert zur ersten echten Auswahl.
    requestAnimationFrame(() => marketingSwitch.current?.focus())
  }

  // Server und Hydration kennen die Entscheidung nicht ('pending'): Das Banner
  // steht im HTML, das Bootstrap-Skript im <head> blendet es vorab aus.
  const autoPrompt = (status === 'unset' || status === 'pending') && !APP_AREA.test(pathname)
  const visible = reopened || autoPrompt

  function decide(allowMarketing: boolean) {
    saveConsent(allowMarketing)
    if (!allowMarketing) revokeMetaPixel()
    setCustomizing(false)
    if (reopened) {
      setReopened(false)
      if (opener.current instanceof HTMLElement) opener.current.focus()
    }
  }

  return <>
    {visible && (
      <section ref={panel} tabIndex={-1} aria-labelledby={titleId} className="consent-banner" data-prompt={reopened ? 'manual' : 'auto'} data-testid="consent-banner">
        <h2 id={titleId} className="consent-title">{copy.title}</h2>
        <p className="consent-text">
          {copy.description}{' '}
          <Link href={`/${lang}/privacy`} className="consent-link">{copy.privacy_link}</Link>
        </p>
        {customizing && (
          <ul className="consent-options">
            <li className="consent-option">
              <div>
                <p className="consent-option-label">{copy.necessary_label}</p>
                <p className="consent-option-text">{copy.necessary_description}</p>
              </div>
              <span className="consent-badge">{copy.always_active}</span>
            </li>
            <li className="consent-option">
              <div>
                <label htmlFor={marketingId} className="consent-option-label">{copy.marketing_label}</label>
                <p id={`${marketingId}-text`} className="consent-option-text">{copy.marketing_description}</p>
              </div>
              <input
                ref={marketingSwitch}
                id={marketingId}
                type="checkbox"
                role="switch"
                aria-describedby={`${marketingId}-text`}
                className="consent-switch"
                checked={marketing}
                onChange={event => setMarketing(event.target.checked)}
              />
            </li>
          </ul>
        )}
        <div className="consent-actions">
          <button type="button" className="academy-button academy-button-primary" onClick={() => decide(false)}>{copy.reject_all}</button>
          <button type="button" className="academy-button academy-button-primary" onClick={() => decide(true)}>{copy.accept_all}</button>
          {customizing
            ? <button type="button" className="academy-button academy-button-outline" onClick={() => decide(marketing)}>{copy.save}</button>
            : <button type="button" className="academy-button academy-button-outline" onClick={customize}>{copy.customize}</button>}
        </div>
      </section>
    )}
  </>
}
