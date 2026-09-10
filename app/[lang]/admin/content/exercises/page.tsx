import { getGrammarExercises } from '@/app/actions/grammar-cms'
import ExerciseCMS from '@/components/admin/ExerciseCMS'

export default async function AdminExercisesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const result = await getGrammarExercises()
  return <ExerciseCMS initialData={result.data} lang={lang} loadFailed={result.failed} />
}
