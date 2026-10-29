import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import {
  agentBrowserNativeName,
  defaultAgentBrowserPackageBinDirs,
  resolveAgentBrowserBinary
} from './agent-browser-bridge-process'

describe('resolveAgentBrowserBinary', () => {
  let root: string
  let res: string
  let pkgA: string
  let pkgB: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'ab-resolve-'))
    res = join(root, 'resources')
    pkgA = join(root, 'pkgA')
    pkgB = join(root, 'pkgB')
    for (const dir of [res, pkgA, pkgB]) {
      mkdirSync(dir, { recursive: true })
    }
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('prefers the binary in resourcesPath', () => {
    const name = agentBrowserNativeName()
    writeFileSync(join(res, name), '')
    writeFileSync(join(pkgA, name), '')
    expect(resolveAgentBrowserBinary({ resourcesPath: res, packageBinDirs: [pkgA, pkgB] })).toEqual(
      { found: true, path: join(res, name) }
    )
  })

  it('falls back to the package bin directory', () => {
    const name = agentBrowserNativeName()
    writeFileSync(join(pkgB, name), '')
    expect(resolveAgentBrowserBinary({ resourcesPath: res, packageBinDirs: [pkgA, pkgB] })).toEqual(
      { found: true, path: join(pkgB, name) }
    )
  })

  it('reports every expected path when nothing exists', () => {
    const name = agentBrowserNativeName()
    expect(resolveAgentBrowserBinary({ resourcesPath: res, packageBinDirs: [pkgA, pkgB] })).toEqual(
      {
        found: false,
        expectedPaths: [join(res, name), join(pkgA, name), join(pkgB, name)]
      }
    )
  })

  it('resolves the binary through the plugin package when bundled', () => {
    const dirs = defaultAgentBrowserPackageBinDirs()
    expect(dirs.length).toBeGreaterThanOrEqual(1)
    expect(existsSync(join(dirs[0], agentBrowserNativeName()))).toBe(true)
  })
})

describe('agentBrowserNativeName', () => {
  const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!
  const originalArch = Object.getOwnPropertyDescriptor(process, 'arch')!

  afterEach(() => {
    Object.defineProperty(process, 'platform', originalPlatform)
    Object.defineProperty(process, 'arch', originalArch)
  })

  it('matches the extraResources file name', () => {
    const cases: [string, string, string][] = [
      ['win32', 'x64', 'agent-browser-win32-x64.exe'],
      ['darwin', 'arm64', 'agent-browser-darwin-arm64'],
      ['linux', 'x64', 'agent-browser-linux-x64']
    ]
    for (const [platform, arch, expected] of cases) {
      Object.defineProperty(process, 'platform', { value: platform, configurable: true })
      Object.defineProperty(process, 'arch', { value: arch, configurable: true })
      expect(agentBrowserNativeName()).toBe(expected)
    }
  })
})
