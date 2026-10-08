import { notFound } from 'next/navigation'
import SitovTrainerHero from '@/components/motion/SitovTrainerHero'
import SitovMediaScene from '@/components/media/SitovMediaScene'
import SitovPreviewAppearance from '@/components/dashboard/SitovPreviewAppearance'
import { sitovTrainerHeroCopy } from '@/lib/sitov-trainer-hero-i18n'
import { studentTranslator } from '@/lib/student-ui-i18n'
import '@/components/dashboard/student.css'

/** Local hero QA uses no account, remote media, or learner writes. */
export default async function SitovMediaPreviewPage({ params }: { params: Promise<{ lang: string }> }) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const { lang } = await params
  const copy = sitovTrainerHeroCopy(lang)
  const s = studentTranslator(lang)
  return <main className="min-h-screen bg-[var(--background)] p-4 sm:p-8">
    <div className="mx-auto max-w-6xl space-y-6">
      <SitovPreviewAppearance />
      <SitovTrainerHero mode="media" eyebrow={copy.mediaEyebrow} level="A1.1" title={s('media_title')}
        graphic={<SitovMediaScene />}>
        <p>{s('media_count', { videos: 8, documents: 4 })}</p>
      </SitovTrainerHero>
    </div>
  </main>
}
