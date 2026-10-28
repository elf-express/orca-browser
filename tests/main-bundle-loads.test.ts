import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const bundlePath = resolve(root, 'dist/main/index.cjs')

describe('main bundle', () => {
  it('keeps the node: protocol on built-in requires', () => {
    const bundle = readFileSync(bundlePath, 'utf8')
    expect(bundle).toContain('require("node:sqlite")')
    expect(bundle).not.toContain('require("sqlite")')
  })

  it('loads with electron stubbed without MODULE_NOT_FOUND', () => {
    // Stub only 'electron'; every other specifier resolves through the real resolver.
    const script = `
      const Module = require('node:module')
      const origLoad = Module._load
      Module._load = function (request, ...rest) {
        if (request === 'electron') return new Proxy({}, { get: () => ({}) })
        return origLoad.call(this, request, ...rest)
      }
      try {
        require(${JSON.stringify(bundlePath)})
      } catch (error) {
        if (error && error.code === 'MODULE_NOT_FOUND') {
          console.error(String(error.message))
          process.exit(2)
        }
      }
    `
    const result = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', cwd: root })
    expect(result.stderr).not.toContain('MODULE_NOT_FOUND')
    expect(result.status).toBe(0)
  })
})
