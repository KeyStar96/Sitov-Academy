import { act, fireEvent, render, screen } from '@testing-library/react'
import MediaAssetViewer from '@/components/dashboard/MediaAssetViewer'
import type { MediaAsset } from '@/lib/media'

const asset: MediaAsset = { id: 'video-id', title: 'Lesson recording', path: 'A1.1/folder/videos/video.mp4', bytes: 2048, mime: 'video/mp4', kind: 'videos' }
const firstUrl = 'https://academy.example/supabase/storage/v1/object/sign/course-assets/video.mp4?token=first'
const secondUrl = 'https://academy.example/supabase/storage/v1/object/sign/course-assets/video.mp4?token=renewed'
const originalFetch = global.fetch
const request = jest.fn()
const response = (url = firstUrl) => ({ ok: true, json: async () => ({ url, expiresIn: 60 }) })
let pause: jest.SpyInstance
beforeEach(() => {
  jest.useFakeTimers(); request.mockReset(); request.mockResolvedValue(response())
  global.fetch = request
  pause = jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
})
afterEach(() => {
  jest.clearAllTimers(); jest.useRealTimers(); pause.mockRestore(); global.fetch = originalFetch
})
async function click(name: string) {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name })) })
}

it('requests a fresh authorized URL on open and only then attaches it to the video', async () => {
  const { container } = render(<MediaAssetViewer asset={asset} lang="de" />)
  expect(container.querySelector('video')).toBeNull(); expect(request).not.toHaveBeenCalled()
  await click('Öffnen')
  expect(request).toHaveBeenCalledWith('/api/course-assets', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: asset.path, download: false }), cache: 'no-store',
  })
  expect(container.querySelector('video')).toHaveAttribute('src', firstUrl)
})

it('requests attachment signing for downloads and does not leave a viewer or timer open', async () => {
  const clicked: { href: string; download: string; connected: boolean }[] = []
  const anchorClick = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push({ href: this.href, download: this.download, connected: this.isConnected })
  })
  try {
    const { container } = render(<MediaAssetViewer asset={{ ...asset, kind: 'presentations', mime: 'application/pdf' }} lang="de" />)
    await click('Herunterladen')
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ path: asset.path, download: true })
    expect(clicked).toEqual([{ href: firstUrl, download: asset.title, connected: true }])
    expect(document.querySelector('a[download]')).toBeNull(); expect(container.querySelector('iframe')).toBeNull()
    await act(async () => jest.advanceTimersByTime(90000))
    expect(request).toHaveBeenCalledTimes(1)
  } finally { anchorClick.mockRestore() }
})

it('reauthorizes at 45 seconds and preserves the playback position when the URL changes', async () => {
  request.mockResolvedValueOnce(response()).mockResolvedValueOnce(response(secondUrl))
  const { container } = render(<MediaAssetViewer asset={asset} lang="de" />)
  await click('Öffnen')
  const video = container.querySelector('video')!
  video.currentTime = 123
  await act(async () => jest.advanceTimersByTime(44999))
  expect(request).toHaveBeenCalledTimes(1)
  await act(async () => jest.advanceTimersByTime(1))
  expect(request).toHaveBeenCalledTimes(2)
  expect(video).toHaveAttribute('src', secondUrl)
  video.currentTime = 0
  fireEvent.loadedMetadata(video)
  expect(video.currentTime).toBe(123)
})

it('stops playback, removes the signed URL and reports revoked access on reauthorization', async () => {
  request.mockResolvedValueOnce(response()).mockResolvedValueOnce({ ok: false, status: 403 })
  const { container } = render(<MediaAssetViewer asset={asset} lang="de" />)
  await click('Öffnen')
  await act(async () => jest.advanceTimersByTime(45000))
  expect(pause).toHaveBeenCalledTimes(1)
  expect(container.querySelector('video')).toBeNull()
  expect(screen.getByRole('alert')).toHaveTextContent('Dieses Medium ist derzeit nicht verfügbar')
  await act(async () => jest.advanceTimersByTime(90000))
  expect(request).toHaveBeenCalledTimes(2)
})

it('cancels automatic reauthorization when the viewer is closed or unmounted', async () => {
  const { container, unmount } = render(<MediaAssetViewer asset={asset} lang="de" />)
  await click('Öffnen'); await click('Schließen')
  expect(container.querySelector('video')).toBeNull()
  await act(async () => jest.advanceTimersByTime(90000))
  expect(request).toHaveBeenCalledTimes(1)
  await click('Öffnen'); unmount()
  await act(async () => jest.advanceTimersByTime(90000))
  expect(request).toHaveBeenCalledTimes(2)
})

it('ignores a signing response that arrives after unmount instead of scheduling a new timer', async () => {
  let resolve!: (value: ReturnType<typeof response>) => void
  request.mockImplementationOnce(() => new Promise(done => { resolve = done }))
  const { unmount } = render(<MediaAssetViewer asset={asset} lang="de" />)
  await click('Öffnen'); unmount()
  await act(async () => resolve(response()))
  await act(async () => jest.advanceTimersByTime(90000))
  expect(request).toHaveBeenCalledTimes(1)
})

it('removes student video downloads while keeping playback available', async () => {
  const { container } = render(<MediaAssetViewer asset={asset} lang="en" />)
  expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument()
  await click('Open')
  const video = container.querySelector('video')!
  expect(video).toHaveAttribute('controls')
  expect(video).toHaveAttribute('controlslist', 'nodownload')
  expect(fireEvent.contextMenu(video)).toBe(false)
  expect(JSON.parse(request.mock.calls[0][1].body).download).toBe(false)
})
it('retains the download option in the staff media viewer', async () => {
  const { container } = render(<MediaAssetViewer asset={asset} lang="en" allowVideoDownload />)
  expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument()
  await click('Open')
  expect(container.querySelector('video')).not.toHaveAttribute('controlslist', 'nodownload')
})
