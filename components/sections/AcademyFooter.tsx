import Link from 'next/link'
import { ArrowUpRight, MapPin } from 'lucide-react'
import BrandLogo from '@/components/layout/BrandLogo'
import type { getDictionary } from '@/lib/dictionary'

type Dictionary = Awaited<ReturnType<typeof getDictionary>>
export default function AcademyFooter({ dictionary, lang }: { dictionary: Dictionary; lang: string }) {
  const copy = dictionary.academy
  const footer = dictionary.Footer
  return <footer id="location" className="academy-footer"><div className="academy-container">
    <div className="academy-footer-top"><div><p className="academy-eyebrow">{footer.Nav.location}</p><h2>{copy.location_title}</h2><p>{copy.location_text}</p></div><a className="academy-button academy-button-outline" href="https://www.google.com/maps/dir/?api=1&destination=Vahrenwalder+Str.+92+30165+Hannover" target="_blank" rel="noreferrer">{copy.location_map}<ArrowUpRight size={19} aria-hidden="true" /></a></div>
    <div className="academy-footer-columns"><Link className="academy-brand-link" href={`/${lang}`}><BrandLogo name={copy.brand_name} descriptor={copy.brand_descriptor} /></Link><address><MapPin size={19} aria-hidden="true" /><span>{copy.location_address}</span></address><div><a href={`mailto:${footer.Contact.email}`}>{footer.Contact.email}</a><a href={`tel:${footer.Contact.phone.replace(/\s/g, '')}`}>{footer.Contact.phone}</a></div></div>
    <div className="academy-footer-bottom"><p>{footer.Legal.copyright}</p><nav aria-label={footer.Legal.imprint}><Link href={`/${lang}/imprint`}>{footer.Legal.imprint}</Link><Link href={`/${lang}/privacy`}>{footer.Legal.privacy}</Link><Link href={`/${lang}/agb`}>{footer.Legal.terms}</Link><Link href={`/${lang}/cancellation`}>{footer.Legal.cancellation}</Link></nav></div>
  </div></footer>
}
