import { fireEvent, render, screen, within } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server.node'
import SitovTrainerHero from '@/components/motion/SitovTrainerHero'
import VideoLibrary from '@/components/dashboard/VideoLibrary'

jest.unmock('lucide-react')
jest.mock('@/lib/useVideoCheckpoint', () => ({ useVideoCheckpoint: () => ({
  progress: {}, issue: null, ready: true, track: jest.fn(), flush: jest.fn(), reload: jest.fn(), retry: jest.fn(),
}) }))
jest.mock('@/app/actions/media-views', () => ({ recordMediaView: jest.fn() }))

it('keeps the start action a named native button without covering its heading or graphic', () => {
  const start = jest.fn()
  render(<SitovTrainerHero mode="verbs" eyebrow="Verbtrainer" level="A1.1" title="Deutsch in Bewegung."
    graphic={<span>Szene</span>} action={{ label: 'Jetzt üben', onClick: start }} />)
  const action = screen.getByRole('button', { name: 'Jetzt üben' })
  expect(action.tagName).toBe('BUTTON')
  expect(action).toHaveAttribute('type', 'button')
  expect(action).not.toContainElement(screen.getByRole('heading', { name: 'Deutsch in Bewegung.' }))
  expect(action).not.toHaveTextContent('Szene')
  fireEvent.click(action)
  expect(start).toHaveBeenCalledTimes(1)
})

it.each([{ disabled: true }, { busy: true }])('blocks a start that is unavailable: %j', state => {
  const start = jest.fn()
  render(<SitovTrainerHero mode="vocabulary" eyebrow="Deine Lernbox" level="A1.1" title="Deine Wörter. Dein Deutsch."
    action={{ label: 'Jetzt üben', onClick: start, ...state }} />)
  const action = screen.getByRole('button', { name: 'Jetzt üben' })
  expect(action).toBeDisabled()
  fireEvent.click(action)
  expect(start).not.toHaveBeenCalled()
})

it('includes a fully visible heading and real destination in calm server markup', () => {
  const html = renderToStaticMarkup(<SitovTrainerHero mode="path" eyebrow="Lernpfad" level="B1.1" title="Dein nächster Schritt."
    headingLevel={2} graphic={<span>Weg</span>} action={{ label: 'Weiterlernen', href: '/ru/dashboard/level/B1.1/path' }} />)
  const view = document.createElement('div')
  view.innerHTML = html
  document.body.appendChild(view)
  expect(within(view).getByRole('heading', { level: 2, name: 'Dein nächster Schritt.' })).toBeVisible()
  expect(within(view).getByRole('link', { name: 'Weiterlernen' })).toHaveAttribute('href', '/ru/dashboard/level/B1.1/path')
  expect(view.querySelector('[data-sitov-trainer-hero="path"]')).toHaveAttribute('data-sitov-live', 'false')
  view.remove()
})

it('shows the media introduction as a scene while resources keep their own actions', () => {
  render(<VideoLibrary level="A1.1" lang="en" translations={{}} links={[
    { id: 'resource', title: 'The alphabet', url: 'https://example.com/alphabet', description: null, createdAt: null },
  ]} />)
  const hero = document.querySelector('[data-sitov-trainer-hero="media"]') as HTMLElement
  expect(hero).toBeInTheDocument()
  expect(within(hero).getByRole('heading', { level: 1 })).toBeInTheDocument()
  expect(within(hero).queryByRole('button')).not.toBeInTheDocument()
  expect(within(hero).queryByRole('link')).not.toBeInTheDocument()
  expect(hero.querySelector('[data-sitov-media-scene]')).toHaveAttribute('aria-hidden', 'true')
  expect(screen.getByRole('link', { name: /The alphabet/ })).toHaveAttribute('href', 'https://example.com/alphabet')
})
