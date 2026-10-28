import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..')
const read = (file: string): string => readFileSync(resolve(root, file), 'utf8')

const pkg = JSON.parse(read('package.json')) as {
  exports: Record<string, Record<string, string>>
}

const targets = Object.entries(pkg.exports).flatMap(([subpath, conditions]) =>
  Object.entries(conditions).map(([condition, file]) => [subpath, condition, file] as const)
)

describe('package exports', () => {
  it.each(targets)('%s (%s) points at an existing file', (_subpath, _condition, file) => {
    expect(existsSync(resolve(root, file))).toBe(true)
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
