import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BrowserHost, BrowserPluginHandle } from '../shared'
import { installBrowserPlugin } from './index'
import { pluginInstallers } from './plugin-installers'
import { getBrowserHost } from './plugin-runtime'

function createHost(): BrowserHost {
  return {
    getMainWindow: () => null,
    userDataDir: '/tmp/user-data',
    resourcesPath: '/tmp/resources',
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    openExternal: vi.fn(async () => {})
  }
}

const handles: BrowserPluginHandle[] = []

function install(host: BrowserHost = createHost()): BrowserPluginHandle {
  const handle = installBrowserPlugin({ host })
  handles.push(handle)
  return handle
}

afterEach(async () => {
  pluginInstallers.length = 0
  for (const handle of handles.splice(0)) {
    await handle.dispose()
  }
})

describe('installBrowserPlugin', () => {
  it('returns a handle whose dispose resolves', async () => {
    const handle = install()
    await expect(handle.dispose()).resolves.toBeUndefined()
  })

  it('throws when installed twice without dispose', () => {
    install()
    expect(() => installBrowserPlugin({ host: createHost() })).toThrow(
      new Error(
        'orca-browser: installBrowserPlugin() was already called; dispose the previous handle first'
      )
    )
  })

  it('can be installed again after dispose', async () => {
    const first = install()
    await first.dispose()
    expect(() => install()).not.toThrow()
  })

  it('returns the same promise for repeated dispose calls', () => {
    const handle = install()
    expect(handle.dispose()).toBe(handle.dispose())
  })

  it('runs installers in order and their disposers in reverse', async () => {
    const calls: string[] = []
    pluginInstallers.push(
      () => {
        calls.push('install:a')
        return () => {
          calls.push('dispose:a')
        }
      },
      () => {
        calls.push('install:b')
        return async () => {
          calls.push('dispose:b')
        }
      }
    )
    const handle = install()
    await handle.dispose()
    expect(calls).toEqual(['install:a', 'install:b', 'dispose:b', 'dispose:a'])
  })

  it('keeps disposing and logs when a disposer throws', async () => {
    const host = createHost()
    const calls: string[] = []
    pluginInstallers.push(
      () => () => {
        calls.push('dispose:a')
      },
      () => () => {
        throw new Error('boom')
      }
    )
    const handle = install(host)
    await handle.dispose()
    expect(calls).toEqual(['dispose:a'])
    expect(() => getBrowserHost()).toThrow('orca-browser: plugin is not installed')
    expect(host.logger.error).toHaveBeenCalledWith('orca-browser: dispose failed', {
      error: 'Error: boom'
    })
  })

  it('rolls back when an installer throws', () => {
    const calls: string[] = []
    pluginInstallers.push(
      () => () => {
        calls.push('dispose:a')
      },
      () => {
        throw new Error('boom')
      }
    )
    const host = createHost()
    expect(() => installBrowserPlugin({ host })).toThrow('boom')
    expect(calls).toEqual(['dispose:a'])
    expect(() => getBrowserHost()).toThrow('orca-browser: plugin is not installed')
    pluginInstallers.length = 0
    expect(() => install(host)).not.toThrow()
  })

  it('does not clear a later install when rollback disposers settle', async () => {
    pluginInstallers.push(
      () => async () => {},
      () => {
        throw new Error('boom')
      }
    )
    expect(() => installBrowserPlugin({ host: createHost() })).toThrow('boom')
    pluginInstallers.length = 0
    const host2 = createHost()
    install(host2)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(getBrowserHost()).toBe(host2)
  })

  it('exposes the host through getBrowserHost while installed', async () => {
    const host = createHost()
    const handle = install(host)
    expect(getBrowserHost()).toBe(host)
    await handle.dispose()
    expect(() => getBrowserHost()).toThrow(new Error('orca-browser: plugin is not installed'))
  })

  it('logs the install through the host logger', () => {
    const host = createHost()
    install(host)
    expect(host.logger.info).toHaveBeenCalledTimes(1)
    expect(host.logger.info).toHaveBeenCalledWith('orca-browser: installed', { mcpPort: 47821 })
  })
})
