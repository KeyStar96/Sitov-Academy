import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MediaLinkForm from '@/components/admin/MediaLinkForm'
import MediaLinkCard from '@/components/admin/MediaLinkCard'
import VideoLibrary from '@/components/dashboard/VideoLibrary'
import { buildMediaLibrary } from '@/lib/media-library'
import { deleteMediaLink, saveMediaLink, setVideoVisibility } from '@/app/actions/media'
import { mediaCopy } from '@/lib/media-i18n'
import { VIDEO_FALLBACKS as copy } from '@/lib/videos-i18n'
import type { MediaFolder, MediaLink } from '@/lib/media'
import type { VideoRecord } from '@/lib/video-links'

jest.mock('@/app/actions/media', () => ({ setVideoVisibility: jest.fn(), saveMediaLink: jest.fn(), deleteMediaLink: jest.fn() }))
jest.unmock('lucide-react')
const t = mediaCopy('de')
const item: VideoRecord = {
  id: '133379c3-b347-4226-bd70-b6c530e2c849', unit_id: '00000000-0000-4000-8000-000000000001',
  title: 'Hallo', level: 'A1.1', description: 'Nicos Weg', created_at: null,
  source_url: 'https://learngerman.dw.com/de/hallo/l-37250531', is_active: true,
}
const link: MediaLink = { id: item.id, title: 'Hallo', description: 'Nicos Weg', url: item.source_url!, isActive: true, createdAt: null }
const folder = (overrides: Partial<MediaFolder> = {}): MediaFolder => ({
  folder_id: '00000000-0000-4000-8000-000000000002', level: 'A1.1', course_id: null, title: 'Lektion 1', sort_order: 0, assets: [], links: [], ...overrides,
})
const onSaved = jest.fn().mockResolvedValue(undefined)
beforeEach(() => { jest.clearAllMocks() })

it('adds a YouTube link to the selected folder and keeps it visible by default', async () => {
  const user = userEvent.setup()
  jest.mocked(saveMediaLink).mockResolvedValue({ success: true, data: { id: item.id } })
  render(<MediaLinkForm folders={[folder()]} folderId={folder().folder_id} editing={null} lang="de" onSaved={onSaved} onCancel={jest.fn()} />)
  await user.type(screen.getByLabelText(t.linkUrl), 'https://youtu.be/abcdefghijk')
  await user.type(screen.getByLabelText(t.linkTitle), 'Das Alphabet')
  await user.click(screen.getByRole('button', { name: t.linkSave }))
  await waitFor(() => expect(saveMediaLink).toHaveBeenCalledWith({
    folder_id: folder().folder_id, title: 'Das Alphabet', url: 'https://youtu.be/abcdefghijk', description: '', is_active: true,
  }))
  expect(onSaved).toHaveBeenCalled()
  expect(await screen.findByRole('status')).toHaveTextContent(t.saved)
  expect(screen.getByLabelText(t.linkUrl)).toHaveValue('')
})

it('rejects links that are not web addresses before saving', async () => {
  const user = userEvent.setup()
  render(<MediaLinkForm folders={[folder()]} folderId={folder().folder_id} editing={null} lang="de" onSaved={onSaved} onCancel={jest.fn()} />)
  await user.type(screen.getByLabelText(t.linkUrl), 'javascript:alert(1)')
  await user.type(screen.getByLabelText(t.linkTitle), 'Trick')
  await user.click(screen.getByRole('button', { name: t.linkSave }))
  expect(await screen.findByRole('alert')).toHaveTextContent(t.linkInvalid)
  expect(saveMediaLink).not.toHaveBeenCalled()
})

it('edits an existing link in place and can move it into another folder', async () => {
  const user = userEvent.setup()
  jest.mocked(saveMediaLink).mockResolvedValue({ success: true, data: { id: item.id } })
  const other = folder({ folder_id: '00000000-0000-4000-8000-000000000009', level: 'A1.2', title: 'Lektion 2' })
  render(<MediaLinkForm folders={[folder(), other]} folderId={folder().folder_id} editing={{ link, folderId: folder().folder_id }} lang="de" onSaved={onSaved} onCancel={jest.fn()} />)
  expect(screen.getByLabelText(t.linkUrl)).toHaveValue(link.url)
  await user.selectOptions(screen.getByLabelText(t.linkFolder), other.folder_id)
  await user.click(screen.getByRole('button', { name: t.linkSave }))
  await waitFor(() => expect(saveMediaLink).toHaveBeenCalledWith(expect.objectContaining({ video_id: item.id, folder_id: other.folder_id, url: link.url, description: 'Nicos Weg' })))
})

it('switches link visibility directly and keeps the previous state if saving fails', async () => {
  const user = userEvent.setup()
  jest.mocked(setVideoVisibility).mockResolvedValueOnce({ success: false, error: 'request_failed' })
    .mockResolvedValueOnce({ success: true, data: { video_id: item.id, is_active: false } })
  render(<MediaLinkCard link={link} lang="en" onEdit={jest.fn()} onChanged={onSaved} />)
  const toggle = screen.getByRole('switch', { name: 'Visible to students: Hallo' })
  await user.click(toggle)
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(toggle).toHaveAttribute('aria-checked', 'true')
  await user.click(toggle)
  await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'))
  expect(setVideoVisibility).toHaveBeenLastCalledWith({ video_id: item.id, is_active: false })
})

it('removes a link only after confirmation', async () => {
  const user = userEvent.setup()
  const confirm = jest.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
  jest.mocked(deleteMediaLink).mockResolvedValue({ success: true, data: { video_id: item.id } })
  render(<MediaLinkCard link={link} lang="de" onEdit={jest.fn()} onChanged={onSaved} />)
  const remove = screen.getByRole('button', { name: `${t.remove}: Hallo` })
  await user.click(remove)
  expect(deleteMediaLink).not.toHaveBeenCalled()
  await user.click(remove)
  await waitFor(() => expect(deleteMediaLink).toHaveBeenCalledWith({ video_id: item.id }))
  expect(onSaved).toHaveBeenCalled()
  confirm.mockRestore()
})

it('shows folder links inside their folder for students, once, and hides hidden ones', () => {
  const inFolder = folder({ links: [link, { ...link, id: 'hidden', title: 'Versteckt', isActive: false }] })
  render(<VideoLibrary {...buildMediaLibrary({ videos: [{ ...item, folder_id: inFolder.folder_id }], folders: [inFolder], looseTitle: 'Weitere Videos' })} lang="de" level="A1.1" translations={{}} />)
  const group = screen.getByRole('heading', { name: 'Lektion 1' }).closest('section')!
  expect(within(group).getByRole('link', { name: '„Hallo“ in einem neuen Fenster öffnen' })).toHaveAttribute('href', link.url)
  expect(screen.getAllByRole('link', { name: '„Hallo“ in einem neuen Fenster öffnen' })).toHaveLength(1)
  expect(screen.queryByText('Versteckt')).not.toBeInTheDocument()
  expect(screen.getByText(copy.external_privacy)).toBeInTheDocument()
})

it('shows an active DW resource as an outbound link and keeps empty drafts out of the student library', () => {
  render(<VideoLibrary {...buildMediaLibrary({ videos: [item, { ...item, id: 'draft', title: 'Unfertig', source_url: null, is_active: false }], folders: [], looseTitle: 'Weitere Videos' })} lang="ru" level="A1.1" translations={{}} />)
  const outbound = screen.getByRole('link', { name: '„Hallo“ in einem neuen Fenster öffnen' })
  expect(outbound).toHaveAttribute('href', item.source_url)
  expect(outbound).toHaveAttribute('rel', 'noopener noreferrer')
  expect(screen.getByText(copy.external_privacy)).toBeInTheDocument()
  expect(screen.queryByText('Unfertig')).not.toBeInTheDocument()
})

it('shows published MP4 uploads without an external URL and hides unpublished uploads', () => {
  const uploaded = { ...item, source_url: null, storage_path: 'A1.1/folder/videos/video.mp4', file_size: 1024 }
  render(<VideoLibrary {...buildMediaLibrary({ videos: [uploaded, { ...uploaded, id: 'hidden', title: 'Hidden upload', is_active: false }], folders: [], looseTitle: 'More videos' })} lang="en" level="A1.1" translations={{}} />)
  expect(screen.getByText('Hallo')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'More videos' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Hallo/ })).toHaveAttribute('aria-haspopup', 'dialog')
  expect(screen.queryByText('Hidden upload')).not.toBeInTheDocument()
  expect(screen.queryByText(copy.empty_internal)).not.toBeInTheDocument()
})
