import { useAtom, useAtomValue } from 'jotai'
import { Search, Star } from 'lucide-react'
import { PanelRoot, PanelBody, PanelHeaderBar } from '../../../dock/panel-primitives'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  rssArticlesAtom,
  rssFeedsAtom,
  rssListModeAtom,
  rssLoadingAtom,
  rssSearchQueryAtom,
  rssSelectedArticleIdAtom,
  rssSidebarSelectionAtom,
} from '../store'
import { formatRelativeTime } from '../utils'
import { RssSkeletonRows } from '../components/rss-skeleton'

/**
 * Article list — feedoverflow-style (title, source, time, star indicator).
 */
export function ArticleListPanel() {
  const loading = useAtomValue(rssLoadingAtom)
  const articles = useAtomValue(rssArticlesAtom)
  const feeds = useAtomValue(rssFeedsAtom)
  const selection = useAtomValue(rssSidebarSelectionAtom)
  const [query, setQuery] = useAtom(rssSearchQueryAtom)
  const [selectedId, setSelectedId] = useAtom(rssSelectedArticleIdAtom)
  const [listMode, setListMode] = useAtom(rssListModeAtom)

  const headerLabel =
    selection.kind === 'view'
      ? selection.view === 'today'
        ? 'Today'
        : selection.view === 'starred'
          ? 'Starred'
          : selection.view === 'podcast'
            ? 'Podcasts'
            : 'All'
      : (feeds.find((f) => f.id === selection.feedId)?.name ?? 'Feed')

  const showModeToggle = selection.kind === 'view' && (selection.view === 'all' || selection.view === 'today')

  return (
    <PanelRoot>
      <PanelHeaderBar className="justify-between gap-2">
        <span className="font-medium truncate min-w-0">{headerLabel}</span>
        <div className="flex items-center gap-1 shrink-0">
          {showModeToggle ? (
            <div className="flex rounded border border-border/80 overflow-hidden">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn('h-6 rounded-none px-2 text-[11px]', listMode === 'latest' && 'bg-foreground-10')}
                onClick={() => setListMode('latest')}
              >
                Latest
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn('h-6 rounded-none px-2 text-[11px]', listMode === 'digest' && 'bg-foreground-10')}
                onClick={() => setListMode('digest')}
              >
                Digest
              </Button>
            </div>
          ) : null}
          <span className="tabular-nums text-[11px] text-muted-foreground">{articles.length}</span>
        </div>
      </PanelHeaderBar>
      <div className="shrink-0 border-b border-border/80 px-2.5 py-1.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search articles…"
            className="h-7 pl-7 text-xs bg-muted/40 border-0 shadow-none focus-visible:ring-1"
            aria-label="Search articles"
          />
        </div>
      </div>
      <PanelBody padding={false} className="p-0">
        {loading && articles.length === 0 ? (
          <RssSkeletonRows rows={7} />
        ) : articles.length === 0 ? (
          <div className="flex h-full min-h-[120px] items-center justify-center p-4 text-center text-sm text-muted-foreground">
            No articles yet.
          </div>
        ) : (
          <ul className="py-1" role="listbox" aria-label="Articles">
            {articles.map((article) => {
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
                    onClick={() => setSelectedId(article.id)}
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0 text-muted-foreground w-3.5">
                        {article.isStarred ? <Star className="h-3.5 w-3.5 fill-current" /> : null}
                      </span>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="text-sm leading-snug line-clamp-2 font-medium text-foreground">
                          {article.title}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
                          <span className="truncate">{article.feedName || 'Unknown'}</span>
                          <span aria-hidden>·</span>
                          <span className="shrink-0">{formatRelativeTime(article.pubDate)}</span>
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
