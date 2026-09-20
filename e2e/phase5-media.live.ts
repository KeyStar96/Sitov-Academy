import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import type { Session } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join, basename } from 'node:path'
import { tmpdir } from 'node:os'
import { mediaCopy } from '../lib/media-i18n'

interface Fixture {
  baseURL: string
  token: string
  allowedOrigins?: string[]
  sessions: { teacher: Session; student: Session; locked: Session }
}

async function sessionContext(browser: Browser, fixture: Fixture, role: keyof Fixture['sessions']) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, acceptDownloads: true })
  const origin = new URL(fixture.baseURL)
  const encoded = `base64-${Buffer.from(JSON.stringify(fixture.sessions[role])).toString('base64url')}`
  const chunks = encoded.match(/.{1,3000}/g)!
  await context.addCookies(chunks.map((value, index) => ({
    name: chunks.length === 1 ? 'sb-sitov-auth-token' : `sb-sitov-auth-token.${index}`,
    value, domain: origin.hostname, path: '/', secure: origin.protocol === 'https:', httpOnly: false, sameSite: 'Lax' as const,
  })))
  const allowed = new Set([origin.origin, ...(fixture.allowedOrigins ?? [])])
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    return allowed.has(url.origin) || ['blob:', 'data:'].includes(url.protocol) ? route.continue() : route.abort()
  })
  await context.addInitScript(() => { if (!localStorage.getItem('theme')) localStorage.setItem('theme', 'light'); localStorage.setItem('academy-contrast', 'standard') })
  return context
}

/** A real one-page PDF with harmless whitespace before its correct xref table. */
function pdfFile(minimumBytes = 0): Buffer {
  const stream = 'BT /F1 18 Tf 24 90 Td (Phase 5 upload test) Tj ET\n'
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 320 180] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
  ]
  let body = '%PDF-1.4\n', offsets = [0]
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(body)); body += `${index + 1} 0 obj\n${object}\nendobj\n` })
  if (body.length < minimumBytes) body += ' '.repeat(minimumBytes - body.length)
  const xref = Buffer.byteLength(body)
  body += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(body)
}

/** Stored ZIP entries suffice for a tiny, valid empty PPTX presentation. */
function pptxFile(): Buffer {
  const entries: [string, string][] = [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>'],
    ['ppt/presentation.xml', '<?xml version="1.0" encoding="UTF-8"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldIdLst/><p:sldSz cx="9144000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>'],
  ]
  const locals: Buffer[] = [], central: Buffer[] = []
  let offset = 0
  for (const [path, text] of entries) {
    const name = Buffer.from(path), data = Buffer.from(text)
    let crc = 0xffffffff
    for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0) }
    crc = (crc ^ 0xffffffff) >>> 0
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4)
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26)
    const directory = Buffer.alloc(46); directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6)
    directory.writeUInt32LE(crc, 16); directory.writeUInt32LE(data.length, 20); directory.writeUInt32LE(data.length, 24); directory.writeUInt16LE(name.length, 28); directory.writeUInt32LE(offset, 42)
    locals.push(local, name, data); central.push(directory, name); offset += local.length + name.length + data.length
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, directory, end])
}

async function canvasVideo(page: Page): Promise<Buffer> {
  const data = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180
    const surface = canvas.getContext('2d')!, stream = canvas.captureStream(10), recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' })
    const chunks: BlobPart[] = []
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
    const completed = new Promise<string>(resolve => { recorder.onstop = async () => {
      const bytes = new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer())
      resolve(btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')))
    } })
    recorder.start()
    for (let frame = 0; frame < 6; frame++) {
      surface.fillStyle = frame % 2 ? '#0F172A' : '#334155'; surface.fillRect(0, 0, 320, 180)
      surface.fillStyle = '#FFFFFF'; surface.font = '20px sans-serif'; surface.fillText('Phase 5 test video', 30, 90)
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    recorder.stop(); stream.getTracks().forEach(track => track.stop())
    return completed
  })
  return Buffer.from(data, 'base64')
}

test('live self-hosted media: resumed 35 MiB TUS, viewers, downloads, access gates and contrast', async ({ browser }, testInfo) => {
  const source = process.env.E2E_MEDIA_FIXTURE_FILE
  if (!source) throw new Error('Root must provision temporary live media fixtures and explicitly enable this test.')
  const fixture = JSON.parse(await readFile(source, 'utf8')) as Fixture
  if (!fixture.sessions?.teacher?.access_token || !fixture.sessions.student?.access_token || !fixture.sessions.locked?.access_token || !/^[0-9a-f-]{36}$/.test(fixture.token)) throw new Error('Invalid private media fixture file')
  const origin = new URL(fixture.baseURL).origin, t = mediaCopy('ru'), folderTitle = `Phase5 ${fixture.token} ${Date.now()}`
  const contexts: BrowserContext[] = []
  const directory = join(tmpdir(), 'sitov-phase5-media', fixture.token); await mkdir(directory, { recursive: true, mode: 0o700 })
  const largePath = join(directory, `phase5-large-${fixture.token}.pdf`), smallPdf = join(directory, `phase5-small-${fixture.token}.pdf`), presentation = join(directory, `phase5-deck-${fixture.token}.pptx`)
  const largeBytes = pdfFile(35 * 1024 * 1024)
  await writeFile(largePath, largeBytes, { mode: 0o600 }); await writeFile(smallPdf, pdfFile(), { mode: 0o600 }); await writeFile(presentation, pptxFile(), { mode: 0o600 })
  const assetPaths: string[] = [], requests: { method: string; offset: number; path: string }[] = []
  let folderId = '', releasePatch: (() => void) | undefined
  try {
    console.info('[media-live] Authenticating the provided teacher session')
    const teacher = await sessionContext(browser, fixture, 'teacher'); contexts.push(teacher)
    const page = await teacher.newPage()
    page.setDefaultTimeout(20000); page.setDefaultNavigationTimeout(30000)
    page.on('pageerror', () => console.info('[media-live] Browser reported a JavaScript error'))
    page.on('response', response => { if (new URL(response.url()).pathname.endsWith('.js') && !response.ok()) console.info(`[media-live] JavaScript resource returned HTTP ${response.status()}`) })
    page.on('requestfailed', request => { const url = new URL(request.url()); if (url.pathname.endsWith('.js')) console.info(`[media-live] JavaScript resource request failed: ${url.origin}${url.pathname}`) })
    page.on('request', request => {
      if (!/\/storage\/v1\/upload\/resumable(?:[/?]|$)/.test(request.url())) return
      const headers = request.headers(), method = request.method()
      requests.push({ method, offset: Number(headers['upload-offset'] ?? 0), path: new URL(request.url()).pathname })
      const object = (headers['upload-metadata'] ?? '').split(',').map(value => value.trim().split(' ')).find(([name]) => name === 'objectName')?.[1]
      if (object) assetPaths.push(Buffer.from(object, 'base64').toString())
    })
    await page.goto(`${origin}/ru/admin/content/media`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    console.info('[media-live] Teacher page DOM loaded')
    await page.waitForLoadState('load', { timeout: 30000 })
    await expect(page.getByRole('heading', { name: t.title, exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: folderTitle, exact: true })).not.toBeVisible()
    const previousFolderId = await page.getByRole('combobox', { name: t.selectFolder, exact: true }).inputValue()
    await page.getByRole('combobox', { name: t.level, exact: true }).selectOption('A1.1')
    await page.getByLabel(t.order, { exact: true }).fill('7')
    await page.getByLabel(t.name, { exact: true }).fill(folderTitle)
    await expect(page.getByRole('combobox', { name: t.level, exact: true })).toHaveValue('A1.1')
    await expect(page.getByLabel(t.name, { exact: true })).toHaveValue(folderTitle)
    await expect(page.getByLabel(t.order, { exact: true })).toHaveValue('7')
    await page.getByRole('button', { name: t.save, exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: t.saved })).toBeVisible()
    await expect(page.getByRole('combobox', { name: t.selectFolder, exact: true })).not.toHaveValue(previousFolderId)
    await expect(page.getByRole('heading', { name: folderTitle, exact: true })).toBeVisible()
    console.info('[media-live] Folder created; checking rename and ordering')
    folderId = await page.getByRole('combobox', { name: t.selectFolder, exact: true }).inputValue()
    await page.getByRole('button', { name: t.edit, exact: true }).click()
    await page.getByLabel(t.name, { exact: true }).fill(`${folderTitle} edited`)
    await page.getByLabel(t.order, { exact: true }).fill('9')
    await page.getByRole('button', { name: t.save, exact: true }).click()
    await expect(page.getByRole('heading', { name: `${folderTitle} edited`, exact: true })).toBeVisible()
    await page.getByRole('button', { name: t.edit, exact: true }).click()
    await expect(page.getByLabel(t.order, { exact: true })).toHaveValue('9')
    await expect(page.getByRole('combobox', { name: t.level, exact: true })).toHaveValue('A1.1')
    await page.getByLabel(t.name, { exact: true }).fill(folderTitle)
    await page.getByRole('button', { name: t.save, exact: true }).click()
    await expect(page.getByRole('heading', { name: folderTitle, exact: true })).toBeVisible()

    let hold = true, interruptResumedPatch = false, transientFailures = 0
    const gate = new Promise<void>(resolve => { releasePatch = resolve })
    await page.route(/\/storage\/v1\/upload\/resumable(?:[/?]|$)/, async route => {
      if (route.request().method() === 'PATCH' && hold) {
        hold = false; await gate
        // The real browser aborts this in-flight request when Pause is clicked.
        try { await route.continue() } catch { /* Request was already aborted by Pause. */ }
      } else if (route.request().method() === 'PATCH' && interruptResumedPatch) {
        interruptResumedPatch = false; transientFailures++
        await route.abort('connectionreset')
      } else await route.continue()
    })
    await page.getByLabel(t.choose, { exact: true }).setInputFiles(largePath)
    await page.getByRole('button', { name: t.start, exact: true }).click()
    console.info('[media-live] Upload started; waiting for the first persisted TUS chunk')
    await expect.poll(() => hold, { timeout: 60000, message: 'Storage must accept the first chunk and reach a resumable PATCH' }).toBe(false)
    const pausedOffset = requests.find(request => request.method === 'PATCH')!.offset
    expect(pausedOffset).toBeGreaterThan(0)
    console.info(`[media-live] First TUS chunk persisted (${pausedOffset} bytes); pausing and reloading`)
    await page.getByRole('button', { name: t.pause, exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: t.paused })).toBeVisible()
    releasePatch(); releasePatch = undefined
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForLoadState('load', { timeout: 30000 })
    await page.getByRole('combobox', { name: t.selectFolder, exact: true }).selectOption(folderId)
    await expect(page.getByRole('heading', { name: folderTitle, exact: true })).toBeVisible()
    await page.getByLabel(t.choose, { exact: true }).setInputFiles(largePath)
    await expect(page.getByRole('button', { name: t.start, exact: true })).toBeEnabled()
    interruptResumedPatch = true
    const resumed = page.waitForResponse(response => response.request().method() === 'HEAD' && /\/storage\/v1\/upload\/resumable\//.test(response.url()))
    await page.getByRole('button', { name: t.start, exact: true }).click()
    const resumedResponse = await resumed
    expect(resumedResponse.status()).toBe(200)
    expect(Number(resumedResponse.headers()['upload-offset'])).toBeGreaterThan(0)
    console.info(`[media-live] TUS resumed after reload (${Number(resumedResponse.headers()['upload-offset'])} bytes); testing transient network failure and completion`)
    await expect(page.getByRole('heading', { name: basename(largePath), exact: true })).toBeVisible({ timeout: 120000 })
    const largeRequests = [...requests]
    expect(transientFailures).toBe(1)
    expect(largeRequests.filter(request => request.method === 'POST')).toHaveLength(1)
    const largeRemotePath = assetPaths[0]
    expect(largeRemotePath.startsWith(`A1.1/${folderId}/presentations/`)).toBe(true)
    console.info('[media-live] Large resumed upload published; uploading real WebM, small PDF and PPTX')

    const videoPath = join(directory, `phase5-video-${fixture.token}.webm`)
    await writeFile(videoPath, await canvasVideo(page), { mode: 0o600 })
    for (const file of [smallPdf, videoPath, presentation]) {
      await page.getByLabel(t.choose, { exact: true }).setInputFiles(file)
      await page.getByRole('button', { name: t.start, exact: true }).click()
      const label = file.endsWith('.webm') ? basename(file, '.webm') : basename(file)
      await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible({ timeout: 60000 })
    }

    const student = await sessionContext(browser, fixture, 'student'); contexts.push(student)
    console.info('[media-live] All uploads published; checking student viewers and downloads')
    const studentPage = await student.newPage()
    await studentPage.goto(`${origin}/ru/dashboard/level/A1.1/media`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await studentPage.waitForLoadState('load', { timeout: 30000 })
    await expect(studentPage.getByRole('heading', { name: folderTitle, exact: true })).toBeVisible()
    const studentFolder = studentPage.locator('section').filter({ has: studentPage.getByRole('heading', { name: folderTitle, exact: true }) })
    const videoArticle = studentFolder.getByRole('article').filter({ has: studentPage.getByRole('heading', { name: basename(videoPath, '.webm'), exact: true }) })
    await videoArticle.getByRole('button', { name: t.open, exact: true }).click()
    const video = videoArticle.locator('video')
    await expect(video).toBeVisible()
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.readyState)).toBeGreaterThanOrEqual(2)
    await video.evaluate((element: HTMLVideoElement) => element.play())
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0)
    await videoArticle.getByRole('button', { name: t.close, exact: true }).click()
    const pdfArticle = studentFolder.getByRole('article').filter({ has: studentPage.getByRole('heading', { name: basename(smallPdf), exact: true }) })
    const pdfLoaded = studentPage.waitForResponse(response => response.request().method() === 'GET' && new URL(response.url()).pathname.endsWith('.pdf'))
    await pdfArticle.getByRole('button', { name: t.open, exact: true }).click()
    await expect(pdfArticle.locator('iframe')).toBeVisible()
    expect([200, 206].includes((await pdfLoaded).status())).toBe(true)
    await pdfArticle.getByRole('button', { name: t.close, exact: true }).click()
    const largeArticle = studentFolder.getByRole('article').filter({ has: studentPage.getByRole('heading', { name: basename(largePath), exact: true }) })
    const downloadEvent = studentPage.waitForEvent('download')
    await largeArticle.getByRole('button', { name: t.download, exact: true }).click()
    const download = await downloadEvent, downloadedPath = join(directory, 'downloaded-large.pdf')
    await download.saveAs(downloadedPath)
    expect((await stat(downloadedPath)).size).toBe(largeBytes.length)
    const expectedHash = createHash('sha256').update(largeBytes).digest('hex')
    expect(createHash('sha256').update(await readFile(downloadedPath)).digest('hex')).toBe(expectedHash)
    const signed = await student.request.post(`${origin}/api/course-assets`, { data: { path: largeRemotePath, download: true } })
    expect(signed.status()).toBe(200)
    const signedBody = await signed.json()
    expect(signedBody.expiresIn).toBe(60)
    expect(new URL(signedBody.url).origin === origin || fixture.allowedOrigins?.includes(new URL(signedBody.url).origin)).toBeTruthy()
    expect(signed.headers()['cache-control']).toBe('private, no-store')
    const signedToken = new URL(signedBody.url).searchParams.get('token')
    expect(Boolean(signedToken)).toBe(true)
    const signedClaims = JSON.parse(Buffer.from(signedToken!.split('.')[1], 'base64url').toString())
    const remainingSeconds = signedClaims.exp - Math.floor(Date.now() / 1000)
    expect(remainingSeconds).toBeGreaterThan(0)
    expect(remainingSeconds).toBeLessThanOrEqual(61)
    const deckArticle = studentFolder.getByRole('article').filter({ has: studentPage.getByRole('heading', { name: basename(presentation), exact: true }) })
    const deckDownload = studentPage.waitForEvent('download')
    await deckArticle.getByRole('button', { name: t.download, exact: true }).click()
    const downloadedDeck = join(directory, 'downloaded-deck.pptx')
    await (await deckDownload).saveAs(downloadedDeck)
    expect(createHash('sha256').update(await readFile(downloadedDeck)).digest('hex')).toBe(createHash('sha256').update(await readFile(presentation)).digest('hex'))

    const locked = await sessionContext(browser, fixture, 'locked'); contexts.push(locked)
    console.info('[media-live] Download hashes and signed expiry verified; checking locked access and both themes')
    const lockedPage = await locked.newPage()
    await lockedPage.goto(`${origin}/ru/dashboard/level/A1.1/media`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await lockedPage.waitForLoadState('load', { timeout: 30000 })
    expect((await lockedPage.content()).includes(folderTitle)).toBe(false)
    expect((await locked.request.post(`${origin}/api/course-assets`, { data: { path: largeRemotePath } })).status()).toBe(403)
    for (const theme of ['light', 'dark']) {
      for (const target of [page, studentPage]) {
        await target.evaluate(value => { localStorage.setItem('theme', value) }, theme)
        await target.reload({ waitUntil: 'load', timeout: 30000 })
        if (target === page) {
          await target.getByRole('combobox', { name: t.selectFolder, exact: true }).selectOption(folderId)
          await expect(target.getByRole('heading', { name: folderTitle, exact: true })).toBeVisible()
        }
        if (theme === 'dark') await expect(target.locator('html')).toHaveClass(/dark/)
        else await expect(target.locator('html')).not.toHaveClass(/dark/)
        expect((await new AxeBuilder({ page: target }).analyze()).violations).toEqual([])
        console.info(`[media-live] Unfiltered axe passed: ${target === page ? 'teacher' : 'student'} ${theme}`)
      }
    }
    const evidencePath = testInfo.outputPath('media-verification.json')
    await writeFile(evidencePath, JSON.stringify({
      origin, folderId, fixtureToken: fixture.token, assets: assetPaths, largeBytes: largeBytes.length,
      sha256: expectedHash, pausedOffset, resumedOffset: Number(resumedResponse.headers()['upload-offset']),
      tusCreationsForLargeFile: largeRequests.filter(request => request.method === 'POST').length, transientFailures,
      signedExpiresIn: signedBody.expiresIn, lockedStatus: 403, axeThemes: ['light', 'dark'],
    }, null, 2), { mode: 0o600 })
    await testInfo.attach('media-verification', { contentType: 'application/json', path: evidencePath })
    await page.screenshot({ path: testInfo.outputPath('teacher-media-dark.png') })
    await studentPage.screenshot({ path: testInfo.outputPath('student-media-dark.png') })
  } finally {
    releasePatch?.()
    await Promise.all(contexts.map(context => context.close()))
    // Root owns remote cleanup, including partial TUS objects and generated units.
  }
})
