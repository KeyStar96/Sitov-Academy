'use client'

import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, Color, Group, ShaderMaterial } from 'three'

type Point3 = readonly [number, number, number]
interface NeuralEdge {
  from: Point3
  to: Point3
  seed: number
  birth: number
  length: number
}

function hash(value: number) {
  const result = Math.sin(value * 127.1 + 311.7) * 43758.5453
  return result - Math.floor(result)
}

/** Static cortical geometry. The GPU grows edges and moves signals; no per-frame buffers. */
function createNeuralGeometry() {
  const neurons: Point3[] = []
  const positions: number[] = []
  const seeds: number[] = []
  const halfCount = 650
  const golden = Math.PI * (3 - Math.sqrt(5))
  const cellSize = .24
  const cells = new Map<string, number[]>()
  const cellKey = (x: number, y: number, z: number) => `${x}:${y}:${z}`

  for (const hemisphere of [-1, 1]) {
    for (let index = 0; index < halfCount; index++) {
      const y = 1 - (index / (halfCount - 1)) * 2
      const radius = Math.sqrt(1 - y * y)
      const angle = golden * index
      const fold = 1 + .065 * Math.sin(angle * 7 + y * 17) * Math.cos(y * 13)
      const fissure = .055 + .035 * radius
      const x = (Math.abs(Math.cos(angle)) * radius * .77 + fissure) * hemisphere
      const point: Point3 = [x * fold, y * 1.03 * fold, Math.sin(angle) * radius * .84 * fold]
      const neuronIndex = neurons.length
      neurons.push(point)
      positions.push(...point)
      seeds.push(hash(neuronIndex))
      const key = cellKey(Math.floor(point[0] / cellSize), Math.floor(point[1] / cellSize), Math.floor(point[2] / cellSize))
      const bucket = cells.get(key) ?? []
      bucket.push(neuronIndex)
      cells.set(key, bucket)
    }
  }

  const edges: NeuralEdge[] = []
  const existing = new Set<string>()
  for (let index = 0; index < neurons.length; index++) {
    const from = neurons[index]
    const cell = from.map(value => Math.floor(value / cellSize))
    const candidates: { index: number; squaredDistance: number }[] = []
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const bucket = cells.get(cellKey(cell[0] + x, cell[1] + y, cell[2] + z))
          for (const candidate of bucket ?? []) {
            if (candidate === index) continue
            const to = neurons[candidate]
            // A few central bridges preserve a visible interhemispheric fissure.
            if (Math.sign(from[0]) !== Math.sign(to[0]) && index % 47 !== 0) continue
            const squaredDistance = (from[0] - to[0]) ** 2 + (from[1] - to[1]) ** 2 + (from[2] - to[2]) ** 2
            if (squaredDistance > .001 && squaredDistance < .075) candidates.push({ index: candidate, squaredDistance })
          }
        }
      }
    }
    candidates.sort((a, b) => a.squaredDistance - b.squaredDistance)
    for (const candidate of candidates.slice(0, 3)) {
      const key = `${Math.min(index, candidate.index)}:${Math.max(index, candidate.index)}`
      if (existing.has(key)) continue
      existing.add(key)
      const seed = hash(index * 13 + candidate.index * 7)
      edges.push({
        from,
        to: neurons[candidate.index],
        seed,
        // A small initial scaffold, followed by connections forming over eight seconds.
        birth: seed < .13 ? -.9 : .25 + seed * 6.5 + Math.abs(from[1]) * .8,
        length: Math.sqrt(candidate.squaredDistance),
      })
    }
  }

  const points = new BufferGeometry()
  points.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  points.setAttribute('aSeed', new BufferAttribute(new Float32Array(seeds), 1))

  const linePositions: number[] = []
  const along: number[] = []
  const edgeSeeds: number[] = []
  const edgeBirths: number[] = []
  const edgeLengths: number[] = []
  for (const edge of edges) {
    linePositions.push(...edge.from, ...edge.to)
    along.push(0, 1)
    edgeSeeds.push(edge.seed, edge.seed)
    edgeBirths.push(edge.birth, edge.birth)
    edgeLengths.push(edge.length, edge.length)
  }
  const connections = new BufferGeometry()
  connections.setAttribute('position', new BufferAttribute(new Float32Array(linePositions), 3))
  connections.setAttribute('aAlong', new BufferAttribute(new Float32Array(along), 1))
  connections.setAttribute('aSeed', new BufferAttribute(new Float32Array(edgeSeeds), 1))
  connections.setAttribute('aBirth', new BufferAttribute(new Float32Array(edgeBirths), 1))
  connections.setAttribute('aLength', new BufferAttribute(new Float32Array(edgeLengths), 1))

  const signals = new BufferGeometry()
  signals.setAttribute('position', new BufferAttribute(new Float32Array(edges.flatMap(edge => [...edge.from])), 3))
  signals.setAttribute('aTarget', new BufferAttribute(new Float32Array(edges.flatMap(edge => [...edge.to])), 3))
  signals.setAttribute('aSeed', new BufferAttribute(new Float32Array(edges.map(edge => edge.seed)), 1))
  signals.setAttribute('aBirth', new BufferAttribute(new Float32Array(edges.map(edge => edge.birth)), 1))
  signals.setAttribute('aLength', new BufferAttribute(new Float32Array(edges.map(edge => edge.length)), 1))
  return { points, connections, signals }
}

const deformationGLSL = `
  vec3 breathe(vec3 p, float time) {
    return p * (1.0 + 0.006 * sin(time * 0.65 + p.y * 2.0));
  }
`

/** Shared by the line highlight and the moving sprite, so each travels on the same edge. */
const signalGLSL = `
  vec3 edgeSignal(float seed, float edgeLength, float birth, float time) {
    float age = time - birth;
    float duration = 0.55 + edgeLength * 3.0;
    float period = 3.8 + seed * 3.2;
    float phase = mod(max(0.0, age - 1.35) + seed * period, period);
    float progress = phase / duration;
    float signalVisible = step(1.35, age) * (1.0 - step(1.0, progress));
    float backwards = step(0.5, fract(seed * 17.3));
    float position = mix(progress, 1.0 - progress, backwards);
    return vec3(position, signalVisible, backwards);
  }
`

const nodeVertex = `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aSeed;
  varying float vPresence;
  varying float vShimmer;
  ${deformationGLSL}
  void main() {
    vPresence = 0.28 + 0.72 * smoothstep(aSeed * 0.8, aSeed * 0.8 + 0.6, uTime);
    vShimmer = pow(max(0.0, sin(uTime * 0.6 - aSeed * 27.0)), 12.0);
    vec4 view = modelViewMatrix * vec4(breathe(position, uTime), 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = (1.6 + vShimmer * 1.1) * uPixelRatio * (3.7 / -view.z);
  }
`
const nodeFragment = `
  uniform vec3 uViolet;
  uniform vec3 uOrange;
  varying float vPresence;
  varying float vShimmer;
  void main() {
    float distance = length(gl_PointCoord - 0.5);
    if (distance > 0.5) discard;
    float alpha = (1.0 - smoothstep(0.12, 0.5, distance)) * vPresence * 0.68;
    gl_FragColor = vec4(mix(uViolet, uOrange, vShimmer * 0.6), alpha);
    #include <colorspace_fragment>
  }
`
const edgeVertex = `
  uniform float uTime;
  attribute float aAlong;
  attribute float aSeed;
  attribute float aBirth;
  attribute float aLength;
  varying float vAlong;
  varying float vSeed;
  varying float vBirth;
  varying float vLength;
  varying float vDepth;
  ${deformationGLSL}
  void main() {
    vAlong = aAlong;
    vSeed = aSeed;
    vBirth = aBirth;
    vLength = aLength;
    vec4 view = modelViewMatrix * vec4(breathe(position, uTime), 1.0);
    vDepth = clamp((view.z + 5.1) / 2.2, 0.25, 1.0);
    gl_Position = projectionMatrix * view;
  }
`
const edgeFragment = `
  uniform float uTime;
  uniform vec3 uViolet;
  uniform vec3 uOrange;
  varying float vAlong;
  varying float vSeed;
  varying float vBirth;
  varying float vLength;
  varying float vDepth;
  ${signalGLSL}
  void main() {
    float age = uTime - vBirth;
    float grown = smoothstep(0.0, 1.2, age);
    float presence = smoothstep(vAlong - 0.035, vAlong + 0.005, grown) * smoothstep(0.0, 0.15, age);
    if (presence < 0.01) discard;
    vec3 signal = edgeSignal(vSeed, vLength, vBirth, uTime);
    float behind = mix(signal.x - vAlong, vAlong - signal.x, signal.z);
    float trail = exp(-max(behind, 0.0) * 18.0) * step(0.0, behind) * signal.y;
    float head = exp(-pow((vAlong - signal.x) * 70.0, 2.0)) * signal.y;
    float energy = clamp(trail * 0.75 + head, 0.0, 1.0);
    float alpha = presence * (0.14 * vDepth + energy * 0.7);
    gl_FragColor = vec4(mix(uViolet, uOrange, energy), alpha);
    #include <colorspace_fragment>
  }
`
const signalVertex = `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute vec3 aTarget;
  attribute float aSeed;
  attribute float aBirth;
  attribute float aLength;
  varying float vActive;
  ${deformationGLSL}
  ${signalGLSL}
  void main() {
    vec3 signal = edgeSignal(aSeed, aLength, aBirth, uTime);
    vActive = signal.y;
    // Interpolate deformed endpoints, exactly matching the rendered line segment.
    vec3 point = mix(breathe(position, uTime), breathe(aTarget, uTime), clamp(signal.x, 0.0, 1.0));
    vec4 view = modelViewMatrix * vec4(point, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = 5.0 * uPixelRatio * (3.7 / -view.z);
  }
`
const signalFragment = `
  uniform vec3 uOrange;
  uniform vec3 uCore;
  varying float vActive;
  void main() {
    float distance = length(gl_PointCoord - 0.5);
    if (vActive < 0.5 || distance > 0.5) discard;
    float core = 1.0 - smoothstep(0.04, 0.2, distance);
    float alpha = 1.0 - smoothstep(0.08, 0.5, distance);
    gl_FragColor = vec4(mix(uOrange, uCore, core), alpha * 0.96);
    #include <colorspace_fragment>
  }
`

function BrainScene({ dark, onContextLost }: { dark: boolean; onContextLost: () => void }) {
  const group = useRef<Group>(null)
  const elapsed = useRef(0)
  const { gl } = useThree()
  const geometry = useMemo(createNeuralGeometry, [])
  const materials = useMemo(() => {
    const create = (vertexShader: string, fragmentShader: string) => new ShaderMaterial({
      vertexShader, fragmentShader, transparent: true, depthWrite: false, toneMapped: false,
      uniforms: {
        uTime: { value: 0 }, uPixelRatio: { value: 1 },
        uViolet: { value: new Color('#6942a0') }, uOrange: { value: new Color('#bd3510') }, uCore: { value: new Color('#802506') },
      },
    })
    return { nodes: create(nodeVertex, nodeFragment), edges: create(edgeVertex, edgeFragment), signals: create(signalVertex, signalFragment) }
  }, [])

  const materialList = useMemo(() => Object.values(materials), [materials])

  useEffect(() => {
    for (const material of materialList) {
      material.uniforms.uViolet.value.set(dark ? '#c2a7ff' : '#6942a0')
      material.uniforms.uOrange.value.set(dark ? '#ffad81' : '#bd3510')
      material.uniforms.uCore.value.set(dark ? '#fff3db' : '#802506')
    }
  }, [dark, materialList])
  useEffect(() => {
    const lost = (event: Event) => { event.preventDefault(); onContextLost() }
    gl.domElement.addEventListener('webglcontextlost', lost)
    return () => gl.domElement.removeEventListener('webglcontextlost', lost)
  }, [gl, onContextLost])
  useEffect(() => () => { for (const value of Object.values(geometry)) value.dispose() }, [geometry])
  useEffect(() => () => { for (const material of materialList) material.dispose() }, [materialList])
  useFrame(({ pointer }, delta) => {
    // Frameloop stops offscreen. Clamping the first resumed frame avoids an animation jump.
    elapsed.current += Math.min(delta, .05)
    for (const material of materialList) {
      material.uniforms.uTime.value = elapsed.current
      material.uniforms.uPixelRatio.value = gl.getPixelRatio()
    }
    if (group.current) {
      const response = 1 - Math.exp(-Math.min(delta, .05) * 2.5)
      const targetY = Math.sin(elapsed.current * .085) * .16 + pointer.x * .06
      group.current.rotation.y += (targetY - group.current.rotation.y) * response
      group.current.rotation.x = -.08 + pointer.y * .025
    }
  })
  return <group ref={group} rotation={[-.08, -.12, -.04]}>
    <lineSegments geometry={geometry.connections} material={materials.edges} />
    <points geometry={geometry.points} material={materials.nodes} />
    <points geometry={geometry.signals} material={materials.signals} />
  </group>
}

function BrainFallback() {
  return <svg viewBox="0 0 400 340" className="h-full w-full" fill="none" aria-hidden="true">
    <defs><linearGradient id="brain-fallback" x1="80" y1="40" x2="330" y2="310"><stop stopColor="var(--violet)"/><stop offset="1" stopColor="var(--accent)"/></linearGradient></defs>
    <g stroke="url(#brain-fallback)" strokeWidth="1.3"><path d="M190 65C160 35 122 49 115 77C75 67 52 102 66 131C39 157 48 191 75 204C65 240 95 267 125 259C143 298 184 278 191 252V65ZM210 65C240 35 278 49 285 77C325 67 348 102 334 131C361 157 352 191 325 204C335 240 305 267 275 259C257 298 216 278 209 252V65Z"/><path d="M116 77Q165 92 156 124T187 167M66 131Q118 113 125 161T183 212M75 204Q126 179 136 214T125 259M283 77Q235 92 244 124T211 167M334 131Q282 113 275 161T217 212M325 204Q274 179 264 214T275 259M110 112L156 124L125 161L136 214L183 212M288 112L244 124L275 161L264 214L217 212"/></g>
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
  const [contextLost, setContextLost] = useState(false)
  const handleContextLost = useCallback(() => setContextLost(true), [])
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const canvas = document.createElement('canvas')
    let supportsWebGL = false
    try {
      const context = canvas.getContext('webgl2')
      supportsWebGL = Boolean(context)
      context?.getExtension('WEBGL_lose_context')?.loseContext()
    } catch { supportsWebGL = false }
    const updateMotion = () => setEnabled(!reduced.matches && supportsWebGL)
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
    }, { threshold: .01 })
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
      camera={{ position: [0, 0, 4], fov: 37 }} dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      frameloop={visible ? 'always' : 'never'} fallback={<BrainFallback />}
    ><BrainScene dark={dark} onContextLost={handleContextLost} /></Canvas></CanvasBoundary> : <BrainFallback />}
  </div>
}
