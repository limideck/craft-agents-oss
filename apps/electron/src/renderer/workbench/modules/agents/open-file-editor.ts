import { getDefaultStore, useStore } from 'jotai'
import { useCallback } from 'react'
import { focusOrAddPanel, CENTER_GROUP } from '../../dock/layout-manager'
import { dockviewApiAtom } from '../../store/workbench-store'
import { baseName } from '../../components/file-tree-utils'

export const PREVIEW_FILE_EDITOR_ID = 'preview:file-editor'
export const FILE_EDITOR_COMPONENT = 'file-editor'

type JotaiStore = ReturnType<typeof getDefaultStore>

function pinnedFilePanelId(path: string): string {
  return `file:${path}`
}

/**
 * Open (or replace) the VS Code–style file preview panel in the center/chat group.
 * Single-click opens the shared preview slot; `pin: true` opens a dedicated tab.
 */
export function openFileEditor(options: {
  path: string
  pin?: boolean
  store?: JotaiStore
}): void {
  const store = options.store ?? getDefaultStore()
  const api = store.get(dockviewApiAtom)
  if (!api) {
    console.warn('[openFileEditor] dockview API not ready')
    return
  }

  const name = baseName(options.path)
  const chatPanel = api.getPanel('chat')
  const referenceGroupId = chatPanel?.group?.id ?? CENTER_GROUP

  if (options.pin) {
    const id = pinnedFilePanelId(options.path)
    focusOrAddPanel(api, {
      id,
      component: FILE_EDITOR_COMPONENT,
      title: name,
      params: { path: options.path, pinned: true },
      referenceGroupId,
      placement: 'active-group',
    })
    return
  }

  // Prefer an already-pinned tab for this path.
  const pinned = api.getPanel(pinnedFilePanelId(options.path))
  if (pinned) {
    pinned.api.setActive()
    return
  }

  focusOrAddPanel(api, {
    id: PREVIEW_FILE_EDITOR_ID,
    component: FILE_EDITOR_COMPONENT,
    title: name,
    params: { path: options.path, previewItemId: options.path },
    referenceGroupId,
    placement: 'active-group',
  })
}

/** React hook for Files panel / context menus. */
export function useOpenFileEditor() {
  const store = useStore()
  return useCallback(
    (path: string, opts?: { pin?: boolean }) => {
      openFileEditor({ path, pin: opts?.pin, store })
    },
    [store],
  )
}
