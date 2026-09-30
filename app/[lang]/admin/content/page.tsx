import ContentView from '@/components/admin/ContentView'

export const dynamic = 'force-dynamic'

export default async function AdminContentPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return <ContentView lang={lang} />
}
