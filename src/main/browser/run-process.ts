import { execFile } from 'node:child_process'

export type RunProcessSpec = {
  program: string
  args: readonly string[]
  env: NodeJS.ProcessEnv
  timeoutMs: number
  maxOutputBytes: number
}

export type RunProcessResult = {
  code: number | null
  signal: NodeJS.Signals | null
  stdout: string
  stderr: string
  timedOut: boolean
}

// Runs a program without a shell. Resolves on normal exit or timeout kill; rejects on spawn errors and maxBuffer overflow.
export function runProcess(spec: RunProcessSpec): Promise<RunProcessResult> {
  return new Promise((resolve, reject) => {
    execFile(
      spec.program,
      [...spec.args],
      {
        env: spec.env,
        timeout: spec.timeoutMs,
        maxBuffer: spec.maxOutputBytes,
        windowsHide: true,
        encoding: 'utf8'
      },
      (error, stdout, stderr) => {
        if (!error) {
          resolve({ code: 0, signal: null, stdout, stderr, timedOut: false })
          return
        }
        const failure = error as NodeJS.ErrnoException & {
          killed?: boolean
          signal?: NodeJS.Signals | null
          code?: number | string | null
        }
        if (failure.killed && failure.signal) {
          resolve({ code: null, signal: failure.signal, stdout, stderr, timedOut: true })
          return
        }
        if (typeof failure.code === 'number') {
          resolve({ code: failure.code, signal: null, stdout, stderr, timedOut: false })
          return
        }
        reject(error)
      }
    )
  })
}
