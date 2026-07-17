import { useMemo } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { Search } from 'lucide-react'
import { PanelRoot, PanelBody, PanelHeaderBar } from '../../../dock/panel-primitives'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { getFeedById, MOCK_ARTICLES } from '../mock/data'
import {
  isArticleUnread,
  rssMockReadyAtom,
  rssReadOverridesAtom,
  rssSearchQueryAtom,
  rssSelectedArticleIdAtom,
  rssSelectedFeedIdAtom,
} from '../store'
import { formatRelativeTime } from '../utils'
import { RssSkeletonRows, useRssMockReady } from '../components/rss-skeleton'

/**
 * Article list — title, source, time, unread; filter/search chrome (mock).
 */
export function ArticleListPanel() {
  useRssMockReady()
  const ready = useAtomValue(rssMockReadyAtom)
  const feedFilter = useAtomValue(rssSelectedFeedIdAtom)
  const [query, setQuery] = useAtom(rssSearchQueryAtom)
  const [selectedId, setSelectedId] = useAtom(rssSelectedArticleIdAtom)
  const overrides = useAtomValue(rssReadOverridesAtom)
  const setOverrides = useSetAtom(rssReadOverridesAtom)

  const articles = useMemo(() => {
    const q = query.trim().toLowerCase()
    return MOCK_ARTICLES.filter((a) => {
      const unread = isArticleUnread(a.id, a.unread, overrides)
      if (feedFilter === 'unread' && !unread) return false
      if (feedFilter !== 'all' && feedFilter !== 'unread' && a.feedId !== feedFilter) return false
      if (!q) return true
      const feedTitle = getFeedById(a.feedId)?.title ?? ''
      return (
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        feedTitle.toLowerCase().includes(q)
      )
    }).sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
  }, [feedFilter, overrides, query])

  const headerLabel =
    feedFilter === 'all'
      ? 'All articles'
      : feedFilter === 'unread'
        ? 'Unread'
        : (getFeedById(feedFilter)?.title ?? 'Articles')

  return (
    <PanelRoot>
      <PanelHeaderBar className="justify-between gap-2">
        <span className="font-medium truncate min-w-0">{headerLabel}</span>
        <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground">
          {articles.length}
        </span>
      </PanelHeaderBar>
      <div className="shrink-0 border-b border-border/80 px-2.5 py-1.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter articles…"
            className="h-7 pl-7 text-xs bg-muted/40 border-0 shadow-none focus-visible:ring-1"
            aria-label="Filter articles"
          />
        </div>
      </div>
      <PanelBody padding={false} className="p-0">
        {!ready ? (
          <RssSkeletonRows rows={7} />
        ) : articles.length === 0 ? (
          <div className="flex h-full min-h-[120px] items-center justify-center p-4 text-center text-sm text-muted-foreground">
            No articles match this filter.
          </div>
        ) : (
          <ul className="py-1" role="listbox" aria-label="Articles">
            {articles.map((article) => {
              const unread = isArticleUnread(article.id, article.unread, overrides)
              const feed = getFeedById(article.feedId)
              const active = selectedId === article.id
              return (
                <li key={article.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={cn(
                      'w-full text-left px-3 py-2.5 border-l-2 border-transparent',
                      'hover:bg-foreground-5 focus-visible:outline-none focus-visible:bg-foreground-5',
                      active && 'bg-foreground-10 border-l-foreground',
                    )}
                    onClick={() => {
                      setSelectedId(article.id)
                      if (unread) {
                        setOverrides((prev) => ({ ...prev, [article.id]: true }))
                      }
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={cn(
                          'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                          unread ? 'bg-foreground' : 'bg-transparent',
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div
                          className={cn(
                            'text-sm leading-snug line-clamp-2',
                            unread ? 'font-medium text-foreground' : 'text-foreground/80',
                          )}
                        >
                          {article.title}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
                          <span className="truncate">{feed?.title ?? 'Unknown'}</span>
                          <span aria-hidden>·</span>
                          <span className="shrink-0">{formatRelativeTime(article.publishedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </PanelBody>
    </PanelRoot>
  )
}
