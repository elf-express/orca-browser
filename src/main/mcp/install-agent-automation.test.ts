import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  bridgeArgs: [] as unknown[][],
  sweep: vi.fn(async () => [] as string[]),
  destroyAll: vi.fn(async () => {}),
  setRef: vi.fn(),
  resolve: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
  powerMonitor: { on: vi.fn(), removeListener: vi.fn() },
  clipboard: { writeText: vi.fn() },
  webContents: { fromId: vi.fn() }
}))

vi.mock('../browser/browser-manager', () => ({
  browserManager: { getScopeIdForTab: vi.fn() }
}))

vi.mock('../browser/agent-browser-bridge', () => ({
  AgentBrowserBridge: class {
    sweepOrphanedSessions = mocks.sweep
    destroyAllSessions = mocks.destroyAll
    constructor(...args: unknown[]) {
      mocks.bridgeArgs.push(args)
    }
  }
}))

vi.mock('../ipc/browser', async (importActual) => ({
  ...(await importActual<typeof import('../ipc/browser')>()),
  setAgentBrowserBridgeRef: mocks.setRef
}))

vi.mock('../browser/agent-browser-bridge-process', async (importActual) => {
  const actual = await importActual<typeof import('../browser/agent-browser-bridge-process')>()
  mocks.resolve.mockImplementation((options: { resourcesPath: string }) =>
    actual.resolveAgentBrowserBinary({ ...options, packageBinDirs: [] })
  )
  return { ...actual, resolveAgentBrowserBinary: mocks.resolve }
})

import { agentBrowserNativeName } from '../browser/agent-browser-bridge-process'
import { BROWSER_MCP_INVOKE_CHANNELS } from '../../shared/browser-ipc-channels'
import { installBrowserGrab } from '../browser-grab-installer'
import * as mainEntry from '../index'
import { pluginInstallers } from '../plugin-installers'
import { installAgentAutomation, installBrowserAgentAutomation } from './install-agent-automation'
import { getMcpEndpoint, stopBrowserMcpRuntime } from './browser-mcp-runtime'

let tmp: string
let resources: string
let userData: string
const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }

function host() {
  return {
    getMainWindow: () => null,
    userDataDir: userData,
    resourcesPath: resources,
    logger,
    openExternal: vi.fn(async () => {})
  }
}

function fakeBinary(): string {
  const path = join(resources, agentBrowserNativeName())
  writeFileSync(path, '')
  return path
}

async function waitForEndpoint(): Promise<NonNullable<ReturnType<typeof getMcpEndpoint>>> {
  for (let i = 0; i < 200; i++) {
    const endpoint = getMcpEndpoint()
    if (endpoint) {
      return endpoint
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('MCP endpoint never became available')
}

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'orca-browser-automation-'))
  resources = join(tmp, 'resources')
  userData = join(tmp, 'user-data')
  mkdirSync(resources)
  mkdirSync(userData)
  mocks.bridgeArgs.length = 0
  mocks.sweep.mockClear()
  mocks.destroyAll.mockClear()
  mocks.setRef.mockClear()
  logger.warn.mockClear()
})

afterEach(async () => {
  await stopBrowserMcpRuntime()
  rmSync(tmp, { recursive: true, force: true })
})

describe('installAgentAutomation', () => {
  it('starts MCP and exposes the endpoint', async () => {
    fakeBinary()
    const automation = installAgentAutomation({
      host: host(),
      browserManager: {} as never,
      mcpPort: 0
    })

    const endpoint = await waitForEndpoint()

    expect(endpoint.url.startsWith('http://127.0.0.1:')).toBe(true)
    expect(endpoint.url.endsWith('/mcp')).toBe(true)
    await automation.dispose()
  })

  it('passes host.userDataDir and the resolved binary into the bridge', async () => {
    const binary = fakeBinary()
    const automation = installAgentAutomation({
      host: host(),
      browserManager: {} as never,
      mcpPort: 0
    })

    expect(mocks.bridgeArgs).toHaveLength(1)
    expect(mocks.bridgeArgs[0][1]).toEqual({ agentBrowserBin: binary, userDataPath: userData })
    expect(mocks.setRef).toHaveBeenCalledWith(automation.bridge)
    await automation.dispose()
  })

  it('skips the orphan sweep and warns when the binary is missing', async () => {
    const automation = installAgentAutomation({
      host: host(),
      browserManager: {} as never,
      mcpPort: 0
    })

    expect(mocks.sweep).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledTimes(1)
    await automation.dispose()
  })

  it('sweeps orphaned sessions when the binary is found', async () => {
    fakeBinary()
    const automation = installAgentAutomation({
      host: host(),
      browserManager: {} as never,
      mcpPort: 0
    })

    expect(mocks.sweep).toHaveBeenCalledTimes(1)
    await automation.dispose()
  })

  it('treats a throwing binary resolution as missing and still installs', async () => {
    mocks.resolve.mockImplementationOnce(() => {
      throw new Error('EPERM: chmod failed')
    })

    const automation = installAgentAutomation({
      host: host(),
      browserManager: {} as never,
      mcpPort: 0
    })

    expect(mocks.sweep).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalled()
    expect(mocks.bridgeArgs[0][1]).toEqual({
      agentBrowserBin: join(resources, agentBrowserNativeName()),
      userDataPath: userData
    })
    await waitForEndpoint()
    await automation.dispose()
  })

  it('dispose stops MCP, clears the bridge ref and destroys sessions', async () => {
    fakeBinary()
    const automation = installAgentAutomation({
      host: host(),
      browserManager: {} as never,
      mcpPort: 0
    })
    await waitForEndpoint()

    await automation.dispose()

    expect(getMcpEndpoint()).toBeNull()
    expect(mocks.setRef.mock.calls.at(-1)).toEqual([null])
    expect(mocks.destroyAll).toHaveBeenCalledWith({ closeTimeoutMs: 5000 })
  })
})

describe('installBrowserAgentAutomation', () => {
  it('disposes the automation and rethrows when handler registration fails', async () => {
    fakeBinary()
    const { ipcMain } = await import('electron')
    vi.mocked(ipcMain.removeHandler).mockClear()
    vi.mocked(ipcMain.handle).mockImplementationOnce(() => {
      throw new Error('handler boom')
    })

    expect(() => installBrowserAgentAutomation({ host: host(), mcpPort: 0 } as never)).toThrow(
      'handler boom'
    )
    // Registration unregisters once up front; the failure path must unregister again.
    expect(vi.mocked(ipcMain.removeHandler).mock.calls.length).toBeGreaterThanOrEqual(
      BROWSER_MCP_INVOKE_CHANNELS.length * 2
    )
    await vi.waitFor(() => expect(mocks.destroyAll).toHaveBeenCalledTimes(1))
    expect(mocks.setRef.mock.calls.at(-1)).toEqual([null])
    expect(getMcpEndpoint()).toBeNull()
  })

  it('is registered as a plugin installer', () => {
    const grabIndex = pluginInstallers.indexOf(installBrowserGrab)
    const automationIndex = pluginInstallers.indexOf(installBrowserAgentAutomation)

    expect(grabIndex).toBeGreaterThanOrEqual(0)
    expect(automationIndex).toBe(grabIndex + 1)
  })

  it('main entry exports getMcpEndpoint, getMcpStatus and rotateMcpToken', () => {
    expect(typeof mainEntry.getMcpEndpoint).toBe('function')
    expect(typeof mainEntry.getMcpStatus).toBe('function')
    expect(typeof mainEntry.rotateMcpToken).toBe('function')
  })
})
