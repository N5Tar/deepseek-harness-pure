/** Loopback HTTP service: the kernel's only network surface. */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { Service, type Context } from '@deepseek-ai/cordis'

/** One HTTP route owned by a kernel plugin. */
export interface KernelRoute {
  readonly method: 'GET' | 'POST'
  readonly path: string
  readonly handle: (request: IncomingMessage, response: ServerResponse) => void | Promise<void>
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    kernelServer: KernelServer
  }
}

function writeText(response: ServerResponse, status: number, contentType: string, body: string): void {
  response.writeHead(status, { 'content-type': contentType, 'content-length': Buffer.byteLength(body) })
  response.end(body)
}

/** Owns the listening socket and dispatches requests to registered routes. */
export class KernelServer extends Service {
  private server: Server | undefined
  private origin: string | undefined
  private readonly routes = new Map<string, KernelRoute['handle']>()

  /**
   * @param ctx - owning context.
   * @param port - requested port; `0` selects an OS-assigned port.
   */
  constructor(ctx: Context, private readonly port: number = 0) {
    super(ctx, 'kernelServer')
  }

  /** Base URL of the running listener. */
  get url(): string {
    if (this.origin === undefined) throw new Error('kernel server: not listening')
    return this.origin
  }

  /**
   * Register one route for the calling fiber's lifetime.
   * @param route - method, path, and handler.
   * @returns Disposer removing the route.
   * @throws When the path is already owned.
   */
  route(route: KernelRoute): () => void {
    const key = `${route.method} ${route.path}`
    if (this.routes.has(key)) throw new Error(`kernel server: duplicate route ${key}`)
    this.routes.set(key, route.handle)
    return () => { this.routes.delete(key) }
  }

  /** Listen on the loopback interface and resolve once the socket is bound. */
  async listen(): Promise<void> {
    const server = createServer((request, response) => { void this.dispatch(request, response) })
    this.server = server
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(this.port, '127.0.0.1', () => { resolve() })
    })
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('kernel server: listener has no port')
    this.origin = `http://127.0.0.1:${String(address.port)}`
    this.ctx.effect(() => () => { void this.close() })
  }

  /** Close the listener; safe to call more than once. */
  async close(): Promise<void> {
    const server = this.server
    this.server = undefined
    this.origin = undefined
    if (server === undefined) return
    await new Promise<void>((resolve, reject) => {
      server.close((error) => { if (error === undefined) resolve(); else reject(error) })
      server.closeAllConnections()
    })
  }

  private async dispatch(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const path = new URL(request.url ?? '/', 'http://kernel.local').pathname
    const key = `${request.method === 'POST' ? 'POST' : 'GET'} ${path}`
    const handle = this.routes.get(key)
    if (handle === undefined) { writeText(response, 404, 'text/plain; charset=utf-8', 'not found'); return }
    try {
      await handle(request, response)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.ctx.logger.warn('kernel route %s failed: %s', key, message)
      if (!response.headersSent) writeText(response, 500, 'text/plain; charset=utf-8', 'internal error')
      else response.end()
    }
  }
}
