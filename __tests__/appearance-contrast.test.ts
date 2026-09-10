import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type Rgb = [number, number, number]
const css = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8')

function palette(selector: string): Record<string, Rgb> {
  const start = css.indexOf(`${selector} {`)
  const block = css.slice(start, css.indexOf('}', start))
  return Object.fromEntries(Array.from(block.matchAll(/--([\w-]+):\s*#([a-f\d]{6});/gi), ([, name, hex]) => {
    const channel = (index: number) => parseInt(hex.slice(index, index + 2), 16) / 255
    const rgb: Rgb = [channel(0), channel(2), channel(4)]
    return [name, rgb]
  }))
}

function luminance(rgb: Rgb): number {
  const linear = rgb.map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
}

function contrast(first: Rgb, second: Rgb): number {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

function tinted(accent: Rgb, surface: Rgb): Rgb {
  return [0, 1, 2].map(index => accent[index] * 0.12 + surface[index] * 0.88) as Rgb
}

// WCAG enhanced text contrast. This covers the shared palette, not a claim
// of site-wide conformance: https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html
describe.each(['html.high-contrast', 'html.dark.high-contrast'])('%s palette', selector => {
  const colors = palette(selector)

  it.each(['foreground', 'muted', 'accent', 'violet', 'success', 'danger'])('keeps %s text at least 7:1 on learning surfaces', text => {
    for (const surface of ['canvas', 'surface', 'surface-muted']) {
      expect(contrast(colors[text], colors[surface])).toBeGreaterThanOrEqual(7)
    }
  })

  it.each(['accent', 'violet', 'success', 'danger'])('keeps %s text legible on tinted selection/status backgrounds', text => {
    expect(contrast(colors[text], tinted(colors[text], colors.surface))).toBeGreaterThanOrEqual(7)
  })

  it('preserves contrast for filled actions and visible control borders', () => {
    expect(contrast(colors['accent-foreground'], colors.accent)).toBeGreaterThanOrEqual(7)
    expect(contrast(colors.surface, colors.violet)).toBeGreaterThanOrEqual(7)
    expect(contrast(colors.surface, colors.success)).toBeGreaterThanOrEqual(7)
    for (const surface of ['canvas', 'surface', 'surface-muted']) {
      expect(contrast(colors.border, colors[surface])).toBeGreaterThanOrEqual(3)
    }
  })
})
