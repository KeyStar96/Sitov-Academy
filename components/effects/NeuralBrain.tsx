'use client'

import { Component, useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, Color, DoubleSide, Group, Mesh, NormalBlending, ShaderMaterial } from 'three'
import { createNeuralGeometry } from './neural-brain-geometry'
import { cometFragment, cometVertex, fiberFragment, fiberVertex, nodeFragment, nodeVertex } from './neural-brain-shaders'

const MAX_COMETS = 3
const TAIL_LENGTH = 0.3
const BURST_COUNTS = [1, 2, 1, 3, 1, 2] as const

interface ImpulseSlot {
  start: number
  duration: number
}

function variation(seed: number) {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return value - Math.floor(value)
}

function createMaterial(vertexShader: string, fragmentShader: string) {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uTissue: { value: new Color('#76528d') },
      uDepthColor: { value: new Color('#9984b0') },
      uNodeOpacity: { value: 0.75 },
      uFiberOpacity: { value: 0.2 },
      uProgress: { value: -1 },
      uTail: { value: TAIL_LENGTH },
      uEnvelope: { value: 0 },
      uEmber: { value: new Color('#b75020') },
      uFlame: { value: new Color('#ed853c') },
      uCore: { value: new Color('#fff4d4') },
    },
  })
}

function BrainScene({ dark, reducedMotion, onContextLost }: {
  dark: boolean
  reducedMotion: boolean
  onContextLost: () => void
}) {
  const group = useRef<Group>(null)
  const comets = useRef<(Mesh | null)[]>([])
  const time = useRef(0)
  const nextBurst = useRef(2.4)
  const burstIndex = useRef(0)
  const slots = useRef<ImpulseSlot[]>(Array.from({ length: MAX_COMETS }, () => ({ start: -1, duration: 1 })))
  const { gl, invalidate, size, viewport } = useThree()
  const geometry = useMemo(createNeuralGeometry, [])
  const materials = useMemo(() => {
    const impulses = Array.from({ length: MAX_COMETS }, () => {
      const material = createMaterial(cometVertex, cometFragment)
      material.side = DoubleSide
      return material
    })
    return {
      nodes: createMaterial(nodeVertex, nodeFragment),
      fibers: createMaterial(fiberVertex, fiberFragment),
      impulses,
    }
  }, [])
  const materialList = useMemo(() => [materials.nodes, materials.fibers, ...materials.impulses], [materials])

  useEffect(() => {
    for (const material of materialList) {
      material.uniforms.uTissue.value.set(dark ? '#c7b4ed' : '#644578')
      material.uniforms.uDepthColor.value.set(dark ? '#625685' : '#9984b0')
      material.uniforms.uNodeOpacity.value = dark ? 0.95 : 0.88
      material.uniforms.uFiberOpacity.value = dark ? 0.28 : 0.3
      material.uniforms.uEmber.value.set(dark ? '#ca602b' : '#b75020')
      material.uniforms.uFlame.value.set(dark ? '#ffb865' : '#ed853c')
      material.uniforms.uCore.value.set(dark ? '#fff6dd' : '#fff4d4')
    }
    // Normal blending keeps the amber silhouette visible on pale backgrounds.
    for (const material of materials.impulses) {
      material.blending = dark ? AdditiveBlending : NormalBlending
      material.needsUpdate = true
    }
    invalidate()
  }, [dark, materialList, materials, invalidate])

  useEffect(() => {
    // DPR can change without an animation frame (e.g. a static reduced-motion scene).
    materials.nodes.uniforms.uPixelRatio.value = gl.getPixelRatio()
    invalidate()
  }, [gl, size, viewport.dpr, materials, invalidate])

  useEffect(() => {
    for (let index = 0; index < MAX_COMETS; index++) {
      slots.current[index].start = -1
      if (comets.current[index]) comets.current[index].visible = false
    }
    nextBurst.current = time.current + 2.4
    invalidate()
  }, [reducedMotion, invalidate])

  useEffect(() => {
    const lost = (event: Event) => { event.preventDefault(); onContextLost() }
    gl.domElement.addEventListener('webglcontextlost', lost)
    return () => gl.domElement.removeEventListener('webglcontextlost', lost)
  }, [gl, onContextLost])

  useEffect(() => () => {
    geometry.nodes.dispose()
    geometry.fibers.dispose()
    for (const pathway of geometry.pathways) pathway.dispose()
    for (const material of materialList) material.dispose()
  }, [geometry, materialList])

  useFrame(({ pointer }, delta) => {
    if (reducedMotion) return
    // The clock freezes offscreen; clamping avoids jumps after tab visibility changes.
    const step = Math.min(delta, 0.05)
    time.current += step
    const now = time.current
    for (const material of materialList) material.uniforms.uTime.value = now
    materials.nodes.uniforms.uPixelRatio.value = gl.getPixelRatio()

    if (now >= nextBurst.current && geometry.pathways.length > 0) {
      const burst = burstIndex.current++
      const count = Math.min(BURST_COUNTS[burst % BURST_COUNTS.length], geometry.pathways.length)
      const firstPath = Math.floor(variation(burst + 19) * geometry.pathways.length)
      for (let index = 0; index < count; index++) {
        const mesh = comets.current[index]
        if (!mesh) continue
        mesh.geometry = geometry.pathways[(firstPath + index) % geometry.pathways.length]
        slots.current[index].start = now + index * 0.16
        slots.current[index].duration = 1.7 + variation(burst * 3 + index) * 0.4
      }
      // Entire bursts finish in <=3.05 s, leaving at least 2.95 s of silence.
      nextBurst.current = now + 6 + variation(burst + 41) * 2
    }

    for (let index = 0; index < MAX_COMETS; index++) {
      const mesh = comets.current[index]
      const slot = slots.current[index]
      if (!mesh || slot.start < 0) continue
      const progress = (now - slot.start) / slot.duration
      mesh.visible = progress >= 0 && progress <= 1 + TAIL_LENGTH
      if (progress > 1 + TAIL_LENGTH) { slot.start = -1; continue }
      const uniforms = materials.impulses[index].uniforms
      uniforms.uProgress.value = progress
      // Fade in at the source; let the entire tail drain through the destination.
      uniforms.uEnvelope.value = Math.min(1, Math.max(0, progress / 0.055))
    }

    if (group.current) {
      const response = 1 - Math.exp(-step * 2)
      const targetY = -0.2 + Math.sin(now * 0.09) * 0.1 + pointer.x * 0.045
      const targetX = -0.12 + pointer.y * 0.025
      group.current.rotation.y += (targetY - group.current.rotation.y) * response
      group.current.rotation.x += (targetX - group.current.rotation.x) * response
      group.current.position.y = Math.sin(now * 0.32) * 0.018
    }
  })

  const scale = 1.08 * Math.min(1, size.width / size.height / 0.95)
  return <group ref={group} rotation={[-0.12, -0.2, -0.035]} scale={scale} dispose={null}>
    <lineSegments geometry={geometry.fibers} material={materials.fibers} />
    <points geometry={geometry.nodes} material={materials.nodes} />
    {materials.impulses.map((material, index) => <mesh
      key={index}
      ref={mesh => { comets.current[index] = mesh }}
      geometry={geometry.pathways[0]}
      material={material}
      visible={false}
      frustumCulled={false}
      renderOrder={2}
    />)}
  </group>
}

function BrainFallback() {
  const gradientId = useId()
  return <svg viewBox="0 0 400 340" className="h-full w-full" fill="none" aria-hidden="true">
    <defs><linearGradient id={gradientId} x1="80" y1="40" x2="330" y2="310"><stop stopColor="var(--violet)"/><stop offset="1" stopColor="var(--accent)"/></linearGradient></defs>
    <g stroke={`url(#${gradientId})`} strokeWidth="1.3"><path d="M190 65C160 35 122 49 115 77C75 67 52 102 66 131C39 157 48 191 75 204C65 240 95 267 125 259C143 298 184 278 191 252V65ZM210 65C240 35 278 49 285 77C325 67 348 102 334 131C361 157 352 191 325 204C335 240 305 267 275 259C257 298 216 278 209 252V65Z"/><path d="M116 77Q165 92 156 124T187 167M66 131Q118 113 125 161T183 212M75 204Q126 179 136 214T125 259M283 77Q235 92 244 124T211 167M334 131Q282 113 275 161T217 212M325 204Q274 179 264 214T275 259M110 112L156 124L125 161L136 214L183 212M288 112L244 124L275 161L264 214L217 212"/></g>
    {[[116,77], [156,124], [125,161], [136,214], [183,212], [284,77], [244,124], [275,161], [264,214], [217,212]].map(([cx,cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="4" fill="var(--accent)"/>)}
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
  const [reducedMotion, setReducedMotion] = useState(true)
  const [contextLost, setContextLost] = useState(false)
  const handleContextLost = useCallback(() => setContextLost(true), [])

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const canvas = document.createElement('canvas')
    try {
      const context = canvas.getContext('webgl2')
      setEnabled(Boolean(context))
      context?.getExtension('WEBGL_lose_context')?.loseContext()
    } catch { setEnabled(false) }
    const updateMotion = () => setReducedMotion(reduced.matches)
    const updateTheme = () => setDark(document.documentElement.classList.contains('dark'))
    updateMotion()
    updateTheme()
    const theme = new MutationObserver(updateTheme)
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    let inView = false
    const updateVisibility = () => setVisible(inView && !document.hidden)
    const observer = new IntersectionObserver(entries => {
      inView = entries[0]?.isIntersecting ?? false
      updateVisibility()
    }, { threshold: 0.01 })
    if (root.current) observer.observe(root.current)
    document.addEventListener('visibilitychange', updateVisibility)
    reduced.addEventListener('change', updateMotion)
    return () => {
      theme.disconnect()
      observer.disconnect()
      reduced.removeEventListener('change', updateMotion)
      document.removeEventListener('visibilitychange', updateVisibility)
    }
  }, [])

  return <div ref={root} className="h-full w-full" aria-hidden="true">
    {enabled && !contextLost ? <CanvasBoundary><Canvas
      camera={{ position: [0, 0, 4.3], fov: 34 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      frameloop={!visible ? 'never' : reducedMotion ? 'demand' : 'always'}
      fallback={<BrainFallback />}
    ><BrainScene dark={dark} reducedMotion={reducedMotion} onContextLost={handleContextLost} /></Canvas></CanvasBoundary> : <BrainFallback />}
  </div>
}
