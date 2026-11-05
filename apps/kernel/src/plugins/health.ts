/** Example capability mounted by the Loader: a health endpoint and nothing else. */
import type { Context } from '@deepseek-ai/cordis'

export const name = 'kernel-health'
export const inject = ['kernelServer']

/**
 * Register the health route for this plugin's lifetime.
 * @param ctx - kernel context holding the HTTP service.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.kernelServer.route({
    method: 'GET',
    path: '/health',
    handle: (_request, response) => {
      const body = JSON.stringify({ status: 'ok', plugin: name })
      response.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) })
      response.end(body)
    },
  }))
}
