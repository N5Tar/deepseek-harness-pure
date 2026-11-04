// @vitest-environment jsdom
/** Root-only applications do not install a Session scope adapter. */
import { Context } from '@deepseek-ai/cordis'
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, onTestFinished, vi } from 'vitest'
import type { FactoryComponentPropsOf, PropsRenderFactories, PropsRenderSlots, StandardSourceBinding } from '@deepseek-ai/dsh-client-ui-slots'
import { SlotRegistry } from '../src/client/registry.ts'
import { createSlotRenderer } from '../src/client/scoped-slots.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'root-only.content': { kind: 'list'; scope: 'root' }
    'root-only.scoped': { kind: 'single'; scope: 'session-maybe' }
    'root-only.strict': { kind: 'single'; scope: 'session' }
  }
  interface SlotFactoryMap {
    'root-only.factory': { scope: 'root'; slots: { content: { scope: 'root' } } }
    'root-only.scoped-factory': { scope: 'session-maybe' }
    'root-only.local-scoped': { scope: 'root'; slots: { content: { scope: 'session-maybe' } } }
  }
}

it.each(['session', 'session-maybe'] as const)('rejects a %s child declaration without its adapter', async (scope) => {
  const ctx = await bench()
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
  onTestFinished(() => { errors.mockRestore() })
  if (scope === 'session') {
    ctx.slots.register({ name: 'root', children: { 'root-only.strict': { kind: 'single', scope } } },
      ({ renderSlot }) => renderSlot('root-only.strict', {}))
  } else {
    ctx.slots.register({ name: 'root', children: { 'root-only.scoped': { kind: 'single', scope } } },
      ({ renderSlot }) => renderSlot('root-only.scoped', {}))
  }
  expect(() => render(ctx.slots.renderSlot('root', {}))).toThrow("entry declares a session child without an installed 'session' scope adapter")
})

it('rejects a scoped factory local slot even when its factory is root-scoped', async () => {
  const ctx = await bench()
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
  onTestFinished(() => { errors.mockRestore() })
  ctx.slots.register({ name: 'root' }, ({ renderFactorySlot }: PropsRenderFactories) => renderFactorySlot('root-only.local-scoped', {}))
  ctx.slots.registerFactory({ name: 'root-only.local-scoped', scope: 'root', slots: { content: { scope: 'session-maybe' } } },
    ({ useFactorySlot }) => { const Content = useFactorySlot('content', Local); return <Content /> })
  expect(() => render(ctx.slots.renderSlot('root', {}))).toThrow("scope 'session-maybe' local slot 'content' rendered without an installed adapter")
})

afterEach(cleanup)
async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry)
  onTestFinished(() => ctx.fiber.dispose())
  ctx.slots.install(createSlotRenderer())
  return ctx
}

function Root({ renderSlot, renderFactorySlot }: PropsRenderSlots<'root-only.content'> & PropsRenderFactories) {
  const [count, setCount] = useState(0)
  return <><button onClick={() => { setCount(count + 1) }}>{count}</button>{renderSlot('root-only.content', {})}{renderFactorySlot('root-only.factory', {})}</>
}
function Local() { return <p>Factory content</p> }
function Factory({ useFactorySlot }: FactoryComponentPropsOf<'root-only.factory'>) {
  const Content = useFactorySlot('content', Local)
  return <Content />
}

it('renders root children and factory local slots without adapters and preserves state across adapter lifetimes', async () => {
  const ctx = await bench()
  ctx.slots.register({ name: 'root', children: { 'root-only.content': { kind: 'list', scope: 'root' } } }, Root)
  ctx.slots.register({ name: 'root-only.content', id: 'content' }, () => <p>Root content</p>)
  ctx.slots.registerFactory({ name: 'root-only.factory', scope: 'root', slots: { content: { scope: 'root' } } }, Factory)
  const view = render(ctx.slots.renderSlot('root', {}))
  expect(screen.getByText('Root content')).toBeTruthy()
  expect(screen.getByText('Factory content')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '0' }))
  const binding: StandardSourceBinding = { key: undefined, hooks: {}, keyedHooks: {}, props: {} }
  const source = { getSnapshot: () => binding, subscribe: () => () => {} }
  const adapter = ctx.plugin({ inject: ['slots'], apply(scope) {
    scope.slots.installScope('session', { current: source, bindingSource: () => source })
  } })
  await act(async () => { await adapter })
  expect(screen.getByRole('button', { name: '1' })).toBeTruthy()
  await act(async () => { await adapter.dispose() })
  expect(screen.getByRole('button', { name: '1' })).toBeTruthy()
  view.unmount()
})

it('reports a missing adapter for a session-maybe factory instead of manufacturing an absent Session', async () => {
  const ctx = await bench()
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
  onTestFinished(() => { errors.mockRestore() })
  ctx.slots.register({ name: 'root' }, ({ renderFactorySlot }: PropsRenderFactories) => renderFactorySlot('root-only.scoped-factory', {}))
  ctx.slots.registerFactory({ name: 'root-only.scoped-factory', scope: 'session-maybe' }, () => <p>Unexpected scoped content</p>)
  expect(() => render(ctx.slots.renderSlot('root', {}))).toThrow("scope 'session-maybe' factory 'root-only.scoped-factory' rendered without an installed adapter")
  expect(screen.queryByText('Unexpected scoped content')).toBeNull()
})
