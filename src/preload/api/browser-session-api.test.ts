import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn()
}))

vi.mock('electron', () => ({
  ipcRenderer: { invoke: mocks.invoke, on: mocks.on, removeListener: mocks.removeListener }
}))

import { createBrowserApi } from '../browser-api'

beforeEach(() => {
  mocks.invoke.mockReset()
})

describe('browser session preload api', () => {
  it('invokes importFromBrowser over its channel', async () => {
    const args = { profileId: 'p1', browserFamily: 'chrome', browserProfile: 'Default' }

    await createBrowserApi().session.importFromBrowser(args)

    expect(mocks.invoke).toHaveBeenCalledWith('browser:session:importFromBrowser', args)
  })

  it.each([
    ['listProfiles', 'browser:session:listProfiles', undefined],
    ['createProfile', 'browser:session:createProfile', { scope: 'isolated', label: 'x' }],
    ['deleteProfile', 'browser:session:deleteProfile', { profileId: 'p1' }],
    ['importCookies', 'browser:session:importCookies', { profileId: 'p1' }],
    ['detectBrowsers', 'browser:session:detectBrowsers', undefined],
    ['resolvePartition', 'browser:session:resolvePartition', { profileId: null }],
    ['clearDefaultCookies', 'browser:session:clearDefaultCookies', undefined]
  ] as const)('session.%s uses %s', async (method, channel, args) => {
    const session = createBrowserApi().session as unknown as Record<
      string,
      (a?: unknown) => unknown
    >

    await session[method](args)

    expect(mocks.invoke).toHaveBeenCalledWith(...(args === undefined ? [channel] : [channel, args]))
  })

  it('invokes identity get and set', async () => {
    await createBrowserApi().identity.get()
    await createBrowserApi().identity.set('native')

    expect(mocks.invoke).toHaveBeenCalledWith('browser:identity:get')
    expect(mocks.invoke).toHaveBeenCalledWith('browser:identity:set', 'native')
  })

  it('invokes settings get and set', async () => {
    const patch = { searchEngine: 'bing' as const }

    await createBrowserApi().settings.get()
    await createBrowserApi().settings.set(patch)

    expect(mocks.invoke).toHaveBeenCalledWith('browser:settings:get')
    expect(mocks.invoke).toHaveBeenCalledWith('browser:settings:set', patch)
  })

  it('invokes setViewportOverride over its channel', async () => {
    const args = { browserPageId: 'p1', override: null }

    await createBrowserApi().setViewportOverride(args)

    expect(mocks.invoke).toHaveBeenCalledWith('browser:setViewportOverride', args)
  })
})
