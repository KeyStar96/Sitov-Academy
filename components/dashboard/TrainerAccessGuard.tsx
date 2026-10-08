import { notFound } from 'next/navigation'
import { currentUserHasTrainerAccess } from '@/lib/access/server'
import { sitovLevelHasTrainer, type Trainer } from '@/lib/access/levels'
import { getDictionary } from '@/lib/dictionary'
import LevelLocked from './LevelLocked'

export default async function TrainerAccessGuard({ children, params, trainer }: {
  children: React.ReactNode
  params: Promise<{ lang: string; level: string }>
  trainer: Trainer
}) {
  const { lang, level } = await params
  const decodedLevel = decodeURIComponent(level)
  // A trainer that does not exist on this level (verbs on C1.1/C1.2) is no locked page.
  if (!sitovLevelHasTrainer(decodedLevel, trainer)) notFound()
  const [allowed, dict] = await Promise.all([currentUserHasTrainerAccess(decodedLevel, trainer), getDictionary(lang)])
  return allowed ? <>{children}</> : <LevelLocked lang={lang} level={decodedLevel} translations={dict.dashboard} trainer />
}
