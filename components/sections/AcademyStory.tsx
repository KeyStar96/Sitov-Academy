import Image from 'next/image'
import { ArrowUpRight, BookOpen, GraduationCap, HeartHandshake, Repeat2 } from 'lucide-react'
import type { getDictionary } from '@/lib/dictionary'
import Reveal from '@/components/ui/Reveal'

type Dictionary = Awaited<ReturnType<typeof getDictionary>>
// Die Abschluss-CTA ("Learning-Bridge") wandert als PremiumCtaCard vor den Footer (siehe page.tsx).
export default function AcademyStory({ dictionary }: { dictionary: Dictionary; lang?: string }) {
  const copy = dictionary.academy
  const method = [
    { title: copy.method_1_title, text: copy.method_1_text, icon: HeartHandshake },
    { title: copy.method_2_title, text: copy.method_2_text, icon: BookOpen },
    { title: copy.method_3_title, text: copy.method_3_text, icon: Repeat2 },
  ]
  return <>
    <section id="science" className="academy-section academy-container">
      <Reveal className="academy-section-heading"><p className="academy-eyebrow">{copy.method_eyebrow}</p><h2>{copy.method_title}</h2><p>{copy.method_description}</p></Reveal>
      <Reveal className="academy-method-grid" delay={0.05}>{method.map((item, index) => <article key={item.title} className="academy-method-card"><div className="academy-method-meta"><item.icon size={25} strokeWidth={1.5} aria-hidden="true" /><span aria-hidden="true">0{index + 1}</span></div><h3>{item.title}</h3><p>{item.text}</p></article>)}</Reveal>
    </section>
    <section id="about" className="academy-section academy-container">
      <Reveal className="academy-teacher-card">
        <div className="academy-teacher-portrait">
          <Image src="/Bilder/Nastja.png" fill alt={copy.teacher_alt} sizes="(max-width: 767px) 90vw, 40vw" className="object-contain object-bottom" />
        </div>
        <div className="academy-teacher-copy">
          <p className="academy-eyebrow">{copy.teacher_eyebrow}</p><h2>{copy.teacher_title}</h2><p>{copy.teacher_text}</p>
          <ul className="academy-teacher-qualifications">
            <li><GraduationCap size={22} aria-hidden="true" /><div><h3>{copy.teacher_academic_title}</h3><p>{copy.teacher_academic_text}</p></div></li>
            <li><BookOpen size={22} aria-hidden="true" /><div><h3>{copy.teacher_training_title}</h3><p>{copy.teacher_training_text}</p></div></li>
          </ul>
          <a className="academy-button academy-button-outline" href="https://t.me/Sprachschule_Anastasia" target="_blank" rel="noopener noreferrer">{copy.teacher_cta}<ArrowUpRight size={19} aria-hidden="true" /></a>
        </div>
      </Reveal>
    </section>
  </>
}
