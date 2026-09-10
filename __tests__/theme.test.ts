import { applyTheme, getPreferredTheme, THEME_BOOTSTRAP_SCRIPT } from '@/lib/theme'

function systemTheme(dark: boolean) {
  jest.mocked(window.matchMedia).mockImplementation((query: string): MediaQueryList => ({
    matches: dark, media: query, onchange: null,
    addListener: jest.fn(), removeListener: jest.fn(),
    addEventListener: jest.fn(), removeEventListener: jest.fn(), dispatchEvent: jest.fn(),
  }))
}

beforeEach(() => {
  jest.restoreAllMocks()
  localStorage.clear()
  document.documentElement.className = ''
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('style')
  document.head.innerHTML = '<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">'
  systemTheme(false)
})

it.each(['light', 'dark'] as const)('applies saved %s before hydration, independently of the system preference', theme => {
  systemTheme(theme !== 'dark')
  localStorage.setItem('theme', theme)
  new Function(THEME_BOOTSTRAP_SCRIPT)()
  expect(document.documentElement.dataset.theme).toBe(theme)
  expect(document.documentElement.classList.contains('dark')).toBe(theme === 'dark')
  expect(document.documentElement.style.colorScheme).toBe(theme)
  expect(getPreferredTheme()).toBe(theme)
})

it('uses the dark system theme when no explicit selection exists', () => {
  systemTheme(true)
  new Function(THEME_BOOTSTRAP_SCRIPT)()
  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(getPreferredTheme()).toBe('dark')
})

it('still initializes dark mode when browser storage is blocked', () => {
  systemTheme(true)
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('storage unavailable') })
  expect(() => new Function(THEME_BOOTSTRAP_SCRIPT)()).not.toThrow()
  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(getPreferredTheme()).toBe('dark')
})

it('ignores unsupported stored values and follows the system preference', () => {
  systemTheme(true)
  localStorage.setItem('theme', 'unsupported')
  new Function(THEME_BOOTSTRAP_SCRIPT)()
  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(getPreferredTheme()).toBe('dark')
})

it('updates native controls and browser chrome with an in-tab theme change', () => {
  applyTheme('dark')
  expect(document.documentElement.classList.contains('dark')).toBe(true)
  expect(document.documentElement.style.colorScheme).toBe('dark')
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  expect(meta?.content).toBe('#121417')
  expect(meta?.hasAttribute('media')).toBe(false)
  applyTheme('light')
  expect(document.documentElement.classList.contains('dark')).toBe(false)
  expect(document.documentElement.dataset.theme).toBe('light')
  expect(meta?.content).toBe('#f7f5ef')
})
