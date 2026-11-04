/** Private Desktop Host mode parsing fails closed on malformed environment values. */
import { describe, expect, it } from 'vitest'
import { parseDesktopHostMode } from '../src/launch-mode.ts'

describe('Desktop Host launch mode', () => {
  it('keeps product behavior for launchers without the new private value', () => {
    expect(parseDesktopHostMode(undefined)).toBe('product')
    expect(parseDesktopHostMode('product')).toBe('product')
  })

  it('selects shell behavior only from the exact shell value', () => {
    expect(parseDesktopHostMode('shell')).toBe('shell')
  })

  it.each(['', 'Shell', ' shell', 'shell ', 'minimal', 'false', '0'])('rejects malformed mode %j', (value) => {
    expect(() => parseDesktopHostMode(value)).toThrow('DSH_DESKTOP_MODE must be product or shell')
  })
})
