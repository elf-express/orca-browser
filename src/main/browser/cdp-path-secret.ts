import { randomBytes, timingSafeEqual } from 'node:crypto'

/** Creates the random path secret a CDP proxy requires as the first segment of every request path. */
export function createCdpPathSecret(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Returns the request path below `/<secret>` (starting with `/`) when the first path segment
 * equals `secret`, or null when it does not. An empty `secret` matches nothing.
 */
export function stripCdpPathSecret(url: string | undefined, secret: string): string | null {
  if (!secret || !url?.startsWith('/')) {
    return null
  }
  const segmentEnd = url.indexOf('/', 1)
  if (segmentEnd === -1) {
    return null
  }
  const candidate = Buffer.from(url.slice(1, segmentEnd))
  const expected = Buffer.from(secret)
  if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) {
    return null
  }
  return url.slice(segmentEnd)
}
