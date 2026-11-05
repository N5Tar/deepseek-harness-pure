/** Electron carrier: authenticated local Host, owned windows, and quiescent recovery. */
import { WINDOWS_TITLEBAR_HEIGHT } from './windows-layout.ts'
import { access, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  app, BrowserWindow, dialog, ipcMain, Menu, powerMonitor, nativeTheme, protocol, session, shell,
  type IpcMainInvokeEvent, type MenuItemConstructorOptions,
} from 'electron'
import { resolveDesktopPaths } from './paths.ts'
import { DesktopProjectManager } from './project-manager.ts'
import { DesktopHostFatalError, DesktopHostProcess } from './host-process.ts'
import { installDesktopDirectoryPicker } from './directory-picker.ts'
import { DesktopBackendController } from './backend-controller.ts'
import { DESKTOP_IPC, SCHEME, assertDesktopSender } from './ipc.ts'
import { resolveDesktopLocale, resolveDesktopStartupLocale } from './locale.ts'
import { claimDesktopSingleInstance } from './single-instance.ts'
import { DesktopCommandManager } from './command-management.ts'
import { desktopClientVersion } from './client-metadata.ts'
import { readDesktopTheme, writeDesktopTheme } from './theme-default.ts'
import { serveWebDocument, authenticateWebHost, forwardWebRequest, removeLegacyHostCookies } from './web-document.ts'
import { DesktopFatalRecovery } from './fatal-recovery.ts'
import { pruneCrashReports, RendererConsoleTail, writeCrashReport, type CrashReportSource } from './crash-report.ts'
import { OperationJournal } from './operation-journal.ts'
import { runOperationReportJob, type OperationReportJobResult } from './operation-report-job.ts'
import { readDesktopLoginShellEnvironment, resolveDesktopLoginShellConfig } from './login-shell-environment.ts'
import { readDesktopLocaleCache, writeDesktopLocaleCache } from './locale-cache.ts'
import { installDesktopShortcuts } from './keyboard.ts'
import { DesktopTray } from './tray.ts'
import { DesktopBackgroundNotice } from './background-notice.ts'

let focusPrimaryWindow = (): void => {}
let stopForRecovery = async (): Promise<void> => { await stopOperationReports() }
let shuttingDown = false
let windowsLanguage: string | undefined = readDesktopLocaleCache(app.getPath('userData'))
let backendReady = false
const rendererConsole = new RendererConsoleTail()
app.setAppLogsPath()

function currentDesktopLocale(): ReturnType<typeof resolveDesktopLocale> {
  return resolveDesktopLocale(windowsLanguage ?? app.getLocale())
}

const recovery = new DesktopFatalRecovery({
  messages: () => currentDesktopLocale().messages,
  show: options => dialog.showMessageBox(options),
  stop: () => { shuttingDown = true; return stopForRecovery() },
  disablePlugins: async () => {
    const manager = new DesktopProjectManager(resolveDesktopPaths(), runtimeResources())
    const backupPath = await manager.disableAllPlugins()
    console.info('Desktop profile recovery completed:', { profilePatchBackup: backupPath ?? null, homePatch: 'unchanged' })
  },
  exit: () => { app.quit() },
  restart: () => { app.relaunch(); app.quit() },
  writeReport: (error, source) => persistCrashReport(error, source),
  revealReport: async (path) => { await access(path); shell.showItemInFolder(path) },
})

let operationJournal: OperationJournal | undefined
let operationReportJob: Promise<OperationReportJobResult> | undefined
let operationReportAbort: AbortController | undefined
let operationReportsStopping = false
let operationReportStop: Promise<void> | undefined

/** Bound cleanup waiting without claiming an unresponsive report Worker has exited. */
function stopOperationReports(): Promise<void> {
  operationReportStop ??= waitForOperationReports()
  return operationReportStop
}

async function waitForOperationReports(): Promise<void> {
  operationReportsStopping = true
  operationReportAbort?.abort()
  const job = operationReportJob
  if (job === undefined) return
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const exited = await Promise.race([job.then(() => true), new Promise<false>((resolve) => {
      timer = setTimeout(() => { resolve(false) }, 500)
    })])
    if (!exited) console.error('dsh desktop: operation report Worker has not exited; continuing shutdown')
  } finally { clearTimeout(timer) }
}

function persistCrashReport(error: unknown, source: CrashReportSource): Promise<string | undefined> {
  const report = writeCrashReport(app.getPath('logs'), {
    operationHistoryPlanned: !shuttingDown && !operationReportsStopping,
    source, phase: backendReady ? 'running' : 'startup', error,
    ...(error instanceof DesktopHostFatalError && error.diagnostic !== undefined ? { hostDiagnostic: error.diagnostic } : {}),
    rendererConsole: rendererConsole.snapshot(),
    app: {
      name: app.name, version: app.getVersion(), platform: process.platform, arch: process.arch,
      electron: process.versions.electron, node: process.versions.node, locale: currentDesktopLocale().id,
    },
    time: new Date(),
  })
  void report.then((path) => {
    if (path !== undefined && operationReportJob === undefined && !shuttingDown && !operationReportsStopping) {
      operationReportAbort = new AbortController()
      operationReportJob = runOperationReportJob({ reportPath: path, directory: join(app.getPath('userData'), 'plugin-operations'),
        limits: { bytes: 64 * 1024, recordBytes: 4096, records: 100, outputBytes: 64 * 1024 },
        journal: operationJournal?.status() ?? null,
      }, { timeoutMs: 500, cancellationGraceMs: 100 }, operationReportAbort.signal)
      void operationReportJob.finally(() => { operationReportJob = undefined; operationReportAbort = undefined })
    }
  }).catch((_error: unknown) => { /* Fatal recovery reports failure to persist the basic crash report. */ })
  return report
}

function reportFatal(error: unknown, source: CrashReportSource): void {
  console.error(error)
  if (shuttingDown) { void persistCrashReport(error, source); return }
  void recovery.report(error, source).catch(async (failure: unknown) => {
    console.error(failure)
    shuttingDown = true
    await stopOperationReports()
    app.exit(1)
  })
}

protocol.registerSchemesAsPrivileged([{
  scheme: SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true },
}])

interface RuntimeResources {
  readonly nodeBin: string
  readonly node: string
  readonly pnpm: string
  readonly dsh: string
}

function runtimeResources(): RuntimeResources {
  const development = !app.isPackaged
  const node = process.execPath
  const nodeBin = development ? join(app.getAppPath(), 'scripts', 'node-bin') : join(process.resourcesPath, 'runtime', 'bin')
  const pnpm = (development ? process.env.DSH_DESKTOP_PNPM_ENTRY : undefined)
    ?? (development ? join(app.getAppPath(), 'node_modules', 'pnpm', 'bin', 'pnpm.mjs')
      : join(process.resourcesPath, 'runtime', 'primary-runtime', 'dependencies', 'pnpm', 'bin', 'pnpm.mjs'))
  const dsh = (development ? process.env.DSH_DESKTOP_DSH_DIR : undefined)
    ?? (development ? join(app.getAppPath(), '.desktop-build', 'shell-development', 'project') : join(app.getAppPath(), 'dsh'))
  return { node, nodeBin, pnpm, dsh }
}

function developmentHostInspectPort(enabled: boolean): number | undefined {
  const configured = process.env.DSH_DESKTOP_HOST_INSPECT_PORT
  if (!enabled || configured === undefined || configured === '') return undefined
  const port = Number(configured)
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error('dsh desktop: DSH_DESKTOP_HOST_INSPECT_PORT must be an integer from 1 through 65535')
  }
  return port
}

/** @returns Opaque native chrome fill before the renderer publishes its palette. */
function chromeFallbackFill(): string {
  return nativeTheme.shouldUseDarkColors ? '#1b1b1c' : '#f9fafb'
}

function createWindow(preload: string): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280, height: 820, minWidth: 520, minHeight: 600, show: false,
    ...(process.platform === 'win32' ? {
      titleBarStyle: 'hidden' as const,
      titleBarOverlay: { height: WINDOWS_TITLEBAR_HEIGHT, color: chromeFallbackFill(),
        symbolColor: nativeTheme.shouldUseDarkColors ? '#f9fafb' : '#0f1115' },
    } : {}),
    ...(process.platform === 'darwin' ? {
      titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 16, y: 18 },
      vibrancy: 'sidebar' as const, visualEffectState: 'active' as const, backgroundColor: '#00000000',
    } : {}),
    webPreferences: { preload, nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, devTools: true },
  })
  window.webContents.on('will-attach-webview', (event) => { event.preventDefault() })
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (['http:', 'https:'].includes(new URL(url).protocol)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  if (process.platform === 'darwin' || process.platform === 'win32') {
    const sendFullscreen = (): void => {
      if (!window.isDestroyed()) window.webContents.send(DESKTOP_IPC.windowFullscreen, window.isFullScreen())
    }
    window.on('enter-full-screen', sendFullscreen)
    window.on('leave-full-screen', sendFullscreen)
    window.webContents.on('did-finish-load', sendFullscreen)
  }
  if (process.platform === 'darwin') {
    // NSVisualEffectView reattaches after deminiaturization; an opaque fill covers that interval.
    const applyBackdrop = (): void => {
      if (window.isDestroyed()) return
      if (window.isMinimized() || !window.isVisible()) {
        window.setVibrancy(null)
        window.setBackgroundColor(chromeFallbackFill())
      } else {
        window.setVibrancy('sidebar')
        window.setBackgroundColor('#00000000')
      }
    }
    window.on('minimize', applyBackdrop)
    window.on('hide', applyBackdrop)
    window.on('restore', applyBackdrop)
    window.on('show', applyBackdrop)
  }
  window.webContents.on('context-menu', (_event, { isEditable, selectionText, editFlags }) => {
    const items: MenuItemConstructorOptions[] = []
    if (isEditable) {
      items.push(
        { role: 'undo', enabled: editFlags.canUndo }, { role: 'redo', enabled: editFlags.canRedo }, { type: 'separator' },
        { role: 'cut', enabled: editFlags.canCut }, { role: 'copy', enabled: editFlags.canCopy },
        { role: 'paste', enabled: editFlags.canPaste }, { type: 'separator' }, { role: 'selectAll', enabled: editFlags.canSelectAll },
      )
    } else if (selectionText.length > 0) items.push({ role: 'copy', enabled: editFlags.canCopy })
    if (items.length > 0) {
      const messages = currentDesktopLocale().messages
      Menu.buildFromTemplate(items.map(item => ({
        ...item,
        ...(process.platform === 'win32' && item.role !== undefined && item.role in messages
          ? { label: messages[item.role as keyof typeof messages] } : {}),
        accelerator: '',
      }))).popup({ window })
    }
  })
  window.webContents.on('will-navigate', (event, url) => {
    const destination = new URL(url)
    if (destination.protocol !== `${SCHEME}:` || destination.hostname !== 'app') {
      event.preventDefault()
      if (['http:', 'https:'].includes(destination.protocol)) void shell.openExternal(url)
    }
  })
  return window
}

/** Kernel mode has no packaged runtime tree; the Host only needs an existing working directory. */
function kernelModeResources(resources: RuntimeResources): RuntimeResources {
  return process.env.DSH_DESKTOP_KERNEL === '1'
    ? { ...resources, dsh: app.getPath('userData') }
    : resources
}

async function main(): Promise<void> {
  void pruneCrashReports(app.getPath('logs'))
  const resources = kernelModeResources(runtimeResources())
  const paths = resolveDesktopPaths()
  // The recorded appearance paints the first frame, before Host settings reach the renderer.
  nativeTheme.themeSource = readDesktopTheme(paths.home) ?? 'system'
  const development = !app.isPackaged
  // Kernel mode boots the Cordis kernel Host instead of a product profile tree.
  const kernelMode = process.env.DSH_DESKTOP_KERNEL === '1'
  const manager = new DesktopProjectManager(paths, resources)
  const loginShellRead = new AbortController()
  app.on('will-quit', () => { loginShellRead.abort() })
  const loginShell = readDesktopLoginShellEnvironment(process.env, resolveDesktopLoginShellConfig(process.env), {
    signal: loginShellRead.signal,
  }).then((result) => {
    for (const failure of result.failures) console.warn(`desktop login shell: ${failure.shell} failed (${failure.reason})`)
    return result.environment
  })
  let hostEnvironment: NodeJS.ProcessEnv = process.env
  const prepareHostEnvironment = async (): Promise<void> => { hostEnvironment = await loginShell }
  let quitting = false
  const isQuitting = (): boolean => quitting
  let startup: Promise<void> | undefined
  let mainWindow: BrowserWindow | undefined
  let sessionEnding = false
  let tray: DesktopTray | undefined
  const systemLanguages = app.getPreferredSystemLanguages()
  let locale = windowsLanguage === undefined
    ? resolveDesktopStartupLocale(null, systemLanguages) : resolveDesktopLocale(windowsLanguage)
  windowsLanguage = locale.id
  const applicationUrl = `${SCHEME}://app/`
  const appPreload = join(app.getAppPath(), 'lib', 'preload-app.cjs')
  let hostUrl: string | undefined
  let hostCookie: string | undefined
  let injections: readonly unknown[] = []
  const assertApplicationSender = (event: IpcMainInvokeEvent): BrowserWindow => {
    assertDesktopSender(event, ['app'])
    if (mainWindow === undefined || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents
      || event.senderFrame === null || event.senderFrame !== mainWindow.webContents.mainFrame) {
      throw new Error('dsh desktop: rejected IPC from an unowned renderer')
    }
    return mainWindow
  }
  let navigation: { window: BrowserWindow; promise: Promise<void> } | undefined
  const navigateMain = (): Promise<void> => {
    const window = mainWindow
    if (quitting || window === undefined || window.isDestroyed()) return Promise.resolve()
    if (navigation?.window === window) return navigation.promise
    const next = { window, promise: Promise.resolve() }
    next.promise = window.loadURL(applicationUrl).catch((error: unknown) => {
      if (quitting || shuttingDown || window.isDestroyed() || navigation !== next
        || (error instanceof Error && 'code' in error && error.code === 'ERR_ABORTED')) return
      navigation = undefined
      throw error
    })
    navigation = next
    return next.promise
  }
  const backend = new DesktopBackendController((onFailure) => {
    const host = new DesktopHostProcess(resources.node, resources.dsh, paths.profile,
      developmentHostInspectPort(development), { ...hostEnvironment, DSH_CLIENT_VERSION: desktopClientVersion() },
      onFailure, resources, (record) => {
        operationJournal ??= new OperationJournal(join(app.getPath('userData'), 'plugin-operations'), {
          segmentBytes: 256 * 1024, recordBytes: 4096, queuedBytes: 64 * 1024,
        })
        operationJournal.enqueue(JSON.stringify(record))
      })
    return {
      start: async () => {
        const ready = await host.start()
        const cookie = await authenticateWebHost(ready.url)
        if (ready.injections === undefined) throw new Error('Desktop Host did not provide boot injections')
        hostCookie = cookie
        hostUrl = ready.url
        injections = ready.injections
        void removeLegacyHostCookies(session.defaultSession.cookies, ready.url)
          .catch((error: unknown) => { console.error('desktop: legacy Host cookie cleanup failed', error) })
      },
      stop: () => host.stop(),
    }
  }, (state) => {
    if (state.phase === 'error') reportFatal(state.failure, 'host')
    else if (!shuttingDown) backendReady = state.phase === 'ready'
  })
  stopForRecovery = async () => {
    const reports = stopOperationReports()
    loginShellRead.abort()
    try { await backend.close() }
    finally { await Promise.all([operationJournal?.drain(500), reports]) }
  }
  const showMain = async (): Promise<void> => {
    const window = mainWindow
    if (hostCookie === '' && hostUrl !== undefined && window !== undefined && !window.isDestroyed()) {
      // A kernel Host serves its own page and carries no authentication challenge.
      await window.loadURL(hostUrl)
    } else {
      await navigateMain()
    }
    if (quitting || recovery.active || mainWindow === undefined || mainWindow.isDestroyed() || backend.host === undefined) return
    mainWindow.show()
  }
  let kernelHandle: { url: string; stop(): Promise<void> } | undefined
  const reconcileBackend = (): Promise<void> => {
    startup ??= (async () => {
      if (kernelMode) {
        // Kernel mode runs the Cordis kernel in this process: no child Host and no product profile.
        const { bootKernel } = await import('@deepseek-ai/dsh-kernel')
        const modulesDirectory = join(app.getAppPath(), 'node_modules', '@deepseek-ai', 'dsh-kernel', 'assets', 'ui')
        const kernel = await bootKernel({ home: app.getPath('userData'), port: 0, modulesDirectory })
        kernelHandle = kernel
        hostUrl = kernel.url
        hostCookie = ''
        injections = []
        backendReady = true
        await showMain()
        return
      }
      await navigateMain()
      await backend.start(async () => { await Promise.all([manager.applyRelease(), prepareHostEnvironment()]) })
      await showMain()
    })().catch((error: unknown) => { reportFatal(error, 'main'); throw error })
      .finally(() => { startup = undefined })
    return startup
  }

  protocol.handle(SCHEME, (request) => {
    const url = new URL(request.url)
    if (url.hostname !== 'app') return Promise.resolve(new Response(null, { status: 404 }))
    if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname.startsWith('/assets/')
      || ['/favicon.svg', '/manifest.webmanifest'].includes(url.pathname)) {
      return serveWebDocument(request, join(resources.dsh, 'node_modules', '@deepseek-ai', 'dsh-web-frontend', 'dist'))
    }
    if (backend.host === undefined || hostUrl === undefined || hostCookie === undefined) {
      return Promise.resolve(new Response(null, { status: 503 }))
    }
    return forwardWebRequest(request, hostUrl, hostCookie)
  })
  installDesktopDirectoryPicker(() => mainWindow)
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => { callback(false) })
  session.defaultSession.setPermissionCheckHandler(() => false)
  const shortcuts = installDesktopShortcuts(() => mainWindow, app.getPath('userData'),
    process.platform === 'darwin' ? 'macos' : process.platform === 'win32' ? 'windows' : 'linux',
    () => { refreshApplicationMenu() }, () => ({ revision: 0, blocked: false }))
  app.on('will-quit', () => { shortcuts.dispose() })
  app.on('will-quit', () => { void kernelHandle?.stop() })
  ipcMain.handle(DESKTOP_IPC.boot, async (event) => {
    assertApplicationSender(event)
    await startup
    if (backend.host === undefined || hostUrl === undefined) throw new Error('Desktop Host is unavailable')
    return { injections, streamBaseUrl: new URL(hostUrl).origin }
  })
  ipcMain.handle(DESKTOP_IPC.bootFailed, (event, message: unknown) => {
    assertApplicationSender(event)
    if (typeof message !== 'string') throw new Error('dsh desktop: startup failure must be text')
    reportFatal(new Error(message), 'web-boot')
  })
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ['ws://127.0.0.1/*', 'wss://127.0.0.1/*'] }, (details, callback) => {
    if (hostUrl === undefined || hostCookie === undefined || details.webContentsId !== mainWindow?.webContents.id) {
      callback({}); return
    }
    const target = new URL(hostUrl)
    const requested = new URL(details.url)
    if (requested.host !== target.host || requested.protocol !== (target.protocol === 'https:' ? 'wss:' : 'ws:')) { callback({}); return }
    const headers = Object.fromEntries(Object.entries(details.requestHeaders).map(([name, value]) => [name.toLowerCase(), value]))
    if (headers.origin !== `${SCHEME}://app`) { callback({ cancel: true }); return }
    callback({ requestHeaders: { ...headers, origin: target.origin, cookie: hostCookie, 'sec-fetch-site': 'same-origin' } })
  })
  ipcMain.on(DESKTOP_IPC.nativeThemeSet, (event, source: unknown) => {
    if (mainWindow === undefined || event.sender !== mainWindow.webContents
      || event.senderFrame !== mainWindow.webContents.mainFrame || !event.senderFrame.url.startsWith(applicationUrl)) return
    if (source !== 'light' && source !== 'dark' && source !== 'system') return
    nativeTheme.themeSource = source
    writeDesktopTheme(paths.home, source)
  })
  ipcMain.handle(DESKTOP_IPC.localeBootstrap, (event) => {
    assertApplicationSender(event)
    // ConfigForms adopts the persisted preference after this provisional native-language bootstrap.
    return { languages: systemLanguages, preference: null }
  })
  ipcMain.on(DESKTOP_IPC.localeChanged, (event, next: unknown) => {
    const window = mainWindow
    if (window === undefined || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame
      || !event.senderFrame.url.startsWith(applicationUrl) || typeof next !== 'string') return
    const current = resolveDesktopStartupLocale(next, systemLanguages)
    writeDesktopLocaleCache(app.getPath('userData'), current.id)
    if (current.id === locale.id) return
    locale = current
    windowsLanguage = locale.id
    refreshApplicationMenu()
  })

  const ordinaryMessageBox = (options: Electron.MessageBoxOptions): Promise<Electron.MessageBoxReturnValue> => {
    const window = mainWindow
    return window === undefined || window.isDestroyed() ? dialog.showMessageBox(options) : dialog.showMessageBox(window, options)
  }
  const commandManager = new DesktopCommandManager({
    resources: process.resourcesPath, isPackaged: app.isPackaged,
    isInstalledLocation: () => process.platform !== 'darwin' || app.isInApplicationsFolder(),
    isQuitting: () => quitting, messages: () => currentDesktopLocale().messages, show: ordinaryMessageBox,
  })
  app.setAboutPanelOptions({ applicationName: app.name, applicationVersion: app.getVersion(), version: '', copyright: '',
    iconPath: development ? join(app.getAppPath(), 'resources', 'icon-windows.png') : join(process.resourcesPath, 'icon.png') })
  const darwin = process.platform === 'darwin'
  const applicationItems = (): MenuItemConstructorOptions[] => [
    { label: currentDesktopLocale().messages.aboutMenu, role: 'about' },
    { type: 'separator' },
    ...darwin || process.platform === 'win32'
      ? [{ label: currentDesktopLocale().messages.cliCommandMenu, click: () => { void commandManager.show() } }] : [],
    ...development ? [
      { label: currentDesktopLocale().messages.reloadPageMenu, role: 'reload' as const },
      { label: currentDesktopLocale().messages.restartAppHostMenu, click: () => {
        if (quitting) return
        app.relaunch()
        app.quit()
      } },
    ] : [],
    { role: 'toggleDevTools', label: currentDesktopLocale().messages.toggleDevToolsMenu },
    { type: 'separator' },
    ...darwin ? [
      { role: 'hide' as const, label: currentDesktopLocale().messages.hideApplication },
      { role: 'hideOthers' as const, label: currentDesktopLocale().messages.hideOtherApplications },
      { role: 'unhide' as const, label: currentDesktopLocale().messages.showAllApplications },
      { type: 'separator' as const },
    ] : [],
    { role: 'quit', ...(darwin ? { label: currentDesktopLocale().messages.quitApplication }
      : process.platform === 'win32' ? { label: currentDesktopLocale().messages.exitApplication } : {}) },
  ]
  const devToolsShortcut: MenuItemConstructorOptions = { role: 'toggleDevTools', visible: false, accelerator: 'F12' }
  const refreshApplicationMenu = (): void => {
    Menu.setApplicationMenu(Menu.buildFromTemplate(process.platform === 'win32' ? [
      { role: 'toggleDevTools', visible: false }, devToolsShortcut,
    ] : [
      { label: darwin ? app.name : currentDesktopLocale().messages.application, submenu: [...applicationItems(), devToolsShortcut] },
      ...darwin ? [shortcuts.fileMenu(currentDesktopLocale().messages), { role: 'editMenu' as const }, { role: 'windowMenu' as const }]
        : [{ role: 'editMenu' as const }],
    ]))
    tray?.relabel()
  }
  refreshApplicationMenu()
  if (process.platform === 'win32') {
    try {
      tray = new DesktopTray({ iconPath: development ? join(app.getAppPath(), 'resources', 'tray-windows.ico')
        : join(process.resourcesPath, 'tray.ico'), locale: currentDesktopLocale,
      open: () => { focusPrimaryWindow() }, quit: () => { app.quit() } })
    } catch (error) { console.warn('desktop tray: unavailable', error) }
  }
  const backgroundNotice = process.platform === 'win32'
    ? new DesktopBackgroundNotice({ markerPath: join(app.getPath('userData'), 'background-close-confirmed'),
      locale: () => locale, show: ordinaryMessageBox, focus: () => { mainWindow?.focus() } })
    : undefined
  if (process.platform === 'win32') {
    ipcMain.handle(DESKTOP_IPC.windowsMenu, (event, name: unknown, x: unknown, y: unknown) => {
      const window = assertApplicationSender(event)
      if ((name !== 'application' && name !== 'edit') || typeof x !== 'number' || typeof y !== 'number'
        || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > 100_000 || y > 100_000) {
        throw new Error('desktop menu: invalid popup request')
      }
      const editItem = (label: string, keyCode: string, modifiers: Array<'control'>, accelerator?: string): MenuItemConstructorOptions => ({
        label, ...(accelerator === undefined ? {} : { accelerator }),
        click: () => { shortcuts.sendEditingKey(keyCode, modifiers) },
      })
      const labels = currentDesktopLocale().messages
      const items: MenuItemConstructorOptions[] = name === 'application' ? applicationItems() : [
        editItem(labels.undo, 'Z', ['control'], 'Ctrl+Z'), editItem(labels.redo, 'Y', ['control'], 'Ctrl+Y'),
        { type: 'separator' }, editItem(labels.cut, 'X', ['control'], 'Ctrl+X'), editItem(labels.copy, 'C', ['control'], 'Ctrl+C'),
        editItem(labels.paste, 'V', ['control'], 'Ctrl+V'), editItem(labels.delete, 'Delete', []),
        { type: 'separator' }, editItem(labels.selectAll, 'A', ['control'], 'Ctrl+A'),
      ]
      const zoom = window.webContents.getZoomFactor()
      return new Promise<void>((resolve) => {
        Menu.buildFromTemplate(items).popup({ window, x: Math.round(x * zoom), y: Math.round(y * zoom), callback: resolve })
      })
    })
    ipcMain.on(DESKTOP_IPC.windowsAppearance, (event, _language: unknown, color: unknown, symbolColor: unknown) => {
      if (mainWindow === undefined || event.sender !== mainWindow.webContents
        || event.senderFrame !== mainWindow.webContents.mainFrame || !event.senderFrame.url.startsWith(applicationUrl)) return
      const validColor = (value: unknown): value is string => typeof value === 'string'
        && /^(?:#[\da-f]{3,8}|rgba?\([\d.,%\s]+\))$/iu.test(value)
      if (validColor(color) && validColor(symbolColor)) mainWindow.setTitleBarOverlay({ color, symbolColor })
    })
  }
  const hideMainWindow = (window: BrowserWindow): void => {
    if (darwin && window.isFullScreen()) {
      window.once('leave-full-screen', () => { if (!window.isDestroyed()) window.hide() })
      window.setFullScreen(false)
    } else window.hide()
  }
  const createMainWindow = (): BrowserWindow => {
    const window = createWindow(appPreload)
    mainWindow = window
    shortcuts.attach(window)
    window.on('close', (event) => {
      if (quitting || sessionEnding) return
      event.preventDefault()
      const hide = (): void => {
        if (!quitting && !sessionEnding && !window.isDestroyed()) hideMainWindow(window)
      }
      if (backgroundNotice === undefined) hide()
      else backgroundNotice.close(hide)
    })
    if (process.platform === 'win32') window.on('session-end', () => { sessionEnding = true })
    else {
      window.on('focus', () => { sessionEnding = false })
      window.on('show', () => { sessionEnding = false })
    }
    window.on('closed', () => { if (mainWindow === window) mainWindow = undefined })
    window.webContents.on('console-message', (details) => {
      if (details.level === 'error') rendererConsole.push(`${details.sourceId}:${String(details.lineNumber)} ${details.message}`)
    })
    window.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
      if (isMainFrame && code !== -3 && !quitting && !window.isDestroyed()) {
        reportFatal(new Error(`Desktop page failed to load: ${url} (${String(code)}: ${description})`), 'renderer')
      }
    })
    window.webContents.on('preload-error', (_event, _path, error) => {
      if (!quitting && !window.isDestroyed()) reportFatal(error, 'renderer')
    })
    window.webContents.on('render-process-gone', (_event, details) => {
      navigation = undefined
      if (!quitting && !window.isDestroyed() && details.reason !== 'clean-exit') {
        reportFatal(new Error(`Desktop renderer exited: ${details.reason}`), 'renderer')
      }
    })
    return window
  }
  focusPrimaryWindow = () => {
    if (quitting || recovery.active) return
    const window = mainWindow
    if (window === undefined || window.isDestroyed()) {
      try { createMainWindow() } catch (error) { reportFatal(error, 'main'); return }
      void (backend.state.phase === 'ready' ? showMain() : navigateMain()).catch((error: unknown) => { reportFatal(error, 'main') })
      return
    }
    if (backend.state.phase !== 'ready') return
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  }
  app.on('activate', (_event, hasVisibleWindows) => { if (!hasVisibleWindows) focusPrimaryWindow() })
  app.on('window-all-closed', () => { if (!darwin) app.quit() })
  if (process.platform !== 'win32') powerMonitor.on('shutdown', () => { sessionEnding = true })
  app.on('before-quit', (event) => {
    if (quitting) return
    event.preventDefault()
    quitting = true
    shuttingDown = true
    backgroundNotice?.dispose()
    tray?.dispose()
    if (mainWindow !== undefined && !mainWindow.isDestroyed()) mainWindow.hide()
    void stopForRecovery().catch((error: unknown) => { reportFatal(error, 'host') }).finally(() => { app.quit() })
  })
  createMainWindow()
  await reconcileBackend().catch(() => undefined)
  if (!isQuitting() && mainWindow !== undefined && development && process.env.DSH_DESKTOP_OPEN_DEVTOOLS !== '0') {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }
}

const ownsDesktopInstance = claimDesktopSingleInstance(app, () => { focusPrimaryWindow() })
if (ownsDesktopInstance) void app.whenReady().then(main).catch(async (error: unknown) => {
  console.error(error)
  const diagnosticFile = process.env.DSH_DESKTOP_DIAGNOSTIC_FILE
  if (diagnosticFile !== undefined) {
    await writeFile(diagnosticFile, `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`).catch(() => undefined)
  }
  reportFatal(error, 'main')
}).catch(async (error: unknown) => {
  console.error(error)
  shuttingDown = true
  await stopOperationReports()
  app.exit(1)
})
