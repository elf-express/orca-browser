import { mkdtemp, readFile, rm, stat, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  MCP_TOKEN_RELATIVE_PATH,
  isValidMcpToken,
  loadOrCreateMcpToken,
  writeNewMcpToken
} from './mcp-token-store'

let userDataDir: string

beforeEach(async () => {
  userDataDir = await mkdtemp(join(tmpdir(), 'orca-browser-token-'))
})

afterEach(async () => {
  await rm(userDataDir, { recursive: true, force: true })
})

describe('mcp-token-store', () => {
  it('creates a 64-char hex token at <userDataDir>/orca-browser/mcp-token', async () => {
    const token = await loadOrCreateMcpToken(userDataDir)
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    expect(MCP_TOKEN_RELATIVE_PATH).toBe('orca-browser/mcp-token')
    const onDisk = await readFile(join(userDataDir, 'orca-browser', 'mcp-token'), 'utf8')
    expect(onDisk).toBe(token)
  })

  it('returns the existing token on the next load', async () => {
    const first = await loadOrCreateMcpToken(userDataDir)
    const second = await loadOrCreateMcpToken(userDataDir)
    expect(second).toBe(first)
  })

  it('regenerates a malformed token file', async () => {
    await mkdir(join(userDataDir, 'orca-browser'), { recursive: true })
    await writeFile(join(userDataDir, 'orca-browser', 'mcp-token'), 'abc')
    const token = await loadOrCreateMcpToken(userDataDir)
    expect(isValidMcpToken(token)).toBe(true)
    expect(token).not.toBe('abc')
  })

  it('regenerates an empty token file', async () => {
    await mkdir(join(userDataDir, 'orca-browser'), { recursive: true })
    await writeFile(join(userDataDir, 'orca-browser', 'mcp-token'), '')
    const token = await loadOrCreateMcpToken(userDataDir)
    expect(isValidMcpToken(token)).toBe(true)
  })

  it('writeNewMcpToken replaces the stored token', async () => {
    const first = await loadOrCreateMcpToken(userDataDir)
    const replaced = await writeNewMcpToken(userDataDir)
    expect(replaced).not.toBe(first)
    expect(await loadOrCreateMcpToken(userDataDir)).toBe(replaced)
  })

  it.skipIf(process.platform === 'win32')('writes the token file with mode 0600', async () => {
    await loadOrCreateMcpToken(userDataDir)
    const info = await stat(join(userDataDir, 'orca-browser', 'mcp-token'))
    expect(info.mode & 0o777).toBe(0o600)
  })
})
