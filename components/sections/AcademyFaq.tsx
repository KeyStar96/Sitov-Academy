import { ChevronDown } from 'lucide-react'
import type { getDictionary } from '@/lib/dictionary'

type Dictionary = Awaited<ReturnType<typeof getDictionary>>

/**
 * Sichtbare FAQ der Startseite. Dieselben Einträge speisen das FAQPage-JSON-LD
 * in `app/[lang]/page.tsx` – Google verlangt, dass markierte Fragen sichtbar sind.
 * Native `<details>`: ohne JavaScript bedienbar, Antworten stehen im HTML.
 */
export default function AcademyFaq({ dictionary }: { dictionary: Dictionary }) {
  const faq = dictionary.faq
  return (
    <section id="faq" className="academy-section academy-container" aria-labelledby="academy-faq-title">
      <div className="academy-section-heading">
        <p className="academy-eyebrow">{faq.eyebrow}</p>
        <h2 id="academy-faq-title">{faq.title}</h2>
        <p>{faq.description}</p>
      </div>
      <div className="academy-faq-list">
        {faq.items.map(item => (
          <details key={item.question} className="academy-faq-item">
            <summary>
              <span>{item.question}</span>
              <ChevronDown size={20} aria-hidden="true" />
            </summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
