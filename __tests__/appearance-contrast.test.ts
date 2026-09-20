import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'

type Rgb = [number, number, number]
const css = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8')

function rgb(hex: string): Rgb {
  return [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16) / 255) as Rgb
}

function palette(selector: string): Record<string, Rgb> {
  const colors: Record<string, Rgb> = {}
  // Read every exact selector in cascade order, including inherited root tokens.
  const selectors = new Set([':root', ...(selector.startsWith('html.dark') ? ['html.dark'] : []), ...(selector.includes('high-contrast') ? ['html.high-contrast'] : []), selector])
  for (const activeSelector of selectors) {
    for (const block of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (block[1].replace(/\/\*[\s\S]*?\*\//g, '').trim() !== activeSelector) continue
      for (const [, name, hex] of block[2].matchAll(/--([\w-]+):\s*#([a-f\d]{6});/gi)) colors[name] = rgb(hex)
    }
  }
  return colors
}

function luminance(color: Rgb): number {
  const linear = color.map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
}

function contrast(first: Rgb, second: Rgb): number {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

function tinted(accent: Rgb, surface: Rgb): Rgb {
  return [0, 1, 2].map(index => accent[index] * 0.12 + surface[index] * 0.88) as Rgb
}

describe.each([
  [':root', 4.5], ['html.dark', 4.5], ['html.high-contrast', 7], ['html.dark.high-contrast', 7],
] as const)('%s palette', (selector, threshold) => {
  const colors = palette(selector)

  it.each(['foreground', 'muted', 'accent', 'violet', 'success', 'danger'])('keeps %s text legible on every learning surface', text => {
    for (const surface of ['canvas', 'surface', 'surface-muted']) {
      expect(contrast(colors[text], colors[surface])).toBeGreaterThanOrEqual(threshold)
    }
  })

  it.each(['accent', 'violet', 'success', 'danger'])('keeps %s text legible on tinted selection/status backgrounds', text => {
    expect(contrast(colors[text], tinted(colors[text], colors.surface))).toBeGreaterThanOrEqual(threshold)
  })

  it('preserves contrast for filled actions, darkening hover states and visible control borders', () => {
    expect(contrast(colors['accent-foreground'], colors.accent)).toBeGreaterThanOrEqual(threshold)
    expect(contrast(colors['accent-foreground'], colors['accent-hover'])).toBeGreaterThanOrEqual(threshold)
    expect(luminance(colors['accent-hover'])).toBeLessThan(luminance(colors.accent))
    expect([rgb('ffffff'), rgb('0f172a')]).toContainEqual(colors['accent-foreground'])
    expect(contrast(colors.surface, colors.violet)).toBeGreaterThanOrEqual(threshold)
    expect(contrast(colors.surface, colors.success)).toBeGreaterThanOrEqual(threshold)
    for (const surface of ['canvas', 'surface', 'surface-muted']) {
      expect(contrast(colors.border, colors[surface])).toBeGreaterThanOrEqual(3)
    }
  })

  it('keeps accent chips and warning messages readable', () => {
    expect(contrast(colors.accent, colors['accent-soft'])).toBeGreaterThanOrEqual(threshold)
    expect(contrast(colors['warning-foreground'], colors.warning)).toBeGreaterThanOrEqual(4.5)
  })
})

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(path) : /\.(tsx?|css)$/.test(path) ? [path] : []
  })
}

/** Literal branches are checked separately, so a disabled gray button is not
 * mistaken for the enabled orange branch. Theme/state prefixes remain paired. */
function forbiddenOrangeText(classes: string): string[] {
  const tokens = classes.split(/\s+/)
  const violations: string[] = []
  for (const token of tokens) {
    const bg = token.match(/^((?:[\w-]+:)*)(?:bg-orange-\d{2,3}|bg-\[var\(--(?:accent|accent-hover|primary-orange)\)\])$/)
    if (!bg) continue
    const variant = bg[1]
    const colors = tokens.flatMap(value => {
      const match = value.match(/^((?:[\w-]+:)*)(text-(?:white|black|(?:gray|slate|zinc|neutral|stone|orange|red|blue|green|amber|violet)-\d{2,3}|\[(?:#[\da-fA-F]+|var\(--[\w-]+\))\]))(?:\/\d+)?$/)
      return match ? [{ variant: match[1], color: match[2] }] : []
    })
    const matching = colors.filter(color => color.variant === variant)
    const applied = matching.length ? matching : colors.filter(color => color.variant === '')
    for (const { color } of applied) {
      if (!/^text-(?:white|\[#(?:ffffff|0f172a)\]|\[var\(--accent-foreground\)\])$/i.test(color)) violations.push(token + ' ' + color)
    }
  }
  return violations
}

it('detects forbidden gray and arbitrary text colors on orange in normal and state variants', () => {
  expect(forbiddenOrangeText('bg-[var(--accent)] text-gray-500')).toHaveLength(1)
  expect(forbiddenOrangeText('dark:bg-[var(--accent)] dark:text-slate-300')).toHaveLength(1)
  expect(forbiddenOrangeText('bg-orange-500 text-[#23150e]')).toHaveLength(1)
  expect(forbiddenOrangeText('bg-[var(--accent)] text-[var(--accent-foreground)]')).toEqual([])
  expect(forbiddenOrangeText('bg-white text-gray-500 dark:bg-[var(--accent)] dark:text-[#0F172A]')).toEqual([])
})

it('uses shared orange tokens and permitted foregrounds throughout application sources', () => {
  const violations: string[] = []
  for (const file of ['app', 'components', 'lib'].flatMap(directory => sourceFiles(resolve(process.cwd(), directory)))) {
    const source = readFileSync(file, 'utf8')
    if (/#(?:FF5C00|FF7A33|FFF4EC)\b/i.test(source)) violations.push(`${file}: hardcoded orange`)
    if (file.endsWith('.css')) continue
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    const visit = (node: ts.Node) => {
      if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
        for (const violation of forbiddenOrangeText(node.text)) violations.push(`${file}:${tree.getLineAndCharacterOfPosition(node.pos).line + 1}: ${violation}`)
      }
      ts.forEachChild(node, visit)
    }
    visit(tree)
  }
  expect(violations).toEqual([])
})
