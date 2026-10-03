import { Mail, MessageCircle, Phone, Send } from 'lucide-react'
import styles from './SitovLevelSupport.module.css'

/** The channel constellation is decorative; contact actions stay in the list. */
export default function SitovSupportArt() {
  return (
    <div className={styles.sitovSupportArt} aria-hidden="true">
      <span className={styles.sitovSupportGlow} />
      <span className={styles.sitovSignalOrbit} />
      <span className={styles.sitovSignalOrbit} data-orbit="outer" />
      <span className={styles.sitovSignalPacket} />
      <span className={styles.sitovChatEcho} />
      <span className={styles.sitovChatEcho} data-echo="back" />
      <span className={styles.sitovChatCore}>
        <i /><i /><i />
      </span>
      <span className={styles.sitovSatellite} data-channel="whatsapp"><MessageCircle size={18} /></span>
      <span className={styles.sitovSatellite} data-channel="phone"><Phone size={16} /></span>
      <span className={styles.sitovSatellite} data-channel="telegram"><Send size={18} /></span>
      <span className={styles.sitovSatellite} data-channel="email"><Mail size={18} /></span>
    </div>
  )
}
