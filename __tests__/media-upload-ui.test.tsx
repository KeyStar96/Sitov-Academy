import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import MediaUpload from '@/components/admin/MediaUpload'
import { createMediaUpload } from '@/lib/media-upload'
import { completeMediaUpload } from '@/app/actions/media'
import type { MediaFolder } from '@/lib/media'
import type { Upload } from 'tus-js-client'

jest.mock('@/utils/supabase/client', () => ({ createClient: () => ({ auth: { getSession: async () => ({ data: { session: { user: { id: 'user' } } } }) } }) }))
jest.mock('@/app/actions/media', () => ({ completeMediaUpload: jest.fn() }))
jest.mock('@/lib/media-upload', () => ({
  createMediaUpload: jest.fn(), uploadTicketKey: () => 'upload-ticket',
  readUploadTicket: () => JSON.parse(localStorage.getItem('upload-ticket') ?? '{"assetId":"00000000-0000-4000-8000-000000000003","title":"Lesson","completed":false}'),
}))
const folder: MediaFolder = { folder_id: '00000000-0000-4000-8000-000000000002', level: 'A1.1', course_id: null, title: 'Folder', sort_order: 0, assets: [], links: [] }
const file = new File(['video'], 'lesson.mp4', { type: 'video/mp4' })
const onSaved = jest.fn().mockResolvedValue(undefined)
const uploader = () => ({ start: jest.fn(), abort: jest.fn().mockResolvedValue(undefined) })
beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); jest.mocked(completeMediaUpload).mockResolvedValue({ success: true, data: { asset_id: '00000000-0000-4000-8000-000000000003' } }) })
function mount() {
  render(<MediaUpload folder={folder} lang="de" onSaved={onSaved} />)
  fireEvent.change(screen.getByLabelText('Datei auswählen'), { target: { files: [file] } })
  fireEvent.click(screen.getByRole('button', { name: 'Hochladen / fortsetzen' }))
}

it('does not start an upload that was paused while resume discovery was still pending', async () => {
  let resolve!: (upload: Upload) => void
  const pending = uploader()
  jest.mocked(createMediaUpload).mockImplementationOnce(() => new Promise(done => { resolve = done }))
  mount(); await waitFor(() => expect(createMediaUpload).toHaveBeenCalledTimes(1))
  fireEvent.click(screen.getByRole('button', { name: 'Pausieren' }))
  await act(async () => resolve(pending as unknown as Upload))
  expect(pending.start).not.toHaveBeenCalled(); expect(pending.abort).toHaveBeenCalled()
  expect(screen.getByRole('status')).toHaveTextContent('Upload pausiert')
})
it('retries publication after the completed transfer without uploading the file again', async () => {
  const upload = uploader(); jest.mocked(createMediaUpload).mockResolvedValue(upload as unknown as Upload)
  jest.mocked(completeMediaUpload).mockResolvedValueOnce({ success: false, error: 'request_failed' })
  mount(); await waitFor(() => expect(upload.start).toHaveBeenCalledTimes(1))
  await act(async () => { jest.mocked(createMediaUpload).mock.calls[0][4].onSuccess() })
  expect(await screen.findByRole('alert')).toHaveTextContent('Nicht gespeichert')
  expect(JSON.parse(localStorage.getItem('upload-ticket')!).completed).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  expect(createMediaUpload).toHaveBeenCalledTimes(1); expect(completeMediaUpload).toHaveBeenCalledTimes(2)
  expect(localStorage.getItem('upload-ticket')).toBeNull()
})
it('reports browser-persistence failures from upload completion and releases the retry button', async () => {
  const upload = uploader(); jest.mocked(createMediaUpload).mockResolvedValue(upload as unknown as Upload)
  mount(); await waitFor(() => expect(upload.start).toHaveBeenCalled())
  const persist = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage_unavailable') })
  try {
    await act(async () => { jest.mocked(createMediaUpload).mock.calls[0][4].onSuccess() })
    expect(await screen.findByRole('alert')).toHaveTextContent('Nicht gespeichert')
    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeEnabled()
  } finally { persist.mockRestore() }
})
