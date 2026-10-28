// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserAgentPayload } from '../../../../shared/agent-payload'
import type { BrowserPageAnnotation } from '../../../../shared/browser-grab-types'
import { BrowserRendererHostContext, type BrowserRendererHost } from '../../../host-context'
import { useBrowserAnnotationStore } from '../../../store/browser-annotation-store'
import { makeAnnotation } from '../../../store/browser-annotation-test-fixture'
import { useBrowserPageAnnotationSend } from './use-browser-page-annotation-send'

const toastError = vi.hoisted(() => vi.fn())
vi.mock('sonner', () => ({ toast: { error: toastError } }))

let onSendToAgent: BrowserRendererHost['onSendToAgent']

function hostWrapper({ children }: { children: ReactNode }) {
  const host: BrowserRendererHost = {
    t: (_key, fallback) => fallback,
    onSendToAgent: onSendToAgent ? (payload) => onSendToAgent!(payload) : undefined
  }
  return (
    <BrowserRendererHostContext.Provider value={host}>
      {children}
    </BrowserRendererHostContext.Provider>
  )
}

function note(pageId: string, id: string, comment: string): BrowserPageAnnotation {
  return { ...makeAnnotation(pageId, id), comment }
}

function notes(page = 'page-1'): BrowserPageAnnotation[] {
  return useBrowserAnnotationStore.getState().browserAnnotationsByPageId[page] ?? []
}

function mount() {
  return renderHook(
    () => useBrowserPageAnnotationSend({ browserTabId: 'page-1', scopeId: 'scope-1' }),
    { wrapper: hostWrapper }
  )
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept
    reject = fail
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  useBrowserAnnotationStore.setState({
    browserAnnotationsByPageId: {},
    browserAnnotationMarkerIdsByPageId: {}
  })
  const store = useBrowserAnnotationStore.getState()
  store.addBrowserPageAnnotation(note('page-1', 'a', 'Comment A'))
  store.addBrowserPageAnnotation(note('page-1', 'b', 'Comment B'))
  store.addBrowserPageAnnotation(note('page-2', 'other', 'Other page'))
  onSendToAgent = undefined
  toastError.mockReset()
})
afterEach(() => {
  cleanup()
  Reflect.deleteProperty(window, 'browserAPI')
})

describe('website annotation delivery', () => {
  it('removes only delivered annotations after send', async () => {
    const sent: BrowserAgentPayload[] = []
    onSendToAgent = async (payload) => {
      sent.push(payload)
    }
    const view = mount()

    await act(async () => {
      await view.result.current.handleSendBrowserAnnotationsToAgent?.()
    })
    expect(notes()).toEqual([])
    expect(notes('page-2')).toHaveLength(1)

    act(() => {
      useBrowserAnnotationStore
        .getState()
        .addBrowserPageAnnotation(note('page-1', 'c', 'Comment C'))
    })
    await act(async () => {
      await view.result.current.handleSendBrowserAnnotationsToAgent?.()
    })

    expect(sent).toHaveLength(2)
    expect(sent[0].kind).toBe('annotation')
    expect(sent[1].text).toContain('Comment C')
    expect(sent[1].text).not.toContain('Comment A')
    expect(notes()).toEqual([])
  })

  it('keeps annotations when onSendToAgent rejects', async () => {
    onSendToAgent = vi.fn().mockRejectedValue(new Error('upload failed'))
    const view = mount()

    await act(async () => {
      await view.result.current.handleSendBrowserAnnotationsToAgent?.()
    })

    expect(notes().map((entry) => entry.id)).toEqual(['a', 'b'])
    expect(toastError).toHaveBeenCalledTimes(1)
    expect(toastError).toHaveBeenCalledWith('Could not send to agent')
    expect(view.result.current.browserAnnotationsSending).toBe(false)
  })

  it('keeps annotations silently when the send is canceled', async () => {
    onSendToAgent = vi.fn().mockRejectedValue(new DOMException('canceled', 'AbortError'))
    const view = mount()

    await act(async () => {
      await view.result.current.handleSendBrowserAnnotationsToAgent?.()
    })

    expect(notes().map((entry) => entry.id)).toEqual(['a', 'b'])
    expect(toastError).not.toHaveBeenCalled()
  })

  it('has no send handler when the host does not provide onSendToAgent', () => {
    const view = mount()
    expect(view.result.current.handleSendBrowserAnnotationsToAgent).toBeNull()
  })

  it('disables sending while a send is in flight and ignores a second trigger', async () => {
    const pending = deferred<void>()
    const send = vi.fn(() => pending.promise)
    onSendToAgent = send
    const view = mount()

    let first!: Promise<void>
    act(() => {
      first = view.result.current.handleSendBrowserAnnotationsToAgent!()
    })
    expect(view.result.current.browserAnnotationsSending).toBe(true)
    await act(async () => {
      await view.result.current.handleSendBrowserAnnotationsToAgent?.()
    })
    expect(send).toHaveBeenCalledTimes(1)
    expect(notes()).toHaveLength(2)

    await act(async () => {
      pending.resolve()
      await first
    })
    expect(view.result.current.browserAnnotationsSending).toBe(false)
    expect(notes()).toEqual([])
  })

  it('keeps notes added or replaced while the send is on its way', async () => {
    const pending = deferred<void>()
    onSendToAgent = () => pending.promise
    const view = mount()

    let delivery!: Promise<void>
    act(() => {
      delivery = view.result.current.handleSendBrowserAnnotationsToAgent!()
    })
    act(() => {
      const store = useBrowserAnnotationStore.getState()
      store.clearBrowserPageAnnotations('page-1')
      store.addBrowserPageAnnotation(note('page-1', 'a', 'Comment A'))
    })
    await act(async () => {
      pending.resolve()
      await delivery
    })

    expect(notes().map((entry) => entry.id)).toEqual(['a'])
  })

  it('preserves later notes when a send finishes after unmount', async () => {
    const pending = deferred<void>()
    onSendToAgent = () => pending.promise
    const view = mount()

    let delivery!: Promise<void>
    act(() => {
      delivery = view.result.current.handleSendBrowserAnnotationsToAgent!()
    })
    act(() => {
      useBrowserAnnotationStore.getState().addBrowserPageAnnotation(note('page-1', 'new', 'Later'))
    })
    view.unmount()
    await act(async () => {
      pending.resolve()
      await delivery
    })

    expect(notes().map((entry) => entry.id)).toEqual(['new'])
  })
})

describe('website annotation clipboard and clearing', () => {
  it('keeps copied notes until delivery is acknowledged', () => {
    const writeClipboardText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(window, 'browserAPI', {
      configurable: true,
      value: { writeClipboardText }
    })
    const view = mount()

    act(() => view.result.current.handleCopyBrowserAnnotations())

    expect(writeClipboardText).toHaveBeenCalledWith(expect.stringContaining('Comment A'))
    expect(notes()).toHaveLength(2)
  })

  it('supports Clear all', () => {
    const view = mount()
    act(() => view.result.current.handleClearBrowserAnnotations())
    expect(notes()).toEqual([])
    expect(notes('page-2')).toHaveLength(1)
  })
})
