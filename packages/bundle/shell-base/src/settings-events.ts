/** Settings-only Host notifications with stream-owned subscriptions. */
import type { Context } from '@deepseek-ai/cordis'
import type { TypertRemoteEventFrame, TypertRemoteEventSource } from '@deepseek-ai/dsh-api-gateway'
import type {} from '@deepseek-ai/dsh-settings'

/**
 * Create the source selected by the shell's Gateway registration.
 * @param ctx - owning shell plugin context.
 * @returns a source whose listeners leave with each stream.
 */
export function settingsEvents(ctx: Context): TypertRemoteEventSource {
  return async function* (signal) {
    const pending = new Map<string, TypertRemoteEventFrame>()
    let wake: (() => void) | undefined
    const abort = (): void => { wake?.() }
    // Generator suspension can change cancellation between frames.
    const cancelled = (): boolean => signal.aborted
    const dispose = ctx.on('settings/document-updated', (ns, revision) => {
      pending.set(ns, { event: 'settings/document-updated', args: [ns, revision] })
      wake?.()
    })
    signal.addEventListener('abort', abort, { once: true })
    try {
      while (!cancelled()) {
        // Only the latest invalidation for a namespace matters: clients re-read its snapshot.
        const batch = [...pending.values()]
        pending.clear()
        for (const frame of batch) {
          if (cancelled()) return
          yield frame
        }
        if (pending.size === 0 && !cancelled()) {
          await new Promise<void>((resolve) => { wake = resolve })
          wake = undefined
        }
      }
    } finally {
      dispose()
      signal.removeEventListener('abort', abort)
      pending.clear()
    }
  }
}
