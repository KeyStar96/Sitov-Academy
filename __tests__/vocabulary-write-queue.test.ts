import { createOrderedWriteQueue } from '@/lib/vocabulary-write-queue'

function deferred<T>() {
  let resolve!: (result: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { resolve, promise }
}
const settle = async () => { await Promise.resolve(); await Promise.resolve() }

it('serializes rapid writes while accepting new intents without blocking', async () => {
  const first = deferred<boolean>()
  const last = deferred<boolean>()
  const write = jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(last.promise)
  const onDrained = jest.fn()
  const queue = createOrderedWriteQueue<number, boolean>({ write, accepted: Boolean, onAccepted: jest.fn(), onBlocked: jest.fn(), onDrained })
  queue.enqueue(1); queue.enqueue(2)
  expect(queue.pending).toEqual([1, 2]); expect(write.mock.calls).toEqual([[1]])
  first.resolve(true); await settle()
  expect(write.mock.calls).toEqual([[1], [2]]); expect(onDrained).not.toHaveBeenCalled()
  last.resolve(true); await settle()
  expect(queue.pending).toEqual([]); expect(onDrained).toHaveBeenCalledTimes(1)
})
it('retains rejected and later intents, without repeating earlier accepted work', async () => {
  const blocked = jest.fn()
  const write = jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockResolvedValue(true)
  const accepted = jest.fn()
  const queue = createOrderedWriteQueue<number, boolean>({ write, accepted: Boolean, onAccepted: accepted, onBlocked: blocked, onDrained: jest.fn() })
  queue.enqueue(1); queue.enqueue(2); queue.enqueue(3)
  await settle(); await settle()
  expect(queue.pending).toEqual([2, 3]); expect(queue.blocked).toBe(true)
  expect(accepted.mock.calls.map(([item]) => item)).toEqual([1])
  queue.retry(); await settle(); await settle()
  expect(write.mock.calls.map(([item]) => item)).toEqual([1, 2, 2, 3])
  expect(queue.pending).toEqual([]); expect(queue.blocked).toBe(false)
})
it('guards duplicate retry clicks while the same request is still in flight', async () => {
  const retry = deferred<boolean>()
  const write = jest.fn().mockRejectedValueOnce(new Error('offline')).mockReturnValueOnce(retry.promise)
  const queue = createOrderedWriteQueue<string, boolean>({ write, accepted: Boolean, onAccepted: jest.fn(), onBlocked: jest.fn(), onDrained: jest.fn() })
  queue.enqueue('stable-request-id'); await settle()
  queue.retry(); queue.retry(); queue.retry()
  expect(write).toHaveBeenCalledTimes(2)
  retry.resolve(true); await settle()
  expect(queue.pending).toEqual([])
})

it('continues ordered writes when post-commit callbacks throw, without replaying confirmed answers', async () => {
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  try {
    const write = jest.fn().mockResolvedValue(true)
    const onAccepted = jest.fn((_item: number) => { throw new Error('storage notification failed') })
    const onDrained = jest.fn(() => { throw new Error('navigation notification failed') })
    const queue = createOrderedWriteQueue<number, boolean>({ write, accepted: Boolean, onAccepted, onBlocked: jest.fn(), onDrained })
    queue.enqueue(1); queue.enqueue(2)
    await settle(); await settle()
    queue.retry()
    queue.enqueue(3)
    await settle()
    expect(write.mock.calls.map(([item]) => item)).toEqual([1, 2, 3])
    expect(onAccepted.mock.calls.map(([item]) => item)).toEqual([1, 2, 3])
    expect(queue.pending).toEqual([])
    expect(queue.blocked).toBe(false)
    expect(onDrained).toHaveBeenCalled()
    expect(errorLog).toHaveBeenCalled()
  } finally {
    errorLog.mockRestore()
  }
})

it('retains retryable work even when the failure notification throws', async () => {
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  try {
    const write = jest.fn().mockResolvedValueOnce(false).mockResolvedValue(true)
    const queue = createOrderedWriteQueue<number, boolean>({ write, accepted: Boolean, onAccepted: jest.fn(),
      onBlocked: () => { throw new Error('notification failed') }, onDrained: jest.fn() })
    queue.enqueue(1); queue.enqueue(2)
    await settle()
    expect(queue.pending).toEqual([1, 2])
    expect(queue.blocked).toBe(true)
    queue.retry()
    await settle(); await settle()
    expect(write.mock.calls.map(([item]) => item)).toEqual([1, 1, 2])
    expect(queue.pending).toEqual([])
    expect(queue.blocked).toBe(false)
  } finally {
    errorLog.mockRestore()
  }
})
