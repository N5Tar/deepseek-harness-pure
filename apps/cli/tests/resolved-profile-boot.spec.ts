/** The CLI selects profile layers and delegates process lifetime to app-boot. */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { runResolvedProfile, type Profile } from '@deepseek-ai/dsh-app-boot'
import { createLaunchEnvironmentSnapshot } from '@deepseek-ai/dsh-launch-environment'
import { afterEach, expect, it, vi } from 'vitest'
import { runProfile } from '../src/profile-boot.ts'

vi.mock('@deepseek-ai/dsh-app-boot', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@deepseek-ai/dsh-app-boot')>()
  return { ...actual, runResolvedProfile: vi.fn() }
})

afterEach(() => { vi.resetAllMocks() })

it('delegates the explicit installation anchor, parsed overlays, and invocation inputs', async () => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-cli-profile-delegation-'))
  const ctx = new Context()
  try {
    const overlay = join(home, 'overlay.yml')
    writeFileSync(overlay, '- id: target\n  config: { selected: true }\n')
    const profile: Profile = { name: 'desktop', dir: home, patchPath: join(home, 'cordis.patch.yml'), patches: [], layers: [], skippedBundles: [] }
    const installAnchor = join(home, 'desktop-host/package.json')
    const environment = createLaunchEnvironmentSnapshot([])
    const shutdown = { shutdown: vi.fn(async () => {}), interrupt: vi.fn() }
    const application = { ctx, shutdown }
    vi.mocked(runResolvedProfile).mockResolvedValue(application)
    const result = await runProfile({ environment, profile: 'desktop', resolvedProfile: { profile, installAnchor }, args: [], patchFiles: [overlay] })
    expect(result).toBe(application)
    expect(runResolvedProfile).toHaveBeenCalledWith({
      name: 'desktop', profile, installAnchor, environment, args: [],
      overlays: [{ id: 'target', config: { selected: true } }],
    })
  } finally {
    await ctx.fiber.dispose()
    rmSync(home, { recursive: true, force: true })
  }
})
