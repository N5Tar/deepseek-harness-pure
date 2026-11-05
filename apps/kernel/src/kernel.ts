/** Boot the kernel: one Cordis root, one page, settings, and Loader-mounted plugins. */
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import { readManifest, type KernelPluginEntry } from './manifest.ts'
import { registerPages } from './pages.ts'
import { KernelServer } from './server.ts'
import { KernelSettingsStore, settingsPath } from './settings.ts'

/** Options one kernel process needs. */
export interface KernelOptions {
  /** Kernel home holding the settings document and the plugin manifest. */
  readonly home: string
  /** Requested loopback port; `0` selects an OS-assigned port. */
  readonly port?: number
  /** Extra entries mounted after the manifest; used by tests and hosts. */
  readonly plugins?: readonly KernelPluginEntry[]
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
 * Start the kernel with its built-in plugins and the plugin manifest.
 * @param options - home directory, requested port, and extra entries.
 * @returns the running kernel.
 */
export async function bootKernel(options: KernelOptions): Promise<RunningKernel> {
  const ctx = new Context()
  await ctx.plugin(KernelServer, options.port ?? 0)
  await ctx.plugin(KernelSettingsStore, settingsPath(options.home))
  await ctx.kernelServer.listen()
  await ctx.plugin(registerPages)
  await ctx.plugin(Loader, { baseUrl: import.meta.url })
  for (const entry of [...await readManifest(options.home), ...options.plugins ?? []]) {
    await ctx.loader.create({
      name: entry.name,
      ...entry.config === undefined ? {} : { config: entry.config },
      ...entry.disabled === undefined ? {} : { disabled: entry.disabled },
    })
  }
  await ctx.loader.await()
  return {
    ctx,
    url: ctx.kernelServer.url,
    async stop() {
      await ctx.kernelServer.close()
      await ctx.fiber.dispose()
    },
  }
}
