/** Process lifecycle for an already resolved application profile, independent of CLI templates. */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { FiberState, type Context } from '@deepseek-ai/cordis'
import type { PatchOptions } from '@deepseek-ai/cordis-plugin-include'
import { provideCmdline, type AppReady } from '@deepseek-ai/dsh-cmdline'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { installProxyFromEnvironment } from '@deepseek-ai/dsh-http-proxy'
import { DSH_LAUNCH_ENVIRONMENT_KEY, type LaunchEnvironmentSnapshot } from '@deepseek-ai/dsh-launch-environment'
import { boot, installFailLoud } from './boot.ts'
import { createRuntimeResolution, type Profile } from './profile.ts'
import { readProfilePatches, type ProfileContext } from './profile-context.ts'
import { PluginPackages } from './profile-resolution/service.ts'
import { createProcessShutdown, type ProcessShutdown } from './process-shutdown.ts'

/** Root config filename shared by resolved-profile launchers and configuration previews. */
export const PROFILE_ROOT_FILENAME = 'cordis.yml'

/** Empty root patched by the profile's ordered bundle, home, and invocation layers. */
export const PROFILE_ROOT_CONFIG = `# dsh profile root — an empty entry list. The tree is composed as patches:
# each bundle in package.json's dsh.profile.bundles, then cordis.patch.yml, then any
# --patch overlays. Edit cordis.patch.yml, not this file.
[]
`

/** Inputs owned by the launcher rather than by product profile templates. */
export interface RunResolvedProfileOptions {
  /** Profile identity, including a private application-owned name such as desktop. */
  name: string
  /** Profile already loaded from the application's own directory. */
  profile: Profile
  /** Absolute manifest path anchoring the application's installed dependency graph. */
  installAnchor: string
  /** Immutable invocation environment provided before any plugin mounts. */
  environment: LaunchEnvironmentSnapshot
  /** Application arguments handed to cmdlineArgs without launcher interpretation. */
  args: readonly string[]
  /** Parsed invocation overlays, in precedence order. */
  overlays: PatchOptions[]
  /** Application-owned package runtime scoped to package operations. */
  packageManager?: ProfileContext['packageManager']
}

/** Launcher readiness is published only after boot and Host setup succeed. */
function createAppReady(): { service: AppReady; commit(): void } {
  let ready = false
  const listeners = new Set<() => void>()
  return {
    service: {
      onReady(listener) {
        if (ready) {
          listener()
          return () => {}
        }
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
    },
    commit() {
      if (ready) return
      ready = true
      for (const listener of [...listeners]) listener()
      listeners.clear()
    },
  }
}

/**
 * Boot an application-owned profile with process shutdown, proxy policy, and readiness.
 * @param options - resolved profile, dependency anchor, and immutable invocation inputs.
 * @returns the settled root context and bounded process shutdown controller.
 * @throws after releasing startup resources; cleanup failures preserve the startup cause.
 */
export async function runResolvedProfile(options: RunResolvedProfileOptions): Promise<{ ctx: Context; shutdown: ProcessShutdown }> {
  const disposeProxy = await installProxyFromEnvironment(options.environment, (message) => {
    process.stderr.write(`dsh: ${message}\n`)
  })
  const app: { current?: Context } = {}
  let disposal: Promise<void> | undefined
  const dispose = (): Promise<void> => disposal ??= (async () => {
    const failures: unknown[] = []
    for (const release of [() => app.current?.fiber.dispose(), disposeProxy]) {
      try { await release() } catch (error) { failures.push(error) }
    }
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) throw new AggregateError(failures, 'dsh: profile cleanup failed')
  })()
  try {
    const rootConfig = join(options.profile.dir, PROFILE_ROOT_FILENAME)
    writeFileSync(rootConfig, PROFILE_ROOT_CONFIG)
    const resolution = await createRuntimeResolution({ installAnchor: options.installAnchor, profile: options.profile })
    const appReady = createAppReady()
    const shutdown = createProcessShutdown(dispose)
    const signalShutdown = new AbortController()
    const interrupt = (code: number): void => {
      signalShutdown.abort()
      shutdown.interrupt(code)
    }
    // Signals also own teardown while providers are still activating.
    process.on('SIGTERM', () => { interrupt(0) })
    process.on('SIGINT', () => { interrupt(130) })
    installFailLoud('dsh', process, async () => { await app.current?.fiber.dispose() })
    const profileContext: ProfileContext = {
      name: options.name,
      ...(options.packageManager === undefined ? {} : { packageManager: options.packageManager }),
      dir: options.profile.dir, patchPath: options.profile.patchPath,
      installAnchor: options.installAnchor,
      startedBundles: options.profile.layers.map(layer => layer.packageName),
      cwd: process.cwd(), home: resolveDshHome(),
      overlays: options.overlays, telemetryDisabledEnv: process.env.DSH_TELEMETRY_DISABLED,
    }
    const ctx = await boot('dsh', rootConfig, readProfilePatches('dsh', profileContext, options.profile), async (hostCtx) => {
      app.current = hostCtx
      hostCtx.provide('profileContext', profileContext)
      hostCtx.provide(DSH_LAUNCH_ENVIRONMENT_KEY, options.environment)
      await hostCtx.plugin(PluginPackages, { resolution })
      provideCmdline(hostCtx, {
        args: options.args,
        exit: code => void shutdown.shutdown(code),
        ready: appReady.service,
      })
    })
    app.current = ctx
    if (!signalShutdown.signal.aborted && ctx.fiber.state === FiberState.ACTIVE && ctx.get('loader') !== undefined) {
      appReady.commit()
    }
    return { ctx, shutdown }
  } catch (error) {
    try { await dispose() } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'dsh: profile startup and cleanup failed')
    }
    throw error
  }
}
