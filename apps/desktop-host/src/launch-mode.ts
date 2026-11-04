/** Private process-boundary selection of Desktop Host behavior. */

/** Product behavior remains the default for existing Desktop launchers. */
export type DesktopHostMode = 'product' | 'shell'

/**
 * Validate the private launcher environment value before starting the Host.
 * @param value - DSH_DESKTOP_MODE from the child process environment.
 * @returns the explicit mode, or product when the value is absent.
 * @throws when a present value is neither product nor shell.
 */
export function parseDesktopHostMode(value: string | undefined): DesktopHostMode {
  if (value === undefined) return 'product'
  if (value === 'product' || value === 'shell') return value
  throw new Error('desktop host: DSH_DESKTOP_MODE must be product or shell')
}
