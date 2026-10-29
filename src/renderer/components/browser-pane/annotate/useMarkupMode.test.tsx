// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { BrowserRendererHostContext, type BrowserRendererHost } from '../../../host-context'
import { useBrowserPageMarkupCapture } from './use-browser-page-markup-capture'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MarkupDeliveryHandledError, useMarkupMode } from './useMarkupMode'

const mocks = vi.hoisted(() => ({ toastError: vi.fn() }))

vi.mock('sonner', () => ({ toast: { error: mocks.toastError, success: vi.fn() } }))
vi.mock('./markup-base-image', () => ({
  captureMarkupBaseImage: vi.fn().mockResolvedValue({ dataUrl: 'data:,', width: 10, height: 10 })
}))
vi.mock('./markup-screenshot-compose', () => ({
  composeMarkupDataUrl: vi.fn().mockResolvedValue({
    dataUrl: 'data:image/png;base64,QQ==',
    mimeType: 'image/png',
    width: 10,
    height: 10,
    byteLength: 4
  })
}))

const CONTEXT = {
  source: { kind: 'webview' as const, webview: {} as Electron.WebviewTag },
  cssWidth: 10,
  cssHeight: 10,
  outputScale: 1
}

async function drawThenComplete(onDeliver: () => Promise<void>) {
  const hook = renderHook(() => useMarkupMode({ getCaptureContext: () => CONTEXT, onDeliver }))
  await act(async () => {
    await hook.result.current.start()
  })
  expect(hook.result.current.state).toBe('drawing')
  await act(async () => {
    await hook.result.current.complete({ imageElement: {} as CanvasImageSource, shapes: [] })
  })
  return hook
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => setTimeout(cb, 0))
})

describe('useMarkupMode delivery outcome', () => {
  it('keeps the drawing without the generic toast when the failure was already reported', async () => {
    const { result } = await drawThenComplete(() =>
      Promise.reject(new MarkupDeliveryHandledError())
    )

    expect(result.current.state).toBe('drawing')
    expect(result.current.baseImage).not.toBeNull()
    expect(mocks.toastError).not.toHaveBeenCalled()
  })

  it('shows the generic attach error for any other failure and keeps drawing', async () => {
    const { result } = await drawThenComplete(() => Promise.reject(new Error('boom')))

    expect(result.current.state).toBe('drawing')
    expect(mocks.toastError).toHaveBeenCalledTimes(1)
    expect(mocks.toastError).toHaveBeenCalledWith('Could not attach the markup screenshot.')
  })

  it('resets after a delivery that resolved', async () => {
    const { result } = await drawThenComplete(() => Promise.resolve())

    expect(result.current.state).toBe('idle')
  })
})

describe('send to agent through the real capture hook', () => {
  async function run(onSendToAgent: BrowserRendererHost['onSendToAgent']) {
    const host: BrowserRendererHost = { t: (_key, fallback) => fallback, onSendToAgent }
    const wrapper = ({ children }: { children: ReactNode }) => (
      <BrowserRendererHostContext.Provider value={host}>
        {children}
      </BrowserRendererHostContext.Provider>
    )
    const webview = {
      getBoundingClientRect: () => ({ width: 10, height: 10 })
    } as unknown as Electron.WebviewTag
    const hook = renderHook(
      () =>
        useBrowserPageMarkupCapture({ current: webview }, { url: 'https://a.com/', title: 'A' }),
      { wrapper }
    )
    await act(async () => {
      await hook.result.current.start()
    })
    await act(async () => {
      await hook.result.current.complete({ imageElement: {} as CanvasImageSource, shapes: [] })
    })
    return hook
  }

  it('keeps the drawing and shows exactly one error when the send fails', async () => {
    const { result } = await run(() => Promise.reject(new Error('x')))

    expect(result.current.state).toBe('drawing')
    expect(result.current.baseImage).not.toBeNull()
    expect(mocks.toastError).toHaveBeenCalledTimes(1)
    expect(mocks.toastError).toHaveBeenCalledWith('Could not send to agent')
  })

  it('keeps the drawing and shows no toast when the send is canceled', async () => {
    const abort = new Error('canceled')
    abort.name = 'AbortError'
    const { result } = await run(() => Promise.reject(abort))

    expect(result.current.state).toBe('drawing')
    expect(mocks.toastError).not.toHaveBeenCalled()
  })

  it('closes the markup after a successful send', async () => {
    const { result } = await run(() => Promise.resolve())

    expect(result.current.state).toBe('idle')
  })
})
