import { notFound } from 'next/navigation'
import VocabCardSession from '@/components/vocabulary/VocabCardSession'
import type { DueVocabularyCard } from '@/lib/types/vocabulary'
import { getDictionary } from '@/lib/dictionary'

/** Development fixtures have no authenticated learner or writable progress. */
export default async function SitovVocabularyChunksPreview({ params, searchParams }: {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ kind?: string; width?: string; frame?: string }>
}) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const { lang } = await params
  const query = await searchParams
  const dictionary = await getDictionary(lang)
  const chunk = query.kind === 'chunk'
  const width = Math.max(320, Math.min(768, Number(query.width) || 390))
  if (query.frame !== '1') return <main className="grid justify-items-center gap-4 p-4">
    <h1 className="text-base font-semibold">Sitov Academy · {width} × 844</h1>
    <iframe title="Sitov Academy vocabulary mobile preview" src={`/${lang}/sitov-preview/vocabulary-chunks?frame=1&kind=${chunk ? 'chunk' : 'word'}`}
      style={{ width, maxWidth: '100%', height: 844, border: '1px solid var(--border)', borderRadius: 24 }} />
  </main>
  const card: DueVocabularyCard = {
    progressId: 'sitov-preview-progress', phase: 3, box: 3, mode: 'learner_choice',
    direction: 'native_to_de', format: 'word', promptLanguage: 'en',
    prompt: chunk ? 'Could you please help me?' : 'appointment',
    contextSentence: chunk ? 'Könnten Sie mir bitte mit dem Formular helfen?' : 'Paul vereinbart einen Termin beim Arzt.',
    solution: null, translation: chunk ? 'Could you please help me?' : 'appointment', isHardForNativeLanguage: false,
    card: {
      id: 'sitov-preview-card', level: 'A1.2', lesson: 'Lektion 1 · Beruf und Arbeit',
      word_de: chunk ? 'Könnten Sie mir bitte helfen?' : 'Termin', article: chunk ? null : 'der', plural: chunk ? null : 'Termine',
      contentKind: chunk ? 'chunk' : 'vocabulary', usageChunk: chunk ? 'Könnten Sie mir bitte helfen?' : 'einen Termin vereinbaren',
      usageChunkTranslation: chunk ? 'Could you please help me?' : 'make an appointment',
      exampleTranslation: chunk ? 'Could you please help me with the form?' : 'Paul makes an appointment with the doctor.',
      image_url: null, audio_url: null,
    },
  }
  return <VocabCardSession learnerId={null} cards={[card]} translations={dictionary.vocabulary} uiLanguage={lang} overviewHref={`/${lang}/sitov-preview/trainers`} />
}
