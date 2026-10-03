import { BookOpen } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { RuleCardData } from '@/lib/learning-path-contract'
import { pathTranslator } from '@/lib/learning-path-i18n'
import styles from './learning-path.module.css'

export default function RuleCard({ card, lang }: { card: RuleCardData; lang: string }) {
  return <aside className={styles.rule} aria-labelledby="path-rule-title" data-testid="path-rule-card">
    <div className={styles.sitovRuleScene} aria-hidden="true">
      <span className={styles.sitovRuleHalo} />
      <span className={styles.sitovRulePage} data-page="back"><i /><i /><i /></span>
      <span className={styles.sitovRulePage} data-page="front"><BookOpen size={27} /><i /><i /></span>
      <span className={styles.sitovRuleSpark} />
    </div>
    <h3 id="path-rule-title"><BookOpen size={24} aria-hidden="true" /> {pathTranslator(lang)('rule')}</h3>
    <p>{card.rule}</p>
    <ul lang="de" translate="no">{card.examples.map((example, index) => <li key={index} style={{ '--sitov-index': index } as CSSProperties}>{example}</li>)}</ul>
  </aside>
}
