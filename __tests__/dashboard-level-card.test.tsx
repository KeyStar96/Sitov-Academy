import { render, screen } from '@testing-library/react'
import LevelCard from '@/components/dashboard/home/LevelCard'

jest.unmock('lucide-react')

const copy = { start: 'Starten', continueLearning: 'Weiterlernen', lockedHint: 'Noch nicht freigeschaltet' }

function mount(overrides: Partial<Parameters<typeof LevelCard>[0]> = {}) {
  return render(<LevelCard id="A1.1" title="A1.1 Anfänger" description="Die ersten Schritte."
    index={0} href="/de/dashboard/level/A1.1" locked={false} progress={38} copy={copy} {...overrides} />)
}

it('verlinkt ein freigeschaltetes Niveau und zeigt den Fortschritt', () => {
  const { container } = mount()
  expect(screen.getByRole('link')).toHaveAttribute('href', '/de/dashboard/level/A1.1')
  expect(screen.getByText('Weiterlernen')).toBeInTheDocument()
  expect(screen.getByText('38%')).toBeInTheDocument()
  // Das Band an der Unterkante trägt den Wert als Breite — schon vor dem
  // Hydrieren, damit es nicht auf 100 % steht und dann zurückspringt.
  expect(container.querySelector('.academy-level-track > span')).toHaveStyle({ width: '38%' })
})

it('lädt ohne Fortschritt zum Starten ein', () => {
  mount({ progress: 0 })
  expect(screen.getByText('Starten')).toBeInTheDocument()
  expect(screen.queryByText('Weiterlernen')).not.toBeInTheDocument()
})

it('ist gesperrt kein Link, sondern eine Sackgasse mit Begründung', () => {
  // Ein toter Link wäre für Tastatur und Screenreader eine Falle.
  const { container } = mount({ locked: true })
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  expect(screen.getByText(copy.lockedHint)).toBeInTheDocument()
  expect(container.querySelector('[aria-disabled="true"]')).toBeInTheDocument()
  expect(container.querySelector('.academy-level-track')).not.toBeInTheDocument()
})

it('nummeriert die Kacheln zweistellig', () => {
  mount({ index: 5 })
  expect(screen.getByText('06')).toBeInTheDocument()
})
