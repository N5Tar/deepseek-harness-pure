/** Plugin manifest: the kernel's only extension point. */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/** One plugin the kernel mounts through the Loader. */
export interface KernelPluginEntry {
  /** Module specifier imported by the Loader, relative to the kernel entry. */
  readonly name: string
  /** Plugin configuration passed verbatim. */
  readonly config?: unknown
  /** Stops the entry and prevents it from starting. */
  readonly disabled?: boolean
}

/** Manifest document shape. */
interface KernelManifest {
  readonly plugins?: readonly KernelPluginEntry[]
}

/** Path of the optional plugin manifest inside the kernel home. */
export function manifestPath(home: string): string {
  return join(home, 'kernel', 'plugins.json')
}

/**
 * Read the plugin manifest.
 * @param home - kernel home holding `kernel/plugins.json`.
 * @returns declared entries; a missing manifest mounts no extra plugin.
 * @throws When the manifest exists but is not a JSON document with a `plugins` array.
 */
export async function readManifest(home: string): Promise<readonly KernelPluginEntry[]> {
  let text: string
  try {
    text = await readFile(manifestPath(home), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  const parsed: unknown = JSON.parse(text)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('kernel manifest: plugins.json must be a JSON object')
  }
  const plugins = (parsed as KernelManifest).plugins
  if (plugins === undefined) return []
  if (!Array.isArray(plugins)) throw new Error('kernel manifest: "plugins" must be an array')
  return plugins.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null) throw new Error(`kernel manifest: plugin ${String(index)} must be an object`)
    const candidate = entry as KernelPluginEntry
    if (typeof candidate.name !== 'string' || candidate.name === '') {
      throw new Error(`kernel manifest: plugin ${String(index)} needs a module name`)
    }
    return candidate
  })
}
