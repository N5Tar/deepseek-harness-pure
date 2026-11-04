/** Session image capacity admission before service publication. */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context, Service } from '@deepseek-ai/cordis'
import Include from '@deepseek-ai/cordis-plugin-include'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import { describe, expect, it, vi } from 'vitest'
import SessionController from '../src/index.ts'
import { assertImageBodyCapacity } from '../src/image-body-capacity.ts'

const IMAGE_BYTES = 20 * 1024 * 1024
const REQUIRED_BYTES = Math.ceil(IMAGE_BYTES * 4 / 3) + 1024 * 1024

// Keep the real constructor and dependency lifecycle without starting unrelated Session business APIs.
class CapacityController extends SessionController {
  protected override async [Service.init](): Promise<void> {}
}

function provideOtherDependencies(ctx: Context): void {
  for (const name of SessionController.inject) {
    if (name !== 'connection' && name !== 'attachments') ctx.provide(name, {} as never)
  }
}

function provideCapacity(ctx: Context, name: 'connection' | 'attachments', valid = true) {
  return ctx.plugin((scope) => {
    if (name === 'connection') {
      scope.provide('connection', { maxRequestBodyBytes: valid ? REQUIRED_BYTES : REQUIRED_BYTES - 1 } as never)
    } else {
      scope.provide('attachments', { imageLimits: { maxMessageImageBytes: valid ? IMAGE_BYTES : IMAGE_BYTES + 1 } } as never)
    }
  })
}

describe('Session image body capacity', () => {
  it('accepts the exact image budget and rejects one byte less', () => {
    expect(() => { assertImageBodyCapacity(REQUIRED_BYTES, IMAGE_BYTES) }).not.toThrow()
    expect(() => { assertImageBodyCapacity(REQUIRED_BYTES - 1, IMAGE_BYTES) })
      .toThrow(`session-controller requires connection maxRequestBodyBytes (${REQUIRED_BYTES - 1}) to be at least ${REQUIRED_BYTES}`)
  })

  it.each(['connection', 'attachments'] as const)('waits for late %s and withdraws the consumer on dependency removal', async (late) => {
    const ctx = new Context()
    try {
      provideOtherDependencies(ctx)
      await provideCapacity(ctx, late === 'connection' ? 'attachments' : 'connection')
      const consumer = ctx.plugin(CapacityController, {})
      expect(ctx.get('sessionController')).toBeUndefined()
      const dependency = provideCapacity(ctx, late)
      await dependency
      await consumer
      expect(ctx.get('sessionController')).toBeInstanceOf(CapacityController)
      await dependency.dispose()
      await vi.waitFor(() => { expect(ctx.get('sessionController')).toBeUndefined() })
      await consumer.dispose()
      await provideCapacity(ctx, late)
      expect(ctx.get('sessionController')).toBeUndefined()
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it.each(['connection', 'attachments'] as const)('rechecks a replaced %s before republishing the consumer', async (replaced) => {
    const ctx = new Context()
    try {
      provideOtherDependencies(ctx)
      await provideCapacity(ctx, replaced === 'connection' ? 'attachments' : 'connection')
      const original = provideCapacity(ctx, replaced)
      await original
      const consumer = ctx.plugin(CapacityController, {})
      await consumer
      expect(ctx.get('sessionController')).toBeInstanceOf(CapacityController)
      await original.dispose()
      await vi.waitFor(() => { expect(ctx.get('sessionController')).toBeUndefined() })
      await provideCapacity(ctx, replaced, false)
      await expect(consumer.await()).rejects.toThrow(/session-controller requires connection maxRequestBodyBytes/)
      expect(ctx.get('sessionController')).toBeUndefined()
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('reports the invalid Session row through a real Loader without publishing its service', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-session-capacity-'))
    const ctx = new Context()
    try {
      const configPath = join(root, 'cordis.yml')
      await writeFile(configPath, JSON.stringify([
        { id: 'dependencies', name: 'fixture:dependencies' },
        { id: 'session-controller', name: '@deepseek-ai/dsh-api-session-controller' },
      ]))
      ctx.baseUrl = pathToFileURL(root).href + '/'
      await ctx.plugin(Loader)
      ctx.loader.builtins.include = Include
      ctx.loader.internal = {
        ...ctx.loader.internal,
        version: 'v2',
        async import(specifier: string) {
          if (specifier === '@deepseek-ai/dsh-api-session-controller') return SessionController
          if (specifier === 'fixture:dependencies') return (scope: Context) => {
            provideOtherDependencies(scope)
            scope.provide('connection', { maxRequestBodyBytes: REQUIRED_BYTES - 1 } as never)
            scope.provide('attachments', { imageLimits: { maxMessageImageBytes: IMAGE_BYTES } } as never)
          }
          throw new Error(`unexpected Loader import: ${specifier}`)
        },
      } as NonNullable<typeof ctx.loader.internal>
      await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
      await ctx.loader.await()
      const entry = [...ctx.loader.entries()].find(row => row.options.id === 'session-controller')
      expect(entry?.fiber).toBeDefined()
      await expect(entry!.fiber!.await()).rejects.toThrow(/session-controller requires connection maxRequestBodyBytes/)
      expect(ctx.get('sessionController')).toBeUndefined()
      expect(ctx.get('connection')?.maxRequestBodyBytes).toBe(REQUIRED_BYTES - 1)
    } finally {
      await ctx.fiber.dispose()
      await rm(root, { recursive: true, force: true })
    }
  })
})
