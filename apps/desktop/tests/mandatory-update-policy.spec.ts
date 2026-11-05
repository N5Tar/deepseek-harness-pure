import { describe, expect, it } from 'vitest'
import { resolveDesktopPolicyConfig } from '../src/mandatory-update-policy.ts'

const deployment = { origin: 'https://policy.example.com', allowedPageOrigins: ['https://downloads.example.com'],
  intervalMs: 10_000, timeoutMs: 1_000, maxBackoffMs: 80_000, jitter: 0 }

describe('policy deployment validation', () => {
  it('requires validated login origins only for test authentication', () => {
    expect(() => resolveDesktopPolicyConfig({ ...deployment, authentication: 'feishu-test' })).toThrow('allowedAuthOrigins')
    expect(() => resolveDesktopPolicyConfig({ ...deployment, allowedAuthOrigins: ['https://login.example.com'] })).toThrow('anonymous')
    expect(() => resolveDesktopPolicyConfig({ ...deployment, authentication: 'feishu-test',
      allowedAuthOrigins: ['https://login.example.com/path'] })).toThrow('HTTPS origin')
    expect(resolveDesktopPolicyConfig({ ...deployment, authentication: 'feishu-test',
      allowedAuthOrigins: ['https://login.example.com'] })?.allowedAuthOrigins).toEqual(['https://login.example.com'])
  })

  it('requires explicit production origins and confines HTTP to an explicit local policy fixture', () => {
    expect(resolveDesktopPolicyConfig(undefined)).toBeUndefined()
    expect(() => resolveDesktopPolicyConfig({ ...deployment, origin: 'http://127.0.0.1:19001' })).toThrow('HTTPS')
    expect(resolveDesktopPolicyConfig({ ...deployment, origin: 'http://127.0.0.1:19001' }, true)!.origin).toBe('http://127.0.0.1:19001')
    expect(() => resolveDesktopPolicyConfig({ ...deployment, origin: 'http://example.com' }, true)).toThrow('HTTPS')
  })

  it.each([{ intervalMs: 0 }, { timeoutMs: 1.5 }, { maxBackoffMs: 1000 }, { jitter: 2 }, { allowedPageOrigins: [] },
    { origin: 'https://example.com/path' }, { authentication: 'feishu' },
    { authentication: 'feishu-test', origin: 'http://127.0.0.1:9000' }])('rejects invalid deployment input: %j', (change) => {
    expect(() => resolveDesktopPolicyConfig({ ...deployment, ...change })).toThrow()
  })
})
