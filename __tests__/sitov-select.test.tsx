import React, { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import SitovSelect, { type SitovSelectOption } from '@/components/ui/SitovSelect'

jest.unmock('lucide-react')

const sitovOptions: SitovSelectOption[] = [
  { value: '', label: 'Choose an answer' },
  { value: 'a', label: 'A · Anmeldung', lang: 'de', translate: 'no' },
  { value: 'b', label: 'B · Beratung', disabled: true, lang: 'de', translate: 'no' },
  { value: 'c', label: 'C · Café', lang: 'de', translate: 'no' },
]

function SitovSelectHarness({ initial = '', disabled = false, onChange = jest.fn() }: {
  initial?: string
  disabled?: boolean
  onChange?: (value: string) => void
}) {
  const [value, setValue] = useState(initial)
  return <>
    <label id="sitov-question-label" htmlFor="sitov-question-select">Your answer</label>
    <SitovSelect id="sitov-question-select" labelId="sitov-question-label" value={value}
      placeholder="Choose an answer" lang="en" disabled={disabled} options={sitovOptions}
      onChange={next => { setValue(next); onChange(next) }} />
    <button type="button">Next task</button>
  </>
}

function sitovActiveOption() {
  const id = screen.getByRole('combobox').getAttribute('aria-activedescendant')
  return id ? document.getElementById(id) : null
}

it('supports keyboard selection without changing the answer during navigation and skips unavailable answers', () => {
  const change = jest.fn()
  render(<SitovSelectHarness onChange={change} />)
  const field = screen.getByRole('combobox', { name: 'Your answer' })
  field.focus()
  fireEvent.keyDown(field, { key: 'ArrowDown' })
  expect(field).toHaveFocus()
  expect(field).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByRole('listbox')).toHaveAccessibleName('Your answer')
  fireEvent.keyDown(field, { key: 'ArrowDown' })
  expect(sitovActiveOption()).toHaveTextContent('A · Anmeldung')
  fireEvent.keyDown(field, { key: 'ArrowDown' })
  expect(sitovActiveOption()).toHaveTextContent('C · Café')
  expect(change).not.toHaveBeenCalled()
  fireEvent.keyDown(field, { key: 'Enter' })
  expect(change).toHaveBeenCalledWith('c')
  expect(field).toHaveTextContent('C · Café')
  expect(field).toHaveFocus()
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
})

it('supports Home, End and Space and opens upwards navigation at the final available answer', () => {
  render(<SitovSelectHarness />)
  const field = screen.getByRole('combobox')
  fireEvent.keyDown(field, { key: 'End' })
  expect(sitovActiveOption()).toHaveTextContent('C · Café')
  fireEvent.keyDown(field, { key: 'Home' })
  expect(sitovActiveOption()).toHaveTextContent('Choose an answer')
  fireEvent.keyDown(field, { key: 'ArrowUp' })
  expect(sitovActiveOption()).toHaveTextContent('C · Café')
  fireEvent.keyDown(field, { key: ' ' })
  expect(field).toHaveTextContent('C · Café')
  expect(field).toHaveAttribute('aria-expanded', 'false')
})

it('keeps an existing unavailable answer visible but prevents choosing a duplicate used elsewhere', () => {
  const change = jest.fn()
  render(<SitovSelectHarness initial="b" onChange={change} />)
  const field = screen.getByRole('combobox')
  expect(field).toHaveTextContent('B · Beratung')
  fireEvent.click(field)
  const unavailable = screen.getByRole('option', { name: 'B · Beratung' })
  expect(unavailable).toHaveAttribute('aria-selected', 'true')
  expect(unavailable).toHaveAttribute('aria-disabled', 'true')
  fireEvent.click(unavailable)
  expect(change).not.toHaveBeenCalled()
  expect(field).toHaveAttribute('aria-expanded', 'true')
  fireEvent.keyDown(field, { key: 'End' })
  fireEvent.keyDown(field, { key: 'Enter' })
  expect(change).toHaveBeenCalledWith('c')
})

it('dismisses with Escape, Tab, focus changes and outside pointer interaction without committing the highlighted answer', () => {
  const change = jest.fn()
  render(<SitovSelectHarness onChange={change} />)
  const field = screen.getByRole('combobox')
  field.focus()
  fireEvent.click(field)
  fireEvent.keyDown(field, { key: 'End' })
  fireEvent.keyDown(field, { key: 'Escape' })
  expect(field).toHaveFocus()
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  fireEvent.click(field)
  const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
  fireEvent(field, tab)
  expect(tab.defaultPrevented).toBe(false)
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  fireEvent.click(field)
  fireEvent.blur(field, { relatedTarget: screen.getByRole('button', { name: 'Next task' }) })
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  fireEvent.click(field)
  fireEvent.pointerDown(document.body)
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  expect(change).not.toHaveBeenCalled()
})

it('searches option labels by typing and ignores unavailable matches', () => {
  const change = jest.fn()
  render(<SitovSelectHarness onChange={change} />)
  const field = screen.getByRole('combobox')
  fireEvent.keyDown(field, { key: 'c' })
  // The first matching enabled label is the placeholder; repeated keys cycle.
  expect(sitovActiveOption()).toHaveTextContent('Choose an answer')
  fireEvent.keyDown(field, { key: 'c' })
  expect(sitovActiveOption()).toHaveTextContent('C · Café')
  fireEvent.keyDown(field, { key: 'Enter' })
  expect(change).toHaveBeenCalledWith('c')
  fireEvent.keyDown(field, { key: 'b' })
  expect(sitovActiveOption()).toHaveTextContent('C · Café')
  expect(screen.getByRole('option', { name: 'B · Beratung' })).toHaveAttribute('aria-disabled', 'true')
})

it('keeps a multi-letter search started while closed so typing finds the full answer', () => {
  render(<SitovSelect value="" placeholder="Choose" aria-label="Your answer" options={[
    { value: 'a', label: 'Anton' }, { value: 'b', label: 'Boris' }, { value: 'c', label: 'Ben' },
  ]} onChange={jest.fn()} />)
  const field = screen.getByRole('combobox')
  fireEvent.keyDown(field, { key: 'b' })
  expect(sitovActiveOption()).toHaveTextContent('Boris')
  fireEvent.keyDown(field, { key: 'e' })
  expect(sitovActiveOption()).toHaveTextContent('Ben')
})

it('preserves German answer content and the English placeholder language through the portal', () => {
  const { container } = render(<SitovSelectHarness />)
  const field = screen.getByRole('combobox')
  const placeholder = screen.getByText('Choose an answer')
  expect(field).toHaveAttribute('lang', 'en')
  expect(placeholder).not.toHaveAttribute('lang', 'de')
  expect(placeholder).not.toHaveAttribute('translate', 'no')
  fireEvent.click(field)
  const listbox = screen.getByRole('listbox')
  expect(listbox).toHaveAttribute('lang', 'en')
  expect(container).not.toContainElement(listbox)
  const answer = screen.getByRole('option', { name: 'A · Anmeldung' })
  expect(answer).toHaveAttribute('lang', 'de')
  expect(answer).toHaveAttribute('translate', 'no')
  fireEvent.click(answer)
  const chosen = screen.getByText('A · Anmeldung')
  expect(chosen).toHaveAttribute('lang', 'de')
  expect(chosen).toHaveAttribute('translate', 'no')
})

it('clamps the popover to a narrow viewport and moves it above a trigger near the bottom on resize', () => {
  render(<SitovSelectHarness />)
  const field = screen.getByRole('combobox')
  let rect = { top: 20, bottom: 68, left: 250, right: 430, width: 180, height: 48 }
  jest.spyOn(field, 'getBoundingClientRect').mockImplementation(() => ({ ...rect, x: rect.left, y: rect.top, toJSON: () => rect }))
  const initialWidth = window.innerWidth
  const initialHeight = window.innerHeight
  Object.defineProperty(window, 'innerWidth', { value: 320, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true })
  try {
    fireEvent.click(field)
    const listbox = screen.getByRole('listbox')
    expect(listbox).toHaveStyle({ width: '240px', left: '72px', top: '76px' })
    rect = { ...rect, top: 540, bottom: 588 }
    fireEvent.resize(window)
    expect(listbox).toHaveAttribute('data-placement', 'above')
    expect(parseFloat(listbox.style.top)).toBeLessThan(rect.top)
    expect(parseFloat(listbox.style.top)).toBeGreaterThanOrEqual(8)
  } finally {
    Object.defineProperty(window, 'innerWidth', { value: initialWidth, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: initialHeight, configurable: true })
  }
})

it('locks an open control immediately and keeps it closed when the task becomes editable again', () => {
  const change = jest.fn()
  const view = render(<SitovSelectHarness onChange={change} />)
  const field = screen.getByRole('combobox')
  fireEvent.click(field)
  expect(screen.getByRole('listbox')).toBeInTheDocument()
  view.rerender(<SitovSelectHarness disabled onChange={change} />)
  expect(field).toBeDisabled()
  expect(field).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  view.rerender(<SitovSelectHarness onChange={change} />)
  expect(field).toHaveAttribute('aria-expanded', 'false')
  expect(change).not.toHaveBeenCalled()
})
