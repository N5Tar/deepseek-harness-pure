/** Launch the private Desktop profile and report authenticated readiness to Electron. */

import { delimiter, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { PluginOperationRunId } from '@deepseek-ai/dsh-plugin-manager/diagnostic'
import { formatFatalDiagnostic } from './fatal-diagnostic.ts'
import { loadLayeredEnv, loadProfileDirectory, reportSkippedBundles, runResolvedProfile } from '@deepseek-ai/dsh-app-boot'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { installOperationDiagnostics } from './operation-diagnostics.ts'
import { parseDesktopHostMode } from './launch-mode.ts'

async function main(): Promise<void> {
  const mode = parseDesktopHostMode(process.env.DSH_DESKTOP_MODE)
  const runId = randomUUID() as PluginOperationRunId
  if (process.connected) process.send?.({ type: 'starting', runId }, (error) => { if (error !== null) console.error(error) })
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
    args: mode === 'shell' ? [] : ['--no-open', '--host', '127.0.0.1', '--port', '0'],
    ...(process.argv[5] === undefined ? {} : {
      packageManager: {
        command: process.execPath,
        args: ['--expose-internals', process.argv[5]],
        env: {
          ELECTRON_RUN_AS_NODE: '1',
          DSH_DESKTOP_NODE_EXECUTABLE: process.execPath,
          PATH: `${process.argv[6] ?? ''}${delimiter}${process.env.PATH ?? ''}`,
        },
      },
    }),
  })
  let stopping: Promise<void> | undefined
  const send = (message: object): Promise<void> => new Promise((resolve, reject) => {
    if (!process.connected || process.send === undefined) { resolve(); return }
    process.send(message, (error) => { if (error === null) resolve(); else reject(error) })
  })
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
    if (!('requestId' in message) || typeof message.requestId !== 'number' || !Number.isSafeInteger(message.requestId)) return
    const requestId = message.requestId
    if (message.type === 'quit-inspection') {
      void (async () => {
        try {
          if (stopping !== undefined) throw new Error('desktop quit: Host is unavailable')
          if (mode !== 'shell') throw new Error('desktop quit: task inspection is unavailable for product profiles')
          await application
          await send({ type: 'quit-inspection', requestId, activeTasks: false, scheduledTasks: false })
        } catch (error) {
          // The parent treats an unknown state as interruptible work and asks before quitting.
          await send({ type: 'quit-inspection', requestId, activeTasks: true, scheduledTasks: false,
            error: error instanceof Error ? error.message : String(error) })
        }
      })().catch((error: unknown) => { console.error(error) })
      return
    }
    if (message.type === 'file-drag-resource') {
      void send({ type: 'file-drag-resource', requestId, resource: null, error: 'desktop file drag: unsupported by desktop base' })
        .catch((error: unknown) => { console.error(error) })
      return
    }
    if (message.type === 'update-tasks' && 'action' in message && ['inspect', 'lock', 'unlock'].includes(String(message.action))) {
      void send({ type: 'update-tasks', requestId, active: true, error: 'desktop update: unsupported by desktop base' })
        .catch((error: unknown) => { console.error(error) })
    }
  })
  process.once('disconnect', () => { void stop() })
  const { ctx } = await application
  if (stopping !== undefined) return
  installOperationDiagnostics(ctx, record => send({ type: 'plugin-operation', record }), 32, runId)
  const url = ctx.connection.authenticatedUrl(`${ctx.webServer.protocol}//127.0.0.1:${String(ctx.webServer.port)}`)
  await send({ type: 'ready', url, injections: ctx.webServer.collectIndexInjections(ctx.connection.browserPeer) })
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
