import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { projectCordisCatalog } from '../src/cordis-catalog.ts'
import { CORDIS_CATALOG_POLICY } from '../../../../scripts/gen-cordis-catalog.ts'

const workspaceRoot = resolve(import.meta.dirname, '../../../..')

/** One workspace projection shared by both cases: analyzing it twice doubles a multi-minute run. */
let cached: ReturnType<typeof projectCordisCatalog> | undefined
const projection = (): ReturnType<typeof projectCordisCatalog> =>
  (cached ??= projectCordisCatalog(workspaceRoot, CORDIS_CATALOG_POLICY))
let cachedClient: ReturnType<typeof projectCordisCatalog> | undefined
const clientProjection = (): ReturnType<typeof projectCordisCatalog> =>
  (cachedClient ??= projectCordisCatalog(workspaceRoot, {
    ...CORDIS_CATALOG_POLICY,
    runtimeDeclarationMaxChars: 4_096,
  }, 'client'))

describe('Typert-backed Cordis catalog', () => {
  it('reproduces the committed runtime catalog byte for byte', { timeout: 480_000 }, () => {
    const { projector, model } = projection()
    const expected = (path: string): string => readFileSync(join(workspaceRoot, path), 'utf8')

    expect(projector.renderRuntimeApi(model)).toBe(
      expected('packages/extensions/tool-cordis/src/api-catalog.ts'),
    )
  })

  it('includes referenced framework enums in the runtime declaration closure', () => {
    const { projector, model } = projection()
    const rendered = projector.renderRuntimeApi(model)
    expect(rendered).toContain("name: 'FiberState'")
    expect(rendered).toContain('enum FiberState')
    expect(rendered).toContain('ACTIVE,')
  })

  it('keeps the Slots service declaration and its referenced types within the display budget', { timeout: 480_000 }, () => {
    const { projector, model } = clientProjection()
    const slots = model.services.find(service => service.key === 'slots')
    if (slots === undefined) throw new Error('Client slots service is missing')
    const rendered = projector.renderRuntimeApi({
      services: [{
        ...slots,
        methods: slots.methods.filter(method => /\b(?:inject|register|registerFactory)\b/u.test(method.signature)),
      }],
      events: [],
    })
    const slotCoreStart = rendered.indexOf("name: 'SlotCore'")
    const slotCoreEnd = rendered.indexOf('\n  },', slotCoreStart)
    expect(rendered.slice(slotCoreStart, slotCoreEnd)).not.toContain('truncated')
    expect(rendered).toContain("name: 'StoredEntry'")
    expect(rendered).toContain("name: 'SlotLabel'")
  })

  it('resolves each key to the declaration a caller meets, and drops keys no plugin provides', { timeout: 480_000 }, () => {
    const byKey = new Map(projection().model.services.map(service => [service.key, service]))
    // An interface-typed key is described by its Service Definition: that is where
    // the contract and, by repository convention, the member JSDoc live.
    expect(byKey.get('lsp')?.type).toBe('LspService')
    // Two packages describe `ctx.typert` — a merge-extensible interface in
    // type-meta and the implementing class in registry. The class wins: it is the
    // object a caller meets and it carries the documentation.
    expect(byKey.get('typert')?.type).toBe('TypertRegistry')
    // Optional keys are values a launcher installs before the tree mounts. No
    // plugin provides them, so describing one as a service would answer "add the
    // plugin that provides it" for a key where no such plugin exists.
    expect(byKey.has('headlessIo')).toBe(false)
    expect(byKey.has('dshHomePath')).toBe(false)
    expect(byKey.has('launcherEnvironment')).toBe(false)
  })
})
