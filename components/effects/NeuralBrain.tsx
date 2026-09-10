'use client'

import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, Color, Group, ShaderMaterial } from 'three'

/** Deterministic twin hemispheres, procedural cortical folds and connecting axons. */
function createNeuralGeometry() {
  const positions: number[] = []
  const seeds: number[] = []
  const count = 1500
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let hemisphere = -1; hemisphere <= 1; hemisphere += 2) {
    for (let i = 0; i < count / 2; i++) {
      const y = 1 - (i / (count / 2 - 1)) * 2
      const radius = Math.sqrt(1 - y * y)
      const angle = golden * i
      const fold = 1 + .07 * Math.sin(angle * 7 + y * 17) * Math.cos(y * 13)
      const x = Math.abs(Math.cos(angle)) * radius * .78 + .035
      positions.push(hemisphere * x * fold, y * 1.03 * fold, Math.sin(angle) * radius * .85 * fold)
      seeds.push((i * .61803 + (hemisphere + 1) * .13) % 1)
    }
  }
  const lines: number[] = []
  const lineSeeds: number[] = []
  for (let a = 0; a < count; a++) {
    let connected = 0
    for (let b = a + 1; b < Math.min(count, a + 100); b++) {
      const dx = positions[a * 3] - positions[b * 3]
      const dy = positions[a * 3 + 1] - positions[b * 3 + 1]
      const dz = positions[a * 3 + 2] - positions[b * 3 + 2]
      if (dx * dx + dy * dy + dz * dz < .038 && connected < 3) {
        lines.push(...positions.slice(a * 3, a * 3 + 3), ...positions.slice(b * 3, b * 3 + 3))
        lineSeeds.push(seeds[a], seeds[a])
        connected++
      }
    }
  }
  const points = new BufferGeometry()
  points.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  points.setAttribute('aSeed', new BufferAttribute(new Float32Array(seeds), 1))
  const connections = new BufferGeometry()
  connections.setAttribute('position', new BufferAttribute(new Float32Array(lines), 3))
  connections.setAttribute('aSeed', new BufferAttribute(new Float32Array(lineSeeds), 1))
  return { points, connections }
}

const vertexShader = `
  uniform float uTime;
  attribute float aSeed;
  varying float vPulse;
  varying float vDepth;
  void main() {
    vPulse = pow(max(0.0, sin(uTime * 0.7 - aSeed * 18.0)), 8.0);
    vec3 p = position * (1.0 + 0.008 * sin(uTime + position.y * 3.0));
    vec4 view = modelViewMatrix * vec4(p, 1.0);
    vDepth = clamp((view.z + 5.0) / 3.0, 0.15, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = (2.0 + vPulse * 2.5) * (3.0 / -view.z);
  }
`
const fragmentShader = `
  uniform vec3 uViolet;
  uniform vec3 uOrange;
  uniform float uPoints;
  varying float vPulse;
  varying float vDepth;
  void main() {
    float alpha = (0.25 + vDepth * 0.55 + vPulse * 0.2);
    if (uPoints > 0.5) {
      float radius = length(gl_PointCoord - 0.5);
      if (radius > 0.5) discard;
      alpha *= 1.0 - smoothstep(0.15, 0.5, radius);
    } else { alpha *= 0.28; }
    gl_FragColor = vec4(mix(uViolet, uOrange, vPulse), alpha);
  }
`

function BrainScene({ dark }: { dark: boolean }) {
  const group = useRef<Group>(null)
  const geometry = useMemo(createNeuralGeometry, [])
  const materials = useMemo(() => {
    const create = (points: boolean) => new ShaderMaterial({
      vertexShader, fragmentShader, transparent: true, depthWrite: false,
      uniforms: {uTime: { value: 0 }, uViolet: { value: new Color(dark ? '#c2a7ff' : '#654493') }, uOrange: { value: new Color(dark ? '#ffad81' : '#bd3510') }, uPoints: { value: points ? 1 : 0 }},
    })
    return {points: create(true), lines: create(false)}
  }, [dark])
  useEffect(() => () => { geometry.points.dispose(); geometry.connections.dispose() }, [geometry])
  useEffect(() => () => { materials.points.dispose(); materials.lines.dispose() }, [materials])
  useFrame(({ clock, pointer }) => {
    const time = clock.getElapsedTime()
    materials.points.uniforms.uTime.value = time
    materials.lines.uniforms.uTime.value = time
    if (group.current) {
      group.current.rotation.y += ((Math.sin(time * .08) * .22 + pointer.x * .08) - group.current.rotation.y) * .025
      group.current.rotation.x = -.12 + pointer.y * .035
    }
  })
  return <group ref={group} rotation={[0, -.22, -.1]}><points geometry={geometry.points} material={materials.points} /><lineSegments geometry={geometry.connections} material={materials.lines} /></group>
}

function BrainFallback() {
  return <svg viewBox="0 0 400 340" className="h-full w-full" fill="none" aria-hidden="true">
    <defs><linearGradient id="brain-fallback" x1="80" y1="40" x2="330" y2="310"><stop stopColor="var(--violet)"/><stop offset="1" stopColor="var(--accent)"/></linearGradient></defs>
    <g stroke="url(#brain-fallback)" strokeWidth="1.3"><path d="M190 65C160 35 122 49 115 77C75 67 52 102 66 131C39 157 48 191 75 204C65 240 95 267 125 259C143 298 184 278 191 252V65ZM210 65C240 35 278 49 285 77C325 67 348 102 334 131C361 157 352 191 325 204C335 240 305 267 275 259C257 298 216 278 209 252V65Z"/><path d="M116 77Q165 92 156 124T187 167M66 131Q118 113 125 161T183 212M75 204Q126 179 136 214T125 259M283 77Q235 92 244 124T211 167M334 131Q282 113 275 161T217 212M325 204Q274 179 264 214T275 259M110 112L156 124L125 161L136 214L183 212M288 112L244 124L275 161L264 214L217 212"/></g>
    {[ [116,77], [156,124], [125,161], [136,214], [183,212], [284,77], [244,124], [275,161], [264,214], [217,212] ].map(([cx,cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="4" fill="var(--accent)"/>)}
  </svg>
}

class CanvasBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <BrainFallback /> : this.props.children }
}

export default function NeuralBrain() {
  const root = useRef<HTMLDivElement>(null)
  const [enabled, setEnabled] = useState(false)
  const [visible, setVisible] = useState(false)
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => {
      setDark(document.documentElement.classList.contains('dark'))
      const canvas = document.createElement('canvas')
      let supportsWebGL = false
      try { const context = canvas.getContext('webgl2'); supportsWebGL = Boolean(context); context?.getExtension('WEBGL_lose_context')?.loseContext() } catch { supportsWebGL = false }
      setEnabled(!reduced.matches && supportsWebGL)
    }
    update()
    const theme = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')))
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    const observer = new IntersectionObserver(entries => setVisible(entries[0]?.isIntersecting ?? false), { rootMargin: '100px' })
    if (root.current) observer.observe(root.current)
    const visibility = () => { if (document.hidden) setVisible(false); else if (root.current) { const rect = root.current.getBoundingClientRect(); setVisible(rect.bottom > 0 && rect.top < window.innerHeight) } }
    document.addEventListener('visibilitychange', visibility)
    reduced.addEventListener('change', update)
    return () => { theme.disconnect(); observer.disconnect(); reduced.removeEventListener('change', update); document.removeEventListener('visibilitychange', visibility) }
  }, [])
  return <div ref={root} className="h-full w-full" aria-hidden="true">{enabled ? <CanvasBoundary><Canvas camera={{ position: [0, 0, 3.9], fov: 37 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }} frameloop={visible ? 'always' : 'never'} fallback={<BrainFallback />}><BrainScene dark={dark} /></Canvas></CanvasBoundary> : <BrainFallback />}</div>
}
