import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import ThemeToggle from '@/components/layout/ThemeToggle'
import { AppearanceProvider } from '@/components/layout/AppearanceProvider'
import ProfileAppearanceSettings from '@/components/dashboard/ProfileAppearanceSettings'
import { ThemeInit } from '@/components/effects/ThemeInit'
import {
  applyContrast, CONTRAST_STORAGE_KEY, getPreferredContrast, getPreferredTheme,
  setContrastPreference, setThemePreference, syncAppearanceFromStorage, THEME_BOOTSTRAP_SCRIPT,
} from '@/lib/theme'
import de from '@/dictionaries/de.json'
import en from '@/dictionaries/en.json'
import ru from '@/dictionaries/ru.json'
import uk from '@/dictionaries/uk.json'
import tr from '@/dictionaries/tr.json'

jest.unmock('lucide-react')

const mediaChanges = new Map<string, EventListener>()
function systemPreferences(dark = false, contrast = false) {
  jest.mocked(window.matchMedia).mockImplementation((query: string): MediaQueryList => ({
    matches: query === '(prefers-color-scheme: dark)' ? dark : contrast,
    media: query, onchange: null, addListener: jest.fn(), removeListener: jest.fn(),
    addEventListener: jest.fn((event: string, listener: EventListenerOrEventListenerObject) => {
      if (event === 'change' && typeof listener === 'function') mediaChanges.set(query, listener)
    }),
    removeEventListener: jest.fn(), dispatchEvent: jest.fn(),
  }))
}

beforeEach(() => {
  jest.restoreAllMocks()
  mediaChanges.clear()
  localStorage.clear()
  document.documentElement.className = ''
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('data-contrast')
  document.head.innerHTML = '<meta name="theme-color" content="#ffffff">'
  systemPreferences()
  syncAppearanceFromStorage(null)
})

it.each(['light', 'dark'] as const)('applies saved high contrast with %s before the first paint', theme => {
  localStorage.setItem('theme', theme)
  localStorage.setItem(CONTRAST_STORAGE_KEY, 'high')
  new Function(THEME_BOOTSTRAP_SCRIPT)()
  expect(document.documentElement.dataset).toMatchObject({ theme, contrast: 'high' })
  expect(document.documentElement.classList.contains('high-contrast')).toBe(true)
  expect(document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content).toBe(theme === 'dark' ? '#000000' : '#ffffff')
})

it('defaults to the device contrast preference and honors an explicit standard override', () => {
  systemPreferences(false, true)
  new Function(THEME_BOOTSTRAP_SCRIPT)()
  expect(getPreferredContrast()).toBe('high')
  expect(document.documentElement.classList.contains('high-contrast')).toBe(true)
  localStorage.setItem(CONTRAST_STORAGE_KEY, 'standard')
  new Function(THEME_BOOTSTRAP_SCRIPT)()
  expect(getPreferredContrast()).toBe('standard')
  expect(document.documentElement.classList.contains('high-contrast')).toBe(false)
})

it('uses device contrast despite invalid storage values or blocked storage', () => {
  systemPreferences(true, true)
  localStorage.setItem(CONTRAST_STORAGE_KEY, 'invalid')
  new Function(THEME_BOOTSTRAP_SCRIPT)()
  expect(getPreferredContrast()).toBe('high')
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('unavailable') })
  expect(() => new Function(THEME_BOOTSTRAP_SCRIPT)()).not.toThrow()
  expect(document.documentElement.dataset).toMatchObject({ theme: 'dark', contrast: 'high' })
})

it('preserves explicit in-tab choices when storage is blocked and device settings change', () => {
  systemPreferences(true, true)
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('unavailable') })
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('unavailable') })
  setThemePreference('light')
  setContrastPreference('standard')
  render(<ThemeInit />)
  act(() => {
    mediaChanges.get('(prefers-color-scheme: dark)')?.(new Event('change'))
    mediaChanges.get('(prefers-contrast: more)')?.(new Event('change'))
  })
  expect(getPreferredTheme()).toBe('light')
  expect(getPreferredContrast()).toBe('standard')
  expect(document.documentElement.dataset).toMatchObject({ theme: 'light', contrast: 'standard' })
})

it('syncs only the preference changed in another tab, and handles clearing preferences', () => {
  render(<ThemeInit />)
  act(() => { setThemePreference('dark'); setContrastPreference('high') })
  localStorage.setItem(CONTRAST_STORAGE_KEY, 'standard')
  fireEvent(window, new StorageEvent('storage', { key: 'unrelated' }))
  expect(document.documentElement.dataset.contrast).toBe('high')
  fireEvent(window, new StorageEvent('storage', { key: CONTRAST_STORAGE_KEY }))
  expect(document.documentElement.dataset).toMatchObject({ theme: 'dark', contrast: 'standard' })
  localStorage.clear()
  fireEvent(window, new StorageEvent('storage', { key: null }))
  expect(document.documentElement.dataset).toMatchObject({ theme: 'light', contrast: 'standard' })
})

it('changes color scheme without losing the independent contrast preference', () => {
  setContrastPreference('high')
  setThemePreference('dark')
  expect(document.documentElement.dataset).toMatchObject({ theme: 'dark', contrast: 'high' })
  setThemePreference('light')
  expect(document.documentElement.dataset).toMatchObject({ theme: 'light', contrast: 'high' })
  applyContrast('standard')
  expect(document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content).toBe('#f7f5ef')
})

it.each([de, en, ru, uk, tr])('supplies localized readable controls in every supported language', dictionary => {
  expect(Object.keys(dictionary.accessibility).sort()).toEqual(Object.keys(de.accessibility).sort())
  render(<AppearanceProvider copy={dictionary.accessibility}><ProfileAppearanceSettings /></AppearanceProvider>)
  const toggle = screen.getByRole('switch', { name: dictionary.accessibility.contrast })
  expect(toggle).toHaveAttribute('aria-checked', 'false')
  fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-checked', 'true')
  expect(localStorage.getItem(CONTRAST_STORAGE_KEY)).toBe('high')
  fireEvent.click(screen.getByRole('button', { name: dictionary.accessibility.dark }))
  expect(document.documentElement.dataset).toMatchObject({ theme: 'dark', contrast: 'high' })
})

it('opens one appearance dialog, retains focus while choosing and restores focus on Escape', () => {
  render(<ThemeToggle lightLabel={de.dashboard.toggle_theme_light} darkLabel={de.dashboard.toggle_theme_dark} />)
  const trigger = screen.getByRole('button', { name: de.accessibility.title })
  fireEvent.click(trigger)
  expect(screen.getByRole('dialog', { name: de.accessibility.title })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: de.dashboard.toggle_theme_light })).toHaveFocus()
  fireEvent.click(screen.getByRole('switch', { name: de.accessibility.contrast }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  fireEvent.keyDown(screen.getByRole('switch'), { key: 'Escape' })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
})

it('dismisses outside the dialog and follows the device again after reset', () => {
  systemPreferences(true, true)
  setThemePreference('light')
  setContrastPreference('standard')
  render(<ThemeToggle lightLabel={de.dashboard.toggle_theme_light} darkLabel={de.dashboard.toggle_theme_dark} />)
  const trigger = screen.getByRole('button', { name: de.accessibility.title })
  fireEvent.click(trigger)
  fireEvent.click(screen.getByRole('button', { name: de.accessibility.system }))
  expect(document.documentElement.dataset).toMatchObject({ theme: 'dark', contrast: 'high' })
  expect(localStorage.getItem('theme')).toBeNull()
  expect(localStorage.getItem(CONTRAST_STORAGE_KEY)).toBeNull()
  fireEvent.pointerDown(document.body)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
