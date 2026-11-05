import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { expect, it } from 'vitest'

it.each(['../lib/index.js', '../lib/types/remote-info.js'])(
  'keeps the published protocol entry %s free of Zod runtime imports',
  async (entry) => {
    const source = await readFile(new URL(entry, import.meta.url), 'utf8')
    expect(source).not.toMatch(/\b(?:from|import|require)\s*(?:\(\s*)?['"]zod(?:\/[^'"]*)?['"]/)
  },
)

it('recognizes source and built Cordis Contexts in an active built TypertRemoteService', () => {
  const script = `
    import { Context as SourceContext } from '@deepseek-ai/cordis/src/index.ts'
    import { Context as BuiltContext } from '@deepseek-ai/cordis'
    import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'

    const observations = []
    for (const [copy, Context] of [['source', SourceContext], ['built', BuiltContext]]) {
      const root = new Context()
      let observed
      try {
        await root.plugin({ apply(ctx) {
          new TypertRemoteService(ctx, 'fixture')
          const guestInvocation = {
            request: { namespace: 'session', method: 'search', args: {} },
            peer: { principal: { kind: 'guest' } },
          }
          const guest = ctx.extend({ invocation: guestInvocation })
          observed = {
            copy,
            sameConstructor: ctx instanceof BuiltContext,
            recognized: BuiltContext.is(ctx),
            active: !!ctx.fiber.runtime,
            accessor: Object.hasOwn(root.reflect.props, 'invocation'),
            outside: ctx.invocation ?? null,
            preservedGuest: guest.invocation === guestInvocation,
          }
        } })
        observations.push(observed)
      } finally {
        await root.fiber.dispose()
      }
    }
    console.log(JSON.stringify(observations))
  `
  const output = execFileSync(process.execPath, ['--import', 'tsx/esm', '--input-type=module', '-e', script], {
    cwd: new URL('../', import.meta.url),
    encoding: 'utf8',
    timeout: 15_000,
  })
  expect(JSON.parse(output)).toEqual([
    { copy: 'source', sameConstructor: false, recognized: true, active: true, accessor: true,
      outside: null, preservedGuest: true },
    { copy: 'built', sameConstructor: true, recognized: true, active: true, accessor: true,
      outside: null, preservedGuest: true },
  ])
})
