import { useEffect, useRef } from 'react'
import { useAtomValue } from 'jotai'
import type { AppShellContextType } from '@/context/AppShellContext'
import { AppShellProvider } from '@/context/AppShellContext'
import { EscapeInterruptProvider } from '@/context/EscapeInterruptContext'
import { ensureWorkbenchModulesRegistered } from '../modules'
import { getModule } from '../registry/module-registry'
import { activeModuleIdAtom, dockviewApiAtom } from '../store/workbench-store'
import { ActivityBar } from './ActivityBar'
import { DockviewHost } from '../dock/DockviewHost'
import { applyLayout, getLayoutPreset } from '../dock/layout-manager'
import type { LayoutPresetId, LayoutState } from '../registry/types'

type WorkbenchShellProps = {
  contextValue: AppShellContextType
  /** Optional extras forwarded for parity with AppShell (unused for now). */
  menuNewChatTrigger?: number
  isFocusedMode?: boolean
}

/**
 * Feature-flagged workbench shell: ActivityBar + dockview layout.
 * Dual-shell parallel with AppShell — enable via CRAFT_FEATURE_WORKBENCH_SHELL.
 */
export function WorkbenchShell({ contextValue }: WorkbenchShellProps) {
  ensureWorkbenchModulesRegistered()

  return (
    <EscapeInterruptProvider>
      <AppShellProvider value={contextValue}>
        <WorkbenchShellInner workspaceId={contextValue.activeWorkspaceId} />
      </AppShellProvider>
    </EscapeInterruptProvider>
  )
}

function resolveModuleLayout(
  defaultLayout: LayoutPresetId | LayoutState | undefined,
): LayoutState | null {
  if (!defaultLayout) return null
  if (typeof defaultLayout === 'string') return getLayoutPreset(defaultLayout)
  return defaultLayout
}

function WorkbenchShellInner({ workspaceId }: { workspaceId: string | null }) {
  const activeModuleId = useAtomValue(activeModuleIdAtom)
  const api = useAtomValue(dockviewApiAtom)
  const mod = getModule(activeModuleId)
  const ActivityView = mod?.activityView
  const prevModuleRef = useRef<string | null>(null)

  // Reset when workspace (and DockviewHost) remounts.
  useEffect(() => {
    prevModuleRef.current = null
  }, [workspaceId])

  // Apply module default layout on ActivityBar switch (not on first agents paint —
  // DockviewHost already restores persisted / agents-default).
  useEffect(() => {
    if (!api || !mod) return
    const prev = prevModuleRef.current
    if (prev === mod.id) return
    prevModuleRef.current = mod.id
    if (prev === null && mod.id === 'agents') return

    const layout = resolveModuleLayout(mod.defaultLayout)
    if (!layout) return
    try {
      applyLayout(api, layout, api.width || 1200, api.height || 800)
    } catch (err) {
      console.warn(`[workbench] failed to apply layout for module "${mod.id}"`, err)
    }
  }, [api, mod])

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
