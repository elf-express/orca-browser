export function browserAnnotationMatchesPageUrl(capturedUrl: string, currentUrl: string): boolean {
  try {
    const captured = new URL(capturedUrl)
    const current = new URL(currentUrl)
    captured.username = ''
    captured.password = ''
    // Capture metadata strips credentials, query strings and fragments before leaving the guest.
    current.username = ''
    current.password = ''
    current.search = ''
    current.hash = ''
    return captured.href === current.href
  } catch {
    return false
  }
}
