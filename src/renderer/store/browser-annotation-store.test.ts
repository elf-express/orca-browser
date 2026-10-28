import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GRAB_BUDGET } from '../../shared/browser-grab-types'
import { buildAnnotationAgentPayload } from '../components/browser-pane/annotate/browser-agent-send'
import { makeAnnotation } from './browser-annotation-test-fixture'
import { useBrowserAnnotationStore } from './browser-annotation-store'

function state() {
  return useBrowserAnnotationStore.getState()
}

function createAnnotatedPage() {
  const pageId = 'p1'
  state().addBrowserPageAnnotation(makeAnnotation(pageId))
  return { pageId }
}

beforeEach(() => {
  useBrowserAnnotationStore.setState({
    browserAnnotationsByPageId: {},
    browserAnnotationMarkerIdsByPageId: {}
  })
})

describe('saved browser note lifetime and marker eligibility', () => {
  it('retires same-URL geometry without changing the saved array or object references', () => {
    const { pageId } = createAnnotatedPage()
    const saved = state().browserAnnotationsByPageId[pageId]
    const note = saved[0]
    expect(state().browserAnnotationMarkerIdsByPageId[pageId]).toEqual([note.id])

    state().invalidateBrowserPageAnnotationGeometry(pageId)

    expect(state().browserAnnotationsByPageId[pageId]).toBe(saved)
    expect(state().browserAnnotationsByPageId[pageId][0]).toBe(note)
    expect(state().browserAnnotationMarkerIdsByPageId[pageId]).toBeUndefined()
    const listener = vi.fn()
    const unsubscribe = useBrowserAnnotationStore.subscribe(listener)
    state().invalidateBrowserPageAnnotationGeometry(pageId)
    expect(listener).not.toHaveBeenCalled()
    unsubscribe()

    state().addBrowserPageAnnotation(makeAnnotation(pageId, 'fresh'))
    expect(state().browserAnnotationsByPageId[pageId][0]).toBe(note)
    expect(state().browserAnnotationMarkerIdsByPageId[pageId]).toEqual(['fresh'])
  })

  it('shares the 20-note budget across URLs and bounds marker IDs to retained notes', () => {
    const { pageId } = createAnnotatedPage()
    for (let index = 0; index < GRAB_BUDGET.annotationsMaxPerPage + 3; index++) {
      const url = `https://example.com/page-${index % 2}`
      // A URL change retires the previous document's marker eligibility.
      state().invalidateBrowserPageAnnotationGeometry(pageId)
      const note = makeAnnotation(pageId, `note-${index}`)
      note.payload.page.sanitizedUrl = url
      state().addBrowserPageAnnotation(note)
    }
    const saved = state().browserAnnotationsByPageId[pageId]
    const eligible = state().browserAnnotationMarkerIdsByPageId[pageId]
    expect(saved).toHaveLength(20)
    expect(saved[0].id).toBe('note-3')
    expect(new Set(saved.map((note) => note.payload.page.sanitizedUrl)).size).toBe(2)
    expect(eligible).toEqual(['note-22'])
    expect(eligible.every((id) => saved.some((note) => note.id === id))).toBe(true)

    state().deleteBrowserPageAnnotation(pageId, 'note-22')
    expect(state().browserAnnotationMarkerIdsByPageId[pageId]).toBeUndefined()
    state().clearBrowserPageAnnotations(pageId)
    expect(state().browserAnnotationsByPageId[pageId]).toBeUndefined()
    expect(state().browserAnnotationMarkerIdsByPageId[pageId]).toBeUndefined()
  })

  it('prunes eligible IDs when the oldest current-document notes are evicted', () => {
    const { pageId } = createAnnotatedPage()
    for (let index = 0; index < 22; index++) {
      state().addBrowserPageAnnotation(makeAnnotation(pageId, `note-${index}`))
    }
    expect(state().browserAnnotationMarkerIdsByPageId[pageId]).toEqual(
      state().browserAnnotationsByPageId[pageId].map((note) => note.id)
    )
    expect(state().browserAnnotationMarkerIdsByPageId[pageId]).toHaveLength(20)
  })

  it('removes an accepted delivery snapshot after navigation while preserving later edits and additions', async () => {
    const { pageId } = createAnnotatedPage()
    state().addBrowserPageAnnotation(makeAnnotation(pageId, 'edited'))
    const delivered = state().browserAnnotationsByPageId[pageId]
    let accept!: () => void
    const delivery = new Promise<void>((resolve) => {
      accept = resolve
    }).then(() => {
      state().removeDeliveredBrowserPageAnnotations(pageId, delivered)
    })
    state().invalidateBrowserPageAnnotationGeometry(pageId)
    state().updateBrowserPageAnnotation(pageId, 'edited', {
      comment: 'Edited while sending',
      intent: 'fix'
    })
    state().addBrowserPageAnnotation(makeAnnotation(pageId, 'fresh'))
    accept()
    await delivery

    const remaining = state().browserAnnotationsByPageId[pageId]
    expect(remaining.map((note) => note.id)).toEqual(['edited', 'fresh'])
    expect(remaining[0].comment).toBe('Edited while sending')
    expect(state().browserAnnotationMarkerIdsByPageId[pageId]).toEqual(['fresh'])
    state().removeDeliveredBrowserPageAnnotations(pageId, remaining)
    expect(state().browserAnnotationsByPageId[pageId]).toBeUndefined()
    expect(state().browserAnnotationMarkerIdsByPageId[pageId]).toBeUndefined()
  })
})

describe('browser annotation store lifecycle and sanitizing', () => {
  it('dispose removes page annotations', () => {
    state().addBrowserPageAnnotation(makeAnnotation('p1'))
    state().addBrowserPageAnnotation(makeAnnotation('p2'))

    state().disposeBrowserPageAnnotations('p1')

    expect(state().browserAnnotationsByPageId.p1).toBeUndefined()
    expect(state().browserAnnotationMarkerIdsByPageId.p1).toBeUndefined()
    expect(state().browserAnnotationsByPageId.p2).toHaveLength(1)
  })

  it('saved annotation drops screenshot', () => {
    const annotation = makeAnnotation('p1')
    Object.assign(annotation.payload, {
      screenshot: {
        mimeType: 'image/png',
        dataUrl: 'data:image/png;base64,QQ==',
        width: 10,
        height: 10
      }
    })

    state().addBrowserPageAnnotation(annotation)

    expect(state().browserAnnotationsByPageId.p1[0].payload.screenshot).toBeNull()
  })

  it('truncates an over-long comment to the annotation budget', () => {
    const annotation = makeAnnotation('p1')
    annotation.comment = 'x'.repeat(GRAB_BUDGET.annotationCommentMaxLength + 50)

    state().addBrowserPageAnnotation(annotation)

    expect(state().browserAnnotationsByPageId.p1[0].comment).toHaveLength(
      GRAB_BUDGET.annotationCommentMaxLength
    )
  })

  it('strips URL queries from a stored annotation so the agent text never carries a token', () => {
    const annotation = makeAnnotation('p1')
    annotation.payload.page.sanitizedUrl = 'https://example.com/account?token=x#frag'

    state().addBrowserPageAnnotation(annotation)

    const saved = state().browserAnnotationsByPageId.p1
    expect(saved[0].payload.page.sanitizedUrl).toBe('https://example.com/account')
    const payload = buildAnnotationAgentPayload(saved)
    expect(payload?.text).not.toContain('token=x')
    expect(payload?.text).not.toContain('frag')
    expect(payload?.pageUrl).toBe('https://example.com/account')
  })

  it('keeps a stored URL query out of text after an update patch too', () => {
    const annotation = makeAnnotation('p1')
    annotation.payload.page.sanitizedUrl = 'https://example.com/?token=x'
    state().addBrowserPageAnnotation(annotation)

    state().updateBrowserPageAnnotation('p1', annotation.id, { comment: 'Edited', intent: 'fix' })

    const payload = buildAnnotationAgentPayload(state().browserAnnotationsByPageId.p1)
    expect(payload?.text).not.toContain('token=x')
  })
})
