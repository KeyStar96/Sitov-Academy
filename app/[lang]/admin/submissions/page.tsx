import { z } from 'zod'
import { getPronunciationConversations } from '@/app/actions/pronunciation-conversations'
import { getDictionary } from '@/lib/dictionary'
import { getPronunciationTranslations } from '@/lib/pronunciation-i18n'
import PronunciationInbox from '@/components/audio/PronunciationInbox'
import Link from 'next/link'
import { adminButton } from '@/components/admin/ui'
export default async function AdminSubmissionsPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ conversation?: string }> }) {
 const { lang } = await params
 const query = await searchParams
 const conversationId = z.string().uuid().safeParse(query.conversation).data
 const [conversations, dictionary] = await Promise.all([getPronunciationConversations(undefined, conversationId), getDictionary(lang)])
 return <div className="min-w-0 space-y-5"><div className="flex flex-wrap gap-3"><Link href={`/${lang}/admin/exam-simulation`} className={adminButton('primary')}>Simulierte Prüfungen bewerten</Link><Link href={`/${lang}/admin/exam-preparation`} className={adminButton('secondary')}>Prüfungsvorbereitung: Abgaben und Rückmeldungen</Link></div><PronunciationInbox conversations={conversations} lang={lang} translations={getPronunciationTranslations(lang, dictionary.pronunciation)} staff initialFilter={conversationId ? 'all' : 'pending'}/></div>
}
