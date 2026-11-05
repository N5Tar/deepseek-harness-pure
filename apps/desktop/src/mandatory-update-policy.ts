/** Deployment policy validation for installer packaging and release qualification. */

/** Validated deployment choices; test authentication is explicitly enabled, never inferred from a redirect. */
export interface DesktopPolicyConfig {
  readonly origin: string
  readonly allowedPageOrigins: readonly string[]
  readonly allowedAuthOrigins: readonly string[]
  readonly intervalMs: number
  readonly timeoutMs: number
  readonly maxBackoffMs: number
  readonly jitter: number
  readonly authentication: 'anonymous' | 'feishu-test'
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function origin(value: unknown, local: boolean): string {
  if (typeof value !== 'string') throw new Error('desktop policy: origin must be a URL')
  const url = new URL(value)
  if (url.username !== '' || url.password !== '' || url.pathname !== '/' || url.search !== '' || url.hash !== ''
    || (url.protocol !== 'https:' && !(local && url.protocol === 'http:' && url.hostname === '127.0.0.1'))) {
    throw new Error('desktop policy: expected an HTTPS origin without credentials, path, query, or fragment')
  }
  return url.origin
}

/**
 * Resolve deployment JSON without guessing a production service or download destination.
 * @param input - Parsed configuration with origin and allowedPageOrigins; absent configuration has no policy record.
 * @param allowLoopback - Explicit unpackaged/test permission for an HTTP 127.0.0.1 policy origin only.
 * @returns Validated deployment options, or undefined when unconfigured.
 */
export function resolveDesktopPolicyConfig(input: unknown, allowLoopback = false): DesktopPolicyConfig | undefined {
  if (input === undefined) return undefined
  const value = record(input)
  if (value === undefined || !Array.isArray(value.allowedPageOrigins) || value.allowedPageOrigins.length === 0) {
    throw new Error('desktop policy: configure origin and a nonempty allowedPageOrigins list')
  }
  const fields = value
  function duration(key: string, fallback: number): number {
    const duration = fields[key] ?? fallback
    if (typeof duration !== 'number' || !Number.isSafeInteger(duration) || duration < 1_000 || duration > 2_147_483_647) {
      throw new Error(`desktop policy: ${key} must be an integer from 1000 through 2147483647`)
    }
    return duration
  }
  const intervalMs = duration('intervalMs', 600_000)
  const maxBackoffMs = duration('maxBackoffMs', 3_600_000)
  const jitter = value.jitter ?? 0.2
  const authentication = value.authentication ?? 'anonymous'
  if (authentication !== 'anonymous' && authentication !== 'feishu-test') {
    throw new Error('desktop policy: authentication must be anonymous or feishu-test')
  }
  const authOrigins = value.allowedAuthOrigins
  if (authentication === 'feishu-test' && (!Array.isArray(authOrigins) || authOrigins.length === 0)) {
    throw new Error('desktop policy: test authentication requires nonempty allowedAuthOrigins')
  }
  if (authentication === 'anonymous' && authOrigins !== undefined) {
    throw new Error('desktop policy: anonymous policy must not configure allowedAuthOrigins')
  }
  if (typeof jitter !== 'number' || !Number.isFinite(jitter) || jitter < 0 || jitter > 1 || maxBackoffMs < intervalMs) {
    throw new Error('desktop policy: jitter must be in [0, 1] and maxBackoffMs must cover intervalMs')
  }
  return {
    origin: origin(value.origin, authentication === 'anonymous' && allowLoopback),
    allowedPageOrigins: value.allowedPageOrigins.map(item => origin(item, false)),
    allowedAuthOrigins: authentication === 'feishu-test' ? (authOrigins as unknown[]).map(item => origin(item, false)) : [],
    intervalMs, timeoutMs: duration('timeoutMs', 15_000), maxBackoffMs, jitter, authentication,
  }
}
