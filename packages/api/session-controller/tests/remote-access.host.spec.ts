/** Complete owner reads, and Gateway owner-only admission. */

import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { mountAgentLoopTestDependencies, mountAgentLoopTestHarness } from '@deepseek-ai/dsh-agent-loop-testkit'
import TypertGatewayService from '@deepseek-ai/dsh-api-gateway'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import { type PeerId, type PeerScope, type Principal, type RemoteInvocation } from '@deepseek-ai/dsh-typert-protocol'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type SessionController from '../src/index.ts'
import { ApiSessionList } from '../src/list.ts'
import type { SessionControlFrame, SessionRequestId, SessionSearchValue } from '../src/types.ts'
import { createSessionTestController } from './test-remote.ts'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface PrincipalMap {
    /** Test-only non-owner caller shared by the access specs. */
    'test-guest': { readonly kind: 'test-guest'; readonly guest: string }
  }
}

const OWNER: Principal = { kind: 'owner' }
const GUEST: Principal = { kind: 'test-guest', guest: 'session-controller' }
const SHARED = SessionId('shared-session')
const PRIVATE = SessionId('private-session')

const owned = new Set<Context>()
afterEach(async () => {
  await Promise.all([...owned].map(ctx => ctx.fiber.dispose()))
  owned.clear()
})

/** Invoke `session/<method>` as the guest through the Gateway. */
function guestCall(ctx: Context, method: string, args: Readonly<Record<string, unknown>>): Promise<unknown> {
  const peer: PeerScope = { id: 'session-access-peer' as PeerId, ctx, principal: GUEST, interactions: 'answer', signal: new AbortController().signal, dispose: async () => {} }
  return ctx.typertGateway.invoke({ peer, namespace: 'session', method, args })
}

async function harness(): Promise<{
  readonly ctx: Context
  readonly controller: SessionController
  readonly shared: Agent
  readonly hidden: Agent
  /** The Context a Gateway dispatch of `session/<method>` binds for `principal`. */
  readonly as: (principal: Principal, method: string) => Context
}> {
  const ctx = new Context()
  owned.add(ctx)
  await ctx.plugin(TypertRegistry)
  await mountAgentLoopTestDependencies(ctx)
  const loop = await mountAgentLoopTestHarness(ctx)
  const shared = await loop.create(SHARED, {}, { cwd: '/tmp' })
  const hidden = await loop.create(PRIVATE, {}, { cwd: '/tmp' })
  const controller = await createSessionTestController(ctx, { defaultModelSelection: () => ({ provider: 'p', model: 'm' }), cwd: '/tmp' })
  const as = (principal: Principal, method: string): Context => {
    const invocation: RemoteInvocation = {
      request: { namespace: 'session', method, args: {} },
      service: 'sessionController',
      peer: { id: 'session-access-peer' as PeerId, ctx, principal, interactions: 'answer', signal: new AbortController().signal, dispose: async () => {} },
      signal: new AbortController().signal,
      uplink: <In>(): AsyncIterable<In> => ({ [Symbol.asyncIterator]: () => ({ next: async () => ({ done: true, value: undefined }) }) }),
    }
    return ctx.extend({ invocation })
  }
  return { ctx, controller, shared, hidden, as }
}

function message(text: string) {
  return createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } })
}

describe('Session Controller access', () => {
  it('lists every Session for the owner', async () => {
    const { as } = await harness()
    const owner = await as(OWNER, 'list').sessionController.list({}, new AbortController().signal)
    expect(owner.items.map(item => item.sessionId).sort()).toEqual([PRIVATE, SHARED].sort())
  })

  it('returns the complete bounded search result to the owner', async () => {
    const { ctx, as } = await harness()
    await ctx.plugin(TypertGatewayService)
    const hits: SessionSearchValue = {
      items: [{ sessionId: PRIVATE, snippet: 'private hit' }, { sessionId: SHARED, snippet: 'shared hit' }],
      hasMore: true,
    }
    vi.spyOn(ApiSessionList.prototype, 'search').mockResolvedValue(hits)
    await expect(as(OWNER, 'search').sessionController.search({ query: 'hit' }, new AbortController().signal)).resolves.toEqual(hits)
  })

  it('streams every Session control baseline and projection to the owner', async () => {
    const { shared, hidden, as } = await harness()
    const abort = new AbortController()
    const owner = as(OWNER, 'control').sessionController.control(abort.signal)[Symbol.asyncIterator]()
    const baselineSessions = async (iterator: AsyncIterator<SessionControlFrame>): Promise<string[]> => {
      const next = await iterator.next()
      if (next.done === true || next.value.type !== 'baseline') throw new Error('control stream opened without a baseline')
      return Object.keys(next.value.value.projections).sort()
    }
    expect(await baselineSessions(owner)).toEqual([PRIVATE, SHARED].sort())

    hidden.inbox.append('next-turn', message('private work'))
    shared.inbox.append('next-turn', message('shared work'))
    const projected = async (iterator: AsyncIterator<SessionControlFrame>): Promise<SessionId> => {
      for (;;) {
        const next = await iterator.next()
        if (next.done === true) throw new Error('control stream ended')
        if (next.value.type === 'projection' && next.value.changes.some(change => change.key === 'inbox')) return next.value.sessionId
      }
    }
    expect(await projected(owner)).toBe(PRIVATE)
    expect(await projected(owner)).toBe(SHARED)
    abort.abort()
    await owner.return?.()
  })

  it('records a non-owner caller on the prompt source and leaves owner sources unchanged', async () => {
    const { shared, as } = await harness()
    const signal = new AbortController().signal
    const prompt = (principal: Principal, requestId: string) => as(principal, 'prompt').sessionController.prompt({
      sessionId: SHARED,
      requestId: requestId as SessionRequestId,
      mode: 'queue',
      content: [{ type: 'text', text: `from ${principal.kind}` }],
    }, signal)
    await expect(prompt(GUEST, 'guest-1')).resolves.toEqual({ accepted: true })
    await expect(prompt(OWNER, 'owner-1')).resolves.toEqual({ accepted: true })
    // The durable Inbox splice records each accepted message with its source.
    const logged = shared.session.snapshotEvents()
      .flatMap(event => event.type === 'agent/inbox/spliced' ? event.data.inserted.map(item => item.source) : [])
    expect(logged).toEqual([
      { kind: 'user', rpcId: 'guest-1', principal: GUEST },
      { kind: 'user', rpcId: 'owner-1' },
    ])
  })

  it('rejects non-owner calls before Session listing', async () => {
    const { ctx } = await harness()
    await ctx.plugin(TypertGatewayService)
    const list = vi.spyOn(ApiSessionList.prototype, 'list')
    await expect(guestCall(ctx, 'list', { _request: {} })).rejects.toMatchObject({
      code: 'gateway/owner-required', details: { endpoint: 'session/list' },
    })
    expect(list).not.toHaveBeenCalled()
  })
})
