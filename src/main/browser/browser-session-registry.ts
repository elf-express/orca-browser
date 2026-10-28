import { session } from 'electron'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { ORCA_BROWSER_PARTITION } from '../../shared/constants'
import {
  DEFAULT_LOCAL_ORCA_PROFILE_ID,
  getOrcaProfileBrowserSessionPartition
} from '../../shared/orca-profiles'
import type {
  BrowserSessionProfile,
  BrowserSessionProfileScope
} from '../../shared/browser-workspace-types'
import {
  applyPendingBrowserCookieImports,
  clearPendingBrowserCookieImport,
  setPendingBrowserCookieImport
} from './browser-session-cookie-staging'
import {
  BROWSER_SESSION_META_FILE_NAME,
  loadBrowserSessionMeta,
  persistBrowserSessionMeta
} from './browser-session-meta-store'
import type { BrowserSessionMeta } from './browser-session-meta-store'
import {
  forgetBrowserSessionPartitionConfiguration,
  installBrowserSessionPartitionPolicies,
  retireBrowserSessionUserAgentPolicy
} from './browser-session-partition-policies'
import {
  isValidPersistedBrowserSessionProfile,
  inspectRetiredBrowserSessionProfileUserAgentModes
} from './browser-session-persisted-profile-validation'
import { retireFailedBrowserSessionProfile } from './browser-session-profile-retirement'
import { markBrowserIdentityMigrationNoticePending } from './browser-identity-mode-store'

// The plugin keeps its own state in one folder under the host's userData.
const BROWSER_DATA_DIR_NAME = 'orca-browser'

class BrowserSessionRegistry {
  private readonly profiles = new Map<string, BrowserSessionProfile>()
  private readonly activeOrcaProfileId = DEFAULT_LOCAL_ORCA_PROFILE_ID
  private readonly defaultPartition = ORCA_BROWSER_PARTITION
  private userDataDir: string | null = null

  constructor() {
    this.resetDefaultProfile()
  }

  // Why: the host's userData path is only known once the plugin is installed, so persistence stays
  // inert (and the default profile has no source) until this runs.
  configure(opts: { userDataDir: string }): void {
    this.userDataDir = opts.userDataDir
    this.profiles.clear()
    this.resetDefaultProfile()
  }

  /** Folder holding the plugin's own state files, including the identity record. */
  getDataDir(): string {
    if (!this.userDataDir) {
      throw new Error('Browser session registry is not configured')
    }
    return join(this.userDataDir, BROWSER_DATA_DIR_NAME)
  }

  private resetDefaultProfile(): void {
    const persisted = this.loadPersistedSource()
    this.profiles.set('default', {
      id: 'default',
      scope: 'default',
      partition: this.defaultPartition,
      label: 'Default',
      source: persisted
    })
  }

  // Why: source metadata must persist across restarts (for the Settings import status) since the registry is in-memory only.
  private get metadataPath(): string {
    return join(this.getDataDir(), BROWSER_SESSION_META_FILE_NAME)
  }

  private loadPersistedSource(): BrowserSessionProfile['source'] {
    return this.loadPersistedMeta().defaultSource
  }

  private persistMeta(updates: Partial<BrowserSessionMeta>): void {
    persistBrowserSessionMeta(() => this.metadataPath, this.defaultPartition, updates)
  }

  private persistSource(source: BrowserSessionProfile['source']): void {
    this.persistMeta({ defaultSource: source })
  }

  // Why: non-default profiles are in-memory only; without this they vanish on restart.
  private persistProfiles(): void {
    const nonDefault = [...this.profiles.values()].filter((p) => p.id !== 'default')
    this.persistMeta({ profiles: nonDefault })
  }

  private loadPersistedMeta(): BrowserSessionMeta {
    return loadBrowserSessionMeta(() => this.metadataPath, this.defaultPartition)
  }

  // Why: run before any webview loads, and set the UA before the first request or Electron's default UA invalidates imported cookies.
  // Why re-read defaultSource: the constructor runs before configure() (userData path unavailable), so loadPersistedSource() returned null.
  initializeBrowserSessionsFromPersistedState(): void {
    const meta = this.loadPersistedMeta()
    const migration = inspectRetiredBrowserSessionProfileUserAgentModes(
      meta.profiles,
      this.activeOrcaProfileId
    )
    if (migration.noticePending) {
      // Why scoped: identity persistence must never reject browser-session startup.
      void markBrowserIdentityMigrationNoticePending(this.getDataDir(), migration.degraded).catch(
        (error) => console.error('[browser-identity] Migration notice failed:', error)
      )
    }
    if (meta.defaultSource) {
      const current = this.profiles.get('default')
      if (current && current.source === null) {
        this.profiles.set('default', { ...current, source: meta.defaultSource })
      }
    }
    if (meta.profiles.length > 0) {
      this.hydrateFromPersisted(meta.profiles)
    }

    // Why: nothing else installs policies on the default partition (hydrate skips it), so without this its guest permission and display-media policies would never be installed.
    const defaultProfile = this.getDefaultProfile()
    void installBrowserSessionPartitionPolicies(defaultProfile).catch(() => {
      console.warn(
        '[browser-session] Failed to apply policies to browser partition',
        defaultProfile.partition
      )
    })
  }

  // Why: must run before any session.fromPartition() so CookieMonster reads the staged cookies instead of overwriting them from its in-memory DB.
  applyPendingCookieImport(): void {
    applyPendingBrowserCookieImports({
      resolveMetadataPath: () => this.metadataPath,
      defaultPartition: this.defaultPartition,
      activeOrcaProfileId: this.activeOrcaProfileId
    })
  }

  setPendingCookieImport(partition: string, stagingDbPath: string): void {
    setPendingBrowserCookieImport({
      resolveMetadataPath: () => this.metadataPath,
      defaultPartition: this.defaultPartition,
      partition,
      stagingDbPath
    })
  }

  // Why: a degraded import still rewrites the live session, so an older staged DB must stop replaying over it.
  clearPendingCookieImport(partition: string): void {
    clearPendingBrowserCookieImport({
      resolveMetadataPath: () => this.metadataPath,
      defaultPartition: this.defaultPartition,
      partition
    })
  }

  getDefaultProfile(): BrowserSessionProfile {
    return this.profiles.get('default')!
  }

  getProfile(profileId: string): BrowserSessionProfile | null {
    return this.profiles.get(profileId) ?? null
  }

  listProfiles(): BrowserSessionProfile[] {
    return [...this.profiles.values()]
  }

  isAllowedPartition(partition: string): boolean {
    if (partition === this.defaultPartition) {
      return true
    }
    return [...this.profiles.values()].some((p) => p.partition === partition)
  }

  resolvePartition(profileId: string | null | undefined): string {
    if (!profileId) {
      return this.defaultPartition
    }
    return this.profiles.get(profileId)?.partition ?? this.defaultPartition
  }

  resolveKnownPartition(profileId: string | null | undefined): string | null {
    if (!profileId) {
      // Why: use the active Orca profile's default partition, not the legacy constant, or profiles resolve local-default's cookie jar.
      return this.defaultPartition
    }
    return this.profiles.get(profileId)?.partition ?? null
  }

  async createProfile(
    scope: BrowserSessionProfileScope,
    label: string
  ): Promise<BrowserSessionProfile | null> {
    // Why: the registry is also an IPC boundary, so runtime types alone cannot keep invalid values out of persisted metadata.
    if (scope !== 'isolated' && scope !== 'imported') {
      return null
    }
    const id = randomUUID()
    // Why: deterministic partition-from-id lets main rebuild the allowlist on restart without a separate partition→profile map.
    const partition = getOrcaProfileBrowserSessionPartition(this.activeOrcaProfileId, id)
    const profile: BrowserSessionProfile = {
      id,
      scope,
      partition,
      label,
      source: null
    }
    try {
      await installBrowserSessionPartitionPolicies(profile)
    } catch (error) {
      await retireFailedBrowserSessionProfile(partition, session.fromPartition(partition))
      throw error
    }
    this.profiles.set(id, profile)
    this.persistProfiles()
    return profile
  }

  updateProfileSource(
    profileId: string,
    source: BrowserSessionProfile['source']
  ): BrowserSessionProfile | null {
    const profile = this.profiles.get(profileId)
    if (!profile) {
      return null
    }
    const updated = { ...profile, source }
    this.profiles.set(profileId, updated)
    if (profileId === 'default') {
      this.persistSource(source)
    } else {
      this.persistProfiles()
    }
    return updated
  }

  async deleteProfile(profileId: string): Promise<boolean> {
    const profile = this.profiles.get(profileId)
    if (!profile || profile.scope === 'default') {
      return false
    }
    this.profiles.delete(profileId)
    this.persistProfiles()
    const meta = this.loadPersistedMeta()
    const pendingCookieImports = { ...meta.pendingCookieImports }
    delete pendingCookieImports[profile.partition]
    const defaultPendingImport = pendingCookieImports[this.defaultPartition]
    this.persistMeta({
      pendingCookieImports,
      pendingCookieDbPath: typeof defaultPendingImport === 'string' ? defaultPendingImport : null
    })

    // Why: clear the partition's storage so deleting a profile doesn't leave orphaned cookies/cache behind.
    try {
      const sess = session.fromPartition(profile.partition)
      forgetBrowserSessionPartitionConfiguration(profile.partition)
      retireBrowserSessionUserAgentPolicy(sess)
      await sess.clearStorageData()
      await sess.clearCache()
    } catch {
      // Why: cleanup is best-effort — the profile is already out of the registry, so will-attach-webview blocks it regardless.
    }
    return true
  }

  // Why: lets users undo a cookie import without deleting the default profile itself.
  async clearDefaultSessionCookies(): Promise<boolean> {
    try {
      // Why: persist metadata before clearing storage so a mid-clear quit doesn't leave a stale "imported from X" badge.
      const defaultProfile = this.profiles.get('default')
      if (defaultProfile) {
        this.profiles.set('default', { ...defaultProfile, source: null })
      }
      const meta = this.loadPersistedMeta()
      const pendingCookieImports = { ...meta.pendingCookieImports }
      delete pendingCookieImports[this.defaultPartition]
      this.persistMeta({
        defaultSource: null,
        pendingCookieDbPath: null,
        pendingCookieImports
      })

      const sess = session.fromPartition(this.defaultPartition)
      await sess.clearStorageData({ storages: ['cookies'] })
      return true
    } catch {
      return false
    }
  }

  hydrateFromPersisted(profiles: BrowserSessionProfile[]): void {
    for (const profile of profiles) {
      if (!isValidPersistedBrowserSessionProfile(profile, this.activeOrcaProfileId)) {
        continue
      }
      this.profiles.set(profile.id, profile)
      if (profile.partition !== this.defaultPartition) {
        void installBrowserSessionPartitionPolicies(profile).catch(() => {
          console.warn(
            '[browser-session] Failed to apply policies to browser partition',
            profile.partition
          )
        })
      }
    }
  }
}

export const browserSessionRegistry = new BrowserSessionRegistry()
