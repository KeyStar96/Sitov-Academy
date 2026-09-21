import ContentView from '@/components/admin/ContentView'
import { ACCESS_LEVELS } from '@/lib/access/levels'

export const dynamic = 'force-dynamic'

export default async function AdminContentPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return <ContentView lang={lang} levels={[...ACCESS_LEVELS]} />
}
