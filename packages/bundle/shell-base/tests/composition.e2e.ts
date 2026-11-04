/**
 * Keyless REAL Loader composition; requires built Client bundles and frontend dist.
 * Missing artifacts fail rather than skip. No external model or account is used.
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader, { type EntryOptions } from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import { auditStartupEntries } from '@deepseek-ai/dsh-app-boot'
import * as Credentials from '@deepseek-ai/dsh-credentials-local'
import * as ConfigEditor from '@deepseek-ai/dsh-config-editor'
import * as Settings from '@deepseek-ai/dsh-settings'
import * as Typert from '@deepseek-ai/dsh-typert-registry'
import * as TypertLoader from '@deepseek-ai/dsh-typert-loader'
import * as RemoteAccess from '@deepseek-ai/dsh-api-remote-access'
import * as Gateway from '@deepseek-ai/dsh-api-gateway'
import * as SettingsController from '@deepseek-ai/dsh-api-settings-controller'
import * as ShellRemotes from '@deepseek-ai/dsh-api-shell-remotes'
import * as WebServer from '@deepseek-ai/dsh-host-webserver'
import * as Modules from '@deepseek-ai/dsh-client-modules'
import * as Connection from '@deepseek-ai/dsh-client-connection'
import * as Renderer from '@deepseek-ai/dsh-client-ui-renderer'
import * as UiSettings from '@deepseek-ai/dsh-client-ui-settings'
import * as Locale from '@deepseek-ai/dsh-client-locale'
import * as Theme from '@deepseek-ai/dsh-client-ui-theme'
import * as Shell from '@deepseek-ai/dsh-client-ui-shell'
import { parse, stringify } from 'yaml'
import { describe, expect, it, onTestFinished } from 'vitest'
import * as ShellBase from '../src/index.ts'

const implementations: Record<string, unknown> = {
  '@deepseek-ai/dsh-credentials-local': Credentials,
  '@deepseek-ai/dsh-config-editor': ConfigEditor,
  '@deepseek-ai/dsh-settings': Settings,
  '@deepseek-ai/dsh-typert-registry': Typert,
  '@deepseek-ai/dsh-typert-loader': TypertLoader,
  '@deepseek-ai/dsh-api-remote-access': RemoteAccess,
  '@deepseek-ai/dsh-api-gateway': Gateway,
  '@deepseek-ai/dsh-api-settings-controller': SettingsController,
  '@deepseek-ai/dsh-api-shell-remotes': ShellRemotes,
  '@deepseek-ai/dsh-host-webserver': WebServer,
  '@deepseek-ai/dsh-client-modules': Modules,
  '@deepseek-ai/dsh-client-connection': Connection,
  '@deepseek-ai/dsh-client-ui-renderer': Renderer,
  '@deepseek-ai/dsh-client-ui-settings': UiSettings,
  '@deepseek-ai/dsh-client-locale': Locale,
  '@deepseek-ai/dsh-client-ui-theme': Theme,
  '@deepseek-ai/dsh-client-ui-shell': Shell,
  '@deepseek-ai/dsh-shell-base': ShellBase,
}

describe('standalone shell composition', () => {
  it('activates every whitelist row and serves an authenticated shell without business services', async () => {
    const root = await mkdtemp(join(import.meta.dirname, '.tmp-shell-base-'))
    const ctx = new Context()
    onTestFinished(async () => {
      await ctx.fiber.dispose()
      await rm(root, { recursive: true, force: true })
    })
    const patch = parse(await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8')) as Array<{ insert: EntryOptions[] }>
    const rows = patch.flatMap(layer => layer.insert)
    const credentials = rows.find(row => row.id === 'credentials')!
    credentials.config = { path: join(root, '.credentials.yaml'), watch: false }
    rows.find(row => row.id === 'shell-base')!.config = { printUrl: false }
    const configPath = join(root, 'cordis.yml')
    const patchPath = join(root, 'cordis.patch.yml')
    await writeFile(configPath, stringify(rows))
    await writeFile(patchPath, '[]\n')
    ctx.baseUrl = pathToFileURL(`${import.meta.dirname}/../`).href
    ctx.provide('profileContext', {
      name: 'shell', dir: root, patchPath,
      installAnchor: new URL('../../../../apps/cli/package.json', import.meta.url).pathname,
      startedBundles: ['@deepseek-ai/dsh-shell-base'], cwd: root, home: root,
      overlays: [], telemetryDisabledEnv: undefined,
    })
    ctx.provide('appReady', { onReady: () => () => {} })
    await ctx.plugin(Loader)
    ctx.loader.builtins.include = Include
    ctx.loader.internal = {
      ...ctx.loader.internal,
      version: 'v2',
      async import(specifier: string) {
        const implementation = implementations[specifier]
        if (implementation === undefined) throw new Error(`unexpected Loader import: ${specifier}`)
        return implementation
      },
    } as NonNullable<typeof ctx.loader.internal>
    await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
    await ctx.loader.await()
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
    // Informational package inject metadata can still name an absent full assembly.
    expect(ids).not.toContain('@deepseek-ai/dsh-api-remotes')
    expect(ids).not.toContain('@deepseek-ai/dsh-client-ui-conversation')
  })
})
