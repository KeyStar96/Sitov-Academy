import { notFound } from 'next/navigation'
import VocabCardSession from '@/components/vocabulary/VocabCardSession'
import type { DueVocabularyCard } from '@/lib/types/vocabulary'
import { getDictionary } from '@/lib/dictionary'
import { AppearanceProvider } from '@/components/layout/AppearanceProvider'
import SitovLearningShell from '@/components/layout/SitovLearningShell'
import ModeDock from '@/components/dashboard/ModeDock'
import VocabularyTabs from '@/components/vocabulary/VocabularyTabs'
import { LEARNING_MODES, modeHref } from '@/lib/mode-targets'
import '@/components/dashboard/student.css'

/** Development fixtures have no authenticated learner or writable progress. */
export default async function SitovVocabularyChunksPreview({ params, searchParams }: {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ kind?: string; width?: string; frame?: string; shell?: string }>
}) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const { lang } = await params
  const query = await searchParams
  const dictionary = await getDictionary(lang)
  const chunk = query.kind === 'chunk'
  const sentence = query.kind === 'sentence'
  const width = Math.max(320, Math.min(768, Number(query.width) || 390))
  if (query.frame !== '1') return <main className="grid justify-items-center gap-4 p-4">
    <h1 className="text-base font-semibold">Sitov Academy · {width} × 844</h1>
    <iframe title="Sitov Academy vocabulary mobile preview" src={`/${lang}/sitov-preview/vocabulary-chunks?frame=1&kind=${chunk ? 'chunk' : 'word'}`}
      style={{ width, maxWidth: '100%', height: 844, border: '1px solid var(--border)', borderRadius: 24 }} />
  </main>
  const card: DueVocabularyCard = {
    progressId: 'sitov-preview-progress', phase: 3, box: 3, mode: 'learner_choice',
    direction: 'native_to_de', format: sentence ? 'sentence' : 'word', promptLanguage: 'en',
    prompt: sentence ? 'What is your telephone number?' : chunk ? 'Could you please help me?' : 'appointment',
    contextSentence: sentence ? null : chunk ? 'Könnten Sie mir bitte mit dem Formular helfen?' : 'Paul vereinbart einen Termin beim Arzt.',
    solution: sentence ? 'Wie ist Ihre Telefonnummer?' : null, translation: chunk ? 'Could you please help me?' : 'appointment', isHardForNativeLanguage: false,
    card: {
      id: 'sitov-preview-card', level: 'A1.2', lesson: 'Lektion 1 · Beruf und Arbeit',
      word_de: chunk ? 'Könnten Sie mir bitte helfen?' : 'Termin', article: chunk ? null : 'der', plural: chunk ? null : 'Termine',
      contentKind: chunk ? 'chunk' : 'vocabulary', usageChunk: sentence ? 'die Telefonnummer sagen' : chunk ? 'Könnten Sie mir bitte helfen?' : 'einen Termin vereinbaren',
      usageChunkTranslation: sentence ? 'say the phone number' : chunk ? 'Could you please help me?' : 'make an appointment',
      exampleTranslation: chunk ? 'Could you please help me with the form?' : 'Paul makes an appointment with the doctor.',
      image_url: null, audio_url: null,
    },
  }
  const session = <VocabCardSession learnerId={null} cards={[card]} translations={dictionary.vocabulary} uiLanguage={lang} overviewHref={`/${lang}/sitov-preview/trainers`} />
  if (query.shell !== '1') return session
  const pathname = modeHref(lang, 'A1.1', 'vocabulary')
  return <AppearanceProvider copy={dictionary.accessibility}><SitovLearningShell lang={lang} translations={dictionary.dashboard}
    displayName="Paul" levels={['A1.1']} sitovPreviewPathname={pathname} supportLabels={{
      whatsapp: dictionary.academy.support_whatsapp, phone: dictionary.Footer.Contact.phone, phoneLabel: dictionary.Footer.Contact.phone_label,
      telegram: dictionary.Footer.Contact.telegram_button, email: dictionary.Footer.Contact.email, emailLabel: dictionary.Footer.Contact.email_button,
    }}>
    <ModeDock lang={lang} level="A1.1" entries={LEARNING_MODES.map(mode => ({ mode, lock: null }))} />
    <VocabularyTabs lang={lang} level="A1.1" sitovPreviewPathname={pathname} />
    {session}
  </SitovLearningShell></AppearanceProvider>
}
