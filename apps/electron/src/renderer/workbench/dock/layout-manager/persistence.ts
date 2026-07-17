import type { DockviewApi, SerializedDockview } from 'dockview-react'
import * as storage from '@/lib/local-storage'
import { KEYS } from '@/lib/local-storage'

const LAYOUT_KEY = KEYS.panelLayout
const LAYOUT_SUFFIX_PREFIX = 'workbench'

export function workbenchLayoutSuffix(workspaceId: string): string {
  return `${LAYOUT_SUFFIX_PREFIX}:${workspaceId}`
}

export function loadPersistedLayout(workspaceId: string): SerializedDockview | null {
  try {
    const raw = storage.get<SerializedDockview | null>(
      LAYOUT_KEY,
      null,
      workbenchLayoutSuffix(workspaceId),
    )
    if (!raw || typeof raw !== 'object') return null
    if (!('grid' in raw) || !('panels' in raw)) return null
    return raw
  } catch {
    return null
  }
}

export function savePersistedLayout(workspaceId: string, layout: SerializedDockview): void {
  storage.set(LAYOUT_KEY, layout, workbenchLayoutSuffix(workspaceId))
}

export function clearPersistedLayout(workspaceId: string): void {
  storage.remove(LAYOUT_KEY, workbenchLayoutSuffix(workspaceId))
}

/** Debounced layout persistence wired to dockview layout-changed events. */
export function createLayoutPersistence(
  workspaceId: string,
  debounceMs = 400,
): {
  attach: (api: DockviewApi) => () => void
  flush: (api: DockviewApi) => void
} {
  let timer: ReturnType<typeof setTimeout> | null = null

  const flush = (api: DockviewApi) => {
    try {
      savePersistedLayout(workspaceId, api.toJSON())
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
