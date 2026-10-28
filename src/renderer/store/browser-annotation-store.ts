import { create } from 'zustand'
import { sanitizeAgentPageUrl } from '../../shared/agent-payload'
import {
  GRAB_BUDGET,
  type BrowserAnnotationIntent,
  type BrowserPageAnnotation
} from '../../shared/browser-grab-types'

export interface BrowserAnnotationStoreState {
  browserAnnotationsByPageId: Record<string, BrowserPageAnnotation[]>
  /** Annotation ids whose geometry still belongs to the page's current document. */
  browserAnnotationMarkerIdsByPageId: Record<string, string[]>

  addBrowserPageAnnotation: (annotation: BrowserPageAnnotation) => void
  updateBrowserPageAnnotation: (
    pageId: string,
    annotationId: string,
    patch: { comment: string; intent: BrowserAnnotationIntent }
  ) => void
  deleteBrowserPageAnnotation: (pageId: string, annotationId: string) => void
  clearBrowserPageAnnotations: (pageId: string) => void
  invalidateBrowserPageAnnotationGeometry: (pageId: string) => void
  removeDeliveredBrowserPageAnnotations: (
    pageId: string,
    deliveredAnnotations: readonly BrowserPageAnnotation[]
  ) => void
  disposeBrowserPageAnnotations: (pageId: string) => void
}

export function sanitizeBrowserPageAnnotation(
  annotation: BrowserPageAnnotation
): BrowserPageAnnotation {
  return {
    ...annotation,
    comment:
      annotation.comment.length > GRAB_BUDGET.annotationCommentMaxLength
        ? annotation.comment.slice(0, GRAB_BUDGET.annotationCommentMaxLength)
        : annotation.comment,
    payload: {
      ...annotation.payload,
      page: {
        ...annotation.payload.page,
        // The agent text embeds this URL, so a stored note never keeps a query or fragment.
        sanitizedUrl: sanitizeAgentPageUrl(annotation.payload.page.sanitizedUrl)
      },
      // Saved notes must not retain transient screenshot bytes.
      screenshot: null
    }
  }
}

export function retainBrowserAnnotationMarkerIds(
  markersByPageId: Record<string, string[]>,
  pageId: string,
  annotations: readonly BrowserPageAnnotation[],
  addedId?: string
): Record<string, string[]> {
  const existingIds = markersByPageId[pageId] ?? []
  const retainedIds = new Set(annotations.map((annotation) => annotation.id))
  const nextIds = [...new Set(addedId ? [...existingIds, addedId] : existingIds)].filter((id) =>
    retainedIds.has(id)
  )
  if (nextIds.length === existingIds.length && nextIds.every((id, i) => id === existingIds[i])) {
    return markersByPageId
  }
  const nextByPageId = { ...markersByPageId }
  if (nextIds.length > 0) {
    nextByPageId[pageId] = nextIds
  } else {
    delete nextByPageId[pageId]
  }
  return nextByPageId
}

function omitPageKey<T>(record: Record<string, T>, pageId: string): Record<string, T> {
  if (!Object.hasOwn(record, pageId)) {
    return record
  }
  const next = { ...record }
  delete next[pageId]
  return next
}

export const useBrowserAnnotationStore = create<BrowserAnnotationStoreState>()((set) => ({
  browserAnnotationsByPageId: {},
  browserAnnotationMarkerIdsByPageId: {},

  addBrowserPageAnnotation: (annotation) =>
    set((s) => {
      const existing = s.browserAnnotationsByPageId[annotation.browserPageId] ?? []
      const next = [...existing, sanitizeBrowserPageAnnotation(annotation)].slice(
        -GRAB_BUDGET.annotationsMaxPerPage
      )
      return {
        browserAnnotationsByPageId: {
          ...s.browserAnnotationsByPageId,
          [annotation.browserPageId]: next
        },
        browserAnnotationMarkerIdsByPageId: retainBrowserAnnotationMarkerIds(
          s.browserAnnotationMarkerIdsByPageId,
          annotation.browserPageId,
          next,
          annotation.id
        )
      }
    }),

  updateBrowserPageAnnotation: (pageId, annotationId, patch) =>
    set((s) => {
      const existing = s.browserAnnotationsByPageId[pageId] ?? []
      const target = existing.find((annotation) => annotation.id === annotationId)
      if (!target) {
        return s
      }
      const updated = sanitizeBrowserPageAnnotation({ ...target, ...patch })
      return {
        browserAnnotationsByPageId: {
          ...s.browserAnnotationsByPageId,
          [pageId]: existing.map((annotation) =>
            annotation.id === annotationId ? updated : annotation
          )
        }
      }
    }),

  deleteBrowserPageAnnotation: (pageId, annotationId) =>
    set((s) => {
      const existing = s.browserAnnotationsByPageId[pageId] ?? []
      const next = existing.filter((annotation) => annotation.id !== annotationId)
      if (next.length === existing.length) {
        return s
      }
      const nextByPageId = { ...s.browserAnnotationsByPageId }
      if (next.length > 0) {
        nextByPageId[pageId] = next
      } else {
        delete nextByPageId[pageId]
      }
      return {
        browserAnnotationsByPageId: nextByPageId,
        browserAnnotationMarkerIdsByPageId: retainBrowserAnnotationMarkerIds(
          s.browserAnnotationMarkerIdsByPageId,
          pageId,
          next
        )
      }
    }),

  clearBrowserPageAnnotations: (pageId) =>
    set((s) => {
      const notes = omitPageKey(s.browserAnnotationsByPageId, pageId)
      const markers = omitPageKey(s.browserAnnotationMarkerIdsByPageId, pageId)
      if (
        notes === s.browserAnnotationsByPageId &&
        markers === s.browserAnnotationMarkerIdsByPageId
      ) {
        return s
      }
      return { browserAnnotationsByPageId: notes, browserAnnotationMarkerIdsByPageId: markers }
    }),

  invalidateBrowserPageAnnotationGeometry: (pageId) =>
    set((s) => {
      const markers = omitPageKey(s.browserAnnotationMarkerIdsByPageId, pageId)
      return markers === s.browserAnnotationMarkerIdsByPageId
        ? s
        : { browserAnnotationMarkerIdsByPageId: markers }
    }),

  // Identity matching preserves edits and additions made during delivery.
  removeDeliveredBrowserPageAnnotations: (pageId, deliveredAnnotations) =>
    set((s) => {
      const existing = s.browserAnnotationsByPageId[pageId] ?? []
      const delivered = new Set(deliveredAnnotations)
      const remaining = existing.filter((note) => !delivered.has(note))
      if (remaining.length === existing.length) {
        return s
      }
      const nextByPageId = { ...s.browserAnnotationsByPageId }
      if (remaining.length > 0) {
        nextByPageId[pageId] = remaining
      } else {
        delete nextByPageId[pageId]
      }
      return {
        browserAnnotationsByPageId: nextByPageId,
        browserAnnotationMarkerIdsByPageId: retainBrowserAnnotationMarkerIds(
          s.browserAnnotationMarkerIdsByPageId,
          pageId,
          remaining
        )
      }
    }),

  disposeBrowserPageAnnotations: (pageId) =>
    set((s) => {
      const notes = omitPageKey(s.browserAnnotationsByPageId, pageId)
      const markers = omitPageKey(s.browserAnnotationMarkerIdsByPageId, pageId)
      if (
        notes === s.browserAnnotationsByPageId &&
        markers === s.browserAnnotationMarkerIdsByPageId
      ) {
        return s
      }
      return { browserAnnotationsByPageId: notes, browserAnnotationMarkerIdsByPageId: markers }
    })
}))
