import { spawnSync } from 'node:child_process'
import curriculum from '@/supabase/seeds/grammar-curriculum-2026.json'

function generate(records: unknown[]) {
  return spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { readFileSync } from 'node:fs'
    import { grammarSeedSql } from './scripts/lib/grammar-seed.mjs'
    try { process.stdout.write(grammarSeedSql(JSON.parse(readFileSync(0, 'utf8')))) }
    catch (error) { process.stderr.write(error.message); process.exitCode = 1 }
  `], { cwd: process.cwd(), input: JSON.stringify(records), encoding: 'utf8' })
}

it('rejects the historical manuscript before emitting import SQL', () => {
  const result = generate(curriculum)
  expect(result.status).toBe(1)
  expect(result.stderr).toMatch(/target_form requires explicitly authored/)
  expect(result.stdout).toBe('')
})

it.each([[], [''], [' '], [null], ['sein', 1]].map(target_form => ({ target_form })))('rejects invalid authored seed targets $target_form', ({ target_form }) => {
  const result = generate([{ ...curriculum[0], content: { ...curriculum[0].content, target_form } }])
  expect(result.status).toBe(1)
  expect(result.stderr).toMatch(/target_form/)
})

it('retains explicitly authored target forms in canonical import SQL', () => {
  const row = { id: '00000000-0000-4000-8000-000000000001', level: 'A1.1', lesson: '01', topic: 'Vorstellung', type: 'fill_in_blank',
    content: { text_before: 'Ich ', text_after: ' Anna.', correct_answer: 'heiße', target_form: ['heißen'] } }
  const result = generate([row])
  expect(result.status).toBe(0)
  expect(result.stdout).toContain('"target_form":["heißen"]')
})
