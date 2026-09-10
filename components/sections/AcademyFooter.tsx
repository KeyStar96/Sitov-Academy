import Link from 'next/link'
import { ArrowUpRight, Mail, Phone } from 'lucide-react'
import BrandLogo from '@/components/layout/BrandLogo'
import type { getDictionary } from '@/lib/dictionary'

type Dictionary = Awaited<ReturnType<typeof getDictionary>>
export default function AcademyFooter({ dictionary, lang }: { dictionary: Dictionary; lang: string }) {
  const copy = dictionary.academy
  const footer = dictionary.Footer
  const { classroom, school } = footer.Addresses

  return (
    <footer id="location" className="academy-footer">
      <div className="academy-container">
        <div className="academy-footer-top">
          <div>
            <p className="academy-eyebrow">{footer.Nav.location}</p>
            <h2>{copy.location_title}</h2>
            <p>{copy.location_text}</p>
          </div>
          <a className="academy-button academy-button-outline" href="https://www.google.com/maps/dir/?api=1&destination=Vahrenwalder+Str.+92+30165+Hannover" target="_blank" rel="noreferrer">
            {copy.location_map}<ArrowUpRight size={19} aria-hidden="true" />
          </a>
        </div>

        <div className="academy-footer-columns">
          <Link className="academy-brand-link" href={`/${lang}`}>
            <BrandLogo name={copy.brand_name} descriptor={copy.brand_descriptor} />
          </Link>
          <section className="academy-footer-address" aria-labelledby="academy-classroom-title">
            <h3 id="academy-classroom-title">{classroom.label}</h3>
            <address>
              <span>{classroom.venue}</span>
              <span>{classroom.street}</span>
              <span>{classroom.city}</span>
            </address>
          </section>
          <section className="academy-footer-address" aria-labelledby="academy-school-title">
            <h3 id="academy-school-title">{school.label}</h3>
            <address>
              <span>{school.street}</span>
              <span>{school.city}</span>
            </address>
          </section>
          <section className="academy-footer-contact" aria-labelledby="academy-contact-title">
            <h3 id="academy-contact-title">{footer.Contact.title}</h3>
            <a href={`mailto:${footer.Contact.email}`}><Mail size={18} aria-hidden="true" /><span>{footer.Contact.email}</span></a>
            <a href={`tel:${footer.Contact.phone.replace(/\s/g, '')}`}><Phone size={18} aria-hidden="true" /><span>{footer.Contact.phone}</span></a>
          </section>
        </div>

        <div className="academy-footer-bottom">
          <p>{footer.Legal.copyright}</p>
          <nav aria-label={footer.Legal.imprint}>
            <Link href={`/${lang}/imprint`}>{footer.Legal.imprint}</Link>
            <Link href={`/${lang}/privacy`}>{footer.Legal.privacy}</Link>
            <Link href={`/${lang}/agb`}>{footer.Legal.terms}</Link>
            <Link href={`/${lang}/cancellation`}>{footer.Legal.cancellation}</Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
