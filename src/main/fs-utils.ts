import { copyFileSync, renameSync } from 'node:fs'

// Why: on Windows, file replacement and backup-copy operations can fail with
// EPERM/EACCES/EBUSY if another process (antivirus, a CLI) holds the target
// file open. A short retry avoids transient failures without masking real
// permission errors.
export function renameFileWithWindowsRetry(source: string, target: string): void {
  runFileOperationWithWindowsRetry(() => renameSync(source, target))
}

export function copyFileWithWindowsRetry(source: string, target: string): void {
  runFileOperationWithWindowsRetry(() => copyFileSync(source, target))
}

function runFileOperationWithWindowsRetry(operation: () => void): void {
  for (let attempt = 1; ; attempt++) {
    try {
      operation()
      return
    } catch (error) {
      if (shouldRetryFileOperation(error, attempt)) {
        sleepSync(attempt * 50)
        continue
      }
      throw error
    }
  }
}

function shouldRetryFileOperation(error: unknown, attempt: number): boolean {
  return (
    process.platform === 'win32' &&
    attempt < 6 &&
    error instanceof Error &&
    'code' in error &&
    (error.code === 'EPERM' || error.code === 'EACCES' || error.code === 'EBUSY')
  )
}

// The retry backoff parks the thread so sync callers do not burn CPU.
const sleepBuffer = new Int32Array(new SharedArrayBuffer(4))
function sleepSync(ms: number): void {
  Atomics.wait(sleepBuffer, 0, 0, ms)
}
