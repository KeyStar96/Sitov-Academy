import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import LeitnerBoxOverview from '@/components/vocabulary/LeitnerBoxOverview'
import { summarizeBox, computeWordBoxState } from '@/lib/vocabulary-box'
import de from '@/dictionaries/de.json'
import en from '@/dictionaries/en.json'

jest.unmock('lucide-react')
jest.unmock('framer-motion')
jest.mock('@/app/actions/vocabulary', () => ({ getPhaseCards: jest.fn() }))

const FUTURE = '2099-01-01T00:00:00.000Z'
const filled = summarizeBox([computeWordBoxState([
  { direction: 'de_to_native', box_number: 2, next_review_date: FUTURE },
  { direction: 'native_to_de', box_number: 2, next_review_date: FUTURE },
])])
const empty = summarizeBox([null, null])

function mount(summary = filled, translations: Record<string, string> = de.vocabulary, uiLanguage = 'de') {
  return render(<LeitnerBoxOverview summary={summary} level="A1.1" uiLanguage={uiLanguage} translations={translations} />)
}

describe('Kurzanleitung zum Lernkasten', () => {
  it('ist bei gefülltem Kasten zugeklappt und öffnet sich mit allen fünf Regeln', async () => {
    mount()
    const toggle = screen.getByRole('button', { name: 'So funktioniert die Lernbox' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('region', { name: 'So funktioniert die Lernbox' })).not.toBeInTheDocument()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const panel = screen.getByRole('region', { name: 'So funktioniert die Lernbox' })
    expect(toggle).toHaveAttribute('aria-controls', panel.id)
    const steps = within(panel).getAllByRole('listitem')
    expect(steps.map((step) => step.querySelector('b')?.textContent)).toEqual(
      ['Neu:', 'Richtig:', 'Falsch:', 'Beide Richtungen:', 'Gelernt:'])
    expect(panel).toHaveTextContent('ist morgen wieder dran')
    expect(panel).toHaveTextContent('Nur der erste Versuch am Tag zählt')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => expect(screen.queryByRole('region', { name: 'So funktioniert die Lernbox' })).not.toBeInTheDocument())
  })

  it('bleibt auch bei leerem Kasten zunächst dezent geschlossen', () => {
    mount(empty)
    expect(screen.getByRole('button', { name: 'So funktioniert die Lernbox' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('die Mini-Box ist Dekoration und zeigt die echten Intervalle', () => {
    mount(empty)
    fireEvent.click(screen.getByRole('button', { name: 'So funktioniert die Lernbox' }))
    const track = document.querySelector('.lb-guide__track')!
    expect(track).toHaveAttribute('aria-hidden', 'true')
    expect([...track.querySelectorAll('.lb-guide__days span')].map((span) => span.textContent)).toEqual(
      ['1', '1', '3', '9', '29', '90', '–'])
  })

  it('spricht die Sprache der Oberfläche', () => {
    mount(filled, en.vocabulary, 'en')
    fireEvent.click(screen.getByRole('button', { name: 'How the learning box works' }))
    expect(screen.getByRole('region', { name: 'How the learning box works' })).toHaveTextContent('drawer 1')
  })
})
