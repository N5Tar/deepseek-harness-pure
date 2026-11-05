/** Native carrier assembly with owned windows, authenticated transport, and quiescent teardown. */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BrowserWindowConstructorOptions, MenuItemConstructorOptions, MessageBoxOptions } from 'electron'
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { DESKTOP_IPC } from '../src/ipc.ts'
import { en } from '../src/locale.ts'
import { writeCrashReport } from '../src/crash-report.ts'
import { runOperationReportJob } from '../src/operation-report-job.ts'

const h = await vi.hoisted(async () => {
  const { EventEmitter } = await import('node:events')
  const deferred = () => {
    const { promise, resolve } = Promise.withResolvers<undefined>()
    return { promise, resolve: () => { resolve(undefined) } }
  }
  const handlers = new Map<string, (event: { sender: unknown; senderFrame: { url: string } | null }, ...args: unknown[]) => unknown>()
  const windows: FakeWindow[] = []
  const hosts: FakeHost[] = []
  let preparing = deferred()
  let prepared = deferred()
  let started = deferred()
  let quitDone = deferred()
  let dialogShown = deferred()
  class FakeWindow extends EventEmitter {
    visible = false
    destroyed = false
    fullscreen = false
    minimized = false
    readonly shown = deferred()
    readonly urls: string[] = []
    readonly webContents = Object.assign(new EventEmitter(), {
      id: 42, mainFrame: { url: '' },
      getURL: () => this.urls.at(-1) ?? '',
      setWindowOpenHandler: vi.fn(), send: vi.fn(), getZoomFactor: () => 1,
      openDevTools: vi.fn(), isDestroyed: () => this.destroyed,
    })
    readonly show = vi.fn(() => { this.visible = true; this.emit('show'); this.shown.resolve() })
    readonly hide = vi.fn(() => { this.visible = false; this.emit('hide') })
    readonly focus = vi.fn()
    readonly restore = vi.fn(() => { this.minimized = false; this.emit('restore') })
    readonly setVibrancy = vi.fn()
    readonly setBackgroundColor = vi.fn()
    readonly setTitleBarOverlay = vi.fn()
    readonly setFullScreen = vi.fn((next: boolean) => { this.fullscreen = next })
    readonly loadURL = vi.fn(async (url: string) => {
      this.urls.push(url)
      this.webContents.mainFrame.url = url
    })
    constructor(readonly options: BrowserWindowConstructorOptions) { super(); windows.push(this) }
    isDestroyed() { return this.destroyed }
    isVisible() { return this.visible }
    isFullScreen() { return this.fullscreen }
    isMinimized() { return this.minimized }
    isEnabled() { return true }
    destroy() { this.destroyed = true; this.emit('closed') }
    static getAllWindows() { return windows.filter(window => !window.destroyed) }
  }
  class FakeHost {
    readonly ready = deferred()
    readonly exited = deferred()
    readonly stopping = deferred()
    url = 'http://127.0.0.1:3080/?token=test'
    injections: readonly unknown[] | undefined = [{ type: 'test' }]
    readonly start = vi.fn(async () => {
      started.resolve()
      await this.ready.promise
      return { url: this.url, injections: this.injections }
    })
    readonly stop = vi.fn(() => { this.stopping.resolve(); return this.exited.promise })
    constructor(readonly node: string, readonly runtime: string, readonly profile: string,
      readonly inspectPort: number | undefined, readonly environment: NodeJS.ProcessEnv,
      readonly onFailure: (error: Error) => void,
      readonly packageManager: { pnpm: string; nodeBin: string }, readonly operation: (record: object) => void,
    ) { hosts.push(this) }
  }
  const app = Object.assign(new EventEmitter(), {
    isPackaged: false, name: 'Desktop base test',
    getVersion: () => '1.2.3', getAppPath: () => 'desktop-test-app', getLocale: () => 'en-US',
    getPreferredSystemLanguages: () => ['en-US'], isInApplicationsFolder: () => true,
    getPath: vi.fn((_name: string) => ''), setAppLogsPath: vi.fn(), setAboutPanelOptions: vi.fn(),
    whenReady: () => Promise.resolve(), requestSingleInstanceLock: vi.fn(() => true),
    relaunch: vi.fn(), exit: vi.fn(), setAsDefaultProtocolClient: vi.fn(),
    quit: vi.fn(() => {
      let prevented = false
      app.emit('before-quit', { preventDefault: () => { prevented = true } })
      if (!prevented) { app.emit('will-quit'); quitDone.resolve() }
    }),
  })
  const popup = vi.fn((options: { callback?: () => void }) => { options.callback?.() })
  const menu = { buildFromTemplate: vi.fn((_items: MenuItemConstructorOptions[]) => ({ popup })), setApplicationMenu: vi.fn() }
  const protocol = { registerSchemesAsPrivileged: vi.fn(), handle: vi.fn() }
  const nativeTheme = { shouldUseDarkColors: false, themeSource: 'system' }
  const session = { defaultSession: {
    cookies: {}, webRequest: { onBeforeSendHeaders: vi.fn() },
    setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn(),
  } }
  const shortcuts = { attach: vi.fn(), dispose: vi.fn(), sendEditingKey: vi.fn(), fileMenu: vi.fn(() => ({ label: 'File', submenu: [] })) }
  const background = { close: vi.fn((hide: () => void) => { hide() }), dispose: vi.fn() }
  const powerMonitor = new EventEmitter()
  const dialog = { showMessageBox: vi.fn(async (..._args: [MessageBoxOptions] | [FakeWindow, MessageBoxOptions]) =>
    ({ response: 0, checkboxChecked: false })) }
  const readLoginShell = async (base: NodeJS.ProcessEnv, _config: unknown, _options: { signal: AbortSignal }) =>
    ({ environment: { ...base, TEST_LOGIN_SHELL: 'yes' }, failures: [] })
  const loginShell = vi.fn(readLoginShell)
  return {
    home: '',
    app, menu, popup, protocol, nativeTheme, session, shortcuts, background, handlers, windows, hosts, FakeWindow, FakeHost,
    powerMonitor, ipcOn: vi.fn(),
    shell: { openExternal: vi.fn(async () => {}), showItemInFolder: vi.fn() },
    dialog,
    projectManager: vi.fn(), applyRelease: vi.fn(() => { preparing.resolve(); return prepared.promise }),
    disablePlugins: vi.fn(async () => 'profile/cordis.patch.yml.bak'),
    loginShell,
    authenticate: vi.fn(async (_url: string) => 'cookie=test'), removeCookies: vi.fn(async () => {}),
    serve: vi.fn(async () => new Response('frontend')), forward: vi.fn(async () => new Response('api')),
    commandOptions: vi.fn(), commandShow: vi.fn(async () => {}), trayDispose: vi.fn(),
    get preparing() { return preparing }, get prepared() { return prepared }, get started() { return started },
    get quitDone() { return quitDone }, get dialogShown() { return dialogShown },
    reset() {
      windows.length = 0; hosts.length = 0; handlers.clear()
      app.removeAllListeners(); powerMonitor.removeAllListeners()
      app.isPackaged = false; nativeTheme.shouldUseDarkColors = false; nativeTheme.themeSource = 'system'
      preparing = deferred(); prepared = deferred(); started = deferred(); quitDone = deferred(); dialogShown = deferred()
      app.requestSingleInstanceLock.mockReturnValue(true)
      dialog.showMessageBox.mockReset().mockImplementation(async () => {
        dialogShown.resolve(); return { response: 0, checkboxChecked: false }
      })
      loginShell.mockReset().mockImplementation(readLoginShell)
    },
  }
})
vi.mock('electron', () => ({
  app: h.app, BrowserWindow: h.FakeWindow, Menu: h.menu, protocol: h.protocol, session: h.session,
  nativeTheme: h.nativeTheme, shell: h.shell, dialog: h.dialog, powerMonitor: h.powerMonitor,
  ipcMain: {
    handle: (name: string, handler: (
      event: { sender: unknown; senderFrame: { url: string } | null }, ...args: unknown[]
    ) => unknown) => { h.handlers.set(name, handler) },
    on: h.ipcOn,
  },
}))
vi.mock('../src/host-process.ts', () => ({ DesktopHostProcess: h.FakeHost, DesktopHostFatalError: class extends Error {} }))
vi.mock('../src/project-manager.ts', () => ({ DesktopProjectManager: class {
  constructor(...args: unknown[]) { h.projectManager(...args) }
  readonly applyRelease = h.applyRelease
  readonly disableAllPlugins = h.disablePlugins
} }))
vi.mock('../src/paths.ts', () => ({ resolveDesktopPaths: () => ({ home: h.home, profile: 'test-profile' }) }))
vi.mock('../src/login-shell-environment.ts', async original => ({
  ...await original<typeof import('../src/login-shell-environment.ts')>(), readDesktopLoginShellEnvironment: h.loginShell,
}))
vi.mock('../src/web-document.ts', () => ({
  authenticateWebHost: h.authenticate, removeLegacyHostCookies: h.removeCookies, serveWebDocument: h.serve, forwardWebRequest: h.forward,
}))
vi.mock('../src/keyboard.ts', () => ({ installDesktopShortcuts: () => h.shortcuts }))
vi.mock('../src/directory-picker.ts', () => ({ installDesktopDirectoryPicker: vi.fn() }))
vi.mock('../src/command-management.ts', () => ({ DesktopCommandManager: class {
  constructor(options: unknown) { h.commandOptions(options) }
  readonly show = h.commandShow
} }))
vi.mock('../src/tray.ts', () => ({ DesktopTray: class { relabel() {} dispose() { h.trayDispose() } } }))
vi.mock('../src/background-notice.ts', () => ({ DesktopBackgroundNotice: class {
  readonly close = h.background.close
  readonly dispose = h.background.dispose
} }))
vi.mock('../src/operation-report-job.ts', () => ({ runOperationReportJob: vi.fn(async () => ({ appended: false, timedOut: false, cancelled: false })) }))
vi.mock('../src/crash-report.ts', async original => ({
  ...await original<typeof import('../src/crash-report.ts')>(),
  pruneCrashReports: vi.fn(async () => {}), writeCrashReport: vi.fn(async () => undefined),
}))

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); vi.useFakeTimers(); h.reset()
  const root = mkdtempSync(join(tmpdir(), 'desktop-main-base-'))
  onTestFinished(() => { rmSync(root, { recursive: true, force: true }) })
  h.app.getPath.mockImplementation(name => join(root, name))
  h.home = join(root, 'home')
  vi.stubGlobal('process', { ...process, platform: 'win32', arch: 'x64', resourcesPath: 'test-resources' })
  vi.stubEnv('DSH_DESKTOP_DSH_DIR', 'test-runtime')
  vi.stubEnv('DSH_DESKTOP_PNPM_ENTRY', 'test-pnpm')
  vi.stubEnv('DSH_DESKTOP_HOST_INSPECT_PORT', undefined)
  vi.stubEnv('DSH_CLIENT_VERSION', '1.2.3')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(async () => {
  h.prepared.resolve()
  for (const host of h.hosts) { host.ready.resolve(); host.exited.resolve() }
  h.app.quit()
  await vi.advanceTimersByTimeAsync(0)
  await h.quitDone.promise
  vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals()
})

function invoke(name: string, ...args: unknown[]): unknown {
  const window = h.windows[0]
  const handler = h.handlers.get(name)
  if (window === undefined || handler === undefined) throw new Error(`missing handler ${name}`)
  return handler({ sender: window.webContents, senderFrame: window.webContents.mainFrame }, ...args)
}
async function ready() {
  await import('../src/main.ts')
  await h.preparing.promise
  expect(h.hosts).toHaveLength(0)
  h.prepared.resolve()
  await h.started.promise
  const host = h.hosts[0]
  if (host === undefined) throw new Error('Host was not created')
  host.ready.resolve()
  const window = h.windows[0]
  if (window === undefined) throw new Error('window was not created')
  await window.shown.promise
  return { host, window }
}
function eventListener(name: string): (event: object, ...args: unknown[]) => void {
  const row = h.ipcOn.mock.calls.find(([channel]) => channel === name)
  if (row === undefined) throw new Error(`missing event handler ${name}`)
  return row[1] as (event: object, ...args: unknown[]) => void
}

describe('desktop application carrier', () => {
  it.each([false, true])('starts one authenticated Host without product protocols (packaged=%s)', async (packaged) => {
    h.app.isPackaged = packaged
    vi.stubEnv('DSH_DESKTOP_MODE', 'invalid-retired-mode')
    vi.stubEnv('DSH_DESKTOP_PRIMARY_RUNTIME_DIR', undefined)
    const { host, window } = await ready()
    expect(host.environment).toMatchObject({ TEST_LOGIN_SHELL: 'yes', DSH_CLIENT_VERSION: '1.2.3' })
    expect(host.runtime).toBe(packaged ? join('desktop-test-app', 'dsh') : 'test-runtime')
    expect(host.packageManager.pnpm).toBe(packaged
      ? join('test-resources', 'runtime', 'primary-runtime', 'dependencies', 'pnpm', 'bin', 'pnpm.mjs') : 'test-pnpm')
    expect(h.projectManager.mock.calls[0]).toHaveLength(2)
    expect(h.authenticate).toHaveBeenCalledExactlyOnceWith(host.url)
    expect(h.removeCookies).toHaveBeenCalledWith(h.session.defaultSession.cookies, host.url)
    await expect(invoke(DESKTOP_IPC.boot)).resolves.toEqual({ injections: [{ type: 'test' }], streamBaseUrl: 'http://127.0.0.1:3080' })
    expect(window.urls).toEqual(['dsh-app://app/'])
    expect(window.options.webPreferences).toMatchObject({ sandbox: true, nodeIntegration: false, contextIsolation: true })
    expect(window.options.webPreferences?.webviewTag).not.toBe(true)
    expect(h.app.setAsDefaultProtocolClient).not.toHaveBeenCalled()
    expect([...h.handlers.keys()].some(name => /update|onboarding|platform|browser|file-drag/iu.test(name))).toBe(false)
    expect(h.windows).toHaveLength(1)
  })

  it('defaults unpackaged resources to the isolated shell development project', async () => {
    vi.stubEnv('DSH_DESKTOP_DSH_DIR', undefined)
    const { host } = await ready()
    expect(host.runtime).toBe(join('desktop-test-app', '.desktop-build', 'shell-development', 'project'))
  })

  it('does not prepare a profile in a second application instance', async () => {
    h.app.requestSingleInstanceLock.mockReturnValue(false)
    await import('../src/main.ts')
    expect(h.projectManager).not.toHaveBeenCalled()
    expect(h.hosts).toHaveLength(0)
    expect(h.app.quit).toHaveBeenCalledOnce()
  })

  it('denies permissions and webview attachment instead of retaining product exceptions', async () => {
    const { window } = await ready()
    const request = h.session.defaultSession.setPermissionRequestHandler.mock.calls[0]?.[0] as (
      contents: unknown, permission: string, answer: (value: boolean) => void,
    ) => void
    const answer = vi.fn()
    request(window.webContents, 'media', answer)
    expect(answer).toHaveBeenCalledExactlyOnceWith(false)
    const check = h.session.defaultSession.setPermissionCheckHandler.mock.calls[0]?.[0] as () => boolean
    expect(check()).toBe(false)
    const event = { preventDefault: vi.fn() }
    window.webContents.emit('will-attach-webview', event)
    expect(event.preventDefault).toHaveBeenCalledOnce()
  })

  it('keeps local navigation and sends only external HTTP links to the system browser', async () => {
    const { window } = await ready()
    const internal = { preventDefault: vi.fn() }
    window.webContents.emit('will-navigate', internal, 'dsh-app://app/settings')
    expect(internal.preventDefault).not.toHaveBeenCalled()
    for (const url of ['https://example.com/', 'file:///tmp/private', 'dsh-app://shell/welcome.html']) {
      const event = { preventDefault: vi.fn() }
      window.webContents.emit('will-navigate', event, url)
      expect(event.preventDefault).toHaveBeenCalledOnce()
    }
    expect(h.shell.openExternal).toHaveBeenCalledExactlyOnceWith('https://example.com/')
  })

  it('rejects boot and settings bootstrap requests from unowned windows or subframes', async () => {
    const { window } = await ready()
    for (const channel of [DESKTOP_IPC.boot, DESKTOP_IPC.localeBootstrap, DESKTOP_IPC.bootFailed]) {
      const handler = h.handlers.get(channel)
      if (handler === undefined) throw new Error('missing handler')
      await expect(Promise.resolve().then(() => handler({ sender: {}, senderFrame: window.webContents.mainFrame }, 'failure')))
        .rejects.toThrow('unowned renderer')
      await expect(Promise.resolve().then(() => handler({ sender: window.webContents, senderFrame: { url: 'dsh-app://app/' } }, 'failure')))
        .rejects.toThrow('unowned renderer')
    }
  })

  it('keeps language bootstrap provisional and accepts only owned palette and language updates', async () => {
    const { window } = await ready()
    expect(invoke(DESKTOP_IPC.localeBootstrap)).toEqual({ languages: ['en-US'], preference: null })
    const sender = { sender: window.webContents, senderFrame: window.webContents.mainFrame }
    eventListener(DESKTOP_IPC.nativeThemeSet)({ ...sender, senderFrame: { url: 'dsh-app://app/' } }, 'dark')
    expect(h.nativeTheme.themeSource).toBe('system')
    eventListener(DESKTOP_IPC.nativeThemeSet)(sender, 'dark')
    expect(h.nativeTheme.themeSource).toBe('dark')
    expect(readFileSync(join(h.home, '.ff_theme'), 'utf8')).toBe('dark\n')
    eventListener(DESKTOP_IPC.localeChanged)(sender, 'zh')
    expect(readFileSync(join(h.app.getPath('userData'), 'desktop', 'locale-cache'), 'utf8')).toContain('zh')
  })

  it('paints the appearance recorded in the Harness home before the renderer publishes one', async () => {
    mkdirSync(h.home, { recursive: true })
    writeFileSync(join(h.home, '.ff_theme'), 'light\n')
    await ready()
    expect(h.nativeTheme.themeSource).toBe('light')
  })

  it('falls back to the system appearance when the recorded appearance is unusable', async () => {
    mkdirSync(h.home, { recursive: true })
    writeFileSync(join(h.home, '.ff_theme'), 'sepia\n')
    await ready()
    expect(h.nativeTheme.themeSource).toBe('system')
  })

  it('serves only the application document and proxies APIs after Host readiness', async () => {
    await ready()
    const handler = h.protocol.handle.mock.calls[0]?.[1] as (request: Request) => Promise<Response>
    expect((await handler(new Request('dsh-app://shell/welcome.html'))).status).toBe(404)
    await handler(new Request('dsh-app://app/'))
    expect(h.serve).toHaveBeenCalledOnce()
    const request = new Request('dsh-app://app/api/settings/describe')
    await handler(request)
    expect(h.forward).toHaveBeenCalledWith(request, 'http://127.0.0.1:3080/?token=test', 'cookie=test')
  })

  it('attaches WebSocket credentials only to the owned application and exact Host address', async () => {
    const { window } = await ready()
    type Details = { url: string; webContentsId: number; requestHeaders: Record<string, string> }
    const handler = h.session.defaultSession.webRequest.onBeforeSendHeaders.mock.calls[0]?.[1] as (
      details: Details, callback: (result: object) => void,
    ) => void
    const callback = vi.fn()
    const details = { url: 'ws://127.0.0.1:3080/api/remote.mux', webContentsId: window.webContents.id, requestHeaders: { Origin: 'dsh-app://app' } }
    handler(details, callback)
    expect(callback).toHaveBeenLastCalledWith({ requestHeaders: { origin: 'http://127.0.0.1:3080', cookie: 'cookie=test', 'sec-fetch-site': 'same-origin' } })
    handler({ ...details, requestHeaders: { Origin: 'https://outside.test' } }, callback)
    expect(callback).toHaveBeenLastCalledWith({ cancel: true })
    handler({ ...details, url: 'ws://127.0.0.1:9999/api/remote.mux' }, callback)
    expect(callback).toHaveBeenLastCalledWith({})
    handler({ ...details, webContentsId: 99 }, callback)
    expect(callback).toHaveBeenLastCalledWith({})
  })

  it('hides on close and reopens the same window without restarting its Host', async () => {
    const { window, host } = await ready()
    const event = { preventDefault: vi.fn() }
    window.emit('close', event)
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(window.hide).toHaveBeenCalledOnce()
    expect(host.stop).not.toHaveBeenCalled()
    h.app.emit('second-instance')
    expect(window.show).toHaveBeenCalledTimes(2)
    expect(window.focus).toHaveBeenCalledOnce()
    expect(host.start).toHaveBeenCalledOnce()
  })

  it('recreates a destroyed window while retaining the ready Host', async () => {
    const { window, host } = await ready()
    window.destroy()
    h.app.emit('second-instance')
    const replacement = h.windows[1]
    if (replacement === undefined) throw new Error('window was not recreated')
    await replacement.shown.promise
    expect(replacement.urls).toEqual(['dsh-app://app/'])
    expect(host.start).toHaveBeenCalledOnce()
  })

  it('leaves macOS fullscreen before hiding and retains standard application menus', async () => {
    vi.stubGlobal('process', { ...process, platform: 'darwin' })
    const { window } = await ready()
    window.fullscreen = true
    window.emit('close', { preventDefault: vi.fn() })
    expect(window.setFullScreen).toHaveBeenCalledWith(false)
    expect(window.hide).not.toHaveBeenCalled()
    window.emit('leave-full-screen')
    expect(window.hide).toHaveBeenCalledOnce()
    const template = h.menu.buildFromTemplate.mock.calls[0]?.[0]
    expect(template?.some(item => item.role === 'editMenu')).toBe(true)
    expect(template?.some(item => item.role === 'windowMenu')).toBe(true)
  })

  it.each(['en-US', 'zh-CN'])('records the packaged application menu in %s without product actions', async (language) => {
    h.app.isPackaged = true
    vi.stubGlobal('process', { ...process, platform: 'darwin' })
    vi.spyOn(h.app, 'getPreferredSystemLanguages').mockReturnValue([language])
    await ready()
    const menu = h.menu.buildFromTemplate.mock.calls[0]?.[0]
    await expect(`${JSON.stringify(menu, null, 2)}\n`).toMatchFileSnapshot(`./expected/application-menu-${language}.json`)
  })

  it('records application-owned About metadata', async () => {
    await ready()
    await expect(`${JSON.stringify(h.app.setAboutPanelOptions.mock.calls[0]?.[0], null, 2)}\n`)
      .toMatchFileSnapshot('./expected/about-panel.json')
  })

  it('keeps About, command management, development tools and quit without update menu actions', async () => {
    await ready()
    await invoke(DESKTOP_IPC.windowsMenu, 'application', 10, 20)
    const items = h.menu.buildFromTemplate.mock.lastCall?.[0] ?? []
    expect(items.some(item => item.role === 'about')).toBe(true)
    expect(items.some(item => item.label === en.cliCommandMenu)).toBe(true)
    expect(items.some(item => item.role === 'toggleDevTools')).toBe(true)
    expect(items.some(item => item.role === 'quit')).toBe(true)
    expect(items.some(item => /update/iu.test(item.label ?? ''))).toBe(false)
    expect(h.commandOptions.mock.calls[0]?.[0]).not.toHaveProperty('isInstalling')
  })

  it('waits for Host exit before completing ordinary quit', async () => {
    const { host, window } = await ready()
    h.app.quit()
    await host.stopping.promise
    expect(window.hide).toHaveBeenCalledOnce()
    expect(h.dialog.showMessageBox).not.toHaveBeenCalled()
    expect(h.app.quit).toHaveBeenCalledOnce()
    host.exited.resolve()
    await h.quitDone.promise
    expect(h.app.quit).toHaveBeenCalledTimes(2)
    expect(h.shortcuts.dispose).toHaveBeenCalledOnce()
    expect(h.loginShell.mock.calls[0]?.[2].signal.aborted).toBe(true)
  })

  it('does not spawn a Host after quitting during profile preparation', async () => {
    await import('../src/main.ts')
    await h.preparing.promise
    h.app.quit()
    h.prepared.resolve()
    await h.quitDone.promise
    expect(h.hosts).toHaveLength(0)
  })

  it.each([0, 1, 2])('stops the failed Host before recovery choice %s takes effect', async (response) => {
    h.dialog.showMessageBox.mockResolvedValue({ response, checkboxChecked: false })
    const { host } = await ready()
    host.onFailure(new Error('backend failed'))
    await host.stopping.promise
    expect(h.disablePlugins).not.toHaveBeenCalled()
    expect(h.app.relaunch).not.toHaveBeenCalled()
    host.exited.resolve()
    await vi.advanceTimersByTimeAsync(0)
    await h.quitDone.promise
    expect(h.disablePlugins).toHaveBeenCalledTimes(response === 2 ? 1 : 0)
    expect(h.app.relaunch).toHaveBeenCalledTimes(response === 0 ? 0 : 1)
    expect(h.projectManager.mock.calls.every(args => args.length === 2)).toBe(true)
    expect(writeCrashReport).toHaveBeenCalled()
  })

  it('bounds report Worker cleanup without claiming it exited', async () => {
    const worker = Promise.withResolvers<{ appended: boolean; timedOut: boolean; cancelled: boolean }>()
    vi.mocked(writeCrashReport).mockResolvedValueOnce('test-report.log')
    vi.mocked(runOperationReportJob).mockReturnValueOnce(worker.promise)
    const { host } = await ready()
    host.onFailure(new Error('Host failed'))
    await host.stopping.promise
    host.exited.resolve()
    await vi.advanceTimersByTimeAsync(501)
    await h.quitDone.promise
    expect(console.error).toHaveBeenCalledWith('dsh desktop: operation report Worker has not exited; continuing shutdown')
    worker.resolve({ appended: false, timedOut: false, cancelled: true })
  })
})
