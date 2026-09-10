import { BufferAttribute, BufferGeometry, CatmullRomCurve3, Vector3 } from 'three'
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js'

interface Neuron {
  position: Vector3
  seed: number
  density: number
  hemisphere: number
}

interface Connection {
  from: number
  to: number
  seed: number
}

export interface NeuralGeometry {
  nodes: BufferGeometry
  fibers: BufferGeometry
  pathways: BufferGeometry[]
  stats: { nodeCount: number; edgeCount: number; pathwayCount: number }
}

type Point3 = readonly [number, number, number]

const NODE_COUNT = 6400
const CELL_SIZE = .145
const PATH_SAMPLES = 192
const noise = new ImprovedNoise()

function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function smoothstep(low: number, high: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)))
  return t * t * (3 - 2 * t)
}

/** Domain warping makes the cortical folds and their internal clusters continuous. */
function tissueNoise(x: number, y: number, z: number): number {
  const wx = x + .58 * noise.noise(x * .9 + 8.4, y * .9, z * .9)
  const wy = y + .58 * noise.noise(x * .9, y * .9 + 19.1, z * .9)
  const wz = z + .58 * noise.noise(x * .9, y * .9, z * .9 + 31.7)
  return noise.noise(wx, wy, wz) * .72
    + noise.noise(wx * 2.13, wy * 2.13, wz * 2.13) * .2
    + noise.noise(wx * 4.31, wy * 4.31, wz * 4.31) * .08
}

function finishGeometry(geometry: BufferGeometry): BufferGeometry {
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

/** A small binary heap keeps graph searches bounded even on dense tissue. */
class SearchQueue {
  private entries: { index: number; priority: number }[] = []

  get length(): number { return this.entries.length }

  push(index: number, priority: number): void {
    const entry = { index, priority }
    let cursor = this.entries.length
    this.entries.push(entry)
    while (cursor > 0) {
      const parent = (cursor - 1) >>> 1
      if (this.entries[parent].priority <= priority) break
      this.entries[cursor] = this.entries[parent]
      cursor = parent
    }
    this.entries[cursor] = entry
  }

  pop(): { index: number; priority: number } {
    const first = this.entries[0]
    const last = this.entries.pop()!
    if (this.entries.length > 0) {
      let cursor = 0
      while (cursor * 2 + 1 < this.entries.length) {
        let child = cursor * 2 + 1
        if (child + 1 < this.entries.length && this.entries[child + 1].priority < this.entries[child].priority) child++
        if (this.entries[child].priority >= last.priority) break
        this.entries[cursor] = this.entries[child]
        cursor = child
      }
      this.entries[cursor] = last
    }
    return first
  }
}

function findRoute(start: number, end: number, neurons: Neuron[], neighbors: number[][]): number[] {
  const costs = new Float64Array(neurons.length).fill(Infinity)
  const parents = new Int32Array(neurons.length).fill(-1)
  const visited = new Uint8Array(neurons.length)
  const target = neurons[end].position
  const queue = new SearchQueue()
  costs[start] = 0
  queue.push(start, 0)

  while (queue.length > 0) {
    const { index } = queue.pop()
    if (visited[index]) continue
    visited[index] = 1
    if (index === end) break
    for (const neighbor of neighbors[index]) {
      if (visited[neighbor]) continue
      const point = neurons[neighbor].position
      // Prefer routes on the visible cortex while allowing genuine deep bridges.
      const depthPenalty = 1 + Math.max(0, .17 - point.z) * 4
      const distance = neurons[index].position.distanceTo(point)
      const cost = costs[index] + distance * depthPenalty
      if (cost >= costs[neighbor]) continue
      costs[neighbor] = cost
      parents[neighbor] = index
      queue.push(neighbor, cost + point.distanceTo(target))
    }
  }

  if (parents[end] === -1) return []
  const route = [end]
  for (let index = end; index !== start;) {
    index = parents[index]
    route.push(index)
  }
  return route.reverse()
}

function createPathway(points: Vector3[]): BufferGeometry {
  const positions = new Float32Array(points.length * 6)
  const tangents = new Float32Array(points.length * 6)
  const along = new Float32Array(points.length * 2)
  const sides = new Float32Array(points.length * 2)
  const indices = new Uint16Array((points.length - 1) * 6)
  const lengths = new Float32Array(points.length)
  for (let index = 1; index < points.length; index++) {
    lengths[index] = lengths[index - 1] + points[index].distanceTo(points[index - 1])
  }
  const tangent = new Vector3()
  const length = lengths[lengths.length - 1]

  for (let index = 0; index < points.length; index++) {
    tangent.subVectors(points[Math.min(index + 1, points.length - 1)], points[Math.max(0, index - 1)]).normalize()
    for (let side = 0; side < 2; side++) {
      const vertex = index * 2 + side
      points[index].toArray(positions, vertex * 3)
      tangent.toArray(tangents, vertex * 3)
      along[vertex] = lengths[index] / length
      sides[vertex] = side === 0 ? -1 : 1
    }
    if (index < points.length - 1) {
      const vertex = index * 2
      indices.set([vertex, vertex + 1, vertex + 2, vertex + 2, vertex + 1, vertex + 3], index * 6)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('aTangent', new BufferAttribute(tangents, 3))
  geometry.setAttribute('aAlong', new BufferAttribute(along, 1))
  geometry.setAttribute('aSide', new BufferAttribute(sides, 1))
  geometry.setIndex(new BufferAttribute(indices, 1))
  return finishGeometry(geometry)
}

/** All sampling, connectivity and ribbon construction runs once, never per frame. */
export function createNeuralGeometry(): NeuralGeometry {
  const random = createRandom(0x5349544f)
  const neurons: Neuron[] = []
  const positions: number[] = []
  const seeds: number[] = []
  const densities: number[] = []
  const cells = new Map<string, number[]>()
  const cellKey = (x: number, y: number, z: number): string => `${x}:${y}:${z}`

  while (neurons.length < NODE_COUNT) {
    const hemisphere = neurons.length < NODE_COUNT / 2 ? -1 : 1
    const y = random() * 2 - 1
    const angle = random() * Math.PI * 2
    const ring = Math.sqrt(1 - y * y)
    const x = Math.abs(Math.cos(angle)) * ring
    const z = Math.sin(angle) * ring
    // A thick cortical layer surrounds a substantial population in the interior.
    const cortical = random() < .63
    const radius = cortical ? .76 + .24 * Math.pow(random(), .58) : Math.cbrt(random()) * .91
    const sideOffset = hemisphere < 0 ? 3.7 : 11.3
    const folding = tissueNoise(x * 2.3 + sideOffset, y * 3.1, z * 2.7)
    const grooves = noise.noise(x * 7.8 + sideOffset, y * 8.6, z * 7.3)
    const contour = .94 + folding * .3 + grooves * .1
    const depth = radius * contour
    // A broad frontal crown, narrower temporal base and asymmetry avoid a sphere.
    const temple = 1 - .29 * smoothstep(-.05, .88, -y) + .13 * smoothstep(-.2, .62, y)
    const fissure = .02 + .023 * smoothstep(-.4, .65, y) + .009 * Math.sin(y * 5.4 + z * 2.1)
    const upperCleft = .14 * smoothstep(.42, .95, y) * (1 - smoothstep(.08, .37, x))
    const frontalCrown = .045 * smoothstep(.16, .4, x) * smoothstep(.15, .85, y)
    const px = hemisphere * (fissure + x * depth * .99 * temple)
    const py = y * depth * .82 + .028 * x * x + frontalCrown - upperCleft
      - .025 * smoothstep(.25, .95, -y) + hemisphere * .013
    const pz = z * depth * .67 * (1 + .055 * y) + .025 * folding
    const clustered = tissueNoise(px * 5.5 + 27.6, py * 5.7, pz * 5.2)
    const density = smoothstep(-.32, .38, clustered)
    // Rejection sampling forms bundles and quieter gaps instead of a uniform shell.
    if (random() > .27 + density * .73) continue
    const position = new Vector3(px, py, pz)
    const seed = random()
    const index = neurons.length
    neurons.push({ position, seed, density, hemisphere })
    positions.push(px, py, pz)
    seeds.push(seed)
    densities.push(density)
    const key = cellKey(Math.floor(px / CELL_SIZE), Math.floor(py / CELL_SIZE), Math.floor(pz / CELL_SIZE))
    const bucket = cells.get(key) ?? []
    bucket.push(index)
    cells.set(key, bucket)
  }

  const connections: Connection[] = []
  const neighbors = Array.from({ length: neurons.length }, (): number[] => [])
  const existing = new Set<number>()
  const connect = (from: number, to: number): void => {
    const key = Math.min(from, to) * NODE_COUNT + Math.max(from, to)
    if (from === to || existing.has(key)) return
    existing.add(key)
    connections.push({ from, to, seed: random() })
    neighbors[from].push(to)
    neighbors[to].push(from)
  }

  for (let index = 0; index < neurons.length; index++) {
    const neuron = neurons[index]
    const cellX = Math.floor(neuron.position.x / CELL_SIZE)
    const cellY = Math.floor(neuron.position.y / CELL_SIZE)
    const cellZ = Math.floor(neuron.position.z / CELL_SIZE)
    const candidates: { index: number; distance: number }[] = []
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const bucket = cells.get(cellKey(cellX + x, cellY + y, cellZ + z))
          for (const candidate of bucket ?? []) {
            if (candidate === index || neurons[candidate].hemisphere !== neuron.hemisphere) continue
            const distance = neuron.position.distanceToSquared(neurons[candidate].position)
            if (distance > .000018 && distance < .066) candidates.push({ index: candidate, distance })
          }
        }
      }
    }
    candidates.sort((a, b) => a.distance - b.distance)
    const neighborCount = 4 + Math.floor(neuron.seed * 3)
    for (const candidate of candidates.slice(0, neighborCount)) connect(index, candidate.index)
  }

  const nearest = (target: Point3, hemisphere: number): number => {
    let closest = -1
    let distance = Infinity
    for (let index = 0; index < neurons.length; index++) {
      const neuron = neurons[index]
      if (neuron.hemisphere !== hemisphere) continue
      const point = neuron.position
      const candidate = (point.x - target[0]) ** 2 + (point.y - target[1]) ** 2 + (point.z - target[2]) ** 2
      if (candidate < distance) { closest = index; distance = candidate }
    }
    return closest
  }

  // Sparse commissures connect both halves without filling the visible upper cleft.
  for (let index = 0; index < 9; index++) {
    const y = -.36 + index * .065
    const z = index % 3 === 0 ? .18 : -.04 - (index % 3) * .08
    connect(nearest([-.05, y, z], -1), nearest([.05, y, z], 1))
  }

  const fiberPositions: number[] = []
  const fiberSeeds: number[] = []
  const fiberDensities: number[] = []
  const addFiber = (from: Vector3, to: Vector3, seed: number, density: number): void => {
    fiberPositions.push(from.x, from.y, from.z, to.x, to.y, to.z)
    fiberSeeds.push(seed, seed)
    fiberDensities.push(density, density)
  }
  const direction = new Vector3()
  const normal = new Vector3()
  const reference = new Vector3()
  const previous = new Vector3()
  const current = new Vector3()
  for (const connection of connections) {
    const from = neurons[connection.from]
    const to = neurons[connection.to]
    direction.subVectors(to.position, from.position)
    const length = direction.length()
    direction.normalize()
    reference.set(.4 + connection.seed, .7 - connection.seed * .3, .3)
    normal.crossVectors(direction, reference).normalize().multiplyScalar(length * (.08 + connection.seed * .11))
    previous.copy(from.position)
    for (let segment = 1; segment <= 3; segment++) {
      const t = segment / 3
      current.lerpVectors(from.position, to.position, t).addScaledVector(normal, Math.sin(t * Math.PI))
      addFiber(previous, current, connection.seed, (from.density + to.density) / 2)
      previous.copy(current)
    }
  }

  const routeTargets: readonly (readonly [Point3, Point3])[] = [
    [[-.22, .72, .25], [-.75, -.35, .31]],
    [[.78, .31, .29], [.24, -.61, .31]],
    [[-.82, -.06, .36], [-.23, .56, .46]],
    [[.24, .66, .37], [.86, -.16, .29]],
    [[-.22, -.59, .32], [-.67, .43, .35]],
    [[.84, -.2, .32], [.3, .51, .48]],
    [[-.87, .23, .21], [-.26, -.41, .52]],
    [[.24, -.55, .37], [.77, .3, .4]],
    [[-.32, .44, .53], [-.74, -.3, .27]],
    [[.72, -.35, .29], [.25, .64, .3]],
    [[-.77, .39, .24], [-.19, -.57, .31]],
    [[.22, .54, .44], [.82, -.25, .22]],
    [[-.62, .4, .4], [.6, -.37, .42]],
    [[.7, .29, .39], [-.56, -.42, .45]],
    [[-.58, -.41, .43], [.62, .43, .37]],
    [[.61, -.43, .35], [-.65, .37, .39]],
  ]
  const pathways: BufferGeometry[] = []
  for (const [from, to] of routeTargets) {
    const route = findRoute(nearest(from, Math.sign(from[0])), nearest(to, Math.sign(to[0])), neurons, neighbors)
    if (route.length < 3) continue
    // Each curve interpolates an actual connected graph route. Its centerline is
    // also part of the static tissue so the comet always lights a visible fiber.
    const curve = new CatmullRomCurve3(route.map(index => neurons[index].position.clone()), false, 'centripetal')
    curve.arcLengthDivisions = 1024
    const points = curve.getSpacedPoints(PATH_SAMPLES - 1)
    const seed = random()
    for (let index = 1; index < points.length; index++) addFiber(points[index - 1], points[index], seed, .65)
    pathways.push(createPathway(points))
  }

  const nodes = new BufferGeometry()
  nodes.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  nodes.setAttribute('aSeed', new BufferAttribute(new Float32Array(seeds), 1))
  nodes.setAttribute('aDensity', new BufferAttribute(new Float32Array(densities), 1))
  const fibers = new BufferGeometry()
  fibers.setAttribute('position', new BufferAttribute(new Float32Array(fiberPositions), 3))
  fibers.setAttribute('aSeed', new BufferAttribute(new Float32Array(fiberSeeds), 1))
  fibers.setAttribute('aDensity', new BufferAttribute(new Float32Array(fiberDensities), 1))

  return {
    nodes: finishGeometry(nodes), fibers: finishGeometry(fibers), pathways,
    stats: { nodeCount: neurons.length, edgeCount: connections.length, pathwayCount: pathways.length },
  }
}
