/** Launch the private Desktop profile and report authenticated readiness to Electron. */

import { delimiter, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { PluginOperationRunId } from '@deepseek-ai/dsh-plugin-manager/diagnostic'
import { formatFatalDiagnostic } from './fatal-diagnostic.ts'
import { loadLayeredEnv, loadProfileDirectory, reportSkippedBundles, runResolvedProfile } from '@deepseek-ai/dsh-app-boot'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { installOperationDiagnostics } from './operation-diagnostics.ts'

/** Send one private IPC message to the Electron parent. */
function send(message: object): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!process.connected || process.send === undefined) { resolve(); return }
    process.send(message, (error) => { if (error === null) resolve(); else reject(error) })
  })
}

async function main(): Promise<void> {
  const runId = randomUUID() as PluginOperationRunId
  if (process.connected) process.send?.({ type: 'starting', runId }, (error) => { if (error !== null) console.error(error) })
  if (process.env.DSH_DESKTOP_KERNEL === '1') {
    await runKernelMode()
    return
  }
  const runtimeDir = process.argv[2] as string
  const projectDir = process.argv[3] as string
  const installAnchor = join(runtimeDir, 'node_modules', '@deepseek-ai', 'dsh-desktop-host', 'package.json')
  const profile = loadProfileDirectory('dsh', projectDir, installAnchor)
  reportSkippedBundles('dsh', profile)
  const application = runResolvedProfile({
    environment: loadLayeredEnv('dsh'),
    name: 'desktop',
    profile,
    installAnchor,
    overlays: [],
    args: [],
    ...(process.argv[4] === undefined ? {} : {
      packageManager: {
        command: process.execPath,
        args: ['--expose-internals', process.argv[4]],
        env: {
          ELECTRON_RUN_AS_NODE: '1',
          DSH_DESKTOP_NODE_EXECUTABLE: process.execPath,
          PATH: `${process.argv[5] ?? ''}${delimiter}${process.env.PATH ?? ''}`,
        },
      },
    }),
  })
  let stopping: Promise<void> | undefined
  const stop = (): Promise<void> => stopping ??= (async () => {
    // Startup failure is reported by main; shutdown only owns a tree that booted.
    const running = await application.catch(() => undefined)
    await running?.shutdown.shutdown(0)
    await send({ type: 'shutdown-complete' })
    if (process.connected) process.disconnect()
    if (running !== undefined) process.exit()
  })()
  process.on('message', (message: unknown) => {
    if (typeof message !== 'object' || message === null || !('type' in message)) return
    if (message.type === 'shutdown') { void stop(); return }
  })
  process.once('disconnect', () => { void stop() })
  const { ctx } = await application
  if (stopping !== undefined) return
  installOperationDiagnostics(ctx, record => send({ type: 'plugin-operation', record }), 32, runId)
  const url = ctx.connection.authenticatedUrl(`${ctx.webServer.protocol}//127.0.0.1:${String(ctx.webServer.port)}`)
  await send({ type: 'ready', url, injections: ctx.webServer.collectIndexInjections(ctx.connection.browserPeer) })
}

/**
 * Boot the Cordis kernel instead of the product profile: one page, no authenticated Host.
 * @returns after the kernel reported readiness and wired shutdown handling.
 */
async function runKernelMode(): Promise<void> {
  const { bootKernel } = await import('@deepseek-ai/dsh-kernel')
  const home = process.env.DSH_HOME ?? join(process.env.HOME ?? process.cwd(), '.dsh')
  const kernel = await bootKernel({ home, port: 0 })
  let stopping: Promise<void> | undefined
  const stop = (): Promise<void> => stopping ??= (async () => {
    await kernel.stop()
    await send({ type: 'shutdown-complete' })
    if (process.connected) process.disconnect()
    process.exit()
  })()
  process.on('message', (message: unknown) => {
    if (typeof message === 'object' && message !== null && 'type' in message && message.type === 'shutdown') void stop()
  })
  process.once('disconnect', () => { void stop() })
  console.log(`desktop host: kernel mode serving ${kernel.url} (home ${home})`)
  await send({ type: 'ready', url: kernel.url, injections: [] })
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    const diagnostic = formatFatalDiagnostic(error)
    if (process.connected) process.send?.({ type: 'fatal', message, diagnostic }, (error) => { if (error !== null) console.error(error) })
    console.error(error)
    process.exitCode = 1
    if (process.connected) process.disconnect()
  })
}
