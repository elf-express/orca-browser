import { afterEach, describe, expect, it, vi } from 'vitest'
import { writeClipboardImage } from './browser-clipboard'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('writeClipboardImage', () => {
  it('ignores non-png data urls', async () => {
    const write = vi.fn()
    const fetchMock = vi.fn()
    vi.stubGlobal('navigator', { clipboard: { write } })
    vi.stubGlobal('fetch', fetchMock)
    await writeClipboardImage('data:image/jpeg;base64,AA')
    expect(write).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('writes a png blob once under image/png', async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    const blob = new Blob(['x'], { type: 'image/png' })
    const items: Record<string, Blob>[] = []
    class FakeClipboardItem {
      constructor(data: Record<string, Blob>) {
        items.push(data)
      }
    }
    vi.stubGlobal('navigator', { clipboard: { write } })
    vi.stubGlobal('ClipboardItem', FakeClipboardItem)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ blob: () => Promise.resolve(blob) }))
    await writeClipboardImage('data:image/png;base64,AA==')
    expect(write).toHaveBeenCalledTimes(1)
    expect(Object.keys(items[0])).toEqual(['image/png'])
    expect(items[0]['image/png']).toBe(blob)
  })
})
