import { useCallback, useEffect } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useAppShellContext } from '@/context/AppShellContext'
import {
  rssArticlesAtom,
  rssErrorAtom,
  rssFeedsAtom,
  rssListModeAtom,
  rssLoadingAtom,
  rssSearchQueryAtom,
  rssSelectedArticleIdAtom,
  rssSidebarSelectionAtom,
  rssStarredCountAtom,
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
  const selection = useAtomValue(rssSidebarSelectionAtom)
  const query = useAtomValue(rssSearchQueryAtom)
  const listMode = useAtomValue(rssListModeAtom)
  const setFeeds = useSetAtom(rssFeedsAtom)
  const setArticles = useSetAtom(rssArticlesAtom)
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
      setArticles(result.articles)
      setSelectedArticleId((prev) => {
        if (prev && result.articles.some((a) => a.id === prev)) return prev
        return result.articles[0]?.id ?? null
      })
    } catch (err) {
      if (seq !== refreshSeq) return
      setError(err instanceof Error ? err.message : String(err))
      setArticles([])
    } finally {
      if (seq === refreshSeq) setLoading(false)
    }
  }, [
    activeWorkspaceId,
    selection,
    query,
    listMode,
    setFeeds,
    setArticles,
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

  return { refresh, workspaceId: activeWorkspaceId }
}
