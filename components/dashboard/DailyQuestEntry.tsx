import Link from 'next/link'
import { useId, type CSSProperties } from 'react'
import { ArrowRight, BookOpen, Check, Headphones, Map, MessageCircle, Trophy } from 'lucide-react'
import { getDailyQuestCopy } from '@/lib/daily-quest-i18n'
import type { DailyQuestStatus } from '@/lib/daily-quest-contract'
import DailyQuestEntryStage from './DailyQuestEntryStage'
import styles from './DailyQuestEntry.module.css'

type Pose = readonly (readonly [number, number])[]

/** Erst der Startpunkt, dann je drei Punkte pro Kurve. Alle Posen einer Schicht sind gleich lang — nur so blendet der Browser zwischen ihnen über. */
const flamePath = (pose: Pose) => `${pose.map(([x, y], index) => `${index === 0 ? 'M' : index % 3 === 1 ? 'C' : ''}${x} ${y}`).join(' ')}Z`

const FLAME_LAYERS: { name: 'outer' | 'mid' | 'core'; dur: string; begin: string; poses: Pose[] }[] = [
  { name: 'outer', dur: '3.4s', begin: '0s', poses: [
    [[60, 148], [33, 148], [12, 129], [12, 103], [12, 86], [21, 75], [28, 62], [33, 53], [34, 43], [30, 35], [41, 40], [47, 52], [49, 66], [50, 48], [55, 26], [70, 10], [70, 31], [84, 46], [95, 62], [103, 76], [108, 89], [108, 105], [108, 129], [87, 148], [60, 148]],
    [[60, 148], [33, 148], [13, 130], [13, 104], [13, 87], [23, 76], [31, 63], [37, 54], [40, 43], [38, 31], [46, 39], [50, 51], [52, 64], [54, 45], [62, 22], [79, 4], [76, 27], [87, 45], [97, 63], [104, 77], [109, 90], [109, 106], [109, 130], [87, 148], [60, 148]],
    [[60, 148], [34, 148], [14, 130], [14, 105], [14, 88], [22, 77], [29, 64], [33, 54], [33, 42], [28, 28], [40, 38], [47, 50], [50, 63], [51, 42], [55, 18], [67, 0], [68, 24], [82, 43], [93, 62], [101, 76], [106, 89], [106, 105], [106, 129], [86, 148], [60, 148]],
    [[60, 148], [33, 148], [11, 128], [11, 102], [11, 85], [19, 74], [25, 61], [29, 52], [28, 44], [23, 40], [35, 42], [43, 53], [46, 67], [46, 50], [49, 32], [62, 18], [63, 36], [80, 47], [92, 61], [101, 75], [107, 88], [107, 104], [107, 128], [87, 148], [60, 148]],
  ] },
  { name: 'mid', dur: '2.7s', begin: '-0.9s', poses: [
    [[60, 143], [40, 143], [26, 129], [26, 110], [26, 96], [38, 90], [45, 78], [49, 70], [56, 58], [64, 42], [65, 56], [74, 65], [82, 78], [90, 90], [94, 100], [94, 112], [94, 130], [80, 143], [60, 143]],
    [[60, 143], [40, 143], [27, 130], [27, 111], [27, 97], [40, 91], [48, 79], [53, 70], [61, 55], [71, 37], [70, 54], [77, 65], [84, 79], [91, 91], [95, 101], [95, 113], [95, 131], [80, 143], [60, 143]],
    [[60, 143], [41, 143], [28, 130], [28, 111], [28, 97], [39, 91], [46, 78], [50, 68], [56, 53], [65, 35], [66, 52], [74, 64], [81, 78], [89, 90], [93, 100], [93, 112], [93, 130], [79, 143], [60, 143]],
    [[60, 143], [40, 143], [25, 128], [25, 109], [25, 95], [36, 89], [43, 78], [46, 70], [51, 61], [58, 48], [60, 60], [71, 66], [80, 78], [89, 90], [93, 100], [93, 111], [93, 129], [80, 143], [60, 143]],
  ] },
  { name: 'core', dur: '2.2s', begin: '-1.5s', poses: [
    [[60, 139], [45, 139], [34, 128], [34, 113], [34, 98], [50, 90], [60, 68], [68, 88], [86, 98], [86, 113], [86, 128], [75, 139], [60, 139]],
    [[60, 139], [45, 139], [35, 128], [35, 114], [35, 99], [53, 89], [64, 64], [70, 87], [87, 99], [87, 114], [87, 128], [75, 139], [60, 139]],
    [[60, 139], [45, 139], [33, 128], [33, 112], [33, 98], [47, 91], [56, 72], [65, 89], [85, 98], [85, 112], [85, 128], [75, 139], [60, 139]],
  ] },
]

/** Feste Werte statt Zufall: Server und Browser zeichnen dieselben Funken. Start x/y in %, Drift und Aufstieg in rem, Größe in rem, Dauer und Versatz in s. */
const EMBERS = [
  [34, 46, -1.1, -6.2, .28, 3.4, -.2], [62, 30, .9, -7.4, .22, 4.1, -1.7], [48, 22, -.4, -5.6, .18, 2.9, -2.4],
  [72, 50, 1.6, -6.8, .3, 3.8, -.9], [26, 58, -1.8, -5.2, .2, 4.4, -3.1], [56, 38, .3, -8.2, .16, 3.1, -1.2],
  [80, 60, 2.2, -5.9, .24, 4.7, -2.8], [42, 34, -.9, -7.1, .2, 3.6, -.6], [66, 44, 1.2, -6.1, .14, 2.7, -1.9],
  [20, 66, -2.4, -4.8, .26, 5.1, -3.8], [52, 26, .6, -8.8, .2, 3.9, -2.2], [76, 40, 1.9, -7.6, .18, 3.3, -.4],
  [30, 40, -1.5, -8, .22, 4.3, -1.4], [60, 54, .1, -6.6, .26, 3, -2.9],
] as const
const EMBER_COUNT = [3, 5, 8, 11, 14] as const

/** Die Flamme wächst mit der Serie: 0 Zündfunke, ab 1, 3, 7 und 30 Tagen je eine Stufe. */
const flameTier = (streak: number) => streak >= 30 ? 4 : streak >= 7 ? 3 : streak >= 3 ? 2 : streak >= 1 ? 1 : 0

function FlameLayers({ gradient, live, pilot }: { gradient: string; live: boolean; pilot: boolean }) {
  const shape = ({ poses, dur, begin }: (typeof FLAME_LAYERS)[number]) => {
    const paths = poses.map(flamePath)
    return { d: paths[0], motion: live && <animate attributeName="d" dur={dur} begin={begin} repeatCount="indefinite" calcMode="spline"
      keyTimes={[...paths.map((_, index) => index / paths.length), 1].join(';')} keySplines={paths.map(() => '.45 0 .55 1').join(';')} values={[...paths, paths[0]].join(';')} /> }
  }
  const ghost = shape(FLAME_LAYERS[0])
  return <>
    {pilot && <path className={styles.sitovGhost} d={ghost.d}>{ghost.motion}</path>}
    {/* Ohne Serie brennt nur ein Zündfunke am Fuß der leeren Form. */}
    <g transform={pilot ? 'translate(60 150) scale(.42) translate(-60 -150)' : undefined}>
      {FLAME_LAYERS.map(layer => { const { d, motion } = shape(layer); return <path key={layer.name} d={d} fill={`url(#${gradient}-${layer.name})`}>{motion}</path> })}
    </g>
  </>
}

export default function DailyQuestEntry({ lang, status }: { lang: string; status: DailyQuestStatus }) {
  const copy = getDailyQuestCopy(lang)
  const gradient = useId()
  const sitovTitleId = `sitov-daily-quest-${gradient.replace(/:/g, '')}`
  const completed = status.today?.status === 'completed'
  const href = status.enabled ? `/${lang}/dashboard/daily-quest` : `/${lang}/dashboard/profile#daily-quest`
  const label = !status.enabled ? copy.openSettings
    : completed ? copy.entryDone : copy.entryStart
  const { current, longest } = status.streak
  const tier = flameTier(current)
  const digits = String(current).split('').map(Number)
  return (
    <DailyQuestEntryStage aria-labelledby={sitovTitleId} className={styles.sitovEntry} data-completed={completed} data-enabled={status.enabled} data-tier={tier} data-testid="daily-quest-entry">
      <div className={styles.sitovScene} aria-hidden="true"><span className={styles.sitovSpot} /><span className={styles.sitovRim} /></div>
      <div className={styles.sitovHeader}>
        <p className={styles.sitovEyebrow}><Map size={18} aria-hidden="true" />{copy.settingsTitle}</p>
        {longest > current && <p className={styles.sitovBest}><Trophy size={16} aria-hidden="true" /><span>{copy.longestStreak}: {longest}</span></p>}
      </div>
      <div className={styles.sitovText}>
        <h2 id={sitovTitleId} className={styles.sitovTitle}>{status.enabled ? copy.title : copy.disabledTitle}</h2>
        <p className={styles.sitovHint}>{status.enabled ? copy.entryHint : copy.disabledHint}</p>
        <div className={styles.sitovRoute} aria-hidden="true">
          <span className={styles.sitovSpark} />
          <span className={styles.sitovStation} style={{ '--sitov-step': 0 } as CSSProperties}><BookOpen size={17} /></span>
          <span className={styles.sitovLink} />
          <span className={styles.sitovStation} style={{ '--sitov-step': 1 } as CSSProperties}><Headphones size={17} /></span>
          <span className={styles.sitovLink} />
          <span className={styles.sitovStation} data-goal="true" style={{ '--sitov-step': 2 } as CSSProperties}>{completed ? <Check size={18} strokeWidth={3} /> : <MessageCircle size={17} />}</span>
          <span className={styles.sitovTrail} />
        </div>
      </div>
      <div className={styles.sitovFlame} data-digits={Math.min(digits.length, 4)}>
        <div className={styles.sitovFlameArt} aria-hidden="true">
          <span className={styles.sitovHalo} />
          <span className={styles.sitovPulse} />
          <div className={styles.sitovFlameIgnite}>
            <div className={styles.sitovFlameFlare}>
              <div className={styles.sitovFlameSway}>
                <svg data-flame="" className={styles.sitovFlameSvg} viewBox="0 0 120 152" fill="none" focusable="false">
                  <defs>
                    {(['outer', 'mid', 'core'] as const).map((name, index) => <linearGradient key={name} id={`${gradient}-${name}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" style={{ stopColor: `var(--sitov-f${index + 1}a)` }} /><stop offset="1" style={{ stopColor: `var(--sitov-f${index + 1}b)` }} />
                    </linearGradient>)}
                  </defs>
                  <g className={styles.sitovFlameLive}><FlameLayers gradient={gradient} live pilot={tier === 0} /></g>
                  <g className={styles.sitovFlameStill}><FlameLayers gradient={gradient} live={false} pilot={tier === 0} /></g>
                </svg>
              </div>
              {current > 0 && <span className={styles.sitovCount}>
                {digits.map((digit, index) => <span key={index} className={styles.sitovDigit}>
                  <span className={styles.sitovDigitStrip} style={{ '--sitov-d': digit, '--sitov-i': index } as CSSProperties}>
                    {Array.from({ length: digit + 1 }, (_, value) => <span key={value}>{value}</span>)}
                  </span>
                </span>)}
              </span>}
            </div>
          </div>
          <span className={styles.sitovBurst} />
          <span className={styles.sitovEmbers}>
            {EMBERS.slice(0, EMBER_COUNT[tier]).map(([x, y, dx, dy, size, time, delay], index) => <span key={index} className={styles.sitovEmber}
              style={{ '--x': `${x}%`, '--y': `${y}%`, '--dx': `${dx}rem`, '--dy': `${dy}rem`, '--s': `${size}rem`, '--t': `${time}s`, '--d': `${delay}s` } as CSSProperties} />)}
          </span>
          {completed && status.enabled && <span className={styles.sitovStamp}><Check size={16} strokeWidth={3} /></span>}
        </div>
        {current > 0 && <p className={styles.sitovStreak}><span aria-hidden="true">{copy.streakDays}</span><span className="sr-only">{current} {copy.streakDays}</span></p>}
      </div>
      <Link href={href} className={`${styles.sitovAction} st-press`}>
        {completed && status.enabled && <Check size={19} aria-hidden="true" />}
        <span>{label}</span><span className={styles.sitovActionArrow} aria-hidden="true"><ArrowRight size={18} /></span>
      </Link>
    </DailyQuestEntryStage>
  )
}
