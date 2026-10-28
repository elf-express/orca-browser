import { ORCA_BROWSER_PARTITION } from '../../../../shared/constants'

export function useBrowserPageWebviewPartition(_args: {
  sessionProfileId: string | null
  sessionPartition: string | null
}): string {
  // The package ships one shared persistent session; profile partitions are not supported yet.
  return ORCA_BROWSER_PARTITION
}
