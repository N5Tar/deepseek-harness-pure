/** Keyless REAL Loader composition; requires built Client bundles and frontend dist. */
import { auditStartupEntries } from '@deepseek-ai/dsh-app-boot'
import { describe, expect, it } from 'vitest'
import { createShellBaseTestHost } from './fixture.ts'

describe('standalone shell composition', () => {
  it('activates every whitelist row and serves an authenticated shell without business services', async () => {
    const { ctx } = await createShellBaseTestHost()
    const warnings: string[] = []
    await auditStartupEntries(ctx, 'shell test', line => warnings.push(line))
    expect(warnings).toEqual([])
    for (const entry of ctx.loader.entries()) {
      expect(entry.disabled).toBeFalsy()
      expect(entry.fiber?.state, entry.options.id).toBe(2)
    }
    for (const service of ['agents', 'sessions', 'llm', 'jobs', 'sessionController', 'deepseekAccount']) {
      expect(ctx.get(service), service).toBeUndefined()
    }
    const origin = ctx.webServer.getOrigin()
    const denied = await fetch(origin)
    expect(denied.status).toBe(401)
    const authenticated = await fetch(ctx.connection.authenticatedUrl(origin), { redirect: 'manual' })
    expect(authenticated.status).toBe(303)
    const cookies = authenticated.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
    const page = await fetch(origin, { headers: { Cookie: cookies } })
    expect(page.status).toBe(200)
    const html = await page.text()
    const encodedGraph = html.match(/globalThis\["__DSH_BOOT__"\] = (.*?)<\/script>/u)?.[1]
    expect(encodedGraph).toBeDefined()
    const graph = JSON.parse(encodedGraph!) as { entries: Array<{ id: string }> }
    const ids = graph.entries.map(entry => entry.id)
    expect(ids).toContain('@deepseek-ai/dsh-client-ui-shell')
    expect(ids).toContain('@deepseek-ai/dsh-api-shell-remotes')
    expect(ids).not.toContain('@deepseek-ai/dsh-api-remotes')
    expect(ids).not.toContain('@deepseek-ai/dsh-client-ui-conversation')

  })
})
