import { expect, it } from 'vitest'
import { computeOutputs, walkPartitionProblems } from './gen-cordis-catalog.ts'

it('projects only the runtime catalog without requiring documentation pages', () => {
  const outputs = computeOutputs()
  expect(outputs.map(([path]) => path)).toEqual(['packages/extensions/tool-cordis/src/api-catalog.ts'])
  expect(outputs[0]![1]).not.toMatch(/key: '(?:remoteAccess|liveshareShares)'/)
}, 120_000)

it('rejects a stale service mapping independently of documentation rendering', () => {
  expect(walkPartitionProblems({
    renderedKeys: new Map(), renderedScopes: new Set(), renderedEventNames: new Set(),
    declaredKeys: new Map(), declaredEvents: new Map(),
  }, {
    servicePage: { retired: 'retired.md' }, serviceWalkExemptions: {},
    eventScopePage: {}, eventWalkExemptions: {},
  })).toEqual(["SERVICE_PAGE maps 'ctx.retired' but the projection discovers no such service; remove the stale entry."])
})
