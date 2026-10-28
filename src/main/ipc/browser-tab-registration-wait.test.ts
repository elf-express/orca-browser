import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getWebContentsIdByTabId: vi.fn(() => new Map<string, number>()),
  getScopeIdForTab: vi.fn(() => undefined as string | undefined),
  getGuestWebContentsId: vi.fn(() => null as number | null),
  webContentsFromId: vi.fn(() => null as unknown)
}))

vi.mock('electron', () => ({ webContents: { fromId: mocks.webContentsFromId } }))
vi.mock('../browser/browser-manager', () => ({
  browserManager: {
    getWebContentsIdByTabId: mocks.getWebContentsIdByTabId,
    getScopeIdForTab: mocks.getScopeIdForTab,
    getGuestWebContentsId: mocks.getGuestWebContentsId
  }
}))

import {
  resolveTabRegistrationWaiters,
  waitForAnyTabRegistration,
  waitForNextTabRegistration,
  waitForScopeTabRegistration
} from './browser-tab-registration-wait'

const WAIT_MS = 1_000

/** Whether a wait has settled, without letting its rejection escape as an unhandled one. */
function track(pending: Promise<void>): () => 'pending' | 'resolved' | 'rejected' {
  let state: 'pending' | 'resolved' | 'rejected' = 'pending'
  pending.then(
    () => {
      state = 'resolved'
    },
    () => {
      state = 'rejected'
    }
  )
  return () => state
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getWebContentsIdByTabId.mockReturnValue(new Map())
  mocks.getGuestWebContentsId.mockReturnValue(null)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('tab registration waits', () => {
  it('settles a wait that names its page when that page registers', async () => {
    const settled = track(waitForNextTabRegistration('page-1', WAIT_MS))

    resolveTabRegistrationWaiters('page-1', 'scope-1')
    await vi.advanceTimersByTimeAsync(0)

    expect(settled()).toBe('resolved')
  })

  it('leaves a scope wait pending when a page in another scope registers', async () => {
    const scopeWait = track(waitForScopeTabRegistration('scope-1', WAIT_MS))

    resolveTabRegistrationWaiters('page-2', 'scope-2')
    await vi.advanceTimersByTimeAsync(0)
    expect(scopeWait()).toBe('pending')

    // The presence half: a wait nobody satisfies must still time out.
    await vi.advanceTimersByTimeAsync(WAIT_MS)
    expect(scopeWait()).toBe('rejected')
  })

  it('settles a scope wait when a page in that scope registers', async () => {
    const scopeWait = track(waitForScopeTabRegistration('scope-1', WAIT_MS))

    resolveTabRegistrationWaiters('page-3', 'scope-1')
    await vi.advanceTimersByTimeAsync(0)

    expect(scopeWait()).toBe('resolved')
  })

  it('settles an any-tab wait when any page registers', async () => {
    const anyWait = track(waitForAnyTabRegistration(WAIT_MS))

    resolveTabRegistrationWaiters('page-4', 'scope-9')
    await vi.advanceTimersByTimeAsync(0)

    expect(anyWait()).toBe('resolved')
  })
})
