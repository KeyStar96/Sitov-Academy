'use client'

import { useId, type CSSProperties } from 'react'
import type { PathNode } from '@/lib/learning-path-contract'
import styles from './learning-path.module.css'

const SITOV_POINTS = [[36, 166], [88, 115], [158, 139], [218, 77], [267, 34]]
const SITOV_SEGMENTS = [
  'M36 166 C34 132 64 126 88 115',
  'M88 115 C125 92 125 157 158 139',
  'M158 139 C192 121 189 80 218 77',
  'M218 77 C252 76 255 48 267 34',
]

/** An ambient miniature of the real route. Every checkpoint keeps its server state. */
export default function SitovPathScene({ nodes, currentId }: { nodes: PathNode[]; currentId: string | null }) {
  const sitovId = useId().replace(/:/g, '')
  const sitovRoute = nodes.filter(node => node.kind !== 'special' || node.id === currentId)
  const sitovCurrent = sitovRoute.findIndex(node => node.id === currentId)
  const sitovStart = Math.max(0, Math.min(sitovRoute.length - SITOV_POINTS.length, sitovCurrent - 2))
  const sitovShown = sitovRoute.slice(sitovStart, sitovStart + SITOV_POINTS.length)
  return <div className={styles.sitovScene} aria-hidden="true">
    <span className={styles.sitovSceneGlow} />
    <svg viewBox="0 0 310 218" fill="none" focusable="false">
      <defs>
        <linearGradient id={`${sitovId}-route`} x1="30" y1="170" x2="268" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--mode-path-text)" /><stop offset="1" stopColor="var(--sitov-path-bright)" />
        </linearGradient>
        <linearGradient id={`${sitovId}-ground`} x1="50" y1="140" x2="260" y2="200" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--mode-path-text)" stopOpacity=".08" /><stop offset="1" stopColor="var(--mode-path-text)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <ellipse cx="155" cy="184" rx="127" ry="24" fill={`url(#${sitovId}-ground)`} />
      <path className={styles.sitovContour} d="M19 184 C42 145 57 161 81 140 S129 160 163 152 S208 104 243 99 S282 68 294 49" />
      <path className={styles.sitovContour} d="M11 160 C29 112 61 97 94 85 S129 124 160 106 S195 42 231 54 S278 17 284 13" />
      {sitovShown.slice(1).map((node, index) => <g key={node.id}>
        <path className={styles.sitovSceneRoadBase} d={SITOV_SEGMENTS[index]} />
        <path className={styles.sitovSceneRoad} d={SITOV_SEGMENTS[index]} data-reached={node.status === 'completed' || (node.kind !== 'test' && node.available)}
          stroke={`url(#${sitovId}-route)`} />
      </g>)}
      {sitovShown.map((node, index) => {
        const [x, y] = SITOV_POINTS[index]
        const state = !node.available ? 'locked' : node.id === currentId ? 'current' : node.status === 'completed' ? 'completed' : 'open'
        return <g key={node.id} className={styles.sitovSceneCheckpoint} data-state={state} style={{ '--sitov-index': index } as CSSProperties}>
          <ellipse cx={x} cy={y + 11} rx="20" ry="6" className={styles.sitovSceneShadow} />
          <g className={styles.sitovSceneMarker} style={{ transformOrigin: `${x}px ${y}px` }}>
            {state === 'current' && <circle className={styles.sitovSceneBeacon} cx={x} cy={y} r="26" />}
            <circle className={styles.sitovSceneRing} cx={x} cy={y} r="18" />
            <circle className={styles.sitovSceneCore} cx={x} cy={y} r="11" />
            {state === 'completed' ? <path className={styles.sitovSceneCheck} d={`M${x - 5} ${y} l4 4 7 -8`} />
              : state === 'current' ? <path className={styles.sitovScenePlay} d={`M${x - 3} ${y - 5} l8 5 -8 5 Z`} /> : <circle cx={x} cy={y} r="3" className={styles.sitovScenePin} />}
          </g>
        </g>
      })}
      {[[43, 80], [183, 38], [274, 143]].map(([x, y], index) => <g key={x} className={styles.sitovSceneSpark} style={{ '--sitov-index': index, transformOrigin: `${x}px ${y}px` } as CSSProperties}>
        <path d={`M${x - 4} ${y}h8 M${x} ${y - 4}v8`} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </g>)}
    </svg>
  </div>
}
