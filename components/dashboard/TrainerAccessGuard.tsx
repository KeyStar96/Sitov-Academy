import TrainerLanguageRequired from '@/components/dashboard/TrainerLanguageRequired'
import { currentUserHasTrainerAccess } from '@/lib/access/server'
import type { Trainer } from '@/lib/access/levels'
import { getDictionary } from '@/lib/dictionary'
import LevelLocked from './LevelLocked'

export default async function TrainerAccessGuard({ children, params, trainer }: {
  children: React.ReactNode
  params: Promise<{ lang: string; level: string }>
  trainer: Trainer
}) {
  const { lang, level } = await params
  if (lang === 'de') return <TrainerLanguageRequired lang={lang} />
  const decodedLevel = decodeURIComponent(level)
  const [allowed, dict] = await Promise.all([currentUserHasTrainerAccess(decodedLevel, trainer), getDictionary(lang)])
  return allowed ? children : <LevelLocked lang={lang} level={decodedLevel} translations={dict.dashboard} trainer />
}
