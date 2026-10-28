import { useEffect, useState } from 'react'
import { formatPermissionNotice, formatPopupNotice } from './browser-notices'

export function useBrowserPageResourceNotices(browserTabId: string): {
  resourceNotice: string | null
  setResourceNotice: React.Dispatch<React.SetStateAction<string | null>>
} {
  const [resourceNotice, setResourceNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!resourceNotice) {
      return
    }
    const timer = setTimeout(() => setResourceNotice(null), 10_000)
    return () => clearTimeout(timer)
  }, [resourceNotice])

  useEffect(() => {
    return window.browserAPI!.onPermissionDenied((event) => {
      if (event.browserPageId !== browserTabId) {
        return
      }
      setResourceNotice(formatPermissionNotice(event))
    })
  }, [browserTabId])

  useEffect(() => {
    return window.browserAPI!.onPopup((event) => {
      if (event.browserPageId !== browserTabId) {
        return
      }
      const notice = formatPopupNotice(event)
      if (notice) {
        setResourceNotice(notice)
      }
    })
  }, [browserTabId])

  return { resourceNotice, setResourceNotice }
}
