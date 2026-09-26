import { BookOpen } from 'lucide-react'
import type { RuleCardData } from '@/lib/learning-path-contract'
import { pathTranslator } from '@/lib/learning-path-i18n'
import styles from './learning-path.module.css'

export default function RuleCard({ card, lang }: { card: RuleCardData; lang: string }) {
  return <aside className={styles.rule} aria-labelledby="path-rule-title" data-testid="path-rule-card">
    <h3 id="path-rule-title"><BookOpen size={24} aria-hidden="true" /> {pathTranslator(lang)('rule')}</h3>
    <p>{card.rule}</p>
    <ul lang="de" translate="no">{card.examples.map((example, index) => <li key={index}>{example}</li>)}</ul>
  </aside>
}
