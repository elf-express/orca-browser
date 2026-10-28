import type { Session } from 'electron'
import { clearBrowserSessionPartitionPolicies } from './browser-session-partition-policies'

export async function retireFailedBrowserSessionProfile(
  partition: string,
  sess: Session
): Promise<void> {
  try {
    clearBrowserSessionPartitionPolicies(partition, sess)
  } catch {
    // Best-effort policy cleanup must not block retirement.
  }
}
