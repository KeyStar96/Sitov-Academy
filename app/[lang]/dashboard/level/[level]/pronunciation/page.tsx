import Link from 'next/link'
import { ArrowLeft, AudioLines } from 'lucide-react'
import { getPronunciationConversations } from '@/app/actions/pronunciation-conversations'
import { getDictionary } from '@/lib/dictionary'
import { createPronunciationTranslator, getPronunciationTranslations } from '@/lib/pronunciation-i18n'
import { getPronunciationPrompts } from '@/app/actions/pronunciation'
import PronunciationPractice from '@/components/audio/PronunciationPractice'
import PronunciationInbox from '@/components/audio/PronunciationInbox'
export default async function PronunciationDashboard({ params }: { params: Promise<{ lang: string; level: string }> }) {
 const { lang, level } = await params
 const decodedLevel = decodeURIComponent(level)
 const dict = await getDictionary(lang)
 const translations = getPronunciationTranslations(lang, dict.pronunciation)
 const t = createPronunciationTranslator(translations)
 const [conversations, prompts] = await Promise.all([getPronunciationConversations(decodedLevel), getPronunciationPrompts(decodedLevel)])
 return <div className="mx-auto w-full max-w-6xl space-y-8 py-6 text-[var(--foreground)] sm:py-10"><Link href={`/${lang}/dashboard/level/${encodeURIComponent(decodedLevel)}`} className="inline-flex min-h-12 items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--foreground)]"><ArrowLeft size={20}/>{t('back_to_level')}</Link><header className="max-w-3xl"><span className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--accent)]"><AudioLines size={16}/>{decodedLevel}</span><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t('title')}</h1><p className="mt-4 text-lg leading-relaxed text-[var(--muted)]">{t('subtitle')}</p></header><PronunciationPractice prompts={prompts} level={decodedLevel} translations={translations}/><div className="border-t border-[var(--border)] pt-10"><PronunciationInbox conversations={conversations} lang={lang} translations={translations}/></div></div>
}
