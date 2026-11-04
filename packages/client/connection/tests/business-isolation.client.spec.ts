/** Connection keeps domain types and packages outside its transport API. */
import { readFileSync } from 'node:fs'
import { describe, expect, expectTypeOf, it } from 'vitest'
import type * as Connection from '../src/client/index.ts'

const dependencySections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const

type Manifest = Partial<Record<typeof dependencySections[number], Record<string, string>>>

const businessPackages = [
  '@deepseek-ai/dsh-session',
  '@deepseek-ai/dsh-llm',
  '@deepseek-ai/dsh-attachment',
]

const businessProjects = [
  '../../core/session',
  '../../llm/llm',
  '../../attachment/attachment',
]

describe('Connection business isolation', () => {
  it('has no direct Session, model, or attachment dependency', () => {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as Manifest
    for (const section of dependencySections) {
      for (const name of businessPackages) {
        expect(manifest[section] ?? {}, section).not.toHaveProperty(name)
      }
    }
  })

  it.each(['host', 'client'])('keeps business projects outside the %s compiler references', (face) => {
    const config = JSON.parse(readFileSync(new URL(`../tsconfig.${face}.json`, import.meta.url), 'utf8')) as {
      references: { path: string }[]
    }
    for (const path of businessProjects) {
      expect(config.references.map(reference => reference.path)).not.toContain(path)
    }
  })

  it('exposes transport types without forwarding business types', () => {
    expectTypeOf<Connection.ConnectionHandle>().toBeObject()
    // @ts-expect-error Session identities belong to the Session package.
    expectTypeOf<Connection.SessionId>()
    // @ts-expect-error Session events belong to the Session package.
    expectTypeOf<Connection.SessionEvent>()
    // @ts-expect-error Message identities belong to the model package.
    expectTypeOf<Connection.MessageId>()
    // @ts-expect-error Model content belongs to the model package.
    expectTypeOf<Connection.ContentBlock>()
    // @ts-expect-error Model stream chunks belong to the model package.
    expectTypeOf<Connection.StreamChunk>()
  })
})
