/** Client module table: the page's plugin bundles and their registration contract. */
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

/** One browser module the page imports after boot. */
export interface KernelClientModule {
  /** Stable id used as the `data-kernel-module` marker once mounted. */
  readonly id: string
  /** Path the page imports, relative to the kernel origin. */
  readonly url: string
}

/** Directory contract: `<dir>/<id>.js` is one client module. */
export interface ModuleDirectory {
  /** Directory scanned for `*.js` client modules; a missing directory serves nothing. */
  readonly directory: string
}

/**
 * List the client modules on disk.
 * @param options - directory holding one `*.js` file per client module.
 * @returns modules ordered by file name; ids are the file stems.
 */
export async function listClientModules(options: ModuleDirectory): Promise<readonly KernelClientModule[]> {
  let entries: string[]
  try {
    entries = await readdir(options.directory)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  return entries
    .filter(name => name.endsWith('.js'))
    .sort()
    .map(name => ({ id: name.slice(0, -'.js'.length), url: `/ui/${name}` }))
}

/**
 * Read one client module body.
 * @param options - directory holding the module files.
 * @param file - file name requested by the page.
 * @returns module source, or undefined when the name is not a plain `*.js` file in the directory.
 */
export async function readClientModule(options: ModuleDirectory, file: string): Promise<string | undefined> {
  if (!/^[A-Za-z0-9._-]+\.js$/u.test(file) || file.includes('..')) return undefined
  try {
    return await readFile(join(options.directory, file), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}
