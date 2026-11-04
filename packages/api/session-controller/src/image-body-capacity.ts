/** Buffered request capacity required by encoded Session image prompts. */

/** Headroom for RPC JSON fields around aggregate base64 image payloads. */
const REQUEST_ENVELOPE_HEADROOM_BYTES = 1024 * 1024

/**
 * Reject an incompatible image-input deployment before publishing Session APIs.
 * @param maxRequestBodyBytes - Connection's configured buffered body cap.
 * @param maxMessageImageBytes - Attachment admission's aggregate source-image limit.
 * @throws Error when the carrier cannot hold the base64 image budget and envelope headroom.
 */
export function assertImageBodyCapacity(maxRequestBodyBytes: number, maxMessageImageBytes: number): void {
  const requiredImageBodyBytes = Math.ceil(maxMessageImageBytes * 4 / 3) + REQUEST_ENVELOPE_HEADROOM_BYTES
  if (maxRequestBodyBytes < requiredImageBodyBytes) {
    throw new Error(
      `session-controller requires connection maxRequestBodyBytes (${String(maxRequestBodyBytes)}) to be at least `
      + `${String(requiredImageBodyBytes)} for the configured aggregate image limit (${String(maxMessageImageBytes)} bytes)`,
    )
  }
}
