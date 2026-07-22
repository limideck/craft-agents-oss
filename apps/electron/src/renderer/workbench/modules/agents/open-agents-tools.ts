import { getDefaultStore, useStore } from 'jotai'
import { useCallback, useEffect, useState } from 'react'
import type { DockviewApi } from 'dockview-react'
import {
  focusOrAddPanel,
  RIGHT_BOTTOM_GROUP,
  RIGHT_TOP_GROUP,
} from '../../dock/layout-manager'
import { dockviewApiAtom } from '../../store/workbench-store'

type JotaiStore = ReturnType<typeof getDefaultStore>

/** Agents right-column tool panels (Files / Changes / Terminal). */
export const AGENTS_TOOL_PANELS = [
  { id: 'files', component: 'files', title: 'Files', group: 'top' as const },
  { id: 'changes', component: 'changes', title: 'Changes', group: 'top' as const },
  { id: 'terminal', component: 'terminal', title: 'Terminal', group: 'bottom' as const },
] as const

export type AgentsToolPanelId = (typeof AGENTS_TOOL_PANELS)[number]['id']

const TOOL_IDS: readonly AgentsToolPanelId[] = AGENTS_TOOL_PANELS.map((p) => p.id)

export function isAgentsRightToolsOpen(api: DockviewApi | null | undefined): boolean {
  if (!api) return false
  return TOOL_IDS.some((id) => !!api.getPanel(id))
}

export function getOpenAgentsToolPanelIds(api: DockviewApi | null | undefined): AgentsToolPanelId[] {
  if (!api) return []
  return TOOL_IDS.filter((id) => !!api.getPanel(id))
}

function toolDef(id: AgentsToolPanelId) {
  return AGENTS_TOOL_PANELS.find((p) => p.id === id)!
}

/** Resolve a stable reference for splitting the right tools column beside chat. */
function chatReferenceGroupId(api: DockviewApi): string | undefined {
  return api.getPanel('chat')?.group?.id
}

/**
 * Focus an existing Agents tool panel, or add it as a tab / split.
 * When the right column is gone, top panels open to the right of chat;
 * Terminal opens below the top tools group (or right of chat if none).
 */
export function openAgentsToolPanel(options: {
  id: AgentsToolPanelId
  store?: JotaiStore
  /** Prefer adding as a tab inside this dockview group id. */
  referenceGroupId?: string
}): void {
  const store = options.store ?? getDefaultStore()
  const api = store.get(dockviewApiAtom)
  if (!api) {
    console.warn('[openAgentsToolPanel] dockview API not ready')
    return
  }

  const def = toolDef(options.id)
  const existing = api.getPanel(def.id)
  if (existing) {
    existing.api.setActive()
    return
  }

  if (options.referenceGroupId && api.getGroup(options.referenceGroupId)) {
    focusOrAddPanel(api, {
      id: def.id,
      component: def.component,
      title: def.title,
      referenceGroupId: options.referenceGroupId,
      placement: 'active-group',
    })
    return
  }

  if (def.group === 'top') {
    const topGroup =
      api.getGroup(RIGHT_TOP_GROUP) ??
      api.getPanel('files')?.group ??
      api.getPanel('changes')?.group
    if (topGroup) {
      focusOrAddPanel(api, {
        id: def.id,
        component: def.component,
        title: def.title,
        referenceGroupId: topGroup.id,
        placement: 'active-group',
      })
      return
    }
    const chatGroupId = chatReferenceGroupId(api)
    focusOrAddPanel(api, {
      id: def.id,
      component: def.component,
      title: def.title,
      referenceGroupId: chatGroupId,
      placement: 'right',
    })
    return
  }

  // Terminal: below top tools when present, else right of chat.
  const topAnchor =
    api.getGroup(RIGHT_TOP_GROUP) ??
    api.getPanel('files')?.group ??
    api.getPanel('changes')?.group
  if (topAnchor) {
    focusOrAddPanel(api, {
      id: def.id,
      component: def.component,
      title: def.title,
      referenceGroupId: topAnchor.id,
      placement: 'below',
    })
    return
  }

  const bottomGroup = api.getGroup(RIGHT_BOTTOM_GROUP)
  if (bottomGroup) {
    focusOrAddPanel(api, {
      id: def.id,
      component: def.component,
      title: def.title,
      referenceGroupId: bottomGroup.id,
      placement: 'active-group',
    })
    return
  }

  const chatGroupId = chatReferenceGroupId(api)
  focusOrAddPanel(api, {
    id: def.id,
    component: def.component,
    title: def.title,
    referenceGroupId: chatGroupId,
    placement: 'right',
  })
}

/**
 * Reopen the default Agents right tools column (Files + Changes + Terminal).
 * Focuses any already-open tool panels; otherwise restores the default set.
 */
export function openAgentsRightTools(options?: { store?: JotaiStore }): void {
  const store = options?.store ?? getDefaultStore()
  const api = store.get(dockviewApiAtom)
  if (!api) {
    console.warn('[openAgentsRightTools] dockview API not ready')
    return
  }

  if (isAgentsRightToolsOpen(api)) {
    for (const id of TOOL_IDS) {
      const panel = api.getPanel(id)
      if (panel) {
        panel.api.setActive()
        return
      }
    }
  }

  openAgentsToolPanel({ id: 'files', store })
  openAgentsToolPanel({ id: 'changes', store })
  openAgentsToolPanel({ id: 'terminal', store })
  api.getPanel('files')?.api.setActive()
}

/** React: whether any Agents right-tool panel is currently docked. */
export function useAgentsRightToolsOpen(): boolean {
  const store = useStore()
  const [open, setOpen] = useState(() => isAgentsRightToolsOpen(store.get(dockviewApiAtom)))

  useEffect(() => {
    const sync = () => setOpen(isAgentsRightToolsOpen(store.get(dockviewApiAtom)))
    sync()
    // Re-subscribe when dockview api instance changes.
    let removeAdd: { dispose: () => void } | undefined
    let removeRemove: { dispose: () => void } | undefined
    const attach = (api: DockviewApi | null) => {
      removeAdd?.dispose()
      removeRemove?.dispose()
      removeAdd = undefined
      removeRemove = undefined
      if (!api) {
        setOpen(false)
        return
      }
      setOpen(isAgentsRightToolsOpen(api))
      removeAdd = api.onDidAddPanel(sync)
      removeRemove = api.onDidRemovePanel(sync)
    }
    attach(store.get(dockviewApiAtom))
    const unsub = store.sub(dockviewApiAtom, () => attach(store.get(dockviewApiAtom)))
    return () => {
      unsub()
      removeAdd?.dispose()
      removeRemove?.dispose()
    }
  }, [store])

  return open
}

export function useOpenAgentsRightTools() {
  const store = useStore()
  return useCallback(() => openAgentsRightTools({ store }), [store])
}

export function useOpenAgentsToolPanel() {
  const store = useStore()
  return useCallback(
    (id: AgentsToolPanelId, opts?: { referenceGroupId?: string }) =>
      openAgentsToolPanel({ id, store, referenceGroupId: opts?.referenceGroupId }),
    [store],
  )
}
