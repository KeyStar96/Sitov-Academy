import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, BookOpen, HeartHandshake, Repeat2 } from 'lucide-react'
import type { getDictionary } from '@/lib/dictionary'

type Dictionary = Awaited<ReturnType<typeof getDictionary>>
export default function AcademyStory({ dictionary, lang }: { dictionary: Dictionary; lang: string }) {
  const copy = dictionary.academy
  const method = [
    { title: copy.method_1_title, text: copy.method_1_text, icon: HeartHandshake },
    { title: copy.method_2_title, text: copy.method_2_text, icon: BookOpen },
    { title: copy.method_3_title, text: copy.method_3_text, icon: Repeat2 },
  ]
  return <>
    <section id="science" className="academy-section academy-container">
      <div className="academy-section-heading"><p className="academy-eyebrow">{copy.method_eyebrow}</p><h2>{copy.method_title}</h2><p>{copy.method_description}</p></div>
      <div className="academy-method-grid">{method.map((item, index) => <article key={item.title} className="academy-method-card"><div className="academy-method-meta"><item.icon size={25} strokeWidth={1.5} aria-hidden="true" /><span aria-hidden="true">0{index + 1}</span></div><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
    </section>
    <section id="about" className="academy-section academy-container">
      <div className="academy-teacher-card"><div className="academy-teacher-portrait"><Image src="/Bilder/Nastja.png" width={650} height={800} alt={copy.teacher_alt} sizes="(max-width: 767px) 90vw, 40vw" className="h-full w-full object-cover object-top" /></div><div className="academy-teacher-copy"><p className="academy-eyebrow">{copy.teacher_eyebrow}</p><h2>{copy.teacher_title}</h2><p>{copy.teacher_text}</p><a className="academy-button academy-button-outline" href={`mailto:${dictionary.Footer.Contact.email}`}>{copy.teacher_cta}<ArrowUpRight size={19} aria-hidden="true" /></a></div></div>
    </section>
    <section className="academy-container academy-learning-bridge"><div><p className="academy-eyebrow">{copy.platform}</p><h2>{copy.learn_title}</h2><p>{copy.learn_description}</p></div><Link className="academy-button academy-button-primary" href={`/${lang}/dashboard`}>{copy.hero_secondary}<ArrowUpRight size={20} aria-hidden="true" /></Link></section>
  </>
}
