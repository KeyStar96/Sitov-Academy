import TrainerAccessGuard from '@/components/dashboard/TrainerAccessGuard'

export default function SitovVerbLayout({ children, params }: {
  children: React.ReactNode; params: Promise<{ lang: string; level: string }>
}) {
  return <TrainerAccessGuard params={params} trainer="verbs">{children}</TrainerAccessGuard>
}
