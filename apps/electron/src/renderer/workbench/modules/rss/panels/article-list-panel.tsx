import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { Headphones, Plus, Search, Star } from 'lucide-react'
import { PanelRoot, PanelBody, PanelHeaderBar } from '../../../dock/panel-primitives'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  articleType,
  effectiveStatus,
  excerptFromArticle,
  getArticleMeta,
  libraryLabel,
  TAG_COLORS,
} from '../local-meta'
import {
  patchArticleMeta,
  rssAddFeedOpenAtom,
  rssArticlesAtom,
  rssFeedsAtom,
  rssListModeAtom,
  rssLoadingAtom,
  rssLocalStateAtom,
  rssSearchQueryAtom,
  rssSelectedArticleIdAtom,
  rssSidebarSelectionAtom,
  rssTypeFilterAtom,
  type RssTypeFilter,
} from '../store'
import { FeedFavicon } from '../components/feed-favicon'
import { formatRelativeTime } from '../utils'
import { RssSkeletonRows } from '../components/rss-skeleton'

/**
 * Article list — Local Reader density (excerpt, type, tags, favorite).
 * Unread dots + subtle selection transitions mirror Yarr feel.
 */
export function ArticleListPanel() {
  const loading = useAtomValue(rssLoadingAtom)
  const articles = useAtomValue(rssArticlesAtom)
  const feeds = useAtomValue(rssFeedsAtom)
  const selection = useAtomValue(rssSidebarSelectionAtom)
  const localState = useAtomValue(rssLocalStateAtom)
  const setLocalState = useSetAtom(rssLocalStateAtom)
  const [query, setQuery] = useAtom(rssSearchQueryAtom)
  const [selectedId, setSelectedId] = useAtom(rssSelectedArticleIdAtom)
  const [listMode, setListMode] = useAtom(rssListModeAtom)
  const [typeFilter, setTypeFilter] = useAtom(rssTypeFilterAtom)
  const setAddOpen = useSetAtom(rssAddFeedOpenAtom)

  /** User gesture only — mark read + history so 未读 filtering cannot cascade. */
  const openArticle = (articleId: string) => {
    setSelectedId(articleId)
    setLocalState((prev) =>
      patchArticleMeta(prev, articleId, {
        status: 'read',
        lastViewedAt: Date.now(),
      }),
    )
  }

  const feedById = new Map(feeds.map((f) => [f.id, f]))

  const headerLabel = (() => {
    if (selection.kind === 'library') return libraryLabel(selection.id)
    if (selection.kind === 'tag') return `#${selection.tag}`
    if (selection.kind === 'view') {
      if (selection.view === 'starred') return '收藏'
      if (selection.view === 'today') return '今日'
      if (selection.view === 'podcast') return '播客'
      return '全部'
    }
    return feeds.find((f) => f.id === selection.feedId)?.name ?? '订阅'
  })()

  const showModeToggle = selection.kind === 'view' && selection.view === 'all'

  const typeTabs: { id: RssTypeFilter; label: string }[] = [
    { id: 'all', label: '全部' },
    { id: 'web', label: '网页' },
    { id: 'podcast', label: '播客' },
  ]

  return (
    <PanelRoot>
      <PanelHeaderBar className="justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-medium truncate min-w-0">{headerLabel}</span>
          <span className="tabular-nums text-[11px] text-muted-foreground shrink-0">
            {articles.length}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {showModeToggle ? (
            <div className="flex border border-border/80 overflow-hidden">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn('h-6 rounded-none px-2 text-[11px]', listMode === 'latest' && 'bg-foreground-10')}
                onClick={() => setListMode('latest')}
              >
                最新
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn('h-6 rounded-none px-2 text-[11px]', listMode === 'digest' && 'bg-foreground-10')}
                onClick={() => setListMode('digest')}
              >
                摘要
              </Button>
            </div>
          ) : null}
          <Button
            type="button"
            size="sm"
            className="h-6 rounded-none px-2 text-[11px] gap-1"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-3 w-3" />
            添加
          </Button>
        </div>
      </PanelHeaderBar>

      <div className="shrink-0 border-b border-border/80 px-2.5 py-1.5 space-y-1.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索文章…"
            className="h-7 pl-7 text-xs bg-muted/40 border-0 shadow-none focus-visible:ring-1"
            aria-label="搜索文章"
          />
        </div>
        <div className="flex gap-0 -mb-px">
          {typeTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={cn(
                'h-6 px-2.5 text-[11px] border-b-2 border-transparent text-muted-foreground',
                'transition-[border-color,color] duration-150',
                typeFilter === tab.id && 'border-accent text-foreground font-medium',
              )}
              onClick={() => setTypeFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <PanelBody padding={false} className="p-0">
        {loading && articles.length === 0 ? (
          <RssSkeletonRows rows={7} />
        ) : articles.length === 0 ? (
          <div className="flex h-full min-h-[120px] items-center justify-center p-4 text-center text-sm text-muted-foreground">
            此视图暂无文章。
          </div>
        ) : (
          <ul className="py-0" role="listbox" aria-label="文章列表">
            {articles.map((article) => {
              const active = selectedId === article.id
              const meta = getArticleMeta(localState.metaById, article.id)
              const unread = effectiveStatus(article, meta) === 'unread'
              const excerpt = excerptFromArticle(article)
              const type = articleType(article)
              const feedUrl = feedById.get(article.feedId)?.url
              return (
                <li key={article.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={cn(
                      'w-full text-left px-3 py-2.5 border-l-2 border-transparent border-b border-border/60',
                      'transition-[background-color,border-color] duration-150 ease-out',
                      'hover:bg-foreground-5 focus-visible:outline-none focus-visible:bg-foreground-5',
                      active && 'bg-foreground-10 border-l-accent',
                    )}
                    onClick={() => openArticle(article.id)}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground mb-1">
                      <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
                        <span
                          aria-hidden
                          className={cn(
                            'inline-block h-1.5 w-1.5 shrink-0 rounded-full transition-opacity duration-150',
                            unread ? 'bg-accent opacity-100' : 'bg-transparent opacity-0',
                          )}
                        />
                        <FeedFavicon feedUrl={feedUrl} size={12} className="opacity-90" />
                        {type === 'podcast' ? (
                          <Headphones className="h-3 w-3 shrink-0" />
                        ) : null}
                        <span className="truncate">
                          {type === 'podcast' ? '播客' : '网页'} · {article.feedName || '未知来源'}
                        </span>
                      </span>
                      <span className="shrink-0 flex items-center gap-1.5">
                        {article.isStarred ? (
                          <Star className="h-3 w-3 fill-current text-[var(--info)]" />
                        ) : null}
                        <span>{formatRelativeTime(article.pubDate)}</span>
                      </span>
                    </div>
                    <div
                      className={cn(
                        'text-sm leading-snug line-clamp-2 transition-colors duration-150',
                        unread ? 'font-medium text-foreground' : 'font-normal text-foreground/80',
                      )}
                    >
                      {article.title}
                    </div>
                    {excerpt ? (
                      <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {excerpt}
                      </div>
                    ) : null}
                    {meta.tags?.length ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {meta.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ background: TAG_COLORS[tag] ?? 'currentColor' }}
                            />
                            #{tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
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
