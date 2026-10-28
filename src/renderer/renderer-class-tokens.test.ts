import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const RENDERER_ROOT = __dirname
const BANNED = /\b(text-2xs|text-3xs|text-chat-code|scrollbar-sleek|can-hover)\b/g

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      return listSourceFiles(path)
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : []
  })
}

describe('renderer class tokens', () => {
  it('uses no Orca-only utility classes', () => {
    const hits = listSourceFiles(RENDERER_ROOT).flatMap((file) => {
      if (file === join(RENDERER_ROOT, 'renderer-class-tokens.test.ts')) {
        return []
      }
      return readFileSync(file, 'utf8').match(BANNED) ?? []
    })

    expect(hits).toHaveLength(0)
  })
})
