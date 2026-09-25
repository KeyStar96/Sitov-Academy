import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import DialogActions from '@/components/ui/DialogActions'
import AdminDialog from '@/components/admin/AdminDialog'
import PersistentDialog from '@/components/ui/PersistentDialog'
import BottomSheet from '@/components/ui/BottomSheet'
import LogoutButton from '@/components/dashboard/LogoutButton'

jest.unmock('lucide-react')
jest.mock('@/app/actions/auth', () => ({ logout: jest.fn() }))

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})

const actions = <DialogActions secondary={<button type="button">Abbrechen</button>}
  primary={<button type="button" className="st-button--primary">Speichern</button>} />

it.each(['admin', 'persistent', 'sheet'] as const)('keeps the primary action last in the shared %s dialog', kind => {
  const common = { title: 'Bearbeiten', onClose: jest.fn(), closeLabel: 'Schließen' }
  render(kind === 'admin' ? <AdminDialog {...common}>{actions}</AdminDialog>
    : kind === 'persistent' ? <PersistentDialog {...common} open>{actions}</PersistentDialog>
      : <BottomSheet {...common} open footer={actions} />)
  const buttons = within(screen.getByRole('dialog')).getAllByRole('button')
  expect(buttons.at(-2)).toHaveTextContent('Abbrechen')
  expect(buttons.at(-1)).toHaveTextContent('Speichern')
  expect(buttons.at(-1)).toHaveClass('st-button--primary')
})

it('places the actual logout confirmation below its cancel action', () => {
  render(<LogoutButton lang="de" />)
  fireEvent.click(screen.getByRole('button', { name: 'Abmelden' }))
  const buttons = within(screen.getByRole('dialog')).getAllByRole('button')
  expect(buttons.at(-2)).not.toHaveClass('st-button--primary')
  expect(buttons.at(-1)).toHaveClass('st-button--primary')
})
