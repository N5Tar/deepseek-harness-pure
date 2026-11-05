/** Shipped profile templates, and the offline catalog that does not depend on installed provider packages or registry requests. */

import { describe, expect, it } from 'vitest'
import { OFFICIAL_ON_DEMAND_CATALOG, ON_DEMAND_BUNDLES, PROFILE_TEMPLATES } from '../src/index.ts'

describe('Official on-demand catalog', () => {
  it('offers no on-demand bundles after the product integrations retired', () => {
    expect(ON_DEMAND_BUNDLES).toEqual([])
    expect(OFFICIAL_ON_DEMAND_CATALOG).toEqual([])
  })
})

describe('Shipped profile templates', () => {
  it('ships only the Cordis shell template after the product bundles retired', () => {
    expect(PROFILE_TEMPLATES).toEqual({
      shell: { bundles: ['@deepseek-ai/dsh-shell-base'] },
    })
  })
})
