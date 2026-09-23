import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Weiß auf orange-500 (--accent) hat nur 2,8 : 1 und fällt durch WCAG AA.
// Texttragende Füllungen im Lernbildschirm müssen --accent-strong nutzen —
// wie der Start-Knopf der Lernbox (siehe globals.css, Phase 5.7).
const css = readFileSync(join(__dirname, '../components/vocabulary/learning.css'), 'utf8')

it('füllt den Hauptknopf im Lernbildschirm mit --accent-strong, nie mit orange-500', () => {
  expect(css).toMatch(/--learn-fill:\s*var\(--accent-strong\)/)
  const rule = css.match(/\.learning-button-primary\s*\{([^}]*)\}/)?.[1] ?? ''
  expect(rule).toMatch(/background:\s*var\(--learn-fill\)/)
  expect(rule).not.toMatch(/var\(--learn-accent\)/)
})

it('legt Text nie direkt auf die helle Akzentfarbe', () => {
  for (const [, body] of css.matchAll(/\{([^}]*)\}/g)) {
    if (/background:\s*var\(--learn-accent\)/.test(body)) expect(body).not.toMatch(/(^|[\s;])color:/)
  }
})
