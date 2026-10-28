import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const script = resolve(import.meta.dirname, 'list-i18n-keys.mjs')
let dir = ''

function run(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' })
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'i18n-keys-'))
  mkdirSync(join(dir, 'src', 'nested'), { recursive: true })
  writeFileSync(
    join(dir, 'src', 'a.ts'),
    "translate('a.b', 'Hello')\n" + "translate('c', \"It's\")\n"
  )
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('list-i18n-keys', () => {
  it('prints the sorted key table to stdout', () => {
    const result = run([join(dir, 'src')])
    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual({ 'a.b': 'Hello', c: "It's" })
    expect(result.stdout.endsWith('}\n')).toBe(true)
    expect(Object.keys(JSON.parse(result.stdout))).toEqual(['a.b', 'c'])
  })

  it('writes the table to --out and keeps stdout empty', () => {
    const out = join(dir, 'k.json')
    const result = run([join(dir, 'src'), '--out', out])
    expect(result.status).toBe(0)
    expect(result.stdout).toBe('')
    expect(JSON.parse(readFileSync(out, 'utf8'))).toEqual({ 'a.b': 'Hello', c: "It's" })
  })

  it('skips test files', () => {
    writeFileSync(join(dir, 'src', 'nested', 'x.test.tsx'), "translate('x', 'X')\n")
    const result = run([join(dir, 'src')])
    expect(JSON.parse(result.stdout)).not.toHaveProperty('x')
  })

  it('fails when two files give the same key different fallbacks', () => {
    writeFileSync(join(dir, 'src', 'nested', 'b.ts'), "translate('a.b', 'Goodbye')\n")
    const result = run([join(dir, 'src')])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('conflicting fallback for key a.b')
  })
})
