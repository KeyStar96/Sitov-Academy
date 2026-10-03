import { render, screen } from '@testing-library/react'
import DailyQuestEntry from '../DailyQuestEntry'
import type { DailyQuestStatus } from '@/lib/daily-quest-contract'

jest.unmock('lucide-react')

const sitovStatus: DailyQuestStatus = {
  success: true,
  enabled: true,
  streak: { current: 3, longest: 5, lastCompletedDate: '2026-10-02' },
  today: { assignmentId: 'c9e3e3ca-69ac-4383-90cd-3788dc1e3104', status: 'active' },
}

describe('DailyQuestEntry', () => {
  it.each(['active', 'skipped'] as const)('keeps an %s journey available from Home', status => {
    render(<DailyQuestEntry lang="en" status={{ ...sitovStatus, today: { ...sitovStatus.today!, status } }} />)

    expect(screen.getByRole('link', { name: 'Open today’s journey' })).toHaveAttribute('href', '/en/dashboard/daily-quest')
    expect(screen.queryByText('Skipped today')).not.toBeInTheDocument()
  })

  it('keeps the completed journey available to review', () => {
    render(<DailyQuestEntry lang="de" status={{ ...sitovStatus, today: { ...sitovStatus.today!, status: 'completed' } }} />)

    expect(screen.getByRole('link', { name: 'Heute geschafft' })).toHaveAttribute('href', '/de/dashboard/daily-quest')
    expect(screen.getByText('3 Tage in Folge')).toBeInTheDocument()
  })

  it('links a disabled daily start to its profile preference', () => {
    render(<DailyQuestEntry lang="de" status={{ ...sitovStatus, enabled: false }} />)

    expect(screen.getByRole('link', { name: 'Einstellung im Profil öffnen' })).toHaveAttribute('href', '/de/dashboard/profile#daily-quest')
    expect(screen.getByRole('heading', { name: 'Deine Deutschreise pausiert' })).toBeInTheDocument()
  })
})
