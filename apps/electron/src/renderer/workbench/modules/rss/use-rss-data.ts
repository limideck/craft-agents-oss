import { useCallback, useEffect } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useAppShellContext } from '@/context/AppShellContext'
import { activeModuleIdAtom } from '../../store/workbench-store'
import {
  filterArticlesByLocalSelection,
  articleType,
} from './local-meta'
import {
  rssArticlesAtom,
  rssCatalogAtom,
  rssErrorAtom,
  rssFeedsAtom,
  rssListModeAtom,
  rssLoadingAtom,
  rssLocalStateAtom,
  rssSearchQueryAtom,
  rssSelectedArticleIdAtom,
  rssSidebarSelectionAtom,
  rssStarredCountAtom,
  rssTypeFilterAtom,
  selectionToQuery,
} from './store'

let refreshSeq = 0
let sharedRefresh: (() => Promise<void>) | null = null

/** Imperative refresh used by Add feed / star / refresh buttons. */
export function refreshRssData(): Promise<void> {
  return sharedRefresh?.() ?? Promise.resolve()
}

type Options = {
  /** Only one panel should bootstrap (FeedsPanel). Others only register consumers. */
  bootstrap?: boolean
}

/** Load feeds + articles for the active workspace. */
export function useRssWorkspaceData(options: Options = {}) {
  const bootstrap = options.bootstrap ?? false
  const { activeWorkspaceId } = useAppShellContext()
  const activeModuleId = useAtomValue(activeModuleIdAtom)
  const selection = useAtomValue(rssSidebarSelectionAtom)
  const query = useAtomValue(rssSearchQueryAtom)
  const listMode = useAtomValue(rssListModeAtom)
  const typeFilter = useAtomValue(rssTypeFilterAtom)
  const localState = useAtomValue(rssLocalStateAtom)
  const setFeeds = useSetAtom(rssFeedsAtom)
  const setArticles = useSetAtom(rssArticlesAtom)
  const setCatalog = useSetAtom(rssCatalogAtom)
  const setStarredCount = useSetAtom(rssStarredCountAtom)
  const setLoading = useSetAtom(rssLoadingAtom)
  const setError = useSetAtom(rssErrorAtom)
  const setSelectedArticleId = useSetAtom(rssSelectedArticleIdAtom)

  const refresh = useCallback(async () => {
    if (!activeWorkspaceId || !window.electronAPI?.rssListFeeds) {
      setLoading(false)
      setError(activeWorkspaceId ? 'RSS API unavailable' : 'No workspace')
      return
    }

    const seq = ++refreshSeq
    setLoading(true)
    setError(null)
    try {
      const [feeds, starred] = await Promise.all([
        window.electronAPI.rssListFeeds(activeWorkspaceId),
        window.electronAPI.rssStarredCount(activeWorkspaceId),
      ])
      if (seq !== refreshSeq) return
      setFeeds(feeds)
      setStarredCount(starred.count)

      const { view, feedId } = selectionToQuery(selection)
      const q = query.trim()
      const result = await window.electronAPI.rssListArticles(activeWorkspaceId, {
        view,
        feedId,
        mode: listMode,
        q: q || undefined,
      })
      if (seq !== refreshSeq) return

      setCatalog(result.articles)

      let articles = result.articles

      if (selection.kind === 'library' || selection.kind === 'tag') {
        articles = filterArticlesByLocalSelection(articles, localState.metaById, selection)
      }

      if (typeFilter !== 'all') {
        articles = articles.filter((a) => articleType(a) === typeFilter)
      }

      setArticles(articles)
      // Never auto-advance when the current selection leaves the filtered list
      // (e.g. marked read on 未读). Keep selection so the reader stays put;
      // mark-read only runs on explicit list click, so a sticky id is safe.
      setSelectedArticleId((prev) => {
        if (prev) return prev
        return articles[0]?.id ?? null
      })
    } catch (err) {
      if (seq !== refreshSeq) return
      setError(err instanceof Error ? err.message : String(err))
      setArticles([])
      setCatalog([])
    } finally {
      if (seq === refreshSeq) setLoading(false)
    }
  }, [
    activeWorkspaceId,
    selection,
    query,
    listMode,
    typeFilter,
    localState.metaById,
    setFeeds,
    setArticles,
    setCatalog,
    setStarredCount,
    setLoading,
    setError,
    setSelectedArticleId,
  ])

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

  // Re-fetch when returning to the RSS module so MCP-added feeds appear without a manual refresh.
  useEffect(() => {
    if (!bootstrap || activeModuleId !== 'rss') return
    void refresh()
  }, [bootstrap, activeModuleId, refresh])

  return { refresh, workspaceId: activeWorkspaceId }
}
