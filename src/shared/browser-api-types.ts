export interface BrowserApi {
  readonly apiVersion: 1
}

declare global {
  interface Window {
    browserAPI?: BrowserApi
  }
}
