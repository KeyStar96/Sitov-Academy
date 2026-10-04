import { BookOpen, Headphones, Mic, PenLine } from 'lucide-react'
import type { SitovExamEntryCopy } from '@/lib/exam-entry-i18n'
import styles from './ExamEntry.module.css'

/** Decorative exam journey, never a student's score or access status. */
export default function SitovExamEntryGraphics({ copy }: { copy: Pick<SitovExamEntryCopy, 'reading' | 'listening' | 'writing' | 'speaking'> }) {
  return <div className={styles.sitovScene} aria-hidden="true" data-sitov-exam-graphic="">
    <div className={styles.sitovParallax}>
      <span className={styles.sitovHalo} />
      <span className={styles.sitovOrbit}><span /></span>
      <span className={`${styles.sitovOrbit} ${styles.sitovOrbitInner}`}><span /></span>
      <span className={styles.sitovCrosshair} />
      <div className={styles.sitovPaperFloat}>
        <svg className={styles.sitovPaper} viewBox="0 0 230 250" fill="none" focusable="false">
          <rect x="26" y="22" width="172" height="214" rx="27" fill="var(--surface)" stroke="var(--border)" />
          <rect x="80" y="10" width="66" height="26" rx="10" fill="var(--surface-muted)" stroke="var(--border)" />
          <circle cx="113" cy="22" r="4" fill="var(--accent)" />
          <rect x="48" y="57" width="77" height="8" rx="4" fill="var(--accent)" opacity=".35" />
          <rect x="48" y="76" width="121" height="5" rx="2.5" fill="var(--muted)" opacity=".15" />
          <rect x="48" y="88" width="95" height="5" rx="2.5" fill="var(--muted)" opacity=".15" />
          <path d="M48 122H175M48 150H175M48 178H175M48 206H175" stroke="var(--border)" opacity=".5" />
          <path d="M52 198 84 169 116 179 151 139 177 118" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" pathLength="1" className={styles.sitovTrace} />
          {[[52,198],[84,169],[116,179],[151,139],[177,118]].map(([x,y], index) => <circle key={index} cx={x} cy={y} r="5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="3" className={styles.sitovPoint} style={{ animationDelay: `${index * .22}s` }} />)}
        </svg>
        <span className={styles.sitovSeal}>
          <span className={styles.sitovSealRipple} />
          <svg viewBox="0 0 48 48" fill="none" focusable="false"><path d="m13 24 8 8 16-18" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" pathLength="1" className={styles.sitovCheck} /></svg>
        </span>
      </div>
      <span className={`${styles.sitovSkill} ${styles.sitovReading}`}><BookOpen size={20} /><span>{copy.reading}</span><i /></span>
      <span className={`${styles.sitovSkill} ${styles.sitovListening}`}><Headphones size={20} /><span>{copy.listening}</span><span className={styles.sitovWave}>{[0,1,2,3,4].map(i => <i key={i} style={{ animationDelay: `${i * -.16}s` }} />)}</span></span>
      <span className={`${styles.sitovSkill} ${styles.sitovWriting}`}><PenLine size={20} /><span>{copy.writing}</span><i /></span>
      <span className={`${styles.sitovSkill} ${styles.sitovSpeaking}`}><Mic size={20} /><span>{copy.speaking}</span><i /></span>
      <span className={`${styles.sitovSpark} ${styles.sitovSparkOne}`} />
      <span className={`${styles.sitovSpark} ${styles.sitovSparkTwo}`} />
      <span className={`${styles.sitovSpark} ${styles.sitovSparkThree}`} />
    </div>
  </div>
}
