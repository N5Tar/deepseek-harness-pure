import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_DESKTOP_THEME, DESKTOP_THEME_FILENAME, ensureDesktopTheme, readDesktopTheme, writeDesktopTheme,
} from '../src/theme-default.ts'

const roots: string[] = []
function temporaryHome(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-desktop-theme-'))
  roots.push(root)
  return join(root, 'home')
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('desktop default appearance', () => {
  it('records the dark default once and keeps a recorded choice', () => {
    const home = temporaryHome()
    ensureDesktopTheme(home)
    expect(readFileSync(join(home, DESKTOP_THEME_FILENAME), 'utf8')).toBe(`${DEFAULT_DESKTOP_THEME}\n`)
    writeDesktopTheme(home, 'light')
    ensureDesktopTheme(home)
    expect(readDesktopTheme(home)).toBe('light')
  })

  it('reads a recorded appearance and treats a missing file as unrecorded', () => {
    const home = temporaryHome()
    expect(readDesktopTheme(home)).toBeUndefined()
    writeDesktopTheme(home, 'dark')
    expect(readDesktopTheme(home)).toBe('dark')
  })

  it('falls back to the system appearance for an invalid or unreadable record', () => {
    const home = temporaryHome()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mkdirSync(home, { recursive: true })
    writeFileSync(join(home, DESKTOP_THEME_FILENAME), 'sepia\n')
    expect(readDesktopTheme(home)).toBeUndefined()
    expect(warn).toHaveBeenCalledOnce()
    rmSync(join(home, DESKTOP_THEME_FILENAME))
    mkdirSync(join(home, DESKTOP_THEME_FILENAME))
    expect(readDesktopTheme(home)).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('keeps the recorded choice when the file cannot be rewritten', () => {
    const home = temporaryHome()
    mkdirSync(home, { recursive: true })
    writeFileSync(join(home, DESKTOP_THEME_FILENAME), 'dark\n')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // A directory in place of the file makes the rewrite fail without removing the record.
    const path = join(home, DESKTOP_THEME_FILENAME)
    rmSync(path)
    mkdirSync(path)
    ensureDesktopTheme(home)
    expect(warn).toHaveBeenCalledOnce()
    expect(existsSync(path)).toBe(true)
  })
})
