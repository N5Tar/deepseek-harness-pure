/** Settings packages do not directly depend on AI services or the full Remote assembly. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dependencySections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const

type SettingsPackageManifest = Partial<Record<typeof dependencySections[number], Record<string, string>>> & {
  dsh?: { client?: { inject?: string[] } }
}

const packagePaths = [
  'packages/settings/settings',
  'packages/api/settings-controller',
  'packages/client/ui-settings',
  'packages/client/locale',
  'packages/client/ui-theme',
]

const productDependencies = [
  '@deepseek-ai/dsh-session',
  '@deepseek-ai/dsh-agent',
  '@deepseek-ai/dsh-agent-default-model',
  '@deepseek-ai/dsh-agent-preset-registry',
  '@deepseek-ai/dsh-llm',
  '@deepseek-ai/dsh-api-remotes',
]

describe('settings dependency isolation', () => {
  it.each(packagePaths)('%s keeps AI services out of its direct dependencies', (path) => {
    const manifest = JSON.parse(readFileSync(new URL(`../../../../${path}/package.json`, import.meta.url), 'utf8')) as SettingsPackageManifest
    for (const section of dependencySections) {
      for (const name of productDependencies) {
        expect(manifest[section] ?? {}, `${path}: ${section}`).not.toHaveProperty(name)
      }
    }
    for (const name of productDependencies) {
      expect(manifest.dsh?.client?.inject ?? [], `${path}: client inject`).not.toContain(name)
    }
  })
})
