/** Durable kernel settings kept in one JSON document under the kernel home. */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Service, type Context } from '@deepseek-ai/cordis'

/** Settings every kernel document may carry; unknown keys are preserved. */
export interface KernelSettings {
  /** Browser appearance preference rendered by the shell page. */
  theme: 'light' | 'dark' | 'system'
  /** Interface language tag used for the page copy. */
  language: string
  /** Extension point: plugin-owned values keyed by plugin name. */
  [key: string]: unknown
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    kernelSettings: KernelSettingsStore
  }
}

const DEFAULTS: KernelSettings = { theme: 'dark', language: 'en' }

/** Reads and writes the settings document, serializing writers. */
export class KernelSettingsStore extends Service {
  private current: KernelSettings | undefined
  private tail: Promise<void> = Promise.resolve()

  /**
   * @param ctx - owning context.
   * @param path - absolute settings document path.
   */
  constructor(ctx: Context, private readonly path: string) {
    super(ctx, 'kernelSettings')
  }

  /** Current settings; the first read loads the document and applies defaults. */
  async read(): Promise<KernelSettings> {
    if (this.current === undefined) this.current = await this.load()
    return this.current
  }

  /**
   * Merge a patch into the document and persist it.
   * @param patch - settings to replace; unknown keys are kept.
   * @returns the committed settings.
   */
  async update(patch: Partial<KernelSettings>): Promise<KernelSettings> {
    const write = this.tail.then(async () => {
      const next = { ...await this.read(), ...patch }
      await mkdir(dirname(this.path), { recursive: true, mode: 0o700 })
      const temporary = `${this.path}.tmp`
      await writeFile(temporary, `${JSON.stringify(next, undefined, 2)}\n`, { mode: 0o600 })
      await rename(temporary, this.path)
      this.current = next
      return next
    })
    this.tail = write.then(() => undefined, () => undefined)
    return write
  }

  private async load(): Promise<KernelSettings> {
    try {
      const raw = JSON.parse(await readFile(this.path, 'utf8')) as Partial<KernelSettings>
      return { ...DEFAULTS, ...raw }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ...DEFAULTS }
      this.ctx.logger.warn('kernel settings: falling back to defaults for %s', this.path)
      return { ...DEFAULTS }
    }
  }
}

/** Resolve the settings document path for a kernel home directory. */
export function settingsPath(home: string): string {
  return join(home, 'kernel', 'settings.json')
}
