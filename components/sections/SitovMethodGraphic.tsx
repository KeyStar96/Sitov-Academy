import styles from './SitovMethodGraphic.module.css'

/** A connection, contextual steps and a repetition loop: the three teaching principles. */
export default function SitovMethodGraphic({ variant }: { variant: number }) {
  const route = variant === 0
    ? 'M12 35C35 35 29 13 54 13S78 41 102 30S119 17 132 17'
    : variant === 1
      ? 'M12 37H39Q46 37 46 30V25Q46 18 53 18H83Q90 18 90 25V30Q90 37 97 37H132'
      : 'M43 29C43 10 99 10 99 29S43 48 43 29'
  return <svg className={styles.graphic} viewBox="0 0 144 58" fill="none" aria-hidden="true" focusable="false">
    <path className={styles.track} d={route} />
    <path className={`${styles.signal} ${variant === 2 ? styles.loop : ''}`} d={route} pathLength="100" />
    {variant === 0 && <g className={styles.nodes}><circle cx="12" cy="35" r="3" /><circle cx="54" cy="13" r="4" /><circle cx="102" cy="30" r="3" /><circle cx="132" cy="17" r="3" /></g>}
    {variant === 1 && <g className={styles.context}><path d="M18 15H32M18 21H27M58 36H77M58 42H70M107 12H126M107 18H118" /></g>}
    {variant === 2 && <g className={styles.nodes}><circle cx="43" cy="29" r="3" /><circle cx="99" cy="29" r="3" /><circle cx="71" cy="29" r="4" /></g>}
  </svg>
}
