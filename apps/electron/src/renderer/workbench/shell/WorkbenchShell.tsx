import { useEffect, useRef } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import type { AppShellContextType } from '@/context/AppShellContext'
import { EscapeInterruptProvider } from '@/context/EscapeInterruptContext'
import { ensureWorkbenchModulesRegistered } from '../modules'
import { useAutomationsDeepLink } from '../modules/automations'
import { getModule } from '../registry/module-registry'
import {
  activeModuleIdAtom,
  cancelLayoutPersistAtom,
  dockviewApiAtom,
  layoutModuleIdAtom,
} from '../store/workbench-store'
import { WorkspaceDataProvider } from '../providers/WorkspaceDataProvider'
import { ActivityBar } from './ActivityBar'
import { WorkbenchTopBar } from './WorkbenchTopBar'
import { DockviewHost } from '../dock/DockviewHost'
import {
  applyLayout,
  loadPersistedLayout,
  resolveModuleLayout,
  savePersistedLayout,
} from '../dock/layout-manager'

type WorkbenchShellProps = {
  contextValue: AppShellContextType
  /** Optional extras forwarded for parity with AppShell (unused for now). */
  menuNewChatTrigger?: number
  isFocusedMode?: boolean
}

/**
 * Feature-flagged workbench shell: TopBar + ActivityBar + dockview layout.
 * Dual-shell parallel with AppShell — enable via GROSE_FEATURE_WORKBENCH_SHELL.
 */
export function WorkbenchShell({ contextValue }: WorkbenchShellProps) {
  ensureWorkbenchModulesRegistered()

  return (
    <EscapeInterruptProvider>
      <WorkspaceDataProvider contextValue={contextValue}>
        <div className="h-full flex flex-col min-h-0">
          <WorkbenchTopBar />
          <div className="flex-1 min-h-0">
            <WorkbenchShellInner workspaceId={contextValue.activeWorkspaceId} />
          </div>
        </div>
      </WorkspaceDataProvider>
    </EscapeInterruptProvider>
  )
}

function WorkbenchShellInner({ workspaceId }: { workspaceId: string | null }) {
  const activeModuleId = useAtomValue(activeModuleIdAtom)
  const api = useAtomValue(dockviewApiAtom)
  const cancelLayoutPersist = useAtomValue(cancelLayoutPersistAtom)
  const setLayoutModuleId = useSetAtom(layoutModuleIdAtom)
  const mod = getModule(activeModuleId)
  const ActivityView = mod?.activityView
  const prevModuleRef = useRef<string | null>(null)

  // Classic automations/* routes → Automations module + Rules surface
  useAutomationsDeepLink()

  // Reset when workspace (and DockviewHost) remounts.
  useEffect(() => {
    prevModuleRef.current = null
  }, [workspaceId])

  // Persist outgoing module layout; restore incoming (or apply default).
  // Skip first paint — DockviewHost already restored for the active module.
  useEffect(() => {
    if (!api || !mod || !workspaceId) return
    const prev = prevModuleRef.current
    if (prev === mod.id) return

    // Drop in-flight debounce so it cannot write the outgoing dock snapshot
    // under the incoming module key (Sites/RSS/etc. looking like Agents).
    cancelLayoutPersist?.()

    if (prev !== null) {
      try {
        savePersistedLayout(workspaceId, prev, api.toJSON())
      } catch (err) {
        console.warn(`[workbench] failed to save layout for module "${prev}"`, err)
      }
    }

    prevModuleRef.current = mod.id
    if (prev === null) {
      setLayoutModuleId(mod.id)
      return
    }

    const saved = loadPersistedLayout(workspaceId, mod.id)
    try {
      if (saved) {
        api.fromJSON(saved)
      } else {
        const layout = resolveModuleLayout(mod.defaultLayout)
        if (!layout) {
          setLayoutModuleId(mod.id)
          return
        }
        applyLayout(api, layout, api.width || 1200, api.height || 800)
      }
    } catch (err) {
      console.warn(`[workbench] failed to apply layout for module "${mod.id}"`, err)
      const layout = resolveModuleLayout(mod.defaultLayout)
      if (layout) {
        try {
          applyLayout(api, layout, api.width || 1200, api.height || 800)
        } catch {
          /* already logged */
        }
      }
    }
    // Layout now belongs to the ActivityBar selection — safe to persist again.
    setLayoutModuleId(mod.id)
  }, [api, mod, workspaceId, cancelLayoutPersist, setLayoutModuleId])

  if (!workspaceId) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        No workspace selected.
      </div>
    )
  }

  return (
    <div className="h-full flex min-h-0">
      <ActivityBar />
      {ActivityView ? (
        <aside className="w-56 shrink-0 border-r border-border overflow-auto">
          <ActivityView />
        </aside>
      ) : null}
      <DockviewHost workspaceId={workspaceId} />
    </div>
  )
}
