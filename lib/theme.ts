export type AcademyTheme = 'light' | 'dark'
export type AcademyContrast = 'standard' | 'high'
export type ThemePreference = AcademyTheme | 'system'
export type ContrastPreference = AcademyContrast | 'system'

export const THEME_STORAGE_KEY = 'theme'
export const CONTRAST_STORAGE_KEY = 'academy-contrast'
export const APPEARANCE_CHANGE_EVENT = 'academy:appearance-change'

// Keep explicit choices working in this tab even when browser storage is blocked.
let inTabTheme: ThemePreference | undefined
let inTabContrast: ContrastPreference | undefined

function readPreference(key: string): string | null {
  try { return window.localStorage.getItem(key) }
  catch { return null }
}

export function getThemePreference(): ThemePreference {
  if (inTabTheme) return inTabTheme
  const saved = readPreference(THEME_STORAGE_KEY)
  return saved === 'light' || saved === 'dark' ? saved : 'system'
}

export function getContrastPreference(): ContrastPreference {
  if (inTabContrast) return inTabContrast
  const saved = readPreference(CONTRAST_STORAGE_KEY)
  return saved === 'standard' || saved === 'high' ? saved : 'system'
}

export function getPreferredTheme(): AcademyTheme {
  const preference = getThemePreference()
  return preference === 'system'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    : preference
}

export function getPreferredContrast(): AcademyContrast {
  const preference = getContrastPreference()
  return preference === 'system'
    ? window.matchMedia('(prefers-contrast: more)').matches ? 'high' : 'standard'
    : preference
}

function updateBrowserChrome() {
  const root = document.documentElement
  const dark = root.dataset.theme === 'dark'
  const high = root.dataset.contrast === 'high'
  root.style.colorScheme = dark ? 'dark' : 'light'
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(meta => {
    meta.content = high ? dark ? '#000000' : '#ffffff' : dark ? '#121417' : '#f7f5ef'
    meta.removeAttribute('media')
  })
  window.dispatchEvent(new Event(APPEARANCE_CHANGE_EVENT))
}

export function applyTheme(theme: AcademyTheme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.dataset.theme = theme
  updateBrowserChrome()
}

export function applyContrast(contrast: AcademyContrast) {
  const root = document.documentElement
  root.classList.toggle('high-contrast', contrast === 'high')
  root.dataset.contrast = contrast
  updateBrowserChrome()
}

function persistPreference(key: string, value: string) {
  try {
    if (value === 'system') window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch { /* The in-tab preference remains active. */ }
}

export function setThemePreference(preference: ThemePreference) {
  inTabTheme = preference
  persistPreference(THEME_STORAGE_KEY, preference)
  applyTheme(getPreferredTheme())
}

export function setContrastPreference(preference: ContrastPreference) {
  inTabContrast = preference
  persistPreference(CONTRAST_STORAGE_KEY, preference)
  applyContrast(getPreferredContrast())
}

/** Storage events only replace the preference changed in the other tab. */
export function syncAppearanceFromStorage(key: string | null) {
  if (key === null || key === THEME_STORAGE_KEY) {
    inTabTheme = undefined
    applyTheme(getPreferredTheme())
  }
  if (key === null || key === CONTRAST_STORAGE_KEY) {
    inTabContrast = undefined
    applyContrast(getPreferredContrast())
  }
}

/** Parser-blocking head script: resolve both preferences before the first paint. */
export const THEME_BOOTSTRAP_SCRIPT = `(()=>{let theme,contrast;try{theme=localStorage.getItem('theme');contrast=localStorage.getItem('academy-contrast')}catch{}if(theme!=='dark'&&theme!=='light'){theme=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}if(contrast!=='high'&&contrast!=='standard'){contrast=window.matchMedia('(prefers-contrast: more)').matches?'high':'standard'}const root=document.documentElement;root.classList.toggle('dark',theme==='dark');root.classList.toggle('high-contrast',contrast==='high');root.dataset.theme=theme;root.dataset.contrast=contrast;root.style.colorScheme=theme;document.querySelectorAll('meta[name="theme-color"]').forEach(meta=>{meta.content=contrast==='high'?(theme==='dark'?'#000000':'#ffffff'):(theme==='dark'?'#121417':'#f7f5ef');meta.removeAttribute('media')})})();`
