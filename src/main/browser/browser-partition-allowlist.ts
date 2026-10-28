import { ORCA_BROWSER_PARTITION } from '../../shared/constants'

type PartitionSource = (partition: string) => boolean

const sources = new Set<PartitionSource>()

/** True when a webview may attach on the partition: the default one or any registered source. */
export function isAllowedBrowserPartition(partition: string): boolean {
  if (partition === ORCA_BROWSER_PARTITION) {
    return true
  }
  for (const source of sources) {
    if (source(partition)) {
      return true
    }
  }
  return false
}

/** Registers an extra partition predicate; the returned function removes it again. */
export function registerAllowedBrowserPartitionSource(source: PartitionSource): () => void {
  sources.add(source)
  return () => {
    sources.delete(source)
  }
}
