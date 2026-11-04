/** Validated desktop product selection before profiles or business integrations start. */

/** Product desktop or the session-free application foundation. */
export type DesktopLaunchMode = 'product' | 'shell'

/**
 * Resolve an authored launch mode from development environment or packaged metadata.
 * @param input - Explicit mode; absence selects the existing product desktop.
 * @returns Validated mode shared by profile selection and the private Host environment.
 * @throws When a present value does not name a supported mode; callers must stop startup.
 */
export function resolveDesktopLaunchMode(input: unknown): DesktopLaunchMode {
  if (input === undefined) return 'product'
  if (input === 'product' || input === 'shell') return input
  throw new Error('desktop launch: mode must be product or shell')
}
