// @vitest-environment jsdom
/**
 * Base bench behavior: real Cordis + SlotRegistry + production renderer with no
 * Session or Workspace mounts. Covers assembly without business services, root
 * rendering through the production entry, the feature mount/dispose cascade, and
 * idempotent teardown — the surface base UI specs rely on.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { SlotTestBench } from '../src/index.ts'

afterEach(cleanup)

describe('SlotTestBench', () => {
  it('assembles slots and the Remote double without Session or Workspace services', async () => {
    const bench = await SlotTestBench.create()
    try {
      expect(bench.ctx.get('slots')).toBeDefined()
      expect(bench.ctx.get('remote')).toBe(bench.remote)
      // Base UI renders the root scope: no business service is mounted beside it.
      for (const name of ['sessions', 'workspaces', 'fileUpload', 'sessionController']) {
        expect(bench.ctx.get(name), name).toBeUndefined()
      }
    } finally { await bench.dispose() }
  })

  it('renders a root registration through the production entry and drops it with the fiber', async () => {
    const bench = await SlotTestBench.create()
    try {
      const handle = await bench.mount({
        inject: ['slots'],
        apply(ctx) {
          return ctx.slots.register({ name: 'root' }, () => <h1>base shell</h1>)
        },
      })
      const view = bench.renderRoot()
      expect(view.container.textContent).toBe('base shell')
      view.unmount()
      await handle.dispose()
      expect(bench.slots.renderSlot).toBeDefined()
    } finally { await bench.dispose() }
  })

  it('rejects a mount whose required services are absent instead of suspending', async () => {
    const bench = await SlotTestBench.create()
    try {
      await expect(bench.mount({ inject: ['missingService'], apply: () => {} }))
        .rejects.toThrow('mount would suspend: missing service(s) missingService')
    } finally { await bench.dispose() }
  })

  it('disposes idempotently', async () => {
    const bench = await SlotTestBench.create()
    await bench.dispose()
    await bench.dispose()
  })
})
