import { act, fireEvent, render, screen, within } from '@testing-library/react'
import TrendChart from '@/components/charts/TrendChart'
import AccuracyRing from '@/components/charts/AccuracyRing'
import StudentProgress from '@/components/progress/StudentProgress'
import ProgressTeaser from '@/components/dashboard/home/ProgressTeaser'
import { getMyLearningProgress } from '@/app/actions/learning-progress'
import { accuracyLine, answeredOn, learnedCurve, learningProgressSchema, percent, progressRangeFrom, rangeTotals, todaySummary } from '@/lib/learning-progress'
import { formatStudyTime, learningProgressCopy } from '@/lib/learning-progress-i18n'
import { progressData, progressDay, progressPayload } from './fixtures/learning-progress'

jest.unmock('lucide-react')
jest.mock('@/app/actions/learning-progress', () => ({ getMyLearningProgress: jest.fn() }))
beforeEach(() => jest.clearAllMocks())

describe('Rechenhilfen', () => {
  it('rechnet Prozent nur, wenn etwas beantwortet wurde, und rundet ganzzahlig', () => {
    expect(percent(0, 0)).toBeNull()
    expect(percent(2, 3)).toBe(67)
    const day = progressDay('2026-09-30', { vocabulary: { answers: 5, correct: 4 }, focus: { answers: 2, correct: 2 }, path: { answers: 3, correct: 0 } })
    expect(answeredOn(day)).toEqual({ answers: 10, correct: 6, wrong: 4, percent: 60 })
  })
  it('vergleicht heute mit den aktiven Vortagen und summiert den Zeitraum', () => {
    const daily = progressData(7, '2026-09-30', (day, index) => index === 6 ? progressDay(day.date, { vocabulary: { answers: 4, correct: 4, seconds: 120 } })
      : index === 2 ? progressDay(day.date, { path: { answers: 4, correct: 2 } }) : day).daily
    expect(todaySummary(daily)).toMatchObject({ answers: 4, correct: 4, percent: 100, averagePercent: 50, seconds: 120 })
    expect(rangeTotals(daily)).toMatchObject({ answers: 8, correct: 6, percent: 75, activeDays: 2 })
  })
  it('baut die Summenkurve gelernter Wörter aus dem heutigen Stand zurück', () => {
    const data = progressData(7, '2026-09-30', (day, index) => index >= 5 ? progressDay(day.date, { vocabulary: { learned: 1 } }) : day)
    expect(learnedCurve(data)).toEqual([3, 3, 3, 3, 3, 4, 5])
  })
  it('zeigt ab 30 Tagen einen gleitenden 7-Tage-Wert statt zerrissener Tageswerte', () => {
    const pick = (day: ReturnType<typeof progressDay>) => day.vocabulary
    const week = progressData(7, '2026-09-30', (day, index) => index === 3 ? progressDay(day.date, { vocabulary: { answers: 4, correct: 1 } }) : day).daily
    expect(accuracyLine(week, pick)).toEqual([null, null, null, 25, null, null, null])
    const month = progressData(30, '2026-09-30', (day, index) => index === 20 ? progressDay(day.date, { vocabulary: { answers: 4, correct: 1 } })
      : index === 22 ? progressDay(day.date, { vocabulary: { answers: 4, correct: 4 } }) : day).daily
    const line = accuracyLine(month, pick)
    expect(line.slice(19, 29)).toEqual([null, 25, 25, 63, 63, 63, 63, 63, 100, 100])
    expect(line[29]).toBeNull()
  })
  it('akzeptiert nur die drei Zeiträume', () => {
    expect(progressRangeFrom('90')).toBe(90)
    expect(progressRangeFrom('14')).toBe(30)
    expect(progressRangeFrom(undefined)).toBe(30)
  })
  it('lehnt widersprüchliche Tageswerte ab', () => {
    expect(learningProgressSchema.safeParse(progressPayload(7)).success).toBe(true)
    expect(learningProgressSchema.safeParse({ ...progressPayload(7), days: 30 }).success).toBe(false)
    const unordered = progressPayload(7); unordered.daily.reverse()
    expect(learningProgressSchema.safeParse(unordered).success).toBe(false)
  })
  it('formatiert Lernzeit kurz und hat fünf vollständige Sprachen', () => {
    const t = learningProgressCopy('de')
    expect(formatStudyTime(1500, t)).toBe('25 Min.')
    expect(formatStudyTime(3900, t)).toBe('1 Std. 5 Min.')
    for (const lang of ['en', 'ru', 'uk', 'tr']) expect(learningProgressCopy(lang)('mode_path')).not.toBe(t('mode_path'))
    expect(learningProgressCopy('de')('mode_path')).toBe('Lernpfad')
  })
})

describe('Diagramm', () => {
  const series = [
    { key: 'correct', label: 'Richtig', color: 'var(--success)', type: 'bar' as const, stack: 'a' },
    { key: 'wrong', label: 'Falsch', color: 'var(--danger)', type: 'bar' as const, stack: 'a' },
    { key: 'percent', label: 'Richtig in %', color: 'var(--violet)', type: 'line' as const, axis: 'percent' as const },
  ]
  const points = ['2026-09-28', '2026-09-29', '2026-09-30'].map((date, index) => ({ date, values: { correct: index, wrong: 1, percent: index ? Math.round(index / (index + 1) * 100) : null } }))
  it('zeigt die Werte eines Tages per Tastatur und kündigt sie an', () => {
    const { container } = render(<TrendChart points={points} series={series} lang="de" label="Verlauf" />)
    const chart = screen.getByRole('group', { name: 'Verlauf' })
    expect(container.querySelectorAll('rect.trend-chart__bar')).toHaveLength(5)
    fireEvent.keyDown(chart, { key: 'End' })
    expect(chart).toHaveAccessibleDescription(/Mittwoch, 30\. September.*Richtig: 2.*Falsch: 1.*Richtig in %: 67 %/)
    fireEvent.keyDown(chart, { key: 'ArrowLeft' })
    expect(chart).toHaveAccessibleDescription(/29\. September/)
    fireEvent.keyDown(chart, { key: 'Escape' })
    expect(chart).toHaveAccessibleDescription('')
  })
  it('zeichnet ohne Werte keine erfundene Kurve, sondern einen Hinweis', () => {
    const empty = points.map(point => ({ ...point, values: { correct: 0, wrong: 0, percent: null } }))
    const { container } = render(<TrendChart points={empty} series={series} lang="de" label="Verlauf" emptyLabel="Noch keine Werte" />)
    expect(screen.getByText('Noch keine Werte')).toBeInTheDocument()
    expect(container.querySelector('polyline')).toBeNull()
    expect(container.querySelector('rect.trend-chart__bar')).toBeNull()
  })
  it('unterscheidet „keine Antworten“ von 0 %', () => {
    render(<><AccuracyRing value={null} label="Noch keine Antworten" /><AccuracyRing value={0} label="0 Prozent richtig" /></>)
    expect(screen.getByRole('img', { name: 'Noch keine Antworten' })).toHaveTextContent('–')
    expect(screen.getByRole('img', { name: '0 Prozent richtig' })).toHaveTextContent('0 %')
  })
})

describe('Mein Fortschritt', () => {
  const initial = progressData(30, '2026-09-30', (day, index) => index === 29 ? progressDay(day.date, { vocabulary: { answers: 8, correct: 6 } }) : day)
  it('zeigt Heute mit Prozent und lädt beim Wechsel des Zeitraums nach; eine ältere Antwort gewinnt nie', async () => {
    let slow!: (value: Awaited<ReturnType<typeof getMyLearningProgress>>) => void
    jest.mocked(getMyLearningProgress).mockImplementationOnce(() => new Promise(resolve => { slow = resolve }))
      .mockResolvedValueOnce({ success: true, data: progressData(90) })
    render(<StudentProgress initial={initial} levels={['A1.1', 'A1.2']} lang="de" translations={{}} focusLevel="A1.1" />)
    expect(within(screen.getByRole('region', { name: 'Heute' })).getByRole('img', { name: '75 Prozent richtig' })).toBeInTheDocument()
    expect(getMyLearningProgress).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '7 Tage' }))
    fireEvent.click(screen.getByRole('button', { name: '90 Tage' }))
    expect(getMyLearningProgress).toHaveBeenNthCalledWith(1, { level: null, days: 7 })
    expect(getMyLearningProgress).toHaveBeenNthCalledWith(2, { level: null, days: 90 })
    expect(await screen.findByText(/Im Zeitraum \(90 Tage\)/)).toBeInTheDocument()
    await act(async () => slow({ success: true, data: progressData(7) }))
    expect(screen.getByText(/Im Zeitraum \(90 Tage\)/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '90 Tage' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('link', { name: 'Problemwörter üben' })).toHaveAttribute('href', '/de/dashboard/level/A1.1/vocabulary/focus')
  })
  it('filtert nach Niveau und meldet Fehler mit Wiederholen', async () => {
    jest.mocked(getMyLearningProgress).mockResolvedValueOnce({ success: false, error: 'request_failed' })
      .mockResolvedValueOnce({ success: true, data: { ...initial, level: 'A1.2' } })
    render(<StudentProgress initial={initial} levels={['A1.1', 'A1.2']} lang="de" translations={{}} focusLevel={null} />)
    expect(screen.queryByRole('link', { name: 'Problemwörter üben' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Niveau'), { target: { value: 'A1.2' } })
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Lernanalyse konnte nicht geladen werden.')
    fireEvent.click(screen.getByRole('button', { name: 'Erneut laden' }))
    expect(getMyLearningProgress).toHaveBeenLastCalledWith({ level: 'A1.2', days: 30 })
    await screen.findByRole('region', { name: 'Heute' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Problemwörter üben' })).toHaveAttribute('href', '/de/dashboard/level/A1.2/vocabulary/focus')
  })
  it('zeigt auf der Startseite den Tag in Zahlen mit Link zum Fortschritt', () => {
    render(<ProgressTeaser progress={progressData(7, '2026-09-30', (day, index) => index === 6 ? progressDay(day.date, { path: { answers: 4, correct: 3 } }) : day)} lang="ru" focus={{ href: '/ru/dashboard/level/A1.1/vocabulary/focus', due: 2 }} />)
    expect(screen.getByRole('img', { name: 'Верно: 75 %' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Смотреть прогресс' })).toHaveAttribute('href', '/ru/dashboard/progress')
    expect(screen.getByRole('link', { name: /Тренировать проблемные слова \(2\)/ })).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Ответы и верные ответы' })).getAllByRole('listitem')).toHaveLength(7)
  })
})
