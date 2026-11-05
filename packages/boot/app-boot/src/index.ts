/** Public boot, profile composition, and process lifecycle entry points. */
export * from './boot.ts'
export { runResolvedProfile, PROFILE_ROOT_CONFIG, PROFILE_ROOT_FILENAME, type RunResolvedProfileOptions } from './profile-runner.ts'
export { createProcessShutdown, PROCESS_SHUTDOWN_TIMEOUT_MS, type ProcessShutdown } from './process-shutdown.ts'
