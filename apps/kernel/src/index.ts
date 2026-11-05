/** Public kernel surface: boot one Cordis root with the shell page and Loader plugins. */
export { bootKernel, type KernelOptions, type RunningKernel } from './kernel.ts'
export { readManifest, manifestPath, type KernelPluginEntry } from './manifest.ts'
export { KernelServer, type KernelRoute } from './server.ts'
export { KernelSettingsStore, settingsPath, type KernelSettings } from './settings.ts'
