import { useCallback, useEffect, useRef, useState } from 'react'
import {
  browserPageZoomLevelToPercent,
  DEFAULT_BROWSER_PAGE_ZOOM_LEVEL,
  getExplicitBrowserPageZoomLevel
} from './browser-page-zoom'

const BROWSER_PAGE_ZOOM_FEEDBACK_MS = 1400

const noopSetDefaultZoomLevel = (): void => {}

export function useBrowserPageZoomFeedback(browserTabId: string): {
  paneZoomLevelRef: React.MutableRefObject<number>
  browserZoomPercent: number
  setBrowserZoomPercent: React.Dispatch<React.SetStateAction<number>>
  browserZoomFeedbackVisible: boolean
  showBrowserZoomFeedback: (level: number) => void
  browserDefaultZoomPercent: number
  setBrowserDefaultZoomLevel: (level: number) => void
} {
  const browserDefaultZoomPercent = browserPageZoomLevelToPercent(DEFAULT_BROWSER_PAGE_ZOOM_LEVEL)
  // The level THIS pane should hold. The guest outlives the pane, so a remount re-reads the level
  // the user explicitly chose instead of falling back to the default.
  const [initialZoomLevel] = useState(
    () => getExplicitBrowserPageZoomLevel(browserTabId) ?? DEFAULT_BROWSER_PAGE_ZOOM_LEVEL
  )
  const paneZoomLevelRef = useRef<number>(initialZoomLevel)
  const [browserZoomPercent, setBrowserZoomPercent] = useState(
    browserPageZoomLevelToPercent(initialZoomLevel)
  )
  const [browserZoomFeedbackVisible, setBrowserZoomFeedbackVisible] = useState(false)
  const browserZoomFeedbackTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => {
    return () => {
      clearTimeout(browserZoomFeedbackTimerRef.current)
    }
  }, [])
  const showBrowserZoomFeedback = useCallback((level: number): void => {
    setBrowserZoomPercent(browserPageZoomLevelToPercent(level))
    setBrowserZoomFeedbackVisible(true)
    clearTimeout(browserZoomFeedbackTimerRef.current)
    browserZoomFeedbackTimerRef.current = setTimeout(() => {
      setBrowserZoomFeedbackVisible(false)
    }, BROWSER_PAGE_ZOOM_FEEDBACK_MS)
  }, [])

  return {
    paneZoomLevelRef,
    browserZoomPercent,
    setBrowserZoomPercent,
    browserZoomFeedbackVisible,
    showBrowserZoomFeedback,
    browserDefaultZoomPercent,
    setBrowserDefaultZoomLevel: noopSetDefaultZoomLevel
  }
}
