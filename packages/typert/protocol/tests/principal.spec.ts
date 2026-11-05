import { describe, expect, it } from 'vitest'
import { principalOf, type PeerScope, type Principal, type RemoteInvocation } from '@deepseek-ai/dsh-typert-protocol'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface PrincipalMap {
    /** Test-only non-owner caller. */
    'test-guest': { readonly kind: 'test-guest'; readonly guest: string }
  }
}

const GUEST: Principal = { kind: 'test-guest', guest: 'g1' }
const OWNER: Principal = { kind: 'owner' }

function invocationAs(principal: Principal): RemoteInvocation {
  const peer = { principal } as PeerScope
  return { peer } as RemoteInvocation
}

describe('principalOf', () => {
  it('reports a non-owner caller and nothing for the owner or code outside a call', () => {
    expect(principalOf(undefined)).toBeUndefined()
    expect(principalOf(invocationAs(OWNER))).toBeUndefined()
    expect(principalOf(invocationAs(GUEST))).toBe(GUEST)
    const lookalike = JSON.parse('{"kind":"Owner"}') as Principal
    expect(principalOf(invocationAs(lookalike))).toBe(lookalike)
  })
})
