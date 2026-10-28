import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const script = resolve(import.meta.dirname, 'check-dist.mjs')
const dirs: string[] = []

function git(dir: string, ...args: string[]): void {
  const result = spawnSync('git', args, { cwd: dir, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`)
}

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'check-dist-'))
  dirs.push(dir)
  git(dir, 'init', '-q')
  git(dir, 'config', 'user.name', 'test')
  git(dir, 'config', 'user.email', 'test@example.com')
  git(dir, 'config', 'core.autocrlf', 'false')
  git(dir, 'config', 'commit.gpgsign', 'false')
  return dir
}

function writeDist(dir: string, name: string, content: string): void {
  mkdirSync(join(dir, 'dist'), { recursive: true })
  writeFileSync(join(dir, 'dist', name), content)
}

function commitAll(dir: string): void {
  git(dir, 'add', '-A')
  git(dir, 'commit', '-q', '-m', 'init')
}

function run(dir: string): { status: number | null; stdout: string; stderr: string } {
  const { status, stdout, stderr } = spawnSync('node', [script, dir], { encoding: 'utf8' })
  return { status, stdout, stderr }
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
    } catch {
      // Windows may keep git handles open briefly; a leftover temp dir must not fail the test.
    }
  }
})

describe('check-dist', { timeout: 30_000 }, () => {
  it('fails when dist is untracked', () => {
    const dir = makeRepo()
    writeFileSync(join(dir, 'README.md'), 'x\n')
    commitAll(dir)
    writeDist(dir, 'a.js', 'a\n')
    const result = run(dir)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('dist is not tracked')
  })

  it('fails when tracked dist differs from the working tree', () => {
    const dir = makeRepo()
    writeDist(dir, 'a.js', 'a\n')
    commitAll(dir)
    writeDist(dir, 'a.js', 'changed\n')
    const result = run(dir)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('dist/ is out of date')
  })

  it('fails when dist has untracked files', () => {
    const dir = makeRepo()
    writeDist(dir, 'a.js', 'a\n')
    commitAll(dir)
    writeDist(dir, 'b.js', 'b\n')
    const result = run(dir)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('dist/b.js')
  })

  it('passes when tracked dist is clean', () => {
    const dir = makeRepo()
    writeDist(dir, 'a.js', 'a\n')
    commitAll(dir)
    const result = run(dir)
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('dist matches source')
  })
})
