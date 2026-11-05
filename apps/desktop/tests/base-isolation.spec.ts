import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = new URL('../', import.meta.url)
const allowed = new Set([
  '@deepseek-ai/cordis',
  '@deepseek-ai/node-addon-system',
  '@deepseek-ai/dsh-app-boot',
  '@deepseek-ai/dsh-home-paths',
  '@deepseek-ai/dsh-official-bundles',
  '@deepseek-ai/dsh-client-shortcuts',
  '@deepseek-ai/dsh-atomic-write',
  '@deepseek-ai/dsh-plugin-manager',
])
type Dependencies = Partial<Record<'dependencies' | 'devDependencies' | 'optionalDependencies' | 'peerDependencies', Record<string, string>>>
function productDependencies(manifest: Dependencies): string[] {
  return Object.values(manifest).flatMap(section => Object.keys(section ?? {}))
    .filter(name => name.startsWith('@deepseek-ai/') && !allowed.has(name))
}

const manifest = JSON.parse(readFileSync(new URL('package.json', root), 'utf8')) as Dependencies
const sections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'] as const

describe('desktop base isolation', () => {
  it('declares only platform workspace dependencies in every dependency section', () => {
    expect(productDependencies(Object.fromEntries(sections.map(section => [section, manifest[section] ?? {}])))).toEqual([])
  })

  it.each(sections)('rejects a product dependency in %s', (section) => {
    expect(productDependencies({ [section]: { '@deepseek-ai/dsh-deepseek-account': 'workspace:*' } }))
      .toEqual(['@deepseek-ai/dsh-deepseek-account'])
  })

  it('builds only the application preload and no independent product renderer', () => {
    const config = readFileSync(new URL('tsdown.config.ts', root), 'utf8')
    expect(config).toContain("...(['preload-app'] as const)")
    expect(config).not.toMatch(/welcome|preload-mandatory|preload-platform-account|preload-update-dialog|from 'vite'/u)
  })

  it('keeps account and task IPC out of the Electron and Host protocols', () => {
    for (const name of ['src/ipc.ts', 'src/host-protocol.ts']) {
      const path = new URL(name, root)
      const source = readFileSync(path, 'utf8')
      expect(source, fileURLToPath(path)).not.toMatch(/update-inspect|quit-inspection|platform-account|file-drag|onboarding|dsh-platform/u)
    }
  })
})
