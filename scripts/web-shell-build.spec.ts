/** Pin the single Host-backed Web entry and its source-level package inputs. */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import config from '../apps/web/vite.config.ts'

const path = (relative: string) => fileURLToPath(new URL(`../apps/web/${relative}`, import.meta.url))
const manifest = JSON.parse(readFileSync(path('package.json'), 'utf8')) as {
  files: string[]
  scripts: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies: Record<string, string>
}

describe('session-free Web build', () => {
  it('builds only the Host-backed document, without a preview bootstrap', () => {
    expect(config.build?.rollupOptions?.input).toEqual({ index: path('index.html') })
    expect(existsSync(path('src/preview.ts'))).toBe(false)
    expect(manifest.files).toEqual(['dist', '!dist/**/*.map'])
    expect(manifest.scripts).not.toHaveProperty('build:preview')
    expect(manifest.scripts).not.toHaveProperty('serve:preview')
  })

  it('does not require message references or business Worker packages for the Web app', () => {
    expect(manifest.dependencies ?? {}).toEqual({})
    for (const name of ['@deepseek-ai/dsh-message-quotes', '@deepseek-ai/dsh-experimental-webworker-runtime', '@deepseek-ai/dsh-experimental-webworker-packer']) {
      expect(manifest.devDependencies).not.toHaveProperty(name)
    }
  })
})
