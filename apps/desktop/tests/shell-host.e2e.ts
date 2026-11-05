/** Keyless built Desktop Host acceptance; requires built packages but no primary Office payload. */
import { randomUUID } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, onTestFinished } from 'vitest'
import { DesktopHostFatalError, DesktopHostProcess } from '../src/host-process.ts'
import { DesktopProjectManager } from '../src/project-manager.ts'
import { resolveDesktopPaths } from '../src/paths.ts'
import { authenticateWebHost } from '../src/web-document.ts'
import { DESKTOP_HOST_PROTOCOL_VERSION } from '../src/host-protocol.ts'
import { prepareDevelopmentProject } from '../scripts/development-project.ts'

const repository = fileURLToPath(new URL('../../../', import.meta.url))

/** Read the installed release number without sharing the fixture's mutable state. */
function version(path: string): string {
  return (JSON.parse(readFileSync(path, 'utf8')) as { version: string }).version
}

/** Isolate credentials and home without mutating the test process environment. */
function hostEnvironment(home: string): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (!/KEY|TOKEN|SECRET|PASSWORD/u.test(key)) environment[key] = value
  }
  return { ...environment, DSH_HOME: home, DSH_TELEMETRY_MODE: 'DISABLED' }
}

/** Query the real settings Remote using the authenticated native carrier. */
async function settingsRpc(url: string, cookie: string, method: string, args: Record<string, unknown>): Promise<unknown> {
  const rpcId = randomUUID()
  const endpoint = `settings/${method}`
  const response = await fetch(new URL(`/api/${endpoint}`, url), {
    method: 'POST', redirect: 'error',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId, method: endpoint, payload: { args } }),
  })
  expect(response.ok).toBe(true)
  const envelope = await response.json() as { rpcId: string; result: { ok: boolean; value: unknown } }
  expect(envelope.rpcId).toBe(rpcId)
  expect(envelope.result.ok).toBe(true)
  return envelope.result.value
}

describe('built shell Desktop Host', () => {
  it('starts without product services, persists settings, and gracefully restarts', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-shell-host-'))
    let host: DesktopHostProcess | undefined
    onTestFinished(async () => {
      try { await host?.stop() }
      finally { rmSync(root, { recursive: true, force: true }) }
    })
    const home = join(root, 'home')
    mkdirSync(home)
    const project = prepareDevelopmentProject({
      projectDir: join(root, 'project'),
      cliDir: join(repository, 'apps/cli'),
      hostDir: join(repository, 'apps/desktop-host'),
      dependencyDir: join(repository, 'node_modules/.pnpm/node_modules'),
      release: {
        schemaVersion: 1,
        version: version(join(repository, 'apps/desktop/package.json')),
        pnpmVersion: version(join(repository, 'apps/desktop/node_modules/pnpm/package.json')),
        nodeVersion: process.versions.node,
        hostProtocolVersion: DESKTOP_HOST_PROTOCOL_VERSION,
      },
      target: 'mac-x64',
    })
    const paths = resolveDesktopPaths(home)
    await new DesktopProjectManager(paths, { dsh: project }).applyRelease()
    // Remove only the fixture's CLI link; Host boot must use its own installation anchor.
    const productCli = join(project, 'node_modules', '@deepseek-ai', 'dsh')
    expect(lstatSync(productCli).isSymbolicLink()).toBe(true)
    unlinkSync(productCli)
    const probe = join(root, 'probe.mjs')
    // The test-only route reports the real service store; it provides no substitute business services.
    writeFileSync(probe, `export const inject = ['webServer', 'loader']
export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/shell-test-status', handler: (_req, res) => {
    const names = ['agents', 'sessions', 'llm', 'jobs', 'sessionController', 'deepseekAccount', 'workspaceDependencies']
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ services: Object.fromEntries(names.map(name => [name, ctx.get(name) !== undefined])), entries: [...ctx.loader.entries()].map(entry => entry.options.id) }))
  } }))
}
`)
    writeFileSync(join(paths.profile, 'cordis.patch.yml'), `- id: shell-base\n  config:\n    printUrl: false\n- insert:\n    - id: shell-test-status\n      name: ${JSON.stringify(probe)}\n`)
    const environment = hostEnvironment(home)
    const restart = async (): Promise<{ url: string; cookie: string }> => {
      await host?.stop()
      host = new DesktopHostProcess(process.execPath, project, paths.profile, undefined, environment)
      const ready = await host.start()
      return { url: ready.url, cookie: await authenticateWebHost(ready.url) }
    }
    let connection = await restart()
    const status = await (await fetch(new URL('/shell-test-status', connection.url))).json() as {
      services: Record<string, boolean>
      entries: string[]
    }
    expect(Object.values(status.services)).toEqual(Array(Object.keys(status.services).length).fill(false))
    expect(status.entries).toContain('shell-base')
    expect(status.entries).not.toContain('agent-loop')
    expect(status.entries).not.toContain('session-controller')
    const initialSettings = await settingsRpc(connection.url, connection.cookie, 'describe', {}) as { namespaces: unknown[] }
    expect(Array.isArray(initialSettings.namespaces)).toBe(true)
    expect(await settingsRpc(connection.url, connection.cookie, 'update', { ns: 'locale', patch: { preference: 'zh' } }))
      .toMatchObject({ ns: 'locale', value: { preference: 'zh' } })
    expect(existsSync(join(home, 'dsh-runtimes', 'dsh-primary-runtime'))).toBe(false)
    connection = await restart()
    const settings = await settingsRpc(connection.url, connection.cookie, 'describe', {}) as { namespaces: Array<{ ns: string; value: unknown }> }
    expect(settings.namespaces.find(namespace => namespace.ns === 'locale')).toMatchObject({ value: { preference: 'zh' } })
    await host!.stop(true)
    writeFileSync(join(paths.profile, 'cordis.patch.yml'), 'invalid: [yaml')
    host = new DesktopHostProcess(process.execPath, project, paths.profile, undefined,
      environment)
    const failure: unknown = await host.start().catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(DesktopHostFatalError)
    if (failure instanceof DesktopHostFatalError) expect(failure.diagnostic).toContain('cordis.patch.yml')
    await host.stop()
  })
})
