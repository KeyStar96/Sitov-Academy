import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { sitovQuestSettings } from './lib/sitov-daily-quest-settings.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const provenance = JSON.parse(await readFile(`${root}content/daily-quests/sitov-scenes-provenance.json`, 'utf8'))
assert.equal(provenance.tool, 'built-in image_gen')
assert.equal(provenance.scenes.length, Object.keys(sitovQuestSettings).length)
const reference = await readFile(`${root}${provenance.reference.path}`)
assert.equal(createHash('sha256').update(reference).digest('hex'), provenance.reference.sha256)

for (const setting of Object.keys(sitovQuestSettings)) {
  const scenes = provenance.scenes.filter(scene => scene.setting === setting)
  assert.equal(scenes.length, 1, `${setting}: exactly one reviewed scene`)
  const scene = scenes[0]
  assert.equal(scene.assetPath, `public/Bilder/deutschreise/sitov-${setting}.png`)
  assert.ok(scene.prompt.length > 100, `${setting}: generation prompt recorded`)
  assert.ok(scene.review, `${setting}: visual review recorded`)
  const bytes = await readFile(`${root}${scene.assetPath}`)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), scene.sha256, `${setting}: reviewed asset unchanged`)
  const metadata = await sharp(bytes).metadata()
  assert.equal(metadata.format, 'png', `${setting}: PNG asset`)
  assert.ok(metadata.width >= 1536 && metadata.height >= 1024, `${setting}: reference resolution or better`)
  assert.ok(metadata.width > metadata.height, `${setting}: landscape composition`)
}
console.log('Sitov Academy: all 20 reviewed Imagegen scenes match the provenance manifest.')
