import { describe, expect, it, vi, afterEach } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { apply as applyConnection, inject as connectionInject } from '@deepseek-ai/dsh-client-connection'
import { Remote, TypertRemoteService, type PeerScope, type Principal } from '@deepseek-ai/dsh-typert-protocol'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import TypertGatewayService from '@deepseek-ai/dsh-api-gateway'
import { provideBrowserCredentials } from './browser-credentials.ts'
import { ownerPeer, peerFor } from './peer.ts'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface PrincipalMap {
    /** Extension-defined identities must not acquire owner privileges. */
    'test-guest': { readonly kind: 'test-guest'; readonly guest: string }
  }
}

const GUEST: Principal = { kind: 'test-guest', guest: 'gateway' }

class AccessFixture extends TypertRemoteService {
  constructor(ctx: Context) {
    super(ctx, 'accessFixture')
  }

  @Remote
  open(): string {
    return this.ctx.invocation?.peer.principal.kind ?? 'none'
  }

  @Remote({ mode: 'stream' })
  *watch(): Iterable<string> {
    yield this.open()
  }

  @Remote({ mode: 'stream' })
  async *wait(signal: AbortSignal): AsyncIterable<string> {
    yield this.open()
    await new Promise<void>((resolve) => {
      if (signal.aborted) resolve()
      else signal.addEventListener('abort', () => { resolve() }, { once: true })
    })
  }
}

const roots: Context[] = []
afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(roots.splice(0).map(ctx => ctx.fiber.dispose()))
})

async function setup(): Promise<Context> {
  const ctx = new Context()
  roots.push(ctx)
  await ctx.plugin(TypertRegistry)
  await ctx.plugin(TypertGatewayService)
  provideBrowserCredentials(ctx)
  await ctx.plugin({ inject: [...connectionInject], apply: applyConnection })
  await ctx.plugin(AccessFixture)
  return ctx
}

function call(ctx: Context, peer: PeerScope): Promise<unknown> {
  return ctx.typertGateway.invoke({ peer, namespace: 'accessFixture', method: 'open', args: {} })
}

async function rpc(ctx: Context, peer: PeerScope, endpoint: string, payload: unknown): Promise<unknown> {
  const response = await ctx.connection.createSharedFetchHandler('/api').fetch(new Request(`http://host/api/${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: 'owner-check', method: endpoint, payload }),
  }), peer)
  return response.json()
}

async function* empty(): AsyncIterable<never> {}

describe('Gateway owner admission', () => {
  it('starts without a policy service and dispatches owner calls and streams', async () => {
    const ctx = await setup()
    await expect(call(ctx, ownerPeer(ctx))).resolves.toBe('owner')
    const stream = await ctx.typertGateway.stream({ peer: ownerPeer(ctx), namespace: 'accessFixture', method: 'watch', args: {} })
    const items: string[] = []
    for await (const item of stream) items.push(String(item))
    expect(items).toEqual(['owner'])
  })

  it('rejects non-owner direct calls and streams before descriptor resolution or business execution', async () => {
    const ctx = await setup()
    const peer = ctx.connection.createPeer({ principal: GUEST })
    const invoked = vi.spyOn(AccessFixture.prototype, 'open')
    const descriptor = vi.spyOn(ctx.typert.local, 'get')
    await expect(call(ctx, peer)).rejects.toMatchObject({ code: 'gateway/owner-required', details: { endpoint: 'accessFixture/open' } })
    await expect(ctx.typertGateway.stream({ peer, namespace: 'accessFixture', method: 'watch', args: {} }))
      .rejects.toMatchObject({ code: 'gateway/owner-required' })
    expect(invoked).not.toHaveBeenCalled()
    expect(descriptor).not.toHaveBeenCalled()
  })

  it('rejects non-owner wire calls, streams and event participation before payload validation', async () => {
    const ctx = await setup()
    for (const interactions of ['answer', 'none'] as const) {
      const peer = ctx.connection.createPeer({ principal: GUEST, interactions })
      for (const payload of [{ args: {} }, { args: 1 }, { args: {}, principal: { kind: 'owner' } }]) {
        for (const endpoint of ['accessFixture/open', '$events/result']) {
          await expect(rpc(ctx, peer, endpoint, payload)).resolves.toMatchObject({ result: { ok: false, error: { code: 'gateway/owner-required' } } })
        }
        for (const endpoint of ['accessFixture/watch', '$events']) {
          await expect(ctx.typertGateway.wireStream.open(endpoint, payload, empty(), peer, new AbortController().signal))
            .rejects.toMatchObject({ code: 'gateway/owner-required' })
        }
      }
    }
    expect(ctx.typertGateway.hasLiveClient()).toBe(false)
  })

  it('still requires answering participation for owner event streams and replies', async () => {
    const ctx = await setup()
    const peer = ctx.connection.createPeer({ principal: { kind: 'owner' }, interactions: 'none' })
    await expect(call(ctx, peer)).resolves.toBe('owner')
    await expect(ctx.typertGateway.wireStream.open('$events', { args: {} }, empty(), peer, new AbortController().signal))
      .rejects.toMatchObject({ code: 'gateway/interactions-forbidden' })
    await expect(rpc(ctx, peer, '$events/result', { args: {} })).resolves.toMatchObject({ result: { ok: false, error: { code: 'gateway/interactions-forbidden' } } })
  })

  it('ends a disposed owner Peer stream without ending another owner stream', async () => {
    const ctx = await setup()
    const peer = peerFor(ctx, { kind: 'owner' })
    const other = peerFor(ctx, { kind: 'owner' })
    const open = async (caller: PeerScope) => (await ctx.typertGateway.stream({
      peer: caller, namespace: 'accessFixture', method: 'wait', args: {},
    }))[Symbol.asyncIterator]()
    const stream = await open(peer)
    const survivor = await open(other)
    await expect(stream.next()).resolves.toEqual({ done: false, value: 'owner' })
    const pending = stream.next()
    const rejected = expect(pending).rejects.toMatchObject({ code: 'gateway/cancelled' })
    await peer.dispose()
    await rejected
    await expect(survivor.next()).resolves.toEqual({ done: false, value: 'owner' })
    await other.dispose()
    await survivor.return?.()
  })

  it('refuses disposed owner and non-owner Peers before payload validation without affecting other Peers', async () => {
    const ctx = await setup()
    for (const principal of [{ kind: 'owner' } as const, GUEST]) {
      const peer = peerFor(ctx, principal)
      await peer.dispose()
      await expect(call(ctx, peer)).rejects.toMatchObject({ code: 'gateway/peer-disposed' })
      await expect(ctx.typertGateway.stream({ peer, namespace: 'accessFixture', method: 'watch', args: {} }))
        .rejects.toMatchObject({ code: 'gateway/peer-disposed' })
      for (const endpoint of ['accessFixture/watch', '$events']) {
        await expect(ctx.typertGateway.wireStream.open(endpoint, { args: 1 }, empty(), peer, new AbortController().signal))
          .rejects.toMatchObject({ code: 'gateway/peer-disposed' })
      }
      for (const endpoint of ['accessFixture/open', '$events/result']) {
        await expect(rpc(ctx, peer, endpoint, { args: 1 })).resolves.toMatchObject({ result: { ok: false, error: { code: 'gateway/peer-disposed' } } })
      }
    }
    await expect(call(ctx, ownerPeer(ctx))).resolves.toBe('owner')
  })
})
