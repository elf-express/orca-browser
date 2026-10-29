import { describe, expect, it } from 'vitest'
import { runProcess } from './run-process'

describe('runProcess', () => {
  it('resolves stdout and exit code 0 for a finished child', async () => {
    const result = await runProcess({
      program: process.execPath,
      args: ['-e', "process.stdout.write('ok')"],
      env: process.env,
      timeoutMs: 10_000,
      maxOutputBytes: 1024
    })
    expect(result.stdout).toBe('ok')
    expect(result.code).toBe(0)
    expect(result.timedOut).toBe(false)
  })

  it('marks timedOut when the child outlives timeoutMs', async () => {
    const result = await runProcess({
      program: process.execPath,
      args: ['-e', 'setTimeout(()=>{},5000)'],
      env: process.env,
      timeoutMs: 200,
      maxOutputBytes: 1024
    })
    expect(result.timedOut).toBe(true)
  })

  it('rejects when the program does not exist', async () => {
    await expect(
      runProcess({
        program: 'definitely-missing-orca-browser-bin',
        args: [],
        env: process.env,
        timeoutMs: 1000,
        maxOutputBytes: 1024
      })
    ).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
