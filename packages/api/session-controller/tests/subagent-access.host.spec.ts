/** The Gateway rejects non-owner subagent input and cancellation before side effects. */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import TypertGatewayService from '@deepseek-ai/dsh-api-gateway'
import { SessionId } from '@deepseek-ai/dsh-session'
import * as JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import SubagentRuntime from '@deepseek-ai/dsh-subagent'
import type { PeerId, PeerScope, Principal } from '@deepseek-ai/dsh-typert-protocol'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MockAdapter } from '../../../core/agent-loop/tests/mock-adapter.ts'
import { mountWorkingDirectoryFixture } from '../../../subagent/subagent/tests/working-directory-fixture.ts'
import { createSessionTestController } from './test-remote.ts'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface PrincipalMap {
    /** Test-only non-owner caller shared by the access specs. */
    'test-guest': { readonly kind: 'test-guest'; readonly guest: string }
  }
}

const GUEST: Principal = { kind: 'test-guest', guest: 'subagent-controls' }
const cleanups: Array<() => Promise<void>> = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
})

async function harness() {
  const root = await mkdtemp(join(tmpdir(), 'dsh-subagent-access-'))
  const ctx = new Context()
  cleanups.push(async () => {
    try { await ctx.fiber.dispose() } finally { await rm(root, { recursive: true, force: true }) }
  })
  await ctx.plugin(TypertRegistry)
  await mountAgentLoopTestDependencies(ctx)
  await ctx.plugin(JsonlSessionPersistence, { root })
  await ctx.plugin(AgentLoop, { agents: [] })
  await mountWorkingDirectoryFixture(ctx)
  await createSessionTestController(ctx, { defaultModelSelection: () => ({ provider: 'mock', model: 'mock' }), cwd: root })
  await ctx.plugin(SubagentRuntime)
  ctx.subagents.registerProvider({
    name: 'test', inheritsParentContext: false,
    capabilities: { agentOptions: true, agentPreset: false, outputSchema: false, depthLimit: false },
    prepareContinuable: async () => ({}),
  })
  const adapter = new MockAdapter(['hang'])
  ctx.llm.registerAdapter(['mock'], adapter)
  const parent = await ctx.agentLoop.create(SessionId('parent'), { provider: 'mock', model: 'mock' })
  const run = await ctx.subagents.startActivation({
    provider: 'test', label: 'access target', delivery: 'caller',
    parent, prompt: [{ type: 'text', text: 'hold' }],
    signal: new AbortController().signal,
  })
  await vi.waitFor(() => { expect(adapter.requests).toHaveLength(1) })
  const child = ctx.agents.get(run.childId)!
  await ctx.plugin(TypertGatewayService)
  const call = (method: 'prompt' | 'interruptByUser', principal: Principal = GUEST, image = false) => {
    const peer: PeerScope = {
      id: 'subagent-access-peer' as PeerId, ctx, principal, interactions: 'answer',
      signal: new AbortController().signal, dispose: async () => {},
    }
    return ctx.typertGateway.invoke({
      peer, namespace: 'subagents', method,
      args: method === 'prompt' ? { request: {
        requestId: 'access-follow-up', childSessionId: child.id, delivery: 'queue',
        content: image ? [{ type: 'image', mediaType: 'image/png', data: 'aGk=' }] : [{ type: 'text', text: 'follow-up' }],
      } } : { childSessionId: child.id },
    })
  }
  return { ctx, parent, child, call }
}

describe('subagent target Session access', () => {
  it.each(['prompt', 'interruptByUser'] as const)('rejects non-owner %s before input or cancellation', async (method) => {
    const { ctx, child, call } = await harness()
    const attachments = vi.spyOn(ctx.attachments, 'admitPromptContent')
    const observe = vi.spyOn(ctx.sessionQuery, 'observeSession')
    const cancel = vi.spyOn(child, 'cancel')
    await expect(call(method, GUEST, true)).rejects.toMatchObject({
      code: 'gateway/owner-required', details: { endpoint: `subagents/${method}` },
    })
    expect(attachments).not.toHaveBeenCalled()
    expect(observe).not.toHaveBeenCalled()
    expect(cancel).not.toHaveBeenCalled()
    expect(child.inbox.nextTurn).toHaveLength(0)

    const accepted = await call(method, { kind: 'owner' })
    if (method === 'prompt') {
      expect(child.inbox.nextTurn).toHaveLength(1)
      expect(accepted).toEqual({ messageId: child.inbox.nextTurn[0]?.id })
      expect(child.inbox.nextTurn[0]?.source).toMatchObject({ kind: 'user' })
    } else {
      expect(accepted).toEqual({ accepted: true })
      expect(cancel).toHaveBeenCalledWith({ kind: 'user' }, { keepInbox: true })
      await child.whenIdle()
    }
  })

  it('allows owner input and cancellation', async () => {
    const { child, call } = await harness()
    const accepted = await call('prompt', { kind: 'owner' })
    expect(child.inbox.nextTurn).toHaveLength(1)
    expect(accepted).toEqual({ messageId: child.inbox.nextTurn[0]?.id })
    await expect(call('interruptByUser', { kind: 'owner' })).resolves.toEqual({ accepted: true })
    await child.whenIdle()
  })
})
