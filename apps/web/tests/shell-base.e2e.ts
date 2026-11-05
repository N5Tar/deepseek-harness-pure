/** Browser acceptance of the session-free Host composition and built Web artifacts. */
import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { expect, it } from 'vitest'
import { createShellBaseTestHost } from '../../../packages/bundle/shell-base/tests/fixture.ts'

it('boots without business services and persists theme and language settings', async () => {
  const { ctx, patchPath } = await createShellBaseTestHost()
  const origin = ctx.webServer.getOrigin()
  const browser = await chromium.launch({ headless: true })
  try {
    const browserContext = await browser.newContext({ locale: 'en-US', colorScheme: 'light' })
    const page = await browserContext.newPage()
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(ctx.connection.authenticatedUrl(origin))
    await page.getByRole('heading', { name: 'Harness shell', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.waitFor()
    await dialog.getByRole('radio', { name: 'Dark', exact: true }).check()
    await page.waitForFunction(() => document.body.hasAttribute('data-ds-dark-theme'))
    await dialog.getByRole('combobox').selectOption('zh')
    await page.getByRole('heading', { name: 'Harness 底座', exact: true }).waitFor()
    // Wait on durable settings rather than a rendering-only optimistic update before reload.
    await expect.poll(async () => await readFile(patchPath, 'utf8')).toContain('zh')
    await page.reload()
    await page.getByRole('heading', { name: 'Harness 底座', exact: true }).waitFor()
    await page.waitForFunction(() => document.body.hasAttribute('data-ds-dark-theme'))
    await page.locator('[data-shell-settings-trigger]').click()
    await dialog.getByRole('radio').nth(1).check()
    await page.waitForFunction(() => !document.body.hasAttribute('data-ds-dark-theme'))
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'detached' })
    expect(await page.locator('[data-shell-settings-trigger]').evaluate(element => element === document.activeElement)).toBe(true)
    expect(errors).toEqual([])
  } finally {
    await browser.close()
  }
})
