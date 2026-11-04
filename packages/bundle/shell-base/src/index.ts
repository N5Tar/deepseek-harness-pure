/** Authenticated browser carrier and settings event assembly for the standalone shell. */
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import * as FrontendStatic from '@deepseek-ai/dsh-host-frontend-static'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-cmdline'
import type {} from '@deepseek-ai/dsh-api-gateway'
import { settingsEvents } from './settings-events.ts'

/** Stable Loader plugin name. */
export const name = 'shell-base'
/** Transport, event dispatch, and launcher readiness precede the shell runtime. */
export const inject = ['webServer', 'connection', 'typertGateway', 'appReady']

/** Shell runtime configuration; transport binding belongs to the webserver row. */
export interface Config {
  /** Print an authenticated local URL once the launcher reports readiness. */
  printUrl: boolean
}

export const Config: z<Config> = z.object({
  printUrl: z.boolean().default(true),
})

/** Resolve the packaged frontend through its owning manifest, not the invocation directory. */
function frontendIndex(): string {
  const require = createRequire(import.meta.url)
  return join(dirname(require.resolve('@deepseek-ai/dsh-web-frontend/package.json')), 'dist', 'index.html')
}

/**
 * Mount authenticated frontend assets and the settings-only event source.
 * @param ctx - profile context with transport and launcher readiness.
 * @param config - validated shell runtime options.
 */
export function apply(ctx: Context, config: Config): void {
  ctx.plugin(FrontendStatic, { distIndex: frontendIndex() })
  ctx.effect(() => ctx.typertGateway.registerRemoteEvents(settingsEvents(ctx), { home: homedir() }), 'shell-base: settings events')
  if (config.printUrl) {
    const ready = ctx.get('appReady')
    if (ready === undefined) throw new Error('shell-base requires launcher readiness')
    ctx.effect(() => ready.onReady(() => {
      console.log(`dsh shell: ${ctx.connection.authenticatedUrl(ctx.webServer.getOrigin())}`)
    }), 'shell-base: ready URL')
  }
}
