/** Desktop mode selection rejects invalid authored values before startup. */
import { describe, expect, it } from 'vitest'
import { resolveDesktopLaunchMode } from '../src/launch-mode.ts'

describe('desktop launch mode', () => {
  it('retains product behavior when no mode is authored', () => {
    expect(resolveDesktopLaunchMode(undefined)).toBe('product')
  })

  it.each(['product', 'shell'])('accepts explicit %s mode', (mode) => {
    expect(resolveDesktopLaunchMode(mode)).toBe(mode)
  })

  it.each(['', 'Shell', 'web', null, 0, {}, []])('rejects an invalid authored mode: %j', (mode) => {
    expect(() => resolveDesktopLaunchMode(mode)).toThrow('mode must be product or shell')
  })
})
