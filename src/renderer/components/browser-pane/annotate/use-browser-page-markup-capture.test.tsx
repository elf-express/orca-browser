// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BrowserRendererHostContext, type BrowserRendererHost } from '../../../host-context'
import type { MarkupComposeResult } from './markup-screenshot-compose'
import { MarkupDeliveryHandledError } from './useMarkupMode'
import { useBrowserPageMarkupCapture } from './use-browser-page-markup-capture'

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  writeClipboardImage: vi.fn(),
  onDeliver: undefined as
    | undefined
    | ((result: MarkupComposeResult, context?: unknown) => Promise<void>),
  getCaptureContext: undefined as undefined | (() => unknown)
}))

vi.mock('sonner', () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }))
vi.mock('../../../lib/browser-clipboard', () => ({
  writeClipboardImage: mocks.writeClipboardImage
}))
vi.mock('./useMarkupMode', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./useMarkupMode')>()),
  useMarkupMode: (options: {
    onDeliver: (result: MarkupComposeResult, context?: unknown) => Promise<void>
    getCaptureContext: () => unknown
  }) => {
    mocks.onDeliver = options.onDeliver
    mocks.getCaptureContext = options.getCaptureContext
    return { isActive: false }
  }
}))

const RESULT: MarkupComposeResult = {
  dataUrl: 'data:image/png;base64,QQ==',
  mimeType: 'image/png',
  width: 800,
  height: 600,
  byteLength: 4
}
const PAGE = { url: 'https://a.com/x?t=1', title: 'A' }

let onSendToAgent: BrowserRendererHost['onSendToAgent']

function wrapper({ children }: { children: ReactNode }) {
  const host: BrowserRendererHost = {
    t: (_key, fallback, vars) =>
      vars
        ? fallback.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => String(vars[name]))
        : fallback,
    onSendToAgent
  }
  return (
    <BrowserRendererHostContext.Provider value={host}>
      {children}
    </BrowserRendererHostContext.Provider>
  )
}

function mount() {
  renderHook(() => useBrowserPageMarkupCapture({ current: null }, PAGE), { wrapper })
  return mocks.onDeliver!
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.onDeliver = undefined
  onSendToAgent = undefined
})
afterEach(() => {
  onSendToAgent = undefined
})

describe('useBrowserPageMarkupCapture delivery', () => {
  it('sends markup payload to agent', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    onSendToAgent = send

    await mount()(RESULT)

    expect(send).toHaveBeenCalledWith({
      kind: 'markup',
      pageUrl: 'https://a.com/x',
      pageTitle: 'A',
      text: 'Screenshot markup from https://a.com/x\n\nImage: browser-markup.png (800x600)',
      images: [{ name: 'browser-markup.png', mimeType: 'image/png', dataBase64: 'QQ==' }]
    })
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Markup sent to agent')
    expect(mocks.writeClipboardImage).not.toHaveBeenCalled()
  })

  it('shows an error when onSendToAgent rejects', async () => {
    onSendToAgent = vi.fn().mockRejectedValue(new Error('x'))

    await expect(mount()(RESULT)).rejects.toBeInstanceOf(MarkupDeliveryHandledError)

    expect(mocks.toastError).toHaveBeenCalledWith('Could not send to agent')
    expect(mocks.toastSuccess).not.toHaveBeenCalled()
  })

  it('stays silent when the host cancels with AbortError', async () => {
    const abort = new Error('canceled')
    abort.name = 'AbortError'
    onSendToAgent = vi.fn().mockRejectedValue(abort)

    await expect(mount()(RESULT)).rejects.toBeInstanceOf(MarkupDeliveryHandledError)

    expect(mocks.toastError).not.toHaveBeenCalled()
    expect(mocks.toastSuccess).not.toHaveBeenCalled()
  })

  it('falls back to clipboard without onSendToAgent', async () => {
    await mount()(RESULT)

    expect(mocks.writeClipboardImage).toHaveBeenCalledWith('data:image/png;base64,QQ==')
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      'Markup copied — paste it into your agent (Ctrl+V)'
    )
  })

  it('keeps the page URL and title captured when the screenshot was taken', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    onSendToAgent = send
    const webview = document.createElement('div')
    webview.getBoundingClientRect = () => ({ width: 100, height: 50 }) as DOMRect
    const view = renderHook(
      (props: { page: { url: string; title: string } }) =>
        useBrowserPageMarkupCapture(
          // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: only getBoundingClientRect is read.
          { current: webview as unknown as Electron.WebviewTag },
          props.page
        ),
      { wrapper, initialProps: { page: PAGE } }
    )
    const context = mocks.getCaptureContext!()

    view.rerender({ page: { url: 'https://b.com/other?secret=1', title: 'B' } })
    await mocks.onDeliver!(RESULT, context)

    expect(send.mock.calls[0][0].pageUrl).toBe('https://a.com/x')
    expect(send.mock.calls[0][0].pageTitle).toBe('A')
  })
})
