/** Local gate inventories keep Wine in its explicitly selected mode. */
import { expect, it } from 'vitest'
import { gatesForMode } from '../run-gates.ts'

it('keeps Wine outside the primary Linux and native Windows gates', () => {
  // Graph construction needs a pnpm entrypoint but never launches it.
  const previous = process.env.npm_execpath
  process.env.npm_execpath = '/test/pnpm.cjs'
  try {
    for (const mode of ['ci-linux-primary', 'ci-windows-complete'] as const) {
      expect(gatesForMode(mode).map(gate => gate.displayCommand).join('\n')).not.toMatch(/wine/i)
    }
  } finally {
    if (previous === undefined) Reflect.deleteProperty(process.env, 'npm_execpath')
    else process.env.npm_execpath = previous
  }
  expect(process.env.npm_execpath).toBe(previous)
})
