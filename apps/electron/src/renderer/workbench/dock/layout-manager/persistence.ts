import type { DockviewApi, SerializedDockview } from 'dockview-react'
import * as storage from '@/lib/local-storage'
import { KEYS } from '@/lib/local-storage'

const LAYOUT_KEY = KEYS.panelLayout
const LAYOUT_SUFFIX_PREFIX = 'workbench'

/**
 * Panel component (or id) markers that identify a persisted layout as belonging
 * to a module. Rejects cross-module corruption from debounced persist races.
 */
const MODULE_LAYOUT_MARKERS: Record<string, readonly string[]> = {
  agents: ['chat', 'session-list', 'files'],
  // Require sites-browser so pre-multi-tab (sites-preview) layouts fall back to default.
  sites: ['sites-browser'],
  rss: ['rss-feeds', 'rss-article-list', 'rss-reader'],
  tables: ['tables-grid'],
  automations: ['automation-detail', 'wf-canvas', 'wf-logs', 'wf-right'],
  workflows: ['wf-canvas', 'wf-logs', 'wf-right'],
  knowledge: ['kb-browse', 'kb-doc', 'kb-search'],
  settings: ['settings-page'],
  sources: ['source-detail'],
  skills: ['skill-detail'],
  connectors: ['connectors-console'],
}

/** Per workspace + module so chat kept open in RSS survives leaving/returning. */
export function workbenchLayoutSuffix(workspaceId: string, moduleId: string): string {
  return `${LAYOUT_SUFFIX_PREFIX}:${workspaceId}:${moduleId}`
}

/** Pre-module-scoped key (agents-only era). */
export function workbenchLayoutSuffixLegacy(workspaceId: string): string {
  return `${LAYOUT_SUFFIX_PREFIX}:${workspaceId}`
}

export function layoutMatchesModule(
  layout: SerializedDockview,
  moduleId: string,
): boolean {
  const markers = MODULE_LAYOUT_MARKERS[moduleId]
  if (!markers) return true

  const panels = layout.panels ?? {}
  const ids = new Set(Object.keys(panels))
  const components = new Set(
    Object.values(panels).map((p) => {
      const entry = p as { contentComponent?: string }
      return entry.contentComponent ?? ''
    }),
  )

  return markers.some((m) => components.has(m) || ids.has(m))
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
    if (isValidLayout(raw) && layoutMatchesModule(raw, moduleId)) return raw

    // Migrate: first agents open may still have the old workspace-only key.
    if (moduleId === 'agents') {
      const legacy = storage.get<SerializedDockview | null>(
        LAYOUT_KEY,
        null,
        workbenchLayoutSuffixLegacy(workspaceId),
      )
      if (isValidLayout(legacy) && layoutMatchesModule(legacy, moduleId)) return legacy
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
  /** Drop a pending debounce without writing (call at the start of a module switch). */
  cancelPending: () => void
} {
  let timer: ReturnType<typeof setTimeout> | null = null
  /** Module id captured when the pending save was scheduled. */
  let pendingModuleId: string | null = null

  const write = (api: DockviewApi, moduleId: string) => {
    try {
      savePersistedLayout(workspaceId, moduleId, api.toJSON())
    } catch (err) {
      console.warn('[workbench] failed to persist layout', err)
    }
  }

  const flush = (api: DockviewApi) => {
    const moduleId = pendingModuleId ?? getModuleId()
    pendingModuleId = null
    write(api, moduleId)
  }

  const cancelPending = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    pendingModuleId = null
  }

  const schedule = (api: DockviewApi) => {
    // Capture module id at schedule time so a later ActivityBar switch cannot
    // attribute this dock snapshot to the incoming module (Sites/RSS/etc.).
    const moduleIdAtSchedule = getModuleId()
    if (timer) clearTimeout(timer)
    pendingModuleId = moduleIdAtSchedule
    timer = setTimeout(() => {
      timer = null
      const still = pendingModuleId
      pendingModuleId = null
      // Module changed since schedule — shell already saved the outgoing layout.
      if (still == null || getModuleId() !== still) return
      write(api, still)
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
    cancelPending,
  }
}
