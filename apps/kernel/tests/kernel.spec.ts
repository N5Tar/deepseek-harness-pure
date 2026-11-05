import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { bootKernel, type RunningKernel } from '../src/kernel.ts'

const home = mkdtempSync(join(tmpdir(), 'dsh-kernel-'))
let kernel: RunningKernel | undefined
afterEach(async () => {
  await kernel?.stop()
  kernel = undefined
})
afterEach(() => { rmSync(home, { recursive: true, force: true }) })

describe('kernel', () => {
  it('serves the single page and the default settings', async () => {
    kernel = await bootKernel({ home })
    const page = await fetch(`${kernel.url}/`)
    expect(page.status).toBe(200)
    expect(page.headers.get('content-type')).toContain('text/html')
    expect(await page.text()).toContain('Harness Kernel')

    const settings = await fetch(`${kernel.url}/api/settings`)
    expect(await settings.json()).toMatchObject({ theme: 'dark', language: 'en' })
  })

  it('persists a settings patch and reloads it from the same home', async () => {
    kernel = await bootKernel({ home })
    const response = await fetch(`${kernel.url}/api/settings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ theme: 'light' }),
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ theme: 'light' })

    const stored = JSON.parse(readFileSync(join(home, 'kernel', 'settings.json'), 'utf8')) as { theme: string }
    expect(stored.theme).toBe('light')

    await kernel.stop()
    kernel = await bootKernel({ home })
    expect(await (await fetch(`${kernel.url}/api/settings`)).json()).toMatchObject({ theme: 'light' })
  })

  it('rejects an unknown route and an invalid settings patch', async () => {
    kernel = await bootKernel({ home })
    expect((await fetch(`${kernel.url}/missing`)).status).toBe(404)
    const invalid = await fetch(`${kernel.url}/api/settings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '[]',
    })
    expect(invalid.status).toBe(400)
  })
})
