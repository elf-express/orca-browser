export type RendererPlatform = 'darwin' | 'win32' | 'linux'

/** Derives the host OS from the user agent; anything that is not macOS or Windows counts as Linux. */
export function getRendererPlatform(): RendererPlatform {
  const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent
  if (/Mac|iPhone|iPad/i.test(userAgent)) {
    return 'darwin'
  }
  if (/Windows|Win32|Win64/i.test(userAgent)) {
    return 'win32'
  }
  return 'linux'
}
