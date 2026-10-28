import { spawnSync } from 'node:child_process'
import { win32 as pathWin32 } from 'node:path'

export type ProcessSyncSpec = {
  program: string
  args: readonly string[]
  timeoutMs: number
  input?: string
}

export type ProcessSyncResult = {
  code: number | null
  timedOut: boolean
  stdout: string
}

export function runProcessSync(spec: ProcessSyncSpec): ProcessSyncResult {
  const result = spawnSync(spec.program, [...spec.args], {
    encoding: 'utf8',
    input: spec.input,
    timeout: spec.timeoutMs,
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024
  })
  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
      return { code: result.status, timedOut: true, stdout: result.stdout ?? '' }
    }
    throw result.error
  }
  return { code: result.status, timedOut: false, stdout: result.stdout ?? '' }
}

function systemRoot(env: NodeJS.ProcessEnv = process.env): string {
  return env.SystemRoot ?? env.SYSTEMROOT ?? env.windir ?? 'C:\\Windows'
}

// Absolute path so a pruned or shadowed PATH cannot redirect the spawn.
export function windowsPowerShellPath(env: NodeJS.ProcessEnv = process.env): string {
  return pathWin32.join(systemRoot(env), 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
}
