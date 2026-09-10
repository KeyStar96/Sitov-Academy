export type AcademyTheme = 'light' | 'dark'

export function getPreferredTheme(): AcademyTheme {
  try {
    const saved = window.localStorage.getItem('theme')
    if (saved === 'dark' || saved === 'light') return saved
  } catch { /* System preference also works when browser storage is unavailable. */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: AcademyTheme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.dataset.theme = theme
  root.style.colorScheme = theme
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(meta => {
    meta.content = theme === 'dark' ? '#121417' : '#f7f5ef'
    meta.removeAttribute('media')
  })
}

/** Parser-blocking head script: the same preference is applied before the first paint. */
export const THEME_BOOTSTRAP_SCRIPT = `(()=>{let theme;try{theme=localStorage.getItem('theme')}catch{}if(theme!=='dark'&&theme!=='light'){theme=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}const root=document.documentElement;root.classList.toggle('dark',theme==='dark');root.dataset.theme=theme;root.style.colorScheme=theme;document.querySelectorAll('meta[name="theme-color"]').forEach(meta=>{meta.content=theme==='dark'?'#121417':'#f7f5ef';meta.removeAttribute('media')})})();`
