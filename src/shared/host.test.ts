import { describe, expectTypeOf, it } from 'vitest'
import type { BrowserAgentPayload } from './agent-payload'
import type { BrowserHost, BrowserPluginHandle } from './host'

describe('host contract', () => {
  it('keeps the host contract shape', () => {
    expectTypeOf<BrowserHost['userDataDir']>().toEqualTypeOf<string>()
    expectTypeOf<ReturnType<BrowserHost['openExternal']>>().toEqualTypeOf<Promise<void>>()
    expectTypeOf<ReturnType<BrowserPluginHandle['dispose']>>().toEqualTypeOf<Promise<void>>()
    expectTypeOf<BrowserAgentPayload['kind']>().toEqualTypeOf<'grab' | 'annotation' | 'markup'>()
  })
})
