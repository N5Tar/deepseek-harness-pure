/** Development bundles preserve literal launch paths without claiming installed application URLs. */
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, onTestFinished, vi } from 'vitest'
import { developmentLauncher, prepareDevelopmentApp } from '../scripts/development-app.ts'

vi.mock('node:child_process', { spy: true })

it.each(['product', 'shell'] as const)('rebuilds %s development bundles with an isolated identity and no URL handlers', (mode) => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-development-protocol-'))
  onTestFinished(() => { rmSync(root, { recursive: true, force: true }) })
  const source = join(root, 'Electron.app')
  mkdirSync(join(source, 'Contents', 'MacOS'), { recursive: true })
  mkdirSync(join(source, 'Contents', 'Resources'))
  const plist = '<plist>inherited URL handlers</plist>'
  writeFileSync(join(source, 'Contents', 'Info.plist'), plist)
  const options = { electron: join(source, 'Contents', 'MacOS', 'Electron'), appRoot: root, directory: root,
    home: join(root, 'home'), userData: join(root, 'browser'), mainPort: 9229, rendererPort: 9222, hostPort: 9230, openDevtools: '0',
    ...(mode === 'shell' ? { launchMode: mode } : {}) }
  const name = mode === 'shell' ? 'Harness Shell Dev' : 'Harness Dev'
  const bundle = join(root, `${name}.app`)
  cpSync(source, bundle, { recursive: true })
  const stamp = join(bundle, 'Contents', 'Resources', 'dsh-development.json')
  writeFileSync(stamp, JSON.stringify({ ...options, launcher: developmentLauncher(options, bundle), plist }))
  const execute = vi.mocked(execFileSync).mockImplementation((command) => {
    if (command === '/usr/bin/ditto') cpSync(source, bundle, { recursive: true })
    return Buffer.from('')
  })
  onTestFinished(() => { execute.mockRestore() })
  prepareDevelopmentApp(options)
  expect(execute).toHaveBeenCalledWith('/usr/bin/ditto', [source, bundle])
  expect(execute).toHaveBeenCalledWith('/usr/bin/plutil', ['-replace', 'CFBundleURLTypes', '-json', '[]', join(bundle, 'Contents', 'Info.plist')])
  expect(execute.mock.calls.some(([command]) => command.includes('lsregister'))).toBe(false)
  const recorded = JSON.parse(readFileSync(stamp, 'utf8')) as { values: { CFBundleIdentifier: string } }
  expect(recorded).toMatchObject({ values: { CFBundleURLTypes: [], CFBundleName: name } })
  expect(recorded.values.CFBundleIdentifier).toContain(mode === 'shell' ? 'harness.shell.dev.' : 'harness.dev.')
  execute.mockClear()
  prepareDevelopmentApp(options)
  expect(execute).not.toHaveBeenCalled()
})

it.skipIf(process.platform === 'win32').each(['product', 'shell'] as const)('preserves literal paths and %s mode through cold starts', (launchMode) => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-development-app-'))
  onTestFinished(() => { rmSync(root, { recursive: true, force: true }) })
  const bundle = join(root, "Harness ' $(false).app")
  const binary = join(bundle, 'Contents', 'MacOS', 'Electron')
  mkdirSync(join(bundle, 'Contents', 'MacOS'), { recursive: true })
  writeFileSync(binary, '#!/bin/sh\nprintf "%s\\n" "$DSH_HOME" "$DSH_DESKTOP_MODE" "$DSH_DESKTOP_DSH_DIR" "$DSH_DESKTOP_DEV_APP" "$DSH_DESKTOP_OPEN_DEVTOOLS" "$@"\n', { mode: 0o755 })
  const launcher = join(root, 'launcher')
  const home = join(root, "home ' $(false)")
  writeFileSync(launcher, developmentLauncher({ electron: binary, appRoot: root, directory: root,
    home, userData: join(root, 'browser data'), launchMode, dshDir: join(root, "runtime ' $(false)"),
    mainPort: 9229, rendererPort: 9222, hostPort: 9230, openDevtools: '0' }, bundle))
  const result = execFileSync('/bin/sh', [launcher, '--test-launch-argument'], { encoding: 'utf8' })
  expect(result.trimEnd().split('\n')).toEqual([home, launchMode, join(root, "runtime ' $(false)"), '1', '0', '--inspect=127.0.0.1:9229',
    '--remote-debugging-port=9222', `--user-data-dir=${join(root, 'browser data')}`, root, '--test-launch-argument'])
})
