import TrainerAccessGuard from '@/components/dashboard/TrainerAccessGuard'
import VocabularyTabs from '@/components/vocabulary/VocabularyTabs'

export default async function TrainerLayout({ children, params }: {
  children: React.ReactNode
  params: Promise<{ lang: string; level: string }>
}) {
  const { lang, level } = await params
  return (
    <TrainerAccessGuard params={params} trainer="vocabulary">
      <VocabularyTabs lang={lang} level={decodeURIComponent(level)} />
      {children}
    </TrainerAccessGuard>
  )
}
