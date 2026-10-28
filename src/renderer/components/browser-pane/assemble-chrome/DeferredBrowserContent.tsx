import { useLayoutEffect, useState, type ReactNode } from 'react'

export function DeferredBrowserContent({
  mountEligible,
  retainMounted = true,
  children
}: {
  mountEligible: boolean
  retainMounted?: boolean
  children: ReactNode
}): React.JSX.Element | null {
  const [hasCommittedMount, setHasCommittedMount] = useState(false)
  // Only committed, retainable mounts may survive the loss of eligibility.
  useLayoutEffect(() => {
    if (!retainMounted) {
      // oxlint-disable-next-line react/set-state-in-effect -- Intentional: a committed mount is remembered only while retainable.
      setHasCommittedMount(false)
    } else if (mountEligible && !hasCommittedMount) {
      // oxlint-disable-next-line react/set-state-in-effect -- Intentional: record the first committed mount.
      setHasCommittedMount(true)
    }
  }, [hasCommittedMount, mountEligible, retainMounted])
  return mountEligible || (retainMounted && hasCommittedMount) ? <>{children}</> : null
}
