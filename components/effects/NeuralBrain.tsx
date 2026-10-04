'use client'

/* Three.js GPU resources require imperative uniform updates outside React state. */
/* eslint-disable react-hooks/immutability */

import { Component, useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, Color, DoubleSide, Group, Mesh, NormalBlending, Points, ShaderMaterial, type BufferGeometry, type NormalOrGLBufferAttributes } from 'three'
import { createNeuralGeometry } from './neural-brain-geometry'
import { cometFragment, cometVertex, cortexFragment, cortexVertex, fiberFragment, fiberVertex, flareFragment, flareVertex, nodeFragment, nodeVertex } from './neural-brain-shaders'

const MAX_COMETS = 9
const TAIL_LENGTH = 0.48

interface ImpulseSlot {
  start: number
  duration: number
  nextStart: number
  cycle: number
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
      uCortexOpacity: { value: 0.22 },
      uCortexLight: { value: new Color('#eee5f2') },
      uCortexShadow: { value: new Color('#7f6293') },
      uProgress: { value: -1 },
      uTail: { value: TAIL_LENGTH },
      uWidth: { value: 0.082 },
      uEnvelope: { value: 0 },
      uTint: { value: 0 },
      uEmber: { value: new Color('#b75020') },
      uFlame: { value: new Color('#ed853c') },
      uCore: { value: new Color('#fff4d4') },
      uViolet: { value: new Color('#8c65ed') },
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
  const flares = useRef<(Points<BufferGeometry<NormalOrGLBufferAttributes>> | null)[]>([])
  const time = useRef(0)
  const slots = useRef<ImpulseSlot[]>(Array.from({ length: MAX_COMETS }, () => ({ start: -1, duration: 1, nextStart: 0, cycle: 0 })))
  const { gl, invalidate, size, viewport } = useThree()
  const geometry = useMemo(() => createNeuralGeometry(), [])
  const materials = useMemo(() => {
    const impulses = Array.from({ length: MAX_COMETS }, (_, index) => {
      const material = createMaterial(cometVertex, cometFragment)
      material.side = DoubleSide
      material.uniforms.uTint.value = index % 4 === 3 ? 1 : 0
      return material
    })
    const sparks = impulses.map(impulse => {
      const material = createMaterial(flareVertex, flareFragment)
      // The ribbon and its lens glint travel on one clock and share all uniforms.
      material.uniforms = impulse.uniforms
      return material
    })
    return {
      cortex: createMaterial(cortexVertex, cortexFragment),
      nodes: createMaterial(nodeVertex, nodeFragment),
      fibers: createMaterial(fiberVertex, fiberFragment),
      impulses,
      sparks,
    }
  }, [])
  const materialList = useMemo(() => [materials.cortex, materials.nodes, materials.fibers, ...materials.impulses, ...materials.sparks], [materials])

  useEffect(() => {
    for (const material of materialList) {
      material.uniforms.uTissue.value.set(dark ? '#e0ccff' : '#75548d')
      material.uniforms.uDepthColor.value.set(dark ? '#75699c' : '#b6a8cd')
      material.uniforms.uNodeOpacity.value = dark ? .88 : .72
      material.uniforms.uFiberOpacity.value = dark ? .32 : .24
      material.uniforms.uCortexOpacity.value = dark ? .43 : .48
      material.uniforms.uCortexLight.value.set(dark ? '#b59cdc' : '#cfbce5')
      material.uniforms.uCortexShadow.value.set(dark ? '#382a58' : '#725286')
      material.uniforms.uEmber.value.set(dark ? '#e47035' : '#c34412')
      material.uniforms.uFlame.value.set(dark ? '#ffc37b' : '#f07827')
      material.uniforms.uCore.value.set(dark ? '#fff9e9' : '#fffaef')
      material.uniforms.uViolet.value.set(dark ? '#b396ff' : '#8760dc')
    }
    // Normal blending keeps the amber silhouette visible on pale backgrounds.
    for (const material of [...materials.impulses, ...materials.sparks]) {
      material.blending = dark ? AdditiveBlending : NormalBlending
      material.needsUpdate = true
    }
    invalidate()
  }, [dark, materialList, materials, invalidate])

  useEffect(() => {
    // DPR can change without an animation frame (e.g. a static reduced-motion scene).
    for (const material of materialList) material.uniforms.uPixelRatio.value = gl.getPixelRatio()
    invalidate()
  }, [gl, size, viewport.dpr, materialList, invalidate])

  useEffect(() => {
    for (let index = 0; index < MAX_COMETS; index++) {
      slots.current[index].start = -1
      slots.current[index].nextStart = time.current + 0.08 + variation(index + 71) * 2.8
      const mesh = comets.current[index]
      const flare = flares.current[index]
      // A composed still retains three lit connections when motion is reduced.
      const still = reducedMotion && index % 3 === 0 && geometry.pathways.length > 0
      const stillRoute = (index === 0 ? 0 : index === 3 ? 3 : 9) % Math.max(1, geometry.pathways.length)
      if (mesh) {
        mesh.visible = still
        if (still) mesh.geometry = geometry.pathways[stillRoute]
      }
      if (flare) {
        flare.visible = still
        if (still) flare.geometry = geometry.flarePaths[stillRoute]
      }
      materials.impulses[index].uniforms.uProgress.value = .62 + index * .022
      materials.impulses[index].uniforms.uEnvelope.value = still ? .9 : 0
    }
    invalidate()
  }, [reducedMotion, geometry, materials, invalidate])

  useEffect(() => {
    const lost = (event: Event) => { event.preventDefault(); onContextLost() }
    gl.domElement.addEventListener('webglcontextlost', lost)
    return () => gl.domElement.removeEventListener('webglcontextlost', lost)
  }, [gl, onContextLost])

  useEffect(() => () => {
    geometry.nodes.dispose()
    geometry.cortex.dispose()
    geometry.fibers.dispose()
    for (const pathway of geometry.pathways) pathway.dispose()
    for (const pathway of geometry.flarePaths) pathway.dispose()
    for (const material of materialList) material.dispose()
  }, [geometry, materialList])

  useFrame(({ pointer }, delta) => {
    if (reducedMotion) return
    // The clock freezes offscreen; clamping avoids jumps after tab visibility changes.
    const step = Math.min(delta, 0.05)
    time.current += step
    const now = time.current
    for (const material of materialList) material.uniforms.uTime.value = now
    for (const material of materialList) material.uniforms.uPixelRatio.value = gl.getPixelRatio()

    // Each reusable slot has its own clock: no shared burst or periodic reset.
    for (let index = 0; index < MAX_COMETS; index++) {
      const mesh = comets.current[index]
      const flare = flares.current[index]
      const slot = slots.current[index]
      if (!mesh) continue
      // Smartphones retain the full anatomy with fewer simultaneous GPU ribbons.
      if (index >= (size.width < 420 ? 6 : MAX_COMETS)) {
        mesh.visible = false
        if (flare) flare.visible = false
        slot.start = -1
        continue
      }
      if (slot.start < 0 && now >= slot.nextStart && geometry.pathways.length > 0) {
        const seed = index * 101 + slot.cycle++ * 37
        const route = Math.floor(variation(seed + 19) * geometry.pathways.length)
        mesh.geometry = geometry.pathways[route]
        if (flare) flare.geometry = geometry.flarePaths[route]
        slot.start = now
        slot.duration = 1.65 + variation(seed + 43) * 1.6
        // Let the complete tail fade before a separately varied idle period.
        slot.nextStart = now + slot.duration * (1 + TAIL_LENGTH) + 0.25 + variation(seed + 89) * 1.7
      }
      if (slot.start < 0) continue
      const progress = (now - slot.start) / slot.duration
      mesh.visible = progress >= 0 && progress <= 1 + TAIL_LENGTH
      if (flare) flare.visible = progress >= 0 && progress <= 1
      if (progress > 1 + TAIL_LENGTH) { slot.start = -1; continue }
      const uniforms = materials.impulses[index].uniforms
      uniforms.uProgress.value = progress
      // Fade in at the source; let the entire tail drain through the destination.
      uniforms.uEnvelope.value = Math.min(1, Math.max(0, progress / 0.055))
    }

    if (group.current) {
      const response = 1 - Math.exp(-step * 2)
      const targetY = -.12 + Math.sin(now * .12) * .065 + pointer.x * .035
      const targetX = .04 + Math.sin(now * .1) * .025 + pointer.y * .025
      group.current.rotation.y += (targetY - group.current.rotation.y) * response
      group.current.rotation.x += (targetX - group.current.rotation.x) * response
      group.current.position.y = Math.sin(now * 0.32) * 0.022
    }
  })

  const scale = 1.1 * Math.min(1, size.width / size.height / .95)
  return <group ref={group} rotation={[.04, -.12, -.12]} scale={scale} dispose={null}>
    <mesh geometry={geometry.cortex} material={materials.cortex} renderOrder={-1} />
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
    {materials.sparks.map((material, index) => <points
      key={index}
      ref={points => { flares.current[index] = points }}
      geometry={geometry.flarePaths[0]}
      material={material}
      visible={false}
      frustumCulled={false}
      renderOrder={3}
    />)}
  </group>
}

function BrainFallback() {
  const gradientId = useId()
  return <svg viewBox="0 0 400 340" className="h-full w-full" fill="none" aria-hidden="true" data-sitov-brain-fallback>
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
      camera={{ position: [1.4, 3.2, 2.75], fov: 36 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      frameloop={!visible ? 'never' : reducedMotion ? 'demand' : 'always'}
      fallback={<BrainFallback />}
    ><BrainScene dark={dark} reducedMotion={reducedMotion} onContextLost={handleContextLost} /></Canvas></CanvasBoundary> : <BrainFallback />}
  </div>
}
