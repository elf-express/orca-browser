import { renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { BrowserGrabPayload } from '../../../../shared/browser-grab-types'
import { makeAnnotation } from '../../../store/browser-annotation-test-fixture'
import { BrowserRendererHostContext, type BrowserRendererHost } from '../../../host-context'
import { clampGrabPayload } from '../../../../main/browser/browser-grab-payload'
import { useBrowserAnnotationStore } from '../../../store/browser-annotation-store'
import { formatBrowserAnnotationsAsMarkdown } from './browser-annotation-output'
import {
  buildAnnotationAgentPayload,
  buildGrabAgentPayload,
  buildMarkupAgentPayload,
  formatMarkupAsText,
  isSendToAgentCanceled,
  useSendToAgent
} from './browser-agent-send'
import { formatGrabPayloadAsText } from './GrabConfirmationSheet'
import type { MarkupComposeResult } from './markup-screenshot-compose'

function makeGrabPayload(overrides?: Partial<BrowserGrabPayload>): BrowserGrabPayload {
  return {
    page: {
      sanitizedUrl: 'https://example.com/',
      title: 'Example',
      viewportWidth: 1280,
      viewportHeight: 720,
      scrollX: 0,
      scrollY: 0,
      devicePixelRatio: 1,
      capturedAt: '2026-04-10T00:00:00.000Z'
    },
    target: {
      tagName: 'button',
      selector: 'button',
      textSnippet: 'Go',
      htmlSnippet: '<button>Go</button>',
      attributes: {},
      accessibility: {
        role: 'button',
        accessibleName: 'Go',
        ariaLabel: null,
        ariaLabelledBy: null
      },
      rectViewport: { x: 0, y: 0, width: 100, height: 40 },
      rectPage: { x: 0, y: 0, width: 100, height: 40 },
      computedStyles: {
        display: 'inline-flex',
        position: 'static',
        width: '100px',
        height: '40px',
        margin: '0px',
        padding: '0px',
        color: 'rgb(0, 0, 0)',
        backgroundColor: 'rgba(0, 0, 0, 0)',
        border: '0px none',
        borderRadius: '0px',
        fontFamily: 'Geist',
        fontSize: '14px',
        fontWeight: '400',
        lineHeight: '20px',
        textAlign: 'center',
        zIndex: 'auto'
      }
    },
    nearbyText: [],
    ancestorPath: [],
    screenshot: null,
    ...overrides
  }
}

const composeResult: MarkupComposeResult = {
  dataUrl: 'data:image/png;base64,QQ==',
  mimeType: 'image/png',
  width: 800,
  height: 600,
  byteLength: 4
}

function hostWrapper(host: BrowserRendererHost) {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrowserRendererHostContext.Provider, { value: host }, children)
}

describe('buildGrabAgentPayload', () => {
  it('grab payload uses Orca text format', () => {
    const fixture = makeGrabPayload()
    const payload = buildGrabAgentPayload(fixture)
    expect(payload.text.startsWith('Attached browser context from https://example.com/')).toBe(true)
    expect(payload.text).toBe(formatGrabPayloadAsText(fixture))
    expect(payload.kind).toBe('grab')
    expect(payload.images.length).toBe(0)
  })

  it('grab payload attaches png screenshot', () => {
    const fixture = makeGrabPayload({
      screenshot: {
        mimeType: 'image/png',
        dataUrl: 'data:image/png;base64,QQ==',
        width: 1,
        height: 1
      }
    })
    expect(buildGrabAgentPayload(fixture).images).toEqual([
      { name: 'browser-grab.png', mimeType: 'image/png', dataBase64: 'QQ==' }
    ])
  })
})

describe('buildAnnotationAgentPayload', () => {
  it('annotation payload is null when empty', () => {
    expect(buildAnnotationAgentPayload([])).toBeNull()
  })

  it('annotation payload uses markdown output', () => {
    const list = [makeAnnotation('page-1')]
    const payload = buildAnnotationAgentPayload(list)
    expect(payload).not.toBeNull()
    expect(payload!.kind).toBe('annotation')
    expect(payload!.text.startsWith('## Design Feedback: /')).toBe(true)
    expect(payload!.text).toBe(formatBrowserAnnotationsAsMarkdown(list))
    expect(payload!.images).toEqual([])
    expect(payload!.pageUrl).toBe('https://example.com/')
    expect(payload!.pageTitle).toBe('Example')
  })
})

describe('markup payload', () => {
  it('markup payload text', () => {
    expect(formatMarkupAsText({ pageUrl: 'https://a.com/x', width: 800, height: 600 })).toBe(
      'Screenshot markup from https://a.com/x\n\nImage: browser-markup.png (800x600)'
    )
  })

  it('omits the source when the page url is empty', () => {
    expect(formatMarkupAsText({ pageUrl: '', width: 8, height: 6 })).toBe(
      'Screenshot markup\n\nImage: browser-markup.png (8x6)'
    )
  })

  it('markup payload pageUrl drops query', () => {
    const payload = buildMarkupAgentPayload({
      pageUrl: 'https://a.com/x?t=1',
      pageTitle: 'A',
      result: composeResult
    })
    expect(payload.pageUrl).toBe('https://a.com/x')
    expect(payload.text).not.toContain('t=1')
    expect(payload.kind).toBe('markup')
    expect(payload.images).toEqual([
      { name: 'browser-markup.png', mimeType: 'image/png', dataBase64: 'QQ==' }
    ])
  })
})

describe('send helpers', () => {
  it('useSendToAgent awaits the host', async () => {
    const error = new Error('boom')
    const host: BrowserRendererHost = {
      t: (_key, fallback) => fallback,
      onSendToAgent: vi.fn(() => Promise.reject(error))
    }
    const { result } = renderHook(() => useSendToAgent(), { wrapper: hostWrapper(host) })
    expect(result.current).not.toBeNull()
    const payload = buildMarkupAgentPayload({
      pageUrl: 'https://a.com/',
      pageTitle: 'A',
      result: composeResult
    })
    await expect(result.current!(payload)).rejects.toBe(error)
    expect(isSendToAgentCanceled(new DOMException('x', 'AbortError'))).toBe(true)
    expect(isSendToAgentCanceled(new Error('x'))).toBe(false)
  })

  it('useSendToAgent is null without onSendToAgent', () => {
    const host: BrowserRendererHost = { t: (_key, fallback) => fallback }
    const { result } = renderHook(() => useSendToAgent(), { wrapper: hostWrapper(host) })
    expect(result.current).toBeNull()
  })
})

describe('payloads built from a page URL with credentials', () => {
  const credentialUrl = 'https://alice:hunter2@example.com/account?t=1'

  it('grab payload from the clamped page has no credentials in pageUrl or text', () => {
    const raw = makeGrabPayload()
    const clamped = clampGrabPayload({
      ...raw,
      page: { ...raw.page, sanitizedUrl: credentialUrl }
    })
    expect(clamped).not.toBeNull()
    const payload = buildGrabAgentPayload(clamped as unknown as BrowserGrabPayload)
    expect(payload.pageUrl).toBe('https://example.com/account')
    expect(payload.text).not.toContain('alice')
    expect(payload.text).not.toContain('hunter2')
  })

  it('annotation payload from a stored note has no credentials in pageUrl or text', () => {
    useBrowserAnnotationStore.setState({
      browserAnnotationsByPageId: {},
      browserAnnotationMarkerIdsByPageId: {}
    })
    const annotation = makeAnnotation('page-1')
    annotation.payload.page.sanitizedUrl = credentialUrl
    useBrowserAnnotationStore.getState().addBrowserPageAnnotation(annotation)
    const payload = buildAnnotationAgentPayload(
      useBrowserAnnotationStore.getState().browserAnnotationsByPageId['page-1']
    )
    expect(payload?.pageUrl).toBe('https://example.com/account')
    expect(payload?.text).not.toContain('alice')
    expect(payload?.text).not.toContain('hunter2')
  })
})
