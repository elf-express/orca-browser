import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { exposeInMainWorld } = vi.hoisted(() => ({ exposeInMainWorld: vi.fn() }))

vi.mock('electron', () => ({ contextBridge: { exposeInMainWorld } }))

import { exposeBrowserApi } from './index'

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
    expect(exposeInMainWorld).toHaveBeenCalledWith('browserAPI', { apiVersion: 1 })
  })

  it('assigns window.browserAPI directly when not isolated', () => {
    proc.contextIsolated = false
    exposeBrowserApi()
    expect(globals.browserAPI).toEqual({ apiVersion: 1 })
    expect(exposeInMainWorld).not.toHaveBeenCalled()
  })
})
