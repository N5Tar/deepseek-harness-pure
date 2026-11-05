/**
 * Keyless REAL Loader composition; requires built Client bundles and frontend dist.
 * Missing artifacts fail rather than skip. No external model or account is used.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import { mountRootInclude, readProfilePatches } from '@deepseek-ai/dsh-app-boot'
import * as Credentials from '@deepseek-ai/dsh-credentials-local'
import * as ConfigEditor from '@deepseek-ai/dsh-config-editor'
import * as Settings from '@deepseek-ai/dsh-settings'
import * as Typert from '@deepseek-ai/dsh-typert-registry'
import * as TypertLoader from '@deepseek-ai/dsh-typert-loader'
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
import { stringify } from 'yaml'
import { onTestFinished } from 'vitest'
import * as ShellBase from '../src/index.ts'

const implementations: Record<string, unknown> = {
  '@deepseek-ai/dsh-credentials-local': Credentials,
  '@deepseek-ai/dsh-config-editor': ConfigEditor,
  '@deepseek-ai/dsh-settings': Settings,
  '@deepseek-ai/dsh-typert-registry': Typert,
  '@deepseek-ai/dsh-typert-loader': TypertLoader,
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

/** Boot the shipped shell rows in an isolated profile, disposed after the owning test. @returns Host Context and settings patch path. */
export async function createShellBaseTestHost() {
  const root = await mkdtemp(join(import.meta.dirname, '.tmp-shell-base-'))
  const ctx = new Context()
  onTestFinished(async () => {
    try { await ctx.fiber.dispose() }
    finally { await rm(root, { recursive: true, force: true }) }
  })
  const configPath = join(root, 'cordis.yml')
  const patchPath = join(root, 'cordis.patch.yml')
  await writeFile(configPath, '[]\n')
  await writeFile(join(root, 'package.json'), JSON.stringify({
    private: true, type: 'module', dsh: { profile: { bundles: ['@deepseek-ai/dsh-shell-base'] } },
  }))
  await writeFile(patchPath, stringify([
    { id: 'credentials', config: { path: join(root, '.credentials.yaml'), watch: false } },
    { id: 'shell-base', config: { printUrl: false } },
  ]))
  ctx.baseUrl = pathToFileURL(`${import.meta.dirname}/../`).href
  ctx.provide('profileContext', {
    name: 'shell', dir: root, patchPath,
    installAnchor: fileURLToPath(new URL('../../../../apps/cli/package.json', import.meta.url)),
    startedBundles: ['@deepseek-ai/dsh-shell-base'], cwd: root, home: join(root, 'home'),
    overlays: [], telemetryDisabledEnv: undefined,
  })
  ctx.provide('appReady', { onReady: () => () => {} })
  await ctx.plugin(Loader)
  ctx.loader.internal = {
    ...ctx.loader.internal,
    version: 'v2',
    async import(specifier: string) {
      const implementation = implementations[specifier]
      if (implementation === undefined) throw new Error(`unexpected Loader import: ${specifier}`)
      return implementation
    },
  } as NonNullable<typeof ctx.loader.internal>
  await mountRootInclude(ctx, configPath, readProfilePatches('dsh', ctx.profileContext))
  await ctx.loader.await()
  return { ctx, patchPath }
}
