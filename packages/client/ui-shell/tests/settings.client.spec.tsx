// @vitest-environment jsdom
/** Settings delegate persistence and share modal focus ownership with other client controls. */
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, expect, it, onTestFinished, vi } from 'vitest'
import { SlotTestRuntime } from '@deepseek-ai/dsh-client-test-runtime'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import type { ThemePreference, ThemeSnapshot } from '@deepseek-ai/dsh-client-ui-theme/client'
import * as plugin from '../src/client/index.ts'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

async function bench() {
  const runtime = await SlotTestRuntime.create()
  onTestFinished(() => runtime.dispose())
  const locale = new LocaleRuntime(runtime.ctx)
  locale.setLocale('en')
  runtime.ctx.provide('locale', locale)
  runtime.slots.installLocale(locale)
  let snapshot: ThemeSnapshot = {
    preference: 'system', fontSizes: { text: 14, code: 13, terminal: 13 },
    fontFamilies: { text: '', code: '', terminal: '' },
    active: { id: 'light', colorScheme: 'light', tokens: {} }, themes: [], revision: 0,
  }
  const setTheme = vi.fn((id: string) => {
    const preference: ThemePreference = id === 'dark' ? 'dark' : id === 'light' ? 'light' : 'system'
    snapshot = { ...snapshot, preference, revision: snapshot.revision + 1,
      active: { ...snapshot.active, id, colorScheme: preference === 'dark' ? 'dark' : 'light' } }
    runtime.ctx.emit('theme/change', snapshot)
  })
  const setLocale = vi.spyOn(locale, 'setLocale')
  runtime.ctx.provide('theme', { getTheme: () => snapshot, setTheme } as never)
  const owner = await runtime.mount(plugin)
  const view = runtime.renderRoot()
  return { runtime, locale, owner, view, setTheme, setLocale }
}

function openSettings() {
  const trigger = screen.getByRole('button', { name: 'Settings' })
  trigger.focus()
  fireEvent.click(trigger)
  return { trigger, dialog: screen.getByRole('dialog', { name: 'Settings' }) }
}

it.each(['button', 'escape', 'backdrop'] as const)('closes with %s and restores focus after making the background inert', async (method) => {
  await bench()
  const { trigger, dialog } = openSettings()
  expect(dialog.getAttribute('aria-modal')).toBe('true')
  const title = dialog.getAttribute('aria-labelledby')
  expect(title === null ? null : document.getElementById(title)?.textContent).toBe('Settings')
  expect(document.querySelector('[data-shell-root]')?.hasAttribute('inert')).toBe(true)
  expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Close settings' }))
  if (method === 'button') fireEvent.click(within(dialog).getByRole('button', { name: 'Close settings' }))
  else if (method === 'escape') fireEvent.keyDown(document, { key: 'Escape' })
  else {
    const backdrop = document.querySelector('[data-shell-settings-backdrop]')
    if (backdrop === null) throw new Error('settings backdrop is missing')
    fireEvent.click(backdrop)
  }
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.querySelector('[data-shell-root]')?.hasAttribute('inert')).toBe(false)
  expect(document.activeElement).toBe(trigger)
})

it('traps Tab at both dialog edges and delegates theme and language writes', async () => {
  const { setTheme, setLocale } = await bench()
  const { dialog } = openSettings()
  const close = within(dialog).getByRole('button', { name: 'Close settings' })
  const language = within(dialog).getByRole('combobox', { name: 'Language' })
  language.focus()
  fireEvent.keyDown(document, { key: 'Tab' })
  expect(document.activeElement).toBe(close)
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
  expect(document.activeElement).toBe(language)
  expect(within(dialog).getByRole('radio', { name: 'System' })).toHaveProperty('checked', true)
  fireEvent.click(within(dialog).getByRole('radio', { name: 'Dark' }))
  expect(setTheme).toHaveBeenCalledExactlyOnceWith('dark')
  expect(within(dialog).getByRole('radio', { name: 'Dark' })).toHaveProperty('checked', true)
  expect(document.body.hasAttribute('data-ds-dark-theme')).toBe(true)
  fireEvent.change(language, { target: { value: 'zh' } })
  expect(setLocale).toHaveBeenCalledExactlyOnceWith('zh')
  expect(screen.getByRole('dialog', { name: '设置' })).toBeTruthy()
  expect(screen.getByRole('combobox', { name: '语言' })).toHaveProperty('value', 'zh')
})

it('reflects registered languages and external theme changes while the panel is open', async () => {
  const { locale, setTheme } = await bench()
  openSettings()
  let removeLanguage: () => void = () => {}
  await act(async () => { removeLanguage = locale.addLanguage({ id: 'eo', label: 'Esperanto', fallback: 'en' }) })
  onTestFinished(() => { removeLanguage() })
  expect(screen.getByRole('option', { name: 'Esperanto' })).toHaveProperty('value', 'eo')
  await act(async () => { setTheme('light') })
  expect(screen.getByRole('radio', { name: 'Light' })).toHaveProperty('checked', true)
})

it('releases modal document listeners and portaled DOM when the root unmounts', async () => {
  const { owner, view, runtime } = await bench()
  const add = vi.spyOn(document, 'addEventListener')
  const remove = vi.spyOn(document, 'removeEventListener')
  const { trigger } = openSettings()
  const keydown = add.mock.calls.find(([name]) => name === 'keydown')
  expect(keydown).toBeDefined()
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(document.activeElement).toBe(trigger)
  if (keydown === undefined) throw new Error('modal keyboard listener is missing')
  expect(remove).toHaveBeenCalledWith('keydown', keydown[1])
  openSettings()
  view.unmount()
  await owner.dispose()
  expect(document.querySelector('[data-shell-settings]')).toBeNull()
  expect(document.querySelector('[data-shell-root]')).toBeNull()
  expect(document.querySelector('[inert]')).toBeNull()
  expect(runtime.slots.entries('root')).toHaveLength(0)
  const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
  document.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(false)
})
