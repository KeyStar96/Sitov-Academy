import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createNeuralGeometry, sampleCortex, BRAIN_PROPORTIONS } from '../components/effects/neural-brain-geometry.ts'

test('Anatomical NeuralBrain geometry', async t => {
  const geometry = createNeuralGeometry()
  try {
    await t.test('keeps the dense graph and all sixteen real graph pathways', () => {
      assert.equal(geometry.stats.nodeCount, 6400)
      assert.ok(geometry.stats.edgeCount > 19000)
      assert.equal(geometry.stats.pathwayCount, 16)
      assert.equal(geometry.nodes.attributes.position.count, 6400)
    })
    await t.test('has two equal hemispheres with an uninterrupted sagittal fissure', () => {
      const positions = geometry.nodes.attributes.position
      let left = 0
      let right = 0
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i)
        assert.ok(Math.abs(x) >= BRAIN_PROPORTIONS.fissure - 1e-6)
        if (x < 0) left++; else right++
      }
      assert.equal(left, 3200)
      assert.equal(right, 3200)
      for (let latitude = -.9; latitude <= .9; latitude += .15) {
        // Inferior and superior contour widths stay comparable: no heart tip.
        const upper = Math.abs(sampleCortex(1, Math.abs(latitude), 0).point.x)
        const lower = Math.abs(sampleCortex(1, -Math.abs(latitude), 0).point.x)
        assert.ok(lower / upper > .82 && lower / upper < 1.2)
      }
    })
    await t.test('preserves elongated anterior/posterior anatomy and a flatter inferior surface', () => {
      const bounds = geometry.nodes.boundingBox
      const width = bounds.max.x - bounds.min.x
      const height = bounds.max.y - bounds.min.y
      const length = bounds.max.z - bounds.min.z
      assert.ok(length / width > 1.2 && length / width < 1.45)
      assert.ok(height < width * .78)
      assert.ok(bounds.max.y > Math.abs(bounds.min.y))
      assert.ok(Math.abs(bounds.min.z) / bounds.max.z > .9)
    })
    await t.test('cortical triangles face outward and never bridge the two hemispheres', () => {
      const positions = geometry.cortex.attributes.position
      const normals = geometry.cortex.attributes.normal
      let outward = 0
      for (let i = 0; i < positions.count; i++) {
        const dot = positions.getX(i) * normals.getX(i) + positions.getY(i) * normals.getY(i) + positions.getZ(i) * normals.getZ(i)
        if (dot > 0) outward++
      }
      assert.ok(outward / positions.count > .99)
      const indices = geometry.cortex.index
      for (let i = 0; i < indices.count; i += 3) {
        const sign = Math.sign(positions.getX(indices.getX(i)))
        assert.equal(Math.sign(positions.getX(indices.getX(i + 1))), sign)
        assert.equal(Math.sign(positions.getX(indices.getX(i + 2))), sign)
      }
    })
    await t.test('all positions/normals/tangents are finite and every comet has a continuous normalized ribbon', () => {
      for (const mesh of [geometry.nodes, geometry.cortex, geometry.fibers, ...geometry.pathways]) {
        for (const attribute of Object.values(mesh.attributes)) {
          for (const number of attribute.array) assert.ok(Number.isFinite(number))
        }
        assert.ok(mesh.boundingSphere.radius > 0 && mesh.boundingSphere.radius < 2)
      }
      for (const pathway of geometry.pathways) {
        const along = pathway.attributes.aAlong
        assert.equal(along.getX(0), 0)
        assert.equal(along.getX(along.count - 1), 1)
        for (let i = 1; i < along.count; i++) assert.ok(along.getX(i) >= along.getX(i - 1))
        assert.equal(pathway.index.count, (192 - 1) * 6)
      }
    })
    await t.test('identical construction is deterministic across renders', () => {
      const second = createNeuralGeometry()
      try {
        assert.deepEqual(second.stats, geometry.stats)
        assert.deepEqual(second.nodes.attributes.position.array, geometry.nodes.attributes.position.array)
        assert.deepEqual(second.cortex.attributes.normal.array, geometry.cortex.attributes.normal.array)
      } finally {
        for (const mesh of [second.nodes, second.cortex, second.fibers, ...second.pathways]) mesh.dispose()
      }
    })
  } finally {
    for (const mesh of [geometry.nodes, geometry.cortex, geometry.fibers, ...geometry.pathways]) mesh.dispose()
  }
})
