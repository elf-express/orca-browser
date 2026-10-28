// Why: rename() is atomic for readers but not durable. Without fsync on the file and its directory,
// a power loss after a successful rename can leave the old contents, or an empty inode — the same
// empty-file symptom as issue #1158, from a different cause. The .bak ring recovers it at up to an
// hour's loss; fsync stops it from happening.

import { closeSync, fsyncSync, openSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { renameFileWithWindowsRetry } from './fs-utils'

/** Sync variant of the best-effort directory fsync, for callers that publish by rename or link. */
export function syncDirectoryDurablySync(directory: string): void {
  let fd: number | null = null
  try {
    fd = openSync(directory, 'r')
    fsyncSync(fd)
  } catch {
    // Windows cannot open a directory for fsync, and some filesystems reject it.
  } finally {
    if (fd !== null) {
      try {
        closeSync(fd)
      } catch {
        // Nothing actionable; the fsync already happened or the open failed.
      }
    }
  }
}

/** Rename an already-fsynced file and make the containing directory durable. */
export function renameDurableSync(tmpPath: string, finalPath: string): void {
  renameFileWithWindowsRetry(tmpPath, finalPath)
  syncDirectoryDurablySync(dirname(finalPath))
}

/** Temp path for a durable write; the `.tmp` suffix marks it as an orphan candidate. */
export function durableWriteTempPath(finalPath: string, owner?: string): string {
  const ownerSuffix = owner === undefined ? '' : `.owner-${owner}`
  return `${finalPath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}${ownerSuffix}.tmp`
}

/** Synchronous counterpart for quit and crash paths that cannot await. */
export function writeFileDurableSync(
  tmpPath: string,
  finalPath: string,
  payload: string | Uint8Array,
  /** Creation mode for a new file, e.g. 0o600 for state other users must not read. */
  mode?: number
): void {
  let renamed = false
  try {
    // A Uint8Array payload is written verbatim; a string still defaults to UTF-8.
    writeFileSync(tmpPath, payload, mode === undefined ? undefined : { mode })
    const fd = openSync(tmpPath, 'r+')
    try {
      fsyncSync(fd)
    } finally {
      closeSync(fd)
    }
    renameDurableSync(tmpPath, finalPath)
    renamed = true
  } finally {
    if (!renamed) {
      rmSync(tmpPath, { force: true })
    }
  }
}
