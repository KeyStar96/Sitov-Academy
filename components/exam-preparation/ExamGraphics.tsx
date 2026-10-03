import styles from './ExamTrainer.module.css'
/** Own vector graphic: learning evidence moves from practice to an independent answer. */
export default function ExamGraphics() {
  return <svg className={styles.art} viewBox="0 0 160 150" fill="none" aria-hidden="true">
    <rect x="22" y="14" width="111" height="125" rx="24" fill="var(--surface-muted)" stroke="var(--border)" />
    <rect x="43" y="31" width="60" height="8" rx="4" fill="var(--accent)" opacity=".25" />
    <path d="M48 107L73 83L100 91L123 58" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" data-trace="" />
    {[{x:48,y:107},{x:73,y:83},{x:100,y:91},{x:123,y:58}].map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="6" fill="var(--surface)" stroke="var(--accent)" strokeWidth="3" data-point="" style={{animationDelay:`${i * .1}s`}} />)}
    <circle cx="126" cy="34" r="23" fill="var(--accent)" />
    <path d="M116 34l7 7 13-15" stroke="var(--accent-foreground)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
}
