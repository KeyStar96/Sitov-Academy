/** Prepare only the frozen universal-exam hearing catalogue through the shared audio contract. */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { bundleSitovAudio, collectSitovAudioCatalog, missingSitovAudioCatalog } from './sitov-audio-catalog'

function argument(name: string) {
  const index = process.argv.indexOf(name)
  const value = index < 0 ? undefined : process.argv[index + 1]
  if (index >= 0 && (!value || value.startsWith('--'))) throw new Error(`Missing ${name} filename`)
  return value
}

export function runSitovSimulationAudio() {
  const exportFile = argument('--export')
  if (!exportFile) throw new Error('Use --export fresh-storage-inventory.json --output missing.json --full-output complete.json; add --manifest prepared/sitov-qwen-manifest.json --bundle bundle-directory after local synthesis.')
  const manifestFile = resolve(__dirname, '../content/exam-simulation/sitov-universal-audio-manifest.json')
  const inventory = JSON.parse(readFileSync(resolve(exportFile), 'utf8'))
  const full = collectSitovAudioCatalog({ counts: {} }, {}, {}, undefined, { authoredTextFiles: [{ name: manifestFile, value: JSON.parse(readFileSync(manifestFile, 'utf8')) }] })
  const missing = missingSitovAudioCatalog(full, inventory.storage_audio_inventory)
  const output = argument('--output'), fullOutput = argument('--full-output')
  if (output) writeFileSync(resolve(output), `${JSON.stringify(missing, null, 2)}\n`, { mode: 0o600 })
  if (fullOutput) writeFileSync(resolve(fullOutput), `${JSON.stringify(full, null, 2)}\n`, { mode: 0o600 })
  const prepared = argument('--manifest'), destination = argument('--bundle')
  if (prepared && destination) {
    if (!missing.rows.length) throw new Error('All frozen exam audios are present; skip generation and bundle, and audit the existing storage objects.')
    bundleSitovAudio(missing, JSON.parse(readFileSync(resolve(prepared), 'utf8')), resolve(destination), dirname(resolve(prepared)))
  }
  return { completeTexts: full.rows.length, missingTexts: missing.rows.length, reusedTexts: missing.reusedStorageRows.length, spokenCharacters: full.rows.reduce((sum, row) => sum + row.text.length, 0), invalidExistingPaths: missing.inventoryCoverage.invalidExistingPaths.length, profileFingerprint: full.profileFingerprint }
}

if (require.main === module) {
  try { console.log(JSON.stringify(runSitovSimulationAudio())) }
  catch (error) { console.error(error instanceof Error ? error.message : 'Audio preparation failed'); process.exitCode = 1 }
}
