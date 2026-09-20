/** @jest-environment node */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'

// Execute the actual embedded container script with an in-memory S3 adapter.
// No network, Docker command, remote filesystem or credentials are involved.
const source = readFileSync(join(process.cwd(), 'deploy/vps/tests/phase5-media-fixture.py'), 'utf8')
const script = source.split("TUS_CLEANUP_JS = r'''\n")[1].split("\n'''", 1)[0]
const folder = { folder_id: '00000000-0000-4000-8000-000000000001', level: 'A1.1' }
const prefix = `storage-single-tenant/course-assets/A1.1/${folder.folder_id}/`
const base = `${prefix}presentations/00000000-0000-4000-8000-000000000002.pdf/00000000-0000-4000-8000-000000000003`
const plan = {
  bucket: 'fixture-storage', tenant: 'storage-single-tenant',
  folders: [{ ...folder, prefix, objects: [{ Key: `${base}.info` }, { Key: `${base}.part` }], multipart: [{ Key: base, UploadId: 'own-upload' }] }],
}
async function run(mode: string, input: unknown, replies: Record<string, unknown[]> = {}) {
  const calls: { type: string; input: any }[] = [], logs: string[] = [], errors: string[] = []
  const processMock = { argv: ['node', mode], exitCode: 0 }
  const sdk: Record<string, any> = {}
  for (const type of ['ListObjectsV2Command', 'ListMultipartUploadsCommand', 'AbortMultipartUploadCommand', 'DeleteObjectsCommand']) {
    sdk[type] = class { type = type; constructor(public input: unknown) {} }
  }
  sdk.S3Client = class {
    async send(command: { type: string; input: any }) {
      calls.push({ type: command.type, input: command.input })
      return replies[command.type]?.shift() ?? {}
    }
    destroy() {}
  }
  const config = { storageBackendType: 's3', storageS3Bucket: 'fixture-storage', tenantId: 'storage-single-tenant', tusUseFileVersionSeparator: false }
  await runInNewContext(script, {
    require: (name: string) => {
      if (name === 'node:fs') return { readFileSync: () => JSON.stringify(input) }
      if (name === '/app/dist/config') return { getConfig: () => config }
      if (name === '/app/node_modules/@aws-sdk/client-s3') return sdk
      throw new Error('Unexpected dependency')
    },
    process: processMock, console: { log: (value: string) => logs.push(value), error: (value: string) => errors.push(value) },
  })
  return { calls, logs, errors, exitCode: processMock.exitCode }
}
const mutations = (calls: Awaited<ReturnType<typeof run>>['calls']) => calls.filter(call => ['AbortMultipartUploadCommand', 'DeleteObjectsCommand'].includes(call.type))

it('inventories both orphaned TUS sidecars using only the exact fixture prefix', async () => {
  const result = await run('inventory', [folder], { ListObjectsV2Command: [{ Contents: [{ Key: `${base}.info` }, { Key: `${base}.part` }] }] })
  expect(result.exitCode).toBe(0); expect(mutations(result.calls)).toHaveLength(0)
  expect(JSON.parse(result.logs[0]).folders[0].objects).toEqual([{ Key: `${base}.info` }, { Key: `${base}.part` }])
  expect(result.calls.every(call => call.input.Prefix === prefix)).toBe(true)
})
it('aborts the saved multipart identity before deleting the saved include-list, including .part', async () => {
  const result = await run('cleanup', plan)
  expect(result.exitCode).toBe(0)
  expect(mutations(result.calls)).toEqual([
    { type: 'AbortMultipartUploadCommand', input: { Bucket: 'fixture-storage', Key: base, UploadId: 'own-upload' } },
    { type: 'DeleteObjectsCommand', input: { Bucket: 'fixture-storage', Delete: { Objects: [{ Key: `${base}.info` }, { Key: `${base}.part` }] } } },
  ])
  expect(JSON.parse(result.logs[0])).toEqual({ removedObjects: 2, abortedUploads: 1, remainingObjects: 0, remainingMultipart: 0 })
})
it('validates every folder before mutating even the first valid folder', async () => {
  const bad = { ...plan, folders: [plan.folders[0], { ...plan.folders[0], objects: [{ Key: 'storage-single-tenant/course-assets/customer/private.pdf' }] }] }
  const result = await run('cleanup', bad)
  expect(result.exitCode).toBe(1); expect(mutations(result.calls)).toHaveLength(0)
})
it('rejects a changed bucket, path traversal, unknown filename, or incomplete inventory', async () => {
  expect((await run('cleanup', { ...plan, bucket: 'other-bucket' })).exitCode).toBe(1)
  for (const Key of [`${prefix}../other/object`, `${prefix}presentations/customer-name.pdf`]) {
    const result = await run('inventory', [folder], { ListObjectsV2Command: [{ Contents: [{ Key }] }] })
    expect(result.exitCode).toBe(1); expect(mutations(result.calls)).toHaveLength(0)
  }
  const result = await run('inventory', [folder], { ListObjectsV2Command: [{ IsTruncated: true }] })
  expect(result.exitCode).toBe(1); expect(mutations(result.calls)).toHaveLength(0)
})
it('reports concurrently arriving uploads instead of broadening the deletion plan', async () => {
  const extra = `${prefix}videos/00000000-0000-4000-8000-000000000004.webm/00000000-0000-4000-8000-000000000005.part`
  const result = await run('cleanup', plan, { ListObjectsV2Command: [{ Contents: [{ Key: extra }] }] })
  expect(result.exitCode).toBe(1)
  expect(result.calls.filter(call => call.type === 'DeleteObjectsCommand')).toHaveLength(1)
  expect(JSON.stringify(mutations(result.calls))).not.toContain(extra)
})
