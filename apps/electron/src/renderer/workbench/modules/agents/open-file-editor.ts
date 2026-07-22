import { atom, getDefaultStore, useAtomValue, useStore } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { useCallback } from 'react'
import {
  focusOrAddPanel,
  CENTER_GROUP,
} from '../../dock/layout-manager'
import { dockviewApiAtom } from '../../store/workbench-store'
import { baseName } from '../../components/file-tree-utils'
import { openAgentsToolPanel } from './open-agents-tools'

export const PREVIEW_FILE_EDITOR_ID = 'preview:file-editor'
export const FILE_EDITOR_COMPONENT = 'file-editor'
export const FILES_PANEL_ID = 'files'
export const FILES_COMPONENT = 'files'

/** Last path opened in the Agents Preview dock panel (persisted). */
export const lastPreviewPathAtom = atomWithStorage<string | null>(
  'grose-agents-last-preview-path',
  null,
)

/** Path to highlight/select in the Agents Files panel (e.g. from chat file links). */
export const filesPanelSelectedPathAtom = atom<string | null>(null)

type JotaiStore = ReturnType<typeof getDefaultStore>

function pinnedFilePanelId(path: string): string {
  return `file:${path}`
}

function rememberPreviewPath(store: JotaiStore, path: string): void {
  store.set(lastPreviewPathAtom, path)
}

/**
 * Open (or replace) the VS Code–style file preview panel in the center/chat group.
 * Single-click opens the shared preview slot; `pin: true` opens a dedicated tab.
 */
export function openFileEditor(options: {
  path: string
  pin?: boolean
  store?: JotaiStore
  /** When true, also focus the Files panel and highlight `path` in the tree. */
  revealInFiles?: boolean
}): void {
  const store = options.store ?? getDefaultStore()
  const api = store.get(dockviewApiAtom)
  if (!api) {
    console.warn('[openFileEditor] dockview API not ready')
    return
  }

  rememberPreviewPath(store, options.path)
  if (options.revealInFiles) {
    store.set(filesPanelSelectedPathAtom, options.path)
    openFilesPanel({ store })
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

/** Focus or add the Agents Files panel (right column). */
export function openFilesPanel(options?: {
  store?: JotaiStore
  /** Optional path to select/highlight in the Files tree. */
  selectPath?: string | null
}): void {
  const store = options?.store ?? getDefaultStore()
  const api = store.get(dockviewApiAtom)
  if (!api) {
    console.warn('[openFilesPanel] dockview API not ready')
    return
  }

  if (options?.selectPath) {
    store.set(filesPanelSelectedPathAtom, options.selectPath)
  }

  // Shared tools path restores a missing right column beside chat
  // instead of nesting Files as a center tab.
  openAgentsToolPanel({ id: 'files', store })
}

/**
 * Reopen the Preview panel using `path`, else `lastPreviewPath`, else an empty
 * “选择文件” slot so the panel is visible again.
 */
export function reopenFilePreview(options?: {
  path?: string | null
  store?: JotaiStore
}): void {
  const store = options?.store ?? getDefaultStore()
  const path = options?.path ?? store.get(lastPreviewPathAtom)
  if (path) {
    openFileEditor({ path, store })
    return
  }

  const api = store.get(dockviewApiAtom)
  if (!api) {
    console.warn('[reopenFilePreview] dockview API not ready')
    return
  }

  const chatPanel = api.getPanel('chat')
  const referenceGroupId = chatPanel?.group?.id ?? CENTER_GROUP

  focusOrAddPanel(api, {
    id: PREVIEW_FILE_EDITOR_ID,
    component: FILE_EDITOR_COMPONENT,
    title: '预览',
    params: {},
    referenceGroupId,
    placement: 'active-group',
  })
}

/** React hook for Files panel / context menus. */
export function useOpenFileEditor() {
  const store = useStore()
  return useCallback(
    (path: string, opts?: { pin?: boolean; revealInFiles?: boolean }) => {
      openFileEditor({ path, pin: opts?.pin, revealInFiles: opts?.revealInFiles, store })
    },
    [store],
  )
}

export function useOpenFilesPanel() {
  const store = useStore()
  return useCallback(
    (opts?: { selectPath?: string | null }) => openFilesPanel({ store, selectPath: opts?.selectPath }),
    [store],
  )
}

export function useFilesPanelSelectedPath() {
  return useAtomValue(filesPanelSelectedPathAtom)
}

export function useReopenFilePreview() {
  const store = useStore()
  return useCallback(
    (path?: string | null) => reopenFilePreview({ path, store }),
    [store],
  )
}

export function useLastPreviewPath() {
  return useAtomValue(lastPreviewPathAtom)
}
