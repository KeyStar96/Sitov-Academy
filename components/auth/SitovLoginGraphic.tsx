'use client'

import { useId } from 'react'
import { AudioLines, BookOpen, MessageCircle } from 'lucide-react'
import styles from './SitovLoginGraphic.module.css'

const sitovLattice = [
  [-31, -16], [-14, -31], [10, -34], [31, -18], [37, 8], [19, 29], [-8, 34], [-30, 19],
  [-9, -9], [15, -10], [17, 13], [-12, 12], [2, 1],
] as const
const sitovLinks = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0],
  [0, 8], [1, 8], [2, 9], [3, 9], [4, 10], [5, 10], [6, 11], [7, 11],
  [8, 9], [9, 10], [10, 11], [11, 8], [8, 12], [9, 12], [10, 12], [11, 12],
] as const

function SitovSignal({ id, className }: { id: string; className?: string }) {
  return <g className={`${styles.signal} ${className || ''}`}>
    <use href={`#${id}`} className={styles.trailAura} />
    <use href={`#${id}`} className={styles.trailBody} />
    <use href={`#${id}`} className={styles.trailCore} />
    <use href={`#${id}`} className={styles.trailHead} />
  </g>
}

function SitovScene({ id, compact = false }: { id: string; compact?: boolean }) {
  const centerY = compact ? 100 : 160
  const stream = compact
    ? 'M78 106 C153 30 236 41 294 99 S418 170 522 94'
    : 'M111 188 C167 81 250 95 294 157 S411 222 489 132'
  const returnStream = compact
    ? 'M519 99 C444 174 378 159 306 100 S177 35 81 108'
    : 'M489 133 C424 29 355 65 304 154 S169 254 111 188'
  const highStream = compact
    ? 'M201 44 C230 11 366 12 398 45'
    : 'M184 90 C245 28 346 28 447 71'

  return <svg className={compact ? styles.compactScene : styles.scene} viewBox={`0 0 600 ${compact ? 200 : 320}`} fill="none" focusable="false">
    <defs>
      <linearGradient id={`${id}-stream`} x1="94" y1="185" x2="495" y2="100" gradientUnits="userSpaceOnUse">
        <stop stopColor="var(--accent)" />
        <stop offset=".38" stopColor="var(--accent)" />
        <stop offset=".62" stopColor="var(--violet)" />
        <stop offset="1" stopColor="var(--violet)" />
      </linearGradient>
      <linearGradient id={`${id}-pearl`} x1="263" y1={centerY - 45} x2="333" y2={centerY + 46} gradientUnits="userSpaceOnUse">
        <stop stopColor="var(--accent)" stopOpacity=".52" />
        <stop offset=".44" stopColor="var(--surface)" stopOpacity=".95" />
        <stop offset="1" stopColor="var(--violet)" stopOpacity=".38" />
      </linearGradient>
      <radialGradient id={`${id}-halo`}>
        <stop stopColor="var(--violet)" stopOpacity=".16" />
        <stop offset=".58" stopColor="var(--violet)" stopOpacity=".06" />
        <stop offset="1" stopColor="var(--violet)" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${id}-orb`} cx=".32" cy=".27" r=".8">
        <stop stopColor="var(--surface)" stopOpacity=".98" />
        <stop offset=".46" stopColor="var(--surface)" stopOpacity=".8" />
        <stop offset="1" stopColor="var(--violet)" stopOpacity=".18" />
      </radialGradient>
      <radialGradient id={`${id}-core`}>
        <stop stopColor="var(--surface)" />
        <stop offset=".17" stopColor="var(--accent)" stopOpacity=".9" />
        <stop offset=".4" stopColor="var(--accent)" stopOpacity=".32" />
        <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
      </radialGradient>
      <path id={`${id}-path`} d={stream} pathLength="100" />
      <path id={`${id}-return`} d={returnStream} pathLength="100" />
      <path id={`${id}-high`} d={highStream} pathLength="100" />
    </defs>

    <ellipse cx="300" cy={centerY + 12} rx={compact ? 235 : 240} ry={compact ? 75 : 130} fill={`url(#${id}-halo)`} />
    <g className={styles.constellation}>
      <path d={compact ? 'M99 55L149 30L217 50M386 148L445 166L502 149' : 'M66 126L100 83L172 72L201 103M404 232L450 262L523 218L548 151'} />
      {(compact ? [[99, 55], [149, 30], [217, 50], [386, 148], [445, 166], [502, 149]] : [[66, 126], [100, 83], [172, 72], [201, 103], [404, 232], [450, 262], [523, 218], [548, 151]]).map(([x, y], index) => <circle key={index} cx={x} cy={y} r={index % 3 === 0 ? 2.4 : 1.7} />)}
    </g>
    <g stroke={`url(#${id}-stream)`} className={styles.streamTrack}>
      <use href={`#${id}-path`} />
      <use href={`#${id}-return`} />
      <use href={`#${id}-high`} className={styles.highTrack} />
    </g>
    <g stroke={`url(#${id}-stream)`}>
      <SitovSignal id={`${id}-path`} />
      <SitovSignal id={`${id}-return`} className={styles.returnSignal} />
      <SitovSignal id={`${id}-high`} className={styles.highSignal} />
    </g>

    <g transform={`translate(300 ${centerY})`}>
      <g className={styles.orbitPlane}>
        <ellipse rx="101" ry="36" transform="rotate(-25)" className={styles.orbitTrack} />
        <ellipse rx="82" ry="34" transform="rotate(36)" className={styles.orbitTrackSecondary} />
        <ellipse rx="101" ry="36" transform="rotate(-25)" pathLength="100" className={styles.orbitLight} />
        <circle cx="88" cy="-39" r="2.5" className={styles.orbitNode} />
        <circle cx="-75" cy="-34" r="1.7" className={styles.orbitNodeSecondary} />
      </g>
      <g className={styles.orb}>
        <circle r="56" fill={`url(#${id}-orb)`} className={styles.orbBody} />
        <circle r="55.5" stroke={`url(#${id}-pearl)`} strokeWidth="1.2" />
        <g className={styles.sphereMesh}>
          <ellipse rx="55" ry="18" />
          <ellipse rx="25" ry="55" transform="rotate(22)" />
          <ellipse rx="25" ry="55" transform="rotate(-37)" />
          <path d="M-47-28Q0-6 47-28M-47 28Q0 7 47 28" />
        </g>
        <g className={styles.lattice}>
          {sitovLinks.map(([from, to], index) => <path key={index} d={`M${sitovLattice[from][0]} ${sitovLattice[from][1]}L${sitovLattice[to][0]} ${sitovLattice[to][1]}`} />)}
          {sitovLattice.map(([x, y], index) => <circle key={index} cx={x} cy={y} r={index === 12 ? 3.6 : index % 3 === 0 ? 2.4 : 1.7} />)}
        </g>
        <circle r="24" fill={`url(#${id}-core)`} className={styles.coreAura} />
        <circle r="4" className={styles.core} />
        <circle r="1.5" fill="var(--surface)" />
        <path d="M-39-21A44 44 0 0 1-9-43" className={styles.specular} />
      </g>
    </g>
  </svg>
}

/** Decorative SVG/CSS artwork; the containing stage owns viewport/tab visibility. */
export default function SitovLoginGraphic({ className }: { className?: string }) {
  const id = `sitov-login-${useId().replace(/:/g, '')}`

  return <div className={`${styles.graphic} ${className || ''}`} aria-hidden="true" data-sitov-login-graphic>
    <SitovScene id={`${id}-wide`} />
    <SitovScene id={`${id}-compact`} compact />
    <div className={`${styles.plaquePosition} ${styles.bookPosition}`}>
      <div className={`${styles.plaque} ${styles.bookPlaque}`}><BookOpen strokeWidth={1.55} /></div>
    </div>
    <div className={`${styles.plaquePosition} ${styles.messagePosition}`}>
      <div className={`${styles.plaque} ${styles.messagePlaque}`}><MessageCircle strokeWidth={1.55} /><i /></div>
    </div>
    <div className={`${styles.plaquePosition} ${styles.audioPosition}`}>
      <div className={`${styles.plaque} ${styles.audioPlaque}`}><AudioLines strokeWidth={1.55} /></div>
    </div>
  </div>
}
