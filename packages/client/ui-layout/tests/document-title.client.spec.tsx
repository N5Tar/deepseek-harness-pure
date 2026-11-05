// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { DocumentTitle } from '../src/client/DocumentTitle.tsx'

let originalTitle: string
beforeEach(() => { originalTitle = document.title })
afterEach(() => {
  try { cleanup() } finally { document.title = originalTitle }
})

describe('DocumentTitle', () => {
  it('projects the frame product title and restores it on unmount', () => {
    document.title = 'stale title'
    const mounted = render(<DocumentTitle productTitle="DeepSeek Harness" />)
    expect(document.title).toBe('DeepSeek Harness')
    mounted.rerender(<DocumentTitle productTitle="Harness 底座" />)
    expect(document.title).toBe('Harness 底座')
    mounted.unmount()
    expect(document.title).toBe('Harness 底座')
  })
})
