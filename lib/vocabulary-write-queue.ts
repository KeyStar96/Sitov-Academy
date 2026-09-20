/** Ordered background writes. A failed item and every later intent stay queued. */
export interface OrderedWriteQueue<Item> {
  readonly pending: readonly Item[]
  readonly blocked: boolean
  enqueue: (item: Item) => void
  retry: () => void
}

export function createOrderedWriteQueue<Item, Result>(options: {
  write: (item: Item) => Promise<Result>
  accepted: (result: Result, item: Item) => boolean
  onAccepted: (item: Item, result: Result) => void
  onBlocked: (pending: readonly Item[]) => void
  onDrained: () => void
}): OrderedWriteQueue<Item> {
  const pending: Item[] = []
  let running = false
  let blocked = false

  function notify(callback: () => void) {
    try {
      callback()
    } catch (error) {
      // UI/storage notifications cannot invalidate or repeat a committed write.
      console.error("Vocabulary queue callback failed:")
    }
  }

  async function drain() {
    if (running || blocked) return
    running = true
    while (pending.length) {
      const item = pending[0]
      let result: Result
      try {
        result = await options.write(item)
        if (!options.accepted(result, item)) throw new Error('write_rejected')
      } catch {
        blocked = true
        running = false
        notify(() => options.onBlocked([...pending]))
        return
      }
      pending.shift()
      notify(() => options.onAccepted(item, result))
    }
    running = false
    notify(options.onDrained)
  }

  return {
    get pending() { return pending },
    get blocked() { return blocked },
    enqueue(item) {
      pending.push(item)
      void drain()
    },
    retry() {
      blocked = false
      void drain()
    },
  }
}
