import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import LeitnerBoxOverview from '@/components/vocabulary/LeitnerBoxOverview'
import { getPhaseCards } from '@/app/actions/vocabulary'
import { summarizeBox, computeWordBoxState, type DirectionProgressRow } from '@/lib/vocabulary-box'
import type { PhaseCardView } from '@/lib/types/vocabulary'
import de from '@/dictionaries/de.json'

jest.unmock('lucide-react')
jest.unmock('framer-motion')
jest.mock('@/app/actions/vocabulary', () => ({ getPhaseCards: jest.fn() }))

const FUTURE = '2099-01-01T00:00:00.000Z'
const PAST = '2020-01-01T00:00:00.000Z'

function rows(a: number, b: number, due = false): DirectionProgressRow[] {
  return [
    { direction: 'de_to_native', box_number: a, next_review_date: due ? PAST : FUTURE },
    { direction: 'native_to_de', box_number: b, next_review_date: FUTURE },
  ]
}

/** Drei Wörter in Phase 1 (eines davon halb gewusst und fällig), eines gelernt. */
const summary = summarizeBox([
  computeWordBoxState(rows(1, 1)),
  computeWordBoxState(rows(2, 1, true)),
  computeWordBoxState(rows(1, 1)),
  computeWordBoxState(rows(7, 7)),
  null,
])

const halfKnown: PhaseCardView = {
  id: 'word-1', word_de: 'Haus', article: 'das', translation: 'дом', lesson: 'Lektion 1',
  ...computeWordBoxState(rows(2, 1, true))!,
}

function mount() {
  return render(<LeitnerBoxOverview summary={summary} level="A1.1" uiLanguage="ru" translations={de.vocabulary} />)
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(getPhaseCards).mockResolvedValue({ key: 1, cards: [halfKnown], total: 1, truncated: false })
})

it('zeigt alle sechs Phasen plus Archiv mit ihren Ruhezeiten', () => {
  mount()
  for (const name of ['Neu', 'Frisch', 'Vertraut', 'Gefestigt', 'Sicher', 'Langzeit', 'Gelernt']) {
    expect(screen.getByText(name)).toBeInTheDocument()
  }
  expect(screen.getByText('Wiederholung nach 29 Tagen')).toBeInTheDocument()
  expect(screen.getByText('Keine Wiederholung mehr')).toBeInTheDocument()
})

it('macht den Zwischenschritt „halb gewusst" an der Phase sichtbar', () => {
  mount()
  // Drei Wörter stehen in Phase 1, weil ihre schwächere Richtung dort liegt –
  // eines davon hat die Gegenrichtung schon geschafft.
  const fresh = within(screen.getByRole('button', { name: 'In das Fach „Neu“ hineinschauen' }))
  expect(fresh.getByText('3')).toBeInTheDocument()
  expect(fresh.getByText('1 halb gewusst')).toBeInTheDocument()
  expect(fresh.getByText('1 fällig')).toBeInTheDocument()
})

it('zählt nicht aufgenommene Vokabeln getrennt und gewichtet den Fortschritt', () => {
  mount()
  expect(screen.getByText('1 noch nicht aufgenommen')).toBeInTheDocument()
  expect(screen.getByRole('progressbar', { name: 'Fortschritt im Karteikasten' }))
    .toHaveAttribute('aria-valuenow', String(summary.percent))
})

it('öffnet ein Fach und listet die Vokabeln mit beiden Richtungen auf', async () => {
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'In das Fach „Neu“ hineinschauen' }))
  await waitFor(() => expect(getPhaseCards).toHaveBeenCalledWith(1, 'A1.1', 'ru'))
  const drawer = await screen.findByRole('dialog', { name: 'Fach 1: Neu' })
  expect(drawer).toHaveTextContent('das Haus')
  expect(drawer).toHaveTextContent('дом')
  // Beide Richtungen stehen als Chip an der Vokabel, damit man sieht, welche fehlt.
  expect(drawer).toHaveTextContent('Deutsch → Deine Sprache')
  expect(drawer).toHaveTextContent('Deine Sprache → Deutsch')
  expect(drawer).toHaveTextContent('Halb gewusst')
})

it('meldet einen Lesefehler, statt ein leeres Fach vorzuspiegeln', async () => {
  jest.mocked(getPhaseCards).mockRejectedValue(new Error('vocabulary_box_unavailable'))
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'In das Fach „Gelernt“ hineinschauen' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(de.vocabulary.inspector_failed)
})

it('schließt das Fach über Escape', async () => {
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'In das Fach „Neu“ hineinschauen' }))
  await screen.findByRole('dialog')
  fireEvent.keyDown(document, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})
