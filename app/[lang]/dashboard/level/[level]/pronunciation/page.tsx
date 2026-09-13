import TrainerLanguageRequired from '@/components/dashboard/TrainerLanguageRequired'
import { getPronunciationConversations } from '@/app/actions/pronunciation-conversations'
import { getDictionary } from '@/lib/dictionary'
import { getPronunciationTranslations } from '@/lib/pronunciation-i18n'
import { getPronunciationPrompts } from '@/app/actions/pronunciation'
import PronunciationPractice from '@/components/audio/PronunciationPractice'
import PronunciationInbox from '@/components/audio/PronunciationInbox'
export default async function PronunciationDashboard({ params }: { params: Promise<{ lang: string; level: string }> }) {
 const { lang, level } = await params
  if (lang === 'de') return <TrainerLanguageRequired lang={lang} />
 const decodedLevel = decodeURIComponent(level)
 const dict = await getDictionary(lang)
 const translations = getPronunciationTranslations(lang, dict.pronunciation)
 const [conversations, prompts] = await Promise.all([getPronunciationConversations(decodedLevel), getPronunciationPrompts(decodedLevel)])
 return <div className="mx-auto w-full max-w-6xl space-y-8 text-[var(--foreground)]">
  <PronunciationPractice prompts={prompts} level={decodedLevel} translations={translations}/>
  <div className="border-t border-[var(--border)] pt-10"><PronunciationInbox conversations={conversations} lang={lang} translations={translations}/></div>
 </div>
}
