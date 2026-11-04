/** Real profile patches, Loader updates, and consumers of live Config references. */
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { onTestFinished } from 'vitest'
import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import Timer from '@deepseek-ai/cordis-plugin-timer'
import { boot, initProfile, readProfilePatches, type ProfileContext } from '@deepseek-ai/dsh-app-boot'
import ConfigEditor from '@deepseek-ai/dsh-config-editor'
import Hmr from '@deepseek-ai/dsh-hmr'
import Settings from '../src/index.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    configurationConsumer: ConfigurationConsumer
  }
}

/** Test-only consumer that reads Loader-owned volatile references on demand. */
class ConfigurationConsumer extends Service {
  static Config = z.object({
    category: z.string().required(),
    label: z.string().required().volatile(),
  })

  constructor(ctx: Context, private readonly config: ReturnType<typeof ConfigurationConsumer.Config>) {
    super(ctx, 'configurationConsumer')
  }

  currentValue() {
    return { category: this.config.category, label: this.config.label.get() }
  }
}

export async function configurationFixture(options: { schema?: z; apply?: (ctx: Context, config: unknown) => void; hmr?: boolean } = {}) {
  const home = realpathSync(mkdtempSync(join(tmpdir(), 'settings-config-')))
  const dir = join(home, 'profiles', 'test')
  onTestFinished(() => { rmSync(home, { recursive: true, force: true }) })
  initProfile(dir, ['test-bundle'])
  const bundle = join(dir, 'node_modules', 'test-bundle')
  mkdirSync(bundle, { recursive: true })
  writeFileSync(join(home, 'package.json'), '{"name":"test-installation"}\n')
  writeFileSync(join(bundle, 'package.json'), JSON.stringify({ name: 'test-bundle', version: '1.0.0', dsh: { bundle: { patch: 'cordis.patch.yml' } } }))
  writeFileSync(join(bundle, 'cordis.patch.yml'), JSON.stringify([{ insert: [
    { id: 'config-editor', name: 'cordis:editor' },
    { id: 'settings', name: 'cordis:settings' },
    { id: 'consumer', name: 'cordis:consumer', config: { category: 'test', label: 'original' } },
    { id: 'first', name: 'cordis:probe', config: { ordinary: 'fixed', token: 'private' } },
    { id: 'second', name: 'cordis:probe', config: { ordinary: 'second' } },
  ] }]))
  writeFileSync(join(dir, 'cordis.yml'), '[]\n')
  const profile: ProfileContext = {
    name: 'test', startedBundles: ['test-bundle'], dir, patchPath: join(dir, 'cordis.patch.yml'),
    installAnchor: join(home, 'package.json'), cwd: home, home, overlays: [], telemetryDisabledEnv: undefined,
  }
  const Probe = {
    Config: options.schema ?? z.object({ ordinary: z.string().required(), count: z.number().min(1).default(2).volatile(), token: z.string().role('secret').volatile(), list: z.array(z.object({ name: z.string().required(), token: z.string().role('secret') })).volatile() }),
    apply: options.apply ?? (() => {}),
  }
  const start = async (): Promise<Context> => {
    const ctx = await boot('test', join(dir, 'cordis.yml'), readProfilePatches('test', profile), (ctx) => {
      ctx.provide('profileContext', profile)
      ctx.provide('appReady', { onReady: (listener: () => void) => { listener(); return () => {} } })
      Object.assign(ctx.loader.builtins, {
        editor: ConfigEditor, settings: Settings, consumer: ConfigurationConsumer, probe: Probe,
      })
    })
    onTestFinished(async () => { await ctx.fiber.dispose() })
    if (options.hmr !== false) {
      await ctx.plugin(Timer)
      const hmr = ctx.plugin(Hmr, { root: [], ignored: [], debounce: 0 })
      await hmr.await()
      await ctx.hmr.runExclusive(async () => {})
    }
    return ctx
  }
  return { ctx: await start(), profile, home, start }
}
