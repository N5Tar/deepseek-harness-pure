/** Configuration Remote namespaces selected by the standalone shell. */
import type { Context } from '@deepseek-ai/cordis'
import settingsControllerRemote from '@deepseek-ai/dsh-api-settings-controller/remote'
export type {} from '@deepseek-ai/dsh-api-gateway/client'
export type {} from '@deepseek-ai/dsh-api-settings-controller/remote'
export type {} from '../types.ts'

/** The Gateway provides the Client Remote registry. */
export const inject = ['remote']

/**
 * Mount generated settings and credential-management methods without business assemblies.
 * @param ctx - Client context carrying the Remote registry.
 * @returns the namespace contribution disposer.
 */
export function apply(ctx: Context): Promise<() => Promise<void>> {
  return ctx.remote.$mount(settingsControllerRemote)
}
