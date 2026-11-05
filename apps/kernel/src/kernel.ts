/** Boot the kernel: one Cordis root, one page, settings, and nothing else. */
import { Context } from '@deepseek-ai/cordis'
import { registerPages } from './pages.ts'
import { KernelServer } from './server.ts'
import { KernelSettingsStore, settingsPath } from './settings.ts'

/** Options one kernel process needs. */
export interface KernelOptions {
  /** Kernel home holding the settings document. */
  readonly home: string
  /** Requested loopback port; `0` selects an OS-assigned port. */
  readonly port?: number
}

/** A running kernel and the handles its host needs. */
export interface RunningKernel {
  readonly ctx: Context
  /** Advertised loopback base URL. */
  readonly url: string
  /** Stop the server and dispose every plugin. */
  stop(): Promise<void>
}

/**
 * Start the kernel with its built-in plugins.
 * @param options - home directory and requested port.
 * @returns the running kernel.
 */
export async function bootKernel(options: KernelOptions): Promise<RunningKernel> {
  const ctx = new Context()
  await ctx.plugin(KernelServer, options.port ?? 0)
  await ctx.plugin(KernelSettingsStore, settingsPath(options.home))
  await ctx.kernelServer.listen()
  await ctx.plugin(registerPages)
  return {
    ctx,
    url: ctx.kernelServer.url,
    async stop() {
      await ctx.kernelServer.close()
      await ctx.fiber.dispose()
    },
  }
}
