const PNG_DATA_URL_PREFIX = 'data:image/png;base64,'

export async function writeClipboardImage(pngDataUrl: string): Promise<void> {
  if (!pngDataUrl.startsWith(PNG_DATA_URL_PREFIX)) {
    return
  }
  const blob = await (await fetch(pngDataUrl)).blob()
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
}
