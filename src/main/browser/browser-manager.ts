import { BrowserManagerFinal } from './browser-manager-final'

export type { BrowserGuestRegistration } from './browser-manager-types'

/**
 * Privileged browser guest facade. Behavior is organized by lifecycle concern in the focused
 * manager modules while this module keeps the stable import surface used by main and renderer code.
 */
export class BrowserManager extends BrowserManagerFinal {}

export const browserManager = new BrowserManager()
