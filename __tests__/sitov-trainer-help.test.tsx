import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderToStaticMarkup } from 'react-dom/server.node'
import Link from 'next/link'
import SitovTrainerHelp from '@/components/motion/SitovTrainerHelp'

jest.unmock('lucide-react')
jest.unmock('framer-motion')

beforeAll(() => { window.PointerEvent = MouseEvent as typeof PointerEvent })

it('uses a named native disclosure button and exposes only the requested rules', async () => {
  const user = userEvent.setup()
  render(<SitovTrainerHelp title="Lernbox verstehen"><p>Diese Regeln gehören zum Trainer.</p></SitovTrainerHelp>)
  const toggle = screen.getByRole('button', { name: 'Lernbox verstehen' })
  expect(toggle.tagName).toBe('BUTTON')
  expect(toggle).toHaveAttribute('type', 'button')
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('region')).not.toBeInTheDocument()

  await user.tab()
  expect(toggle).toHaveFocus()
  await user.keyboard('{Enter}')
  const panel = screen.getByRole('region', { name: 'Lernbox verstehen' })
  expect(toggle).toHaveAttribute('aria-controls', panel.id)
  expect(panel).toHaveAttribute('aria-labelledby', toggle.id)
  expect(panel).toHaveTextContent('Diese Regeln gehören zum Trainer.')
  await user.keyboard(' ')
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('region')).not.toBeInTheDocument()
  expect(toggle).toHaveFocus()
})

it('makes a closing panel inaccessible immediately while its motion finishes', () => {
  render(<SitovTrainerHelp title="Regeln" defaultOpen><Link href="/de/dashboard/profile">Einstellungen</Link></SitovTrainerHelp>)
  const panel = screen.getByRole('region', { name: 'Regeln' })
  expect(within(panel).getByRole('link', { name: 'Einstellungen' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Regeln' }))
  expect(panel).toHaveAttribute('aria-hidden', 'true')
  expect(panel).toHaveAttribute('inert')
  expect(screen.queryByRole('link', { name: 'Einstellungen' })).not.toBeInTheDocument()
})

it('keeps independent help panels associated with their own unique controls', () => {
  render(<>
    <SitovTrainerHelp title="Vokabelregeln"><p>Zwei Richtungen</p></SitovTrainerHelp>
    <SitovTrainerHelp title="Verbregeln"><p>Drei Zeitformen</p></SitovTrainerHelp>
  </>)
  const first = screen.getByRole('button', { name: 'Vokabelregeln' })
  const second = screen.getByRole('button', { name: 'Verbregeln' })
  expect(first.id).not.toBe(second.id)
  expect(first.getAttribute('aria-controls')).not.toBe(second.getAttribute('aria-controls'))
  fireEvent.click(second)
  expect(first).toHaveAttribute('aria-expanded', 'false')
  expect(within(screen.getByRole('region', { name: 'Verbregeln' })).getByText('Drei Zeitformen')).toBeInTheDocument()
})

it('keeps the same disclosure usable when reduced motion is requested', () => {
  const matchMedia = jest.spyOn(window, 'matchMedia').mockImplementation(query => ({
    matches: query === '(prefers-reduced-motion: reduce)', media: query, onchange: null,
    addListener: jest.fn(), removeListener: jest.fn(), addEventListener: jest.fn(), removeEventListener: jest.fn(), dispatchEvent: jest.fn(),
  }))
  try {
    render(<SitovTrainerHelp title="Ruhige Hilfe"><p>Alle Regeln bleiben erreichbar.</p></SitovTrainerHelp>)
    const toggle = screen.getByRole('button', { name: 'Ruhige Hilfe' })
    fireEvent.click(toggle)
    expect(screen.getByRole('region', { name: 'Ruhige Hilfe' })).toHaveTextContent('Alle Regeln bleiben erreichbar.')
    fireEvent.click(toggle)
    expect(document.getElementById(toggle.getAttribute('aria-controls')!)).toBeNull()
  } finally { matchMedia.mockRestore() }
})

it('renders an explicitly opened help panel with readable content in server markup', () => {
  const view = document.createElement('div')
  view.innerHTML = renderToStaticMarkup(<SitovTrainerHelp title="Gespeicherte Hilfe" defaultOpen><p>Dein Lernstand bleibt erhalten.</p></SitovTrainerHelp>)
  document.body.appendChild(view)
  try {
    expect(within(view).getByRole('button', { name: 'Gespeicherte Hilfe' })).toHaveAttribute('aria-expanded', 'true')
    expect(within(view).getByRole('region', { name: 'Gespeicherte Hilfe' })).toBeVisible()
    expect(within(view).getByText('Dein Lernstand bleibt erhalten.')).toBeVisible()
    expect(view.querySelector('[data-sitov-trainer-help]')).toHaveAttribute('data-sitov-live', 'false')
  } finally { view.remove() }
})
