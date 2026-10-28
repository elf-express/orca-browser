import { describe, expect, it } from 'vitest'
import {
  isAllowedBrowserPartition,
  registerAllowedBrowserPartitionSource
} from './browser-partition-allowlist'

describe('browser partition allowlist', () => {
  it('allows the default partition', () => {
    expect(isAllowedBrowserPartition('persist:orca-browser')).toBe(true)
  })

  it('denies unknown partitions', () => {
    expect(isAllowedBrowserPartition('persist:other')).toBe(false)
    expect(isAllowedBrowserPartition('')).toBe(false)
  })

  it('allows partitions from a registered source until it is removed', () => {
    const remove = registerAllowedBrowserPartitionSource((p) => p === 'persist:p1')

    expect(isAllowedBrowserPartition('persist:p1')).toBe(true)

    remove()

    expect(isAllowedBrowserPartition('persist:p1')).toBe(false)
  })
})
