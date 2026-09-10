import TrainerAccessGuard from '@/components/dashboard/TrainerAccessGuard'

export default function TrainerLayout(props: {
  children: React.ReactNode
  params: Promise<{ lang: string; level: string }>
}) {
  return <TrainerAccessGuard {...props} trainer="pronunciation" />
}
