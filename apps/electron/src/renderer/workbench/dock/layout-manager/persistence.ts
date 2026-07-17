import type { DockviewApi, SerializedDockview } from 'dockview-react'
import * as storage from '@/lib/local-storage'
import { KEYS } from '@/lib/local-storage'

const LAYOUT_KEY = KEYS.panelLayout
const LAYOUT_SUFFIX_PREFIX = 'workbench'

/** Per workspace + module so chat kept open in RSS survives leaving/returning. */
export function workbenchLayoutSuffix(workspaceId: string, moduleId: string): string {
  return `${LAYOUT_SUFFIX_PREFIX}:${workspaceId}:${moduleId}`
}

/** Pre-module-scoped key (agents-only era). */
export function workbenchLayoutSuffixLegacy(workspaceId: string): string {
  return `${LAYOUT_SUFFIX_PREFIX}:${workspaceId}`
}

export function loadPersistedLayout(
  workspaceId: string,
  moduleId: string,
): SerializedDockview | null {
  try {
    const raw = storage.get<SerializedDockview | null>(
      LAYOUT_KEY,
      null,
      workbenchLayoutSuffix(workspaceId, moduleId),
    )
    if (isValidLayout(raw)) return raw

    // Migrate: first agents open may still have the old workspace-only key.
    if (moduleId === 'agents') {
      const legacy = storage.get<SerializedDockview | null>(
        LAYOUT_KEY,
        null,
        workbenchLayoutSuffixLegacy(workspaceId),
      )
      if (isValidLayout(legacy)) return legacy
    }
    return null
  } catch {
    return null
  }
}

function isValidLayout(raw: unknown): raw is SerializedDockview {
  return (
    !!raw &&
    typeof raw === 'object' &&
    'grid' in raw &&
    'panels' in raw
  )
}

export function savePersistedLayout(
  workspaceId: string,
  moduleId: string,
  layout: SerializedDockview,
): void {
  storage.set(LAYOUT_KEY, layout, workbenchLayoutSuffix(workspaceId, moduleId))
}

export function clearPersistedLayout(workspaceId: string, moduleId?: string): void {
  if (moduleId) {
    storage.remove(LAYOUT_KEY, workbenchLayoutSuffix(workspaceId, moduleId))
    return
  }
  storage.remove(LAYOUT_KEY, workbenchLayoutSuffixLegacy(workspaceId))
}

/** Debounced layout persistence wired to dockview layout-changed events. */
export function createLayoutPersistence(
  workspaceId: string,
  getModuleId: () => string,
  debounceMs = 400,
): {
  attach: (api: DockviewApi) => () => void
  flush: (api: DockviewApi) => void
} {
  let timer: ReturnType<typeof setTimeout> | null = null

  const flush = (api: DockviewApi) => {
    try {
      savePersistedLayout(workspaceId, getModuleId(), api.toJSON())
    } catch (err) {
      console.warn('[workbench] failed to persist layout', err)
    }
  }

  const schedule = (api: DockviewApi) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      flush(api)
    }, debounceMs)
  }

  return {
    attach(api: DockviewApi) {
      const disposable = api.onDidLayoutChange(() => schedule(api))
      return () => {
        disposable.dispose()
        if (timer) {
          clearTimeout(timer)
          timer = null
          flush(api)
        }
      }
    },
    flush,
  }
}
