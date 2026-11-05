/** Desktop Host declares only its generic boot and authenticated transport dependencies. */
import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const root = new URL('../', import.meta.url)

const allowedDependencies = new Set([
  '@deepseek-ai/cordis',
  '@deepseek-ai/cordis-plugin-loader',
  '@deepseek-ai/cordis-plugin-include',
  '@deepseek-ai/dsh-app-boot',
  '@deepseek-ai/dsh-client-connection',
  '@deepseek-ai/dsh-host-webserver',
  '@deepseek-ai/dsh-plugin-manager',
  '@deepseek-ai/dsh-shell-base',
])

/** Return direct dependencies that do not belong to the Desktop Host. */
function unexpectedDependencies(sections: Record<string, Record<string, string>>): string[] {
  return [...new Set(['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']
    .flatMap(section => Object.keys(sections[section] ?? {})))].filter(name => !allowedDependencies.has(name))
}

describe('Desktop Host isolation', () => {
  it('has no product dependency in any manifest section', () => {
    const manifest = JSON.parse(readFileSync(new URL('package.json', root), 'utf8')) as Record<string, Record<string, string>>
    expect(unexpectedDependencies(manifest)).toEqual([])
  })

  it.each(['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'])('rejects product packages in %s', (section) => {
    expect(unexpectedDependencies({ [section]: { '@deepseek-ai/dsh': 'workspace:*', '@deepseek-ai/dsh-agent': 'workspace:*' } }))
      .toEqual(['@deepseek-ai/dsh', '@deepseek-ai/dsh-agent'])
  })

  it('compiles only the generic host dependencies', () => {
    const config = JSON.parse(readFileSync(new URL('tsconfig.json', root), 'utf8')) as { references: { path: string }[] }
    expect(config.references.map(reference => reference.path).sort()).toEqual([
      '../../vendor/cordis', '../../packages/boot/app-boot', '../../packages/client/connection/tsconfig.host.json',
      '../../packages/host/webserver', '../../packages/boot/plugin-manager',
    ].sort())
  })

  it('keeps product bridges outside the Host source entrypoints', () => {
    expect(readdirSync(new URL('src/', root)).sort()).toEqual([
      'fatal-diagnostic.ts', 'index.ts', 'launch-mode.ts', 'operation-diagnostics.ts',
    ])
    const entry = readFileSync(new URL('src/index.ts', root), 'utf8')
    expect(entry).toContain('runResolvedProfile')
    expect(entry).not.toContain("'@deepseek-ai/dsh/")
    expect(entry).toContain("'dsh-desktop-host', 'package.json'")
  })
})
