/**
 * Base UI specs and the base bench keep the Session, Workspace, and subagent
 * test stacks out of their dependency closure: the bench exists so base specs
 * do not inherit the business doubles with `dsh-client-test-runtime`.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dependencySections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const

type Manifest = Partial<Record<typeof dependencySections[number], Record<string, string>>> & {
  dsh?: { client?: { inject?: string[] } }
}

/** Packages that would pull Session, Workspace, or subagent business state into a base spec. */
const BUSINESS_TEST_STACKS = [
  '@deepseek-ai/dsh-client-test-runtime',
  '@deepseek-ai/dsh-agent',
  '@deepseek-ai/dsh-api-session-controller',
  '@deepseek-ai/dsh-api-workspace-controller',
  '@deepseek-ai/dsh-client-ui-conversation',
  '@deepseek-ai/dsh-client-ui-session',
  '@deepseek-ai/dsh-client-ui-workspace',
  '@deepseek-ai/dsh-session',
  '@deepseek-ai/dsh-subagent',
]

/** Base UI packages and the bench itself. */
const BASE_PACKAGES = [
  'packages/test-support/ui-test-bench',
  'packages/client/ui-shell',
  'packages/client/ui-theme',
  'packages/client/locale',
  'packages/client/ui-settings',
]

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(new URL(`../../../../${relativePath}`, import.meta.url), 'utf8'))
}

describe('base UI test isolation', () => {
  it.each(BASE_PACKAGES)('%s declares no business test stack', (path) => {
    const manifest = readJson(`${path}/package.json`) as Manifest
    for (const section of dependencySections) {
      for (const name of BUSINESS_TEST_STACKS) {
        expect(manifest[section] ?? {}, `${path}: ${section}`).not.toHaveProperty(name)
      }
    }
    for (const name of BUSINESS_TEST_STACKS) {
      expect(manifest.dsh?.client?.inject ?? [], `${path}: client inject`).not.toContain(name)
    }
  })

  it('keeps business projects out of the bench compiler references', () => {
    const config = readJson('packages/test-support/ui-test-bench/tsconfig.json') as { references: { path: string }[] }
    const paths = config.references.map(reference => reference.path)
    for (const business of ['session', 'workspace', 'subagent', 'ui-session', 'ui-workspace', 'client-runtime']) {
      expect(paths.filter(path => path.includes(business)), business).toEqual([])
    }
  })
})
