import { getPronunciationConversations } from '@/app/actions/pronunciation-conversations'
import { getDictionary } from '@/lib/dictionary'
import { getPronunciationTranslations } from '@/lib/pronunciation-i18n'
import PronunciationInbox from '@/components/audio/PronunciationInbox'
export default async function AdminSubmissionsPage({ params }: { params: Promise<{ lang: string }> }) {
 const { lang } = await params
 const [conversations, dictionary] = await Promise.all([getPronunciationConversations(), getDictionary(lang)])
 return <PronunciationInbox conversations={conversations} lang={lang} translations={getPronunciationTranslations(lang, dictionary.pronunciation)} staff/>
}
