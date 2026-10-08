import { FileText, Play } from 'lucide-react'
import styles from './SitovMediaScene.module.css'

/** Familiar video and paper previews; this scene is decorative, never a player. */
export default function SitovMediaScene() {
  return <div className={styles.sitovScene} aria-hidden="true" data-sitov-media-scene="">
    <span className={styles.sitovShelf} />
    <div className={styles.sitovDocument}>
      <span className={styles.sitovDocumentHead}><FileText size={20} strokeWidth={1.7} /><span /></span>
      <span className={styles.sitovParagraph}><i /><i /><i /></span>
      <span className={styles.sitovParagraph}><i /><i /><i /></span>
    </div>
    <div className={styles.sitovVideo}>
      <span className={styles.sitovVideoTop}><i /><i /><i /></span>
      <span className={styles.sitovScreen}>
        <span className={styles.sitovScreenPaper}><i /><i /></span>
        <span className={styles.sitovPlay}><Play size={25} fill="currentColor" strokeWidth={1.5} /></span>
      </span>
      <span className={styles.sitovPlayback}><i /></span>
    </div>
    <span className={styles.sitovSmallPaper}><i /><i /><i /></span>
  </div>
}
