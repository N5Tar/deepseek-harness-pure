/** The single shell page and its settings endpoint. */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { listClientModules, readClientModule, type ModuleDirectory } from './modules.ts'
import type { KernelSettings } from './settings.ts'

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Harness Kernel</title>
<style>
:root { color-scheme: dark; --bg:#141416; --fg:#e9e9ec; --muted:#9a9aa3; }
body { margin:0; font:16px/1.5 system-ui, sans-serif; background:var(--bg); color:var(--fg);
  display:grid; place-items:center; min-height:100vh; }
main { max-width:38rem; padding:2rem; }
h1 { font-size:2rem; margin:0 0 .5rem; }
p { color:var(--muted); margin:0 0 1rem; }
button { font:inherit; padding:.5rem 1rem; border-radius:.5rem; border:1px solid #3a3a40;
  background:#1d1d21; color:inherit; cursor:pointer; }
button:hover { background:#26262b; }
</style>
</head>
<body>
<main>
  <h1>Harness Kernel</h1>
  <p>One page from the Cordis kernel. Every capability arrives as a plugin.</p>
  <p>Theme: <strong id="theme">…</strong> · Language: <strong id="language">…</strong></p>
  <button id="toggle" type="button">Toggle theme</button>
  <div id="modules"></div>
</main>
<script>
const theme = document.getElementById('theme')
const language = document.getElementById('language')
async function refresh() {
  const settings = await fetch('./api/settings').then(r => r.json())
  theme.textContent = settings.theme
  language.textContent = settings.language
  document.documentElement.style.colorScheme = settings.theme === 'system' ? 'light dark' : settings.theme
}
document.getElementById('toggle').addEventListener('click', async () => {
  const current = await fetch('./api/settings').then(r => r.json())
  await fetch('./api/settings', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ theme: current.theme === 'dark' ? 'light' : 'dark' }) })
  await refresh()
})
void refresh()

async function mountModules() {
  const modules = await fetch('./api/modules').then(r => r.json())
  for (const module of modules) {
    await import(module.url)
  }
  const registry = window.__DSH_KERNEL_UI__ ?? { modules: [] }
  const host = document.getElementById('modules')
  for (const plugin of registry.modules ?? []) {
    plugin.mount(host)
  }
}
void mountModules()
</script>
</body>
</html>
`

function json(response: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value)
  response.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) })
  response.end(body)
}

async function readPatch(request: IncomingMessage): Promise<Partial<KernelSettings>> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk as Uint8Array))
  const text = Buffer.concat(chunks).toString('utf8')
  if (text.trim() === '') return {}
  const parsed: unknown = JSON.parse(text)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('kernel settings: patch must be a JSON object')
  }
  return parsed
}

/**
 * Serve the shell page and its settings API over the kernel server.
 * @param ctx - kernel context; the server and settings services must exist.
 */
export const registerPages = Object.assign((ctx: Context, modules: ModuleDirectory): void => {
  ctx.effect(() => ctx.kernelServer.route({
    method: 'GET',
    path: '/',
    handle: (_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-length': Buffer.byteLength(PAGE) })
      response.end(PAGE)
    },
  }))
  ctx.effect(() => ctx.kernelServer.route({
    method: 'GET',
    path: '/api/settings',
    handle: async (_request, response) => { json(response, 200, await ctx.kernelSettings.read()) },
  }))
  ctx.effect(() => ctx.kernelServer.route({
    method: 'GET',
    path: '/api/modules',
    handle: async (_request, response) => { json(response, 200, await listClientModules(modules)) },
  }))
  for (const prefix of ['/ui/'] as const) {
    ctx.effect(() => ctx.kernelServer.route({
      method: 'GET',
      path: prefix + ':file',
      handle: async (request, response) => {
        const file = decodeURIComponent(new URL(request.url ?? '/', 'http://kernel.local').pathname.slice(prefix.length))
        const source = await readClientModule(modules, file)
        if (source === undefined) { response.writeHead(404); response.end(); return }
        response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'content-length': Buffer.byteLength(source) })
        response.end(source)
      },
    }))
  }
  ctx.effect(() => ctx.kernelServer.route({
    method: 'POST',
    path: '/api/settings',
    handle: async (request, response) => {
      try {
        json(response, 200, await ctx.kernelSettings.update(await readPatch(request)))
      } catch (error) {
        json(response, 400, { error: error instanceof Error ? error.message : 'invalid settings patch' })
      }
    },
  }))
}, { inject: ['kernelServer', 'kernelSettings'] })
