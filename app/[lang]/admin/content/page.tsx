import ContentView from '@/components/admin/ContentView'
import Link from 'next/link'
import { adminButton } from '@/components/admin/ui'

export const dynamic = 'force-dynamic'

export default async function AdminContentPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return <div className="min-w-0 space-y-5"><ContentView lang={lang} /><Link href={`/${lang}/admin/exam-preparation?view=audio`} className={adminButton('secondary')}>B1-Prüfungsvorbereitung: Aufnahmeaufträge</Link></div>
}
