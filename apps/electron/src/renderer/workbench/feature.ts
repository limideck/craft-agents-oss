import {
  isWorkbenchShellEnabled as sharedIsWorkbenchShellEnabled,
} from '@craft-agent/shared/feature-flags'

const LOCAL_STORAGE_KEY = 'craft-feature-workbench-shell'

/**
 * Dual-shell feature flag.
 *
 * Precedence:
 * 1. localStorage `craft-feature-workbench-shell` = 1|0|true|false (dev toggle)
 * 2. CRAFT_FEATURE_WORKBENCH_SHELL env (shared helper)
 * 3. default false
 */
export function isWorkbenchShellEnabled(): boolean {
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (raw != null) {
      const normalized = raw.trim().toLowerCase()
      if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
      if (['0', 'false', 'no', 'off'].includes(normalized)) return false
    }
  }
  return sharedIsWorkbenchShellEnabled()
}

export function setWorkbenchShellEnabled(enabled: boolean): void {
  localStorage.setItem(LOCAL_STORAGE_KEY, enabled ? '1' : '0')
}
