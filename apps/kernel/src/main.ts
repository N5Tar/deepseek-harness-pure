/** Process entry: resolve the kernel home and port, then serve the single page. */
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { bootKernel } from './kernel.ts'

const home = resolve(process.env.DSH_HOME ?? resolve(homedir(), '.dsh'))
const port = Number(process.env.DSH_KERNEL_PORT ?? '0')
if (!Number.isSafeInteger(port) || port < 0 || port > 65_535) {
  throw new Error('kernel: DSH_KERNEL_PORT must be an integer from 0 through 65535')
}

const kernel = await bootKernel({ home, port })
console.log(`kernel: serving ${kernel.url} (home ${home})`)

let stopping = false
const stop = async (): Promise<void> => {
  if (stopping) return
  stopping = true
  await kernel.stop()
}
process.once('SIGINT', () => { void stop().then(() => { process.exitCode = 0 }) })
process.once('SIGTERM', () => { void stop().then(() => { process.exitCode = 0 }) })
