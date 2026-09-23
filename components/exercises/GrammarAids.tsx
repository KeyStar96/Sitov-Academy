'use client'

import { ChevronDown, Table2 } from 'lucide-react'
import { studentTranslator } from '@/lib/student-ui-i18n'
import { articleColorClass } from '@/lib/vocabulary-ui'
import type { StudentExercise } from '@/lib/types/exercise'
import { cn } from '@/lib/utils'

export type GermanArticleWord = 'der' | 'die' | 'das'

/** Genau ein Artikelwort („Der", „die") — dann bekommt es seine feste Farbe. */
export function articleWord(word: string): GermanArticleWord | null {
  const normalized = word.trim().toLowerCase()
  return normalized === 'der' || normalized === 'die' || normalized === 'das' ? normalized : null
}

/** Geht es in dieser Aufgabe um Artikel? Dann steht die Farblegende darüber. */
export function exerciseUsesArticles(exercise: StudentExercise): boolean {
  if (/artikel|article/i.test(exercise.topic)) return true
  const words = exercise.type === 'multiple_choice' ? exercise.content.options : exercise.chips.flatMap(chip => chip.split(/\s+/))
  return words.some(word => articleWord(word) !== null)
}

/** Verb-Themen bekommen die kleine Endungs-Tabelle als Hilfe. */
export function exerciseUsesConjugation(exercise: StudentExercise): boolean {
  return /präsens|praesens|konjug|verb/i.test(exercise.topic)
}

/** Farbige Anzeige eines Artikelworts; alles andere bleibt unverändert. */
export function ArticleColored({ word }: { word: string }) {
  const article = articleWord(word)
  return article ? <span className={cn('font-bold', articleColorClass(article))}>{word}</span> : <>{word}</>
}

/** Die Legende: immer dieselben drei Farben, auf jeder Karte gleich. */
export function ArticleLegend({ lang }: { lang: string }) {
  const t = studentTranslator(lang)
  return (
    <div className="st-article-legend" role="note" aria-label={t('grammar_legend')}>
      {(['der', 'die', 'das'] as const).map(article => (
        <span key={article} className="st-article-chip" data-article={article}>
          <span aria-hidden="true" className="st-article-chip__dot" />
          <span className={cn('font-bold', articleColorClass(article))}>{article}</span>
          <span className="st-article-chip__label">{t(`article_${article}`).split('–')[1]?.trim()}</span>
        </span>
      ))}
    </div>
  )
}

const ENDINGS = [
  { pronoun: 'ich', ending: 'e', example: 'lerne' },
  { pronoun: 'du', ending: 'st', example: 'lernst' },
  { pronoun: 'er/sie/es', ending: 't', example: 'lernt' },
  { pronoun: 'wir', ending: 'en', example: 'lernen' },
  { pronoun: 'ihr', ending: 't', example: 'lernt' },
  { pronoun: 'sie/Sie', ending: 'en', example: 'lernen' },
] as const

/**
 * Welche Zeile gilt für den Satz? Nur eindeutige Pronomen: „sie" kann „sie
 * lernt" oder „sie lernen" sein — dann wird lieber nichts hervorgehoben.
 */
function rowForSentence(sentence: string): number | null {
  const match = sentence.match(/(?:^|[\s„"(])(ich|du|er|es|wir|ihr)(?=[\s,.!?]|$)/i)
  if (!match) return null
  const pronoun = match[1].toLowerCase()
  return { ich: 0, du: 1, er: 2, es: 2, wir: 3, ihr: 4 }[pronoun] ?? null
}

/** „Tabellenkarte": die regelmäßigen Präsens-Endungen, die passende Zeile leuchtet. */
export function EndingsCard({ lang, sentence }: { lang: string; sentence: string }) {
  const t = studentTranslator(lang)
  const active = rowForSentence(sentence)
  return (
    <details className="st-endings" open={active !== null}>
      <summary className="st-endings__summary">
        <Table2 size={20} aria-hidden="true" />
        <span className="min-w-0 flex-1">{t('endings_title')}</span>
        <ChevronDown size={20} aria-hidden="true" className="st-endings__chevron" />
      </summary>
      <p className="st-endings__hint">{t('endings_hint')}</p>
      <table className="st-endings__table">
        <tbody>
          {ENDINGS.map((row, index) => (
            <tr key={row.pronoun} data-active={index === active} style={{ '--i': index } as React.CSSProperties}>
              <th scope="row" lang="de">{row.pronoun}</th>
              <td lang="de">lern<strong>{row.ending}</strong></td>
              <td className="st-endings__ending" lang="de">-{row.ending}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}
