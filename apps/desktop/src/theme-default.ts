/** Appearance applied before the renderer publishes a persisted preference. */
import { lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Home file holding the last appearance the owned renderer applied. */
export const DESKTOP_THEME_FILENAME = '.ff_theme'

/** Appearances the shell applies natively; `system` defers to the operating system. */
export type DesktopTheme = 'light' | 'dark' | 'system'

/** Appearance a Harness home starts with, recorded once when the file is absent. */
export const DEFAULT_DESKTOP_THEME: DesktopTheme = 'dark'

function isDesktopTheme(value: string): value is DesktopTheme {
  return value === 'light' || value === 'dark' || value === 'system'
}

/**
 * Read the appearance recorded for this launch.
 * @param home - resolved Harness home.
 * @returns the recorded appearance, or undefined when the file is missing, invalid, or unreadable.
 */
export function readDesktopTheme(home: string): DesktopTheme | undefined {
  try {
    const value = readFileSync(join(home, DESKTOP_THEME_FILENAME), 'utf8').trim()
    if (!isDesktopTheme(value)) throw new Error('expected light, dark or system')
    return value
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('desktop theme: using the system appearance because the recorded choice could not be read', error)
    }
    return undefined
  }
}

/**
 * Record an appearance confirmed by the owned renderer, so the next launch paints it before settings load.
 * @param home - resolved Harness home.
 * @param theme - appearance the shell now applies.
 */
export function writeDesktopTheme(home: string, theme: DesktopTheme): void {
  try {
    mkdirSync(home, { recursive: true, mode: 0o700 })
    writeFileSync(join(home, DESKTOP_THEME_FILENAME), `${theme}\n`, { mode: 0o600 })
  } catch (error) {
    console.warn('desktop theme: the appearance could not be recorded for the next launch', error)
  }
}

/**
 * Create the default appearance in a Harness home that has none; a recorded choice is never overwritten.
 * @param home - resolved Harness home.
 */
export function ensureDesktopTheme(home: string): void {
  const path = join(home, DESKTOP_THEME_FILENAME)
  try {
    mkdirSync(home, { recursive: true, mode: 0o700 })
    writeFileSync(path, `${DEFAULT_DESKTOP_THEME}\n`, { mode: 0o600, flag: 'wx' })
  } catch (error) {
    // Only an existing regular file is a recorded choice; anything else at that path is reported.
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || !isRecordedChoice(path)) {
      console.warn('desktop theme: the default appearance could not be recorded', error)
    }
  }
}

function isRecordedChoice(path: string): boolean {
  try {
    return lstatSync(path).isFile()
  } catch {
    return false
  }
}
