// @vitest-environment jsdom
/** Root registration and theme projection require no Session services. */
import { act, cleanup, screen } from '@testing-library/react'
import { afterEach, expect, it, onTestFinished } from 'vitest'
import { SlotTestBench } from '@deepseek-ai/dsh-client-ui-test-bench'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import type { ThemeRuntime, ThemeSnapshot } from '@deepseek-ai/dsh-client-ui-theme/client'
import * as plugin from '../src/client/index.ts'
import { apply as applyHost } from '../src/index.ts'

const light: ThemeSnapshot = {
  preference: 'light', fontSizes: { text: 14, code: 13, terminal: 13 },
  fontFamilies: { text: '', code: '', terminal: '' },
  active: { id: 'light', colorScheme: 'light', tokens: {} }, themes: [], revision: 0,
}
afterEach(cleanup)

it('registers a localized root and content slot without declaring Session or layout dependencies, then removes them', async () => {
  applyHost()
  const runtime = await SlotTestBench.create()
  onTestFinished(() => runtime.dispose())
  const locale = new LocaleRuntime(runtime.ctx)
  locale.setLocale('en')
  runtime.ctx.provide('locale', locale)
  runtime.slots.installLocale(locale)
  // Only the exact theme read used by this plugin is supplied; the registry is exercised separately.
  runtime.ctx.provide('theme', { getTheme: () => light } as ThemeRuntime)
  const owner = await runtime.mount(plugin)
  const view = runtime.renderRoot()
  expect(screen.getByRole('heading', { name: 'Harness shell' })).toBeTruthy()
  expect(document.querySelector('[data-shell-overlay]')).not.toBeNull()
  expect(plugin.inject).toEqual(['slots', 'locale', 'theme'])
  const contribution = await runtime.mount({ inject: ['slots'], apply(ctx) {
    ctx.slots.inject('shell.content', () => ctx.slots.register({ name: 'shell.content', id: 'sample' }, () => <p>Sample content</p>))
  } })
  expect(screen.getByText('Sample content')).toBeTruthy()
  await act(async () => { locale.setLocale('zh') })
  expect(screen.getByRole('heading', { name: 'Harness 底座' })).toBeTruthy()
  view.unmount()
  await owner.dispose()
  expect(runtime.slots.entries('root')).toHaveLength(0)
  expect(document.querySelector('[data-shell-root]')).toBeNull()
  await contribution.dispose()
})

it('updates and restores document palette values when the root is unloaded', async () => {
  const runtime = await SlotTestBench.create()
  onTestFinished(() => runtime.dispose())
  const locale = new LocaleRuntime(runtime.ctx)
  runtime.ctx.provide('locale', locale)
  runtime.slots.installLocale(locale)
  runtime.ctx.provide('theme', { getTheme: () => light } as ThemeRuntime)
  document.body.style.setProperty('--test-shell-token', 'before')
  onTestFinished(() => { document.body.style.removeProperty('--test-shell-token') })
  const owner = await runtime.mount(plugin)
  runtime.ctx.emit('theme/change', { ...light, preference: 'system', active: {
    ...light.active, colorScheme: 'dark', tokens: { '--test-shell-token': 'after' },
  } })
  expect(document.body.hasAttribute('data-ds-dark-theme')).toBe(true)
  expect(document.body.style.getPropertyValue('--test-shell-token')).toBe('after')
  expect(document.documentElement.getAttribute('data-ds-theme-source')).toBe('system')
  runtime.ctx.emit('theme/change', light)
  expect(document.body.style.getPropertyValue('--test-shell-token')).toBe('before')
  await owner.dispose()
  expect(document.body.hasAttribute('data-ds-dark-theme')).toBe(false)
  expect(document.documentElement.hasAttribute('data-ds-theme-source')).toBe(false)
})
