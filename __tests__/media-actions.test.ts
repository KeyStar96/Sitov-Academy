/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
import { createClient } from '@/utils/supabase/server'
import { completeMediaUpload, getMediaFolders, saveMediaFolder } from '@/app/actions/media'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const folder = { folder_id: id(1), title: 'Lessons', level: 'A1.1', course_id: null, sort_order: 0 }
const rpc = jest.fn()
const chain = () => ({
  select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), is: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(), range: jest.fn().mockResolvedValue({ data: [], error: null }),
  in: jest.fn().mockReturnThis(), not: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(), update: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: folder, error: null }),
})
function session(role = 'teacher') {
  const tables = { profiles: chain(), lms_media_folder: chain(), learning_videos: chain(), lms_presentation_asset: chain(), courses: chain() }
  tables.profiles.single.mockResolvedValue({ data: { role }, error: null })
  const from = jest.fn((table: keyof typeof tables) => tables[table])
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: id(90) } } }) }, from, rpc } as never)
  return tables
}
beforeEach(() => jest.clearAllMocks())
it('never truncates a large folder at the PostgREST row limit', async () => {
  const tables = session()
  const videos = Array.from({ length: 500 }, (_, i) => ({ id: id(i + 100), folder_id: folder.folder_id, title: `Video ${i}`, storage_path: `A1.1/${folder.folder_id}/videos/${id(i + 100)}.mp4`, file_size: 100 }))
  tables.lms_media_folder.range.mockResolvedValue({ data: [folder], error: null })
  tables.learning_videos.range.mockResolvedValueOnce({ data: videos, error: null }).mockResolvedValueOnce({ data: [{ ...videos[0], id: id(1000), title: 'Last video' }], error: null })
  const result = await getMediaFolders('A1.1')
  expect(result.success).toBe(true)
  if (result.success) expect(result.data[0].assets).toHaveLength(501)
  expect(tables.learning_videos.range.mock.calls).toEqual([[0, 499], [500, 999]])
  expect(tables.lms_media_folder.eq).toHaveBeenCalledWith('level', 'A1.1')
})
it('does not request asset names when RLS exposes no folders', async () => {
  const tables = session('student')
  expect(await getMediaFolders('B1.1')).toEqual({ success: true, data: [] })
  expect(tables.learning_videos.select).not.toHaveBeenCalled(); expect(tables.lms_presentation_asset.select).not.toHaveBeenCalled()
})
it('requires staff access to upload and edit folders', async () => {
  const tables = session('student')
  expect(await completeMediaUpload({})).toEqual({ success: false, error: 'not_authorized' })
  expect(await saveMediaFolder({})).toEqual({ success: false, error: 'not_authorized' })
  expect(rpc).not.toHaveBeenCalled(); expect(tables.courses.select).not.toHaveBeenCalled()
})
it('derives storage paths from the persisted folder and rejects forged paths', async () => {
  session(); rpc.mockResolvedValue({ data: { asset_id: id(2) }, error: null })
  const input = { asset_id: id(2), folder_id: folder.folder_id, title: 'Lecture', file: { name: 'lecture.pdf', type: 'application/pdf', size: 2048 } }
  expect(await completeMediaUpload({ ...input, storage_path: 'other-level/hidden.pdf' })).toEqual({ success: false, error: 'invalid_input' })
  expect(rpc).not.toHaveBeenCalled()
  expect(await completeMediaUpload(input)).toEqual({ success: true, data: { asset_id: id(2) } })
  expect(rpc).toHaveBeenCalledWith('complete_media_upload', { p_payload: {
    asset_id: id(2), folder_id: folder.folder_id, title: 'Lecture', file_name: 'lecture.pdf', file_size: 2048, mime_type: 'application/pdf', storage_path: `A1.1/${folder.folder_id}/presentations/${id(2)}.pdf`,
  } })
})
it('rejects course bindings in level-only folder input', async () => {
  const tables = session()
  expect(await saveMediaFolder({ ...folder, course_id: id(3) })).toEqual({ success: false, error: 'invalid_input' })
  expect(tables.lms_media_folder.update).not.toHaveBeenCalled()
})

it('saves a folder using its level without any course lookup', async () => {
  const tables = session()
  const input = { folder_id: folder.folder_id, title: folder.title, level: folder.level, sort_order: folder.sort_order }
  expect(await saveMediaFolder(input)).toEqual({ success: true, data: folder })
  expect(tables.lms_media_folder.update).toHaveBeenCalledWith({ title: folder.title, level: 'A1.1', sort_order: 0 })
  expect(tables.courses.select).not.toHaveBeenCalled()
})
