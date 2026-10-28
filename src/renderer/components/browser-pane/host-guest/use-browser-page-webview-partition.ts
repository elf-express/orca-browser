import { ORCA_BROWSER_PARTITION } from '../../../../shared/constants'
import { useBrowserSessionStore } from '../../../store/browser-session-store'

/** Resolves the guest partition: the page's own, else its profile's, else the shared default. */
export function useBrowserPageWebviewPartition(args: {
  sessionProfileId: string | null
  sessionPartition: string | null
}): string {
  const profilePartition = useBrowserSessionStore((state) =>
    args.sessionProfileId === null
      ? null
      : (state.browserSessionProfiles.find((profile) => profile.id === args.sessionProfileId)
          ?.partition ?? null)
  )
  return args.sessionPartition ?? profilePartition ?? ORCA_BROWSER_PARTITION
}
