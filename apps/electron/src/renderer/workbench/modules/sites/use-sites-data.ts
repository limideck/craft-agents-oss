import { useCallback, useEffect } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import type { GroseModulesSite } from '@grose-agent/shared/grose-modules'
import { useAppShellContext } from '@/context/AppShellContext'
import { activeModuleIdAtom } from '../../store/workbench-store'
import {
  selectedSiteIdAtom,
  sitesAtom,
  sitesErrorAtom,
  sitesFileContentAtom,
  sitesFileTreeAtom,
  sitesFilesLoadingAtom,
  sitesLoadingAtom,
  sitesPreviewStatusAtom,
  sitesPreviewUrlAtom,
  sitesSelectedFilePathAtom,
} from './store'

let refreshSeq = 0
let sharedRefresh: (() => Promise<void>) | null = null

function hasSitesApi(): boolean {
  return typeof window.electronAPI?.sitesList === 'function'
}

/** Imperative refresh used after create / delete / bind. */
export function refreshSitesData(): Promise<void> {
  return sharedRefresh?.() ?? Promise.resolve()
}

type Options = {
  bootstrap?: boolean
}

/** Load sites for the active workspace via electronAPI only. */
export function useSitesWorkspaceData(options: Options = {}) {
  const bootstrap = options.bootstrap ?? false
  const { activeWorkspaceId } = useAppShellContext()
  const activeModuleId = useAtomValue(activeModuleIdAtom)
  const setSites = useSetAtom(sitesAtom)
  const setLoading = useSetAtom(sitesLoadingAtom)
  const setError = useSetAtom(sitesErrorAtom)
  const setSelectedId = useSetAtom(selectedSiteIdAtom)
  const setPreviewUrl = useSetAtom(sitesPreviewUrlAtom)
  const setPreviewStatus = useSetAtom(sitesPreviewStatusAtom)

  const refresh = useCallback(async () => {
    if (!activeWorkspaceId || !hasSitesApi()) {
      setLoading(false)
      setError(activeWorkspaceId ? 'Sites API unavailable' : 'No workspace')
      return
    }

    const seq = ++refreshSeq
    setLoading(true)
    setError(null)
    try {
      const list = await window.electronAPI.sitesList(activeWorkspaceId)
      if (seq !== refreshSeq) return
      setSites(list)
      setSelectedId((prev) => {
        if (prev && list.some((s) => s.id === prev)) return prev
        return list[0]?.id ?? null
      })
    } catch (err) {
      if (seq !== refreshSeq) return
      setError(err instanceof Error ? err.message : String(err))
      setSites([])
    } finally {
      if (seq === refreshSeq) setLoading(false)
    }
  }, [activeWorkspaceId, setSites, setLoading, setError, setSelectedId])

  useEffect(() => {
    sharedRefresh = refresh
    return () => {
      if (sharedRefresh === refresh) sharedRefresh = null
    }
  }, [refresh])

  useEffect(() => {
    if (!bootstrap) return
    void refresh()
  }, [bootstrap, refresh])

  useEffect(() => {
    if (!bootstrap || activeModuleId !== 'sites') return
    void refresh()
  }, [bootstrap, activeModuleId, refresh])

  /** Sync preview URL from selected site metadata when list refreshes. */
  const selectedId = useAtomValue(selectedSiteIdAtom)
  const sites = useAtomValue(sitesAtom)
  useEffect(() => {
    const site = sites.find((s) => s.id === selectedId)
    if (!site) {
      setPreviewUrl(null)
      setPreviewStatus(null)
      return
    }
    setPreviewUrl(site.previewUrl)
    setPreviewStatus(site.status)
  }, [selectedId, sites, setPreviewUrl, setPreviewStatus])

  return { refresh, workspaceId: activeWorkspaceId }
}

/** Load file tree + content for the selected site. */
export function useSitesFilesData() {
  const { activeWorkspaceId } = useAppShellContext()
  const selectedId = useAtomValue(selectedSiteIdAtom)
  const selectedPath = useAtomValue(sitesSelectedFilePathAtom)
  const setTree = useSetAtom(sitesFileTreeAtom)
  const setContent = useSetAtom(sitesFileContentAtom)
  const setLoading = useSetAtom(sitesFilesLoadingAtom)
  const setSelectedPath = useSetAtom(sitesSelectedFilePathAtom)

  const loadTree = useCallback(async () => {
    if (!activeWorkspaceId || !selectedId || !hasSitesApi()) {
      setTree([])
      setContent(null)
      return
    }
    setLoading(true)
    try {
      const tree = await window.electronAPI.sitesListFiles(activeWorkspaceId, selectedId)
      setTree(tree)
      setSelectedPath((prev) => {
        if (prev) return prev
        const first = findFirstFile(tree)
        return first?.path ?? null
      })
    } catch {
      setTree([])
    } finally {
      setLoading(false)
    }
  }, [activeWorkspaceId, selectedId, setTree, setContent, setLoading, setSelectedPath])

  useEffect(() => {
    setSelectedPath(null)
    setContent(null)
    void loadTree()
  }, [selectedId, loadTree, setSelectedPath, setContent])

  useEffect(() => {
    if (!activeWorkspaceId || !selectedId || !selectedPath || !hasSitesApi()) {
      setContent(null)
      return
    }
    let cancelled = false
    void window.electronAPI
      .sitesReadFile(activeWorkspaceId, selectedId, selectedPath)
      .then((res) => {
        if (!cancelled) setContent(res.content)
      })
      .catch(() => {
        if (!cancelled) setContent(null)
      })
    return () => {
      cancelled = true
    }
  }, [activeWorkspaceId, selectedId, selectedPath, setContent])

  return { loadTree, workspaceId: activeWorkspaceId, siteId: selectedId }
}

function findFirstFile(
  nodes: import('@grose-agent/shared/grose-modules').GroseModulesSiteFileNode[],
): import('@grose-agent/shared/grose-modules').GroseModulesSiteFileNode | null {
  for (const n of nodes) {
    if (n.type === 'file') return n
    if (n.children?.length) {
      const found = findFirstFile(n.children)
      if (found) return found
    }
  }
  return null
}

export function upsertSiteInList(
  list: GroseModulesSite[],
  site: GroseModulesSite,
): GroseModulesSite[] {
  const idx = list.findIndex((s) => s.id === site.id)
  if (idx < 0) return [site, ...list]
  const next = list.slice()
  next[idx] = site
  return next
}
