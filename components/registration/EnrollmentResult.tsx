'use client'

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, Check, User } from 'lucide-react'
import EnrollmentSignup from './EnrollmentSignup'
import { fill, type RegistrationDictionary } from './registration-copy'

function ResultShell({ icon, title, children, lang, home }: { icon: ReactNode; title: string; children: ReactNode; lang: string; home: string }) {
  const heading = useRef<HTMLHeadingElement>(null)
  // The form disappears; move focus so screen readers announce the outcome.
  useEffect(() => { heading.current?.focus() }, [])
  return (
    <div className="registration-flow reg-result">
      <div className="reg-result__card">
        <span className="reg-result__icon" aria-hidden="true">{icon}</span>
        <h1 ref={heading} tabIndex={-1} className="reg-result__title">{title}</h1>
        {children}
        <Link href={`/${lang}`} className="reg-button reg-button--soft reg-result__home"><ArrowLeft size={20} aria-hidden="true" />{home}</Link>
      </div>
    </div>
  )
}

/** Thank-you page with the concrete next steps instead of a bare "confirmed". */
export function EnrollmentDone({ dictionary, lang, trial, email, name, trialDateLabel }: {
  dictionary: RegistrationDictionary; lang: string; trial: boolean; email: string; name: string; trialDateLabel?: string
}) {
  const done = dictionary.registration.flow.done
  const steps = trial
    ? [fill(done.step_mail, { email }), done.step_check_trial, done.step_trial_free]
    : [fill(done.step_mail, { email }), done.step_check, done.step_invoice]
  return (
    <ResultShell icon={<Check size={44} strokeWidth={3} />} title={trial ? done.title_trial : done.title} lang={lang} home={dictionary.registration.flow.home}>
      <p className="reg-result__lead">{trial ? done.lead_trial : done.lead}</p>
      {trial && trialDateLabel && <p className="reg-result__date"><CalendarDays size={22} aria-hidden="true" />{fill(done.trial_date, { date: trialDateLabel })}</p>}
      <h2 className="reg-result__subtitle">{done.next_title}</h2>
      <ol className="reg-result__steps">
        {steps.map((step, index) => <li key={index} className="reg-enter" style={{ '--i': index + 2 } as CSSProperties}><span aria-hidden="true">{index + 1}</span><p>{step}</p></li>)}
      </ol>
      <EnrollmentSignup lang={lang} name={name} email={email} />
    </ResultShell>
  )
}

export function EnrollmentTrialUsed({ dictionary, lang }: { dictionary: RegistrationDictionary; lang: string }) {
  const trial = dictionary.registration.trial
  return (
    <ResultShell icon={<User size={40} />} title={trial.already_used_title} lang={lang} home={dictionary.registration.flow.home}>
      <p className="reg-result__lead">{trial.already_used_message}</p>
      {/* A full page load leaves trial mode and its state behind. */}
      <a href={`/${lang}/registration`} className="reg-button reg-button--primary reg-result__cta">{dictionary.academy.book_course}</a>
    </ResultShell>
  )
}
