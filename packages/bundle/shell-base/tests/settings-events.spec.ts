/** Settings invalidations are stream-owned and stop at cancellation. */
import { Context } from '@deepseek-ai/cordis'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'
import { describe, expect, it, onTestFinished } from 'vitest'
import { settingsEvents } from '../src/settings-events.ts'

const ns = 'ui-theme' as SettingsNamespace

describe('shell settings events', () => {
  it('forwards settings invalidations and ends a waiting stream on abort', async () => {
    const ctx = new Context()
    onTestFinished(() => ctx.fiber.dispose())
    const abort = new AbortController()
    const stream = settingsEvents(ctx)(abort.signal)[Symbol.asyncIterator]()
    const next = stream.next()
    ctx.emit('settings/document-updated', ns, 1)
    await expect(next).resolves.toEqual({ done: false, value: { event: 'settings/document-updated', args: [ns, 1] } })
    const waiting = stream.next()
    abort.abort()
    await expect(waiting).resolves.toEqual({ done: true, value: undefined })
    ctx.emit('settings/document-updated', ns, 2)
    await expect(stream.next()).resolves.toEqual({ done: true, value: undefined })
  })

  it('coalesces queued invalidations by namespace without forwarding other events', async () => {
    const ctx = new Context()
    onTestFinished(() => ctx.fiber.dispose())
    const abort = new AbortController()
    onTestFinished(() => { abort.abort() })
    const stream = settingsEvents(ctx)(abort.signal)[Symbol.asyncIterator]()
    const next = stream.next()
    ctx.emit('settings/document-updated', ns, 1)
    ctx.emit('settings/document-updated', ns, 2)
    await expect(next).resolves.toEqual({ done: false, value: { event: 'settings/document-updated', args: [ns, 2] } })
    abort.abort()
    await stream.return?.()
  })

  it('does not publish from an already cancelled stream', async () => {
    const ctx = new Context()
    onTestFinished(() => ctx.fiber.dispose())
    const abort = new AbortController()
    abort.abort()
    const stream = settingsEvents(ctx)(abort.signal)[Symbol.asyncIterator]()
    await expect(stream.next()).resolves.toEqual({ done: true, value: undefined })
  })
})
