import { describe, expect, it } from 'vitest'
import { runProcessSync, windowsPowerShellPath } from './process-sync'

describe('runProcessSync', () => {
  it('returns stdout and exit code', () => {
    const result = runProcessSync({
      program: process.execPath,
      args: ['-e', 'process.stdout.write("ok")'],
      timeoutMs: 5000
    })
    expect(result).toEqual({ code: 0, timedOut: false, stdout: 'ok' })
  })

  it('passes input through stdin', () => {
    const result = runProcessSync({
      program: process.execPath,
      args: ['-e', 'process.stdin.pipe(process.stdout)'],
      timeoutMs: 5000,
      input: 'abc'
    })
    expect(result.stdout).toBe('abc')
  })

  it('reports timeout', () => {
    const result = runProcessSync({
      program: process.execPath,
      args: ['-e', 'setTimeout(()=>{},5000)'],
      timeoutMs: 100
    })
    expect(result.timedOut).toBe(true)
  })
})

describe('windowsPowerShellPath', () => {
  it('uses SystemRoot', () => {
    expect(windowsPowerShellPath({ SystemRoot: 'D:\\Win' })).toBe(
      'D:\\Win\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
    )
  })
})
