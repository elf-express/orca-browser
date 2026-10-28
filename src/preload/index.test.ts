import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { exposeInMainWorld } = vi.hoisted(() => ({ exposeInMainWorld: vi.fn() }))

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld },
  ipcRenderer: { invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn() }
}))

import { createBrowserApi } from './browser-api'
import { exposeBrowserApi } from './index'

const apiKeys = (value: unknown): string[] => Object.keys(value as object).sort()

const proc = process as unknown as { contextIsolated?: boolean }
const globals = globalThis as Record<string, unknown>
let originalIsolated: boolean | undefined

beforeEach(() => {
  exposeInMainWorld.mockClear()
  originalIsolated = proc.contextIsolated
})

afterEach(() => {
  proc.contextIsolated = originalIsolated
  delete globals.browserAPI
})

describe('exposeBrowserApi', () => {
  it('exposes browserAPI through contextBridge when context isolated', () => {
    proc.contextIsolated = true
    exposeBrowserApi()
    expect(exposeInMainWorld).toHaveBeenCalledTimes(1)
    expect(exposeInMainWorld).toHaveBeenCalledWith('browserAPI', expect.any(Object))
    const exposed = exposeInMainWorld.mock.calls[0]?.[1]
    expect(exposed.apiVersion).toBe(1)
    expect(apiKeys(exposed)).toEqual(apiKeys(createBrowserApi()))
  })

  it('assigns window.browserAPI directly when not isolated', () => {
    proc.contextIsolated = false
    exposeBrowserApi()
    expect((globals.browserAPI as { apiVersion: number }).apiVersion).toBe(1)
    expect(apiKeys(globals.browserAPI)).toEqual(apiKeys(createBrowserApi()))
    expect(exposeInMainWorld).not.toHaveBeenCalled()
  })
})
