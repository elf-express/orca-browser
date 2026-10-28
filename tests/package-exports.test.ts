import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const read = (file: string): string => readFileSync(resolve(root, file), 'utf8')

const pkg = JSON.parse(read('package.json')) as {
  name: string
  exports: Record<string, unknown>
}

function collectTargets(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (value && typeof value === 'object') return Object.values(value).flatMap(collectTargets)
  return []
}

const requireFromRoot = createRequire(resolve(root, 'package.json'))
const specifier = (subpath: string): string => `${pkg.name}${subpath.slice(1)}`

const importResolvable = ['./main', './preload', './shared', './package.json', './renderer']
const requireResolvable = ['./main', './preload', './shared', './package.json']

describe('package exports', () => {
  it.each(collectTargets(pkg.exports))('target %s exists', (file) => {
    expect(existsSync(resolve(root, file))).toBe(true)
  })

  it('covers every exported subpath in the resolution tests', () => {
    expect(Object.keys(pkg.exports).sort()).toEqual([...importResolvable].sort())
  })

  it.each(importResolvable)('%s resolves under the import condition', (subpath) => {
    const url = import.meta.resolve(specifier(subpath))
    expect(existsSync(fileURLToPath(url))).toBe(true)
  })

  it.each(requireResolvable)('%s resolves under the require condition', (subpath) => {
    expect(existsSync(requireFromRoot.resolve(specifier(subpath)))).toBe(true)
  })

  it('keeps react external in the renderer bundle', () => {
    const bundle = read('dist/renderer/index.js')
    expect(bundle).toContain('from "react"')
    expect(bundle).not.toContain('react.production')
  })

  it('declares the contract entry points in the type bundles', () => {
    expect(read('dist/main/index.d.cts')).toContain(
      'installBrowserPlugin(opts: BrowserPluginOptions): BrowserPluginHandle'
    )
    expect(read('dist/preload/index.d.cts')).toContain('exposeBrowserApi(): void')
    const rendererTypes = read('dist/renderer/index.d.ts')
    expect(rendererTypes).toContain('BrowserPane')
    expect(rendererTypes).toContain('BrowserPluginProvider')
  })
})
