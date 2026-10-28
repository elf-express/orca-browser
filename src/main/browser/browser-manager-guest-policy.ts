import type { PopupOwnerContext } from './browser-manager-types'
import { BrowserManagerGuestCleanup } from './browser-manager-guest-cleanup'

export abstract class BrowserManagerGuestPolicy extends BrowserManagerGuestCleanup {
  attachGuestPolicies(
    guest: Electron.WebContents,
    inheritedOwnerContext: PopupOwnerContext | null = null
  ): void {
    if (this.policyAttachedGuestIds.has(guest.id)) {
      return
    }
    this.policyAttachedGuestIds.add(guest.id)
    if (inheritedOwnerContext) {
      this.popupOwnerContextByGuestId.set(guest.id, inheritedOwnerContext)
    }
    const disposeDetachTracking = this.trackDebuggerDetachForCdpOverrides(guest)
    // Why: disable throttling so background screenshots still get frames; else the compositor stalls and capture returns empty.
    guest.setBackgroundThrottling(false)
    const disposePopupPolicy = this.installGuestPopupPolicy(guest)
    const disposeNavigationPolicy = this.installGuestNavigationPolicy(guest)

    // Why: store cleanup so unregisterGuest can drop these listeners on teardown and let the WebContents wrapper GC.
    this.policyCleanupByGuestId.set(guest.id, () => {
      disposeDetachTracking()
      disposePopupPolicy()
      disposeNavigationPolicy()
    })
  }
}
