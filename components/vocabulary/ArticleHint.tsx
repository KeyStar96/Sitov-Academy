import { Info } from 'lucide-react'
import { articleColorClass } from '@/lib/vocabulary-ui'
import { learningFeedback } from '@/lib/learning-feedback-i18n'

/** A general reminder before writing; never reveals this noun's article. */
export default function ArticleHint({ article, lang, id }: { article: string | null; lang: string; id?: string }) {
  if (!article || article === 'none') return null
  const t = learningFeedback(lang)
  return <p id={id} role="note" className="flex items-start gap-2 py-1 text-base leading-relaxed text-[var(--muted)]">
    <Info className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
    <span>{t.article} <span lang="de" className={articleColorClass('der')}>der</span>, <span lang="de" className={articleColorClass('die')}>die</span> {t.or} <span lang="de" className={articleColorClass('das')}>das</span></span>
  </p>
}

/** The server's returned solution, with only its article highlighted. */
export function ArticleSolution({ solution }: { solution: string }) {
  const parts = solution.match(/^(der|die|das)(\s+)([\s\S]*)$/i)
  if (!parts) return <>{solution}</>
  return <><span className={articleColorClass(parts[1].toLowerCase())}>{parts[1]}</span>{parts[2]}{parts[3]}</>
}
