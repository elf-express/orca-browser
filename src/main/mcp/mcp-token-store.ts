import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export const MCP_TOKEN_RELATIVE_PATH = 'orca-browser/mcp-token'

const TOKEN_PATTERN = /^[0-9a-f]{64}$/

export function isValidMcpToken(value: string): boolean {
  return TOKEN_PATTERN.test(value)
}

function tokenPath(userDataDir: string): string {
  return join(userDataDir, ...MCP_TOKEN_RELATIVE_PATH.split('/'))
}

// Token reads and writes in this process run one at a time so concurrent callers agree on one token.
let queue: Promise<unknown> = Promise.resolve()

function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  queue = run.catch(() => undefined)
  return run
}

export function loadOrCreateMcpToken(userDataDir: string): Promise<string> {
  return serialized(() => loadOrCreate(userDataDir))
}

export function writeNewMcpToken(userDataDir: string): Promise<string> {
  return serialized(() => writeNew(userDataDir))
}

async function loadOrCreate(userDataDir: string): Promise<string> {
  try {
    const existing = (await readFile(tokenPath(userDataDir), 'utf8')).trim()
    if (isValidMcpToken(existing)) {
      return existing
    }
  } catch {
    // Missing or unreadable file: fall through and write a fresh token.
  }
  return writeNew(userDataDir)
}

async function writeNew(userDataDir: string): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const target = tokenPath(userDataDir)
  await mkdir(dirname(target), { recursive: true, mode: 0o700 })
  // Write to a sibling temp file and rename so readers never see a partial token.
  // A unique name per write also keeps other processes sharing the directory from colliding.
  const temp = `${target}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  await writeFile(temp, token, { mode: 0o600 })
  await rename(temp, target)
  return token
}
