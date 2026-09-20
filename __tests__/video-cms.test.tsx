import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VideoCMS from '@/components/admin/VideoCMS'
import VideoLibrary from '@/components/dashboard/VideoLibrary'
import { setVideoVisibility } from '@/app/actions/media'
import { addVideo, updateVideo } from '@/app/actions/cms'
import { VIDEO_FALLBACKS as copy } from '@/lib/videos-i18n'
import type { VideoRecord } from '@/lib/video-links'

jest.mock('@/app/actions/media', () => ({ setVideoVisibility: jest.fn() }))
jest.unmock('lucide-react')
jest.mock('@/app/actions/cms', () => ({ addVideo: jest.fn(), updateVideo: jest.fn(), deleteVideo: jest.fn() }))
const item: VideoRecord = {
  id: '133379c3-b347-4226-bd70-b6c530e2c849', unit_id: '00000000-0000-4000-8000-000000000001',
  title: 'Hallo', level: 'A1.1', description: 'Nicos Weg', created_at: null,
  source_url: 'https://learngerman.dw.com/de/hallo/l-37250531', is_active: true,
}
beforeEach(() => {
  jest.clearAllMocks()
  Element.prototype.scrollIntoView = jest.fn()
})

it('preserves an existing DW learning link when the teacher edits its description', async () => {
  const user = userEvent.setup()
  jest.mocked(updateVideo).mockResolvedValue({ success: true, data: { ...item, description: 'Erste Begrüßung' } })
  render(<VideoCMS initialData={[item]} />)
  await user.click(screen.getByRole('button', { name: copy.cms_edit }))
  expect(screen.getByLabelText(copy.cms_url)).toHaveValue(item.source_url)
  const description = screen.getByLabelText(copy.cms_description)
  await user.clear(description)
  await user.type(description, 'Erste Begrüßung')
  await user.click(screen.getByRole('button', { name: copy.cms_save }))
  await waitFor(() => expect(updateVideo).toHaveBeenCalledWith(item.id, expect.objectContaining({
    source_url: item.source_url, description: 'Erste Begrüßung', is_active: true,
  })))
  expect(await screen.findByRole('status')).toHaveTextContent(copy.cms_saved)
})

it('saves a URL-less draft but requires a URL when publication is selected', async () => {
  const user = userEvent.setup()
  jest.mocked(addVideo).mockResolvedValue({ success: true, data: { ...item, source_url: null, is_active: false } })
  render(<VideoCMS initialData={[]} />)
  await user.type(screen.getByLabelText(copy.cms_title_field), 'Neue Lektion')
  const publish = screen.getByLabelText(copy.cms_active)
  await user.click(publish)
  await user.click(screen.getByRole('button', { name: copy.cms_save }))
  expect(addVideo).not.toHaveBeenCalled()
  expect(screen.getByLabelText(copy.cms_url)).toBeInvalid()
  await user.click(publish)
  await user.click(screen.getByRole('button', { name: copy.cms_save }))
  await waitFor(() => expect(addVideo).toHaveBeenCalledWith(expect.objectContaining({ source_url: '', is_active: false })))
  expect(await screen.findByText(copy.cms_draft)).toBeInTheDocument()
})

it('shows an active DW resource as an outbound link and keeps empty drafts out of the student library', () => {
  render(<VideoLibrary videos={[item, { ...item, id: 'draft', title: 'Unfertig', source_url: null, is_active: false }]} lang="ru" level="A1.1" translations={{}} />)
  const link = screen.getByRole('link', { name: '„Hallo“ in einem neuen Fenster öffnen' })
  expect(link).toHaveAttribute('href', item.source_url)
  expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  expect(screen.getByText(copy.watch_resource)).toBeInTheDocument()
  expect(screen.queryByText('Unfertig')).not.toBeInTheDocument()
})

it('shows published MP4 uploads without an external URL and hides unpublished uploads', () => {
  const uploaded = { ...item, source_url: null, storage_path: 'A1.1/folder/videos/video.mp4', file_size: 1024 }
  render(<VideoLibrary videos={[uploaded, { ...uploaded, id: 'hidden', title: 'Hidden upload', is_active: false }]} lang="en" level="A1.1" translations={{}} />)
  expect(screen.getByText('Hallo')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument()
  expect(screen.queryByText('Hidden upload')).not.toBeInTheDocument()
  expect(screen.queryByText(copy.empty_internal)).not.toBeInTheDocument()
})
it('switches publication directly and keeps the previous state if saving fails', async () => {
  const user = userEvent.setup()
  jest.mocked(setVideoVisibility).mockResolvedValueOnce({ success: false, error: 'request_failed' })
    .mockResolvedValueOnce({ success: true, data: { video_id: item.id, is_active: false } })
  render(<VideoCMS initialData={[item]} lang="en" />)
  const toggle = screen.getByRole('switch', { name: 'Visible to students: Hallo' })
  await user.click(toggle)
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(toggle).toHaveAttribute('aria-checked', 'true')
  await user.click(toggle)
  await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'))
  expect(setVideoVisibility).toHaveBeenLastCalledWith({ video_id: item.id, is_active: false })
})
