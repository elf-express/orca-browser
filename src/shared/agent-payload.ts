export type BrowserAgentPayload = {
  kind: 'grab' | 'annotation' | 'markup'
  pageUrl: string
  pageTitle: string
  text: string
  images: Array<{ name: string; mimeType: 'image/png'; dataBase64: string }>
}
