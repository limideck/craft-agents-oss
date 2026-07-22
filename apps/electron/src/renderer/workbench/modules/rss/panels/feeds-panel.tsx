import { useMemo } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { History, Library, Mail, Plus, RefreshCw, Settings2, Star } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ActivityShell } from '../../../shell/ActivityShell'
import { getArticleMeta, matchesLibrary, TAG_COLORS } from '../local-meta'
import {
  rssAddFeedOpenAtom,
  rssCatalogAtom,
  rssCommandOpenAtom,
  rssErrorAtom,
  rssFeedsAtom,
  rssLoadingAtom,
  rssLocalStateAtom,
  rssManageFeedsOpenAtom,
  rssSearchQueryAtom,
  rssSidebarSelectionAtom,
  rssStarredCountAtom,
  type ReaderLibraryId,
  type RssSidebarSelection,
} from '../store'
import { useRssWorkspaceData } from '../use-rss-data'
import { AddFeedDialog } from '../components/add-feed-dialog'
import { FeedFavicon } from '../components/feed-favicon'
import { ManageFeedsDialog } from '../components/manage-feeds-dialog'
import { RssSkeletonRows } from '../components/rss-skeleton'

function FeedRow({
  active,
  onSelect,
  label,
  count,
  icon,
  depth = 0,
}: {
  active: boolean
  onSelect: () => void
  label: string
  count?: number
  icon?: ReactNode
  depth?: number
}) {
  return (
    <button
      type="button"
      aria-current={active ? 'true' : undefined}
      className={cn(
        'flex w-full items-center gap-2 py-1.5 text-sm text-left rounded-none',
        'transition-[background-color,color] duration-150 ease-out',
        'hover:bg-foreground-5 focus-visible:outline-none focus-visible:bg-foreground-5',
        active && 'bg-foreground-10 text-foreground',
        !active && 'text-foreground/90',
      )}
      style={{ paddingLeft: 12 + depth * 12, paddingRight: 12 }}
      onClick={onSelect}
    >
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count != null && count > 0 ? (
        <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground">{count}</span>
      ) : null}
    </button>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 pt-3 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  )
}

function isActive(sel: RssSidebarSelection, candidate: RssSidebarSelection): boolean {
  if (sel.kind !== candidate.kind) return false
  if (sel.kind === 'view' && candidate.kind === 'view') return sel.view === candidate.view
  if (sel.kind === 'feed' && candidate.kind === 'feed') return sel.feedId === candidate.feedId
  if (sel.kind === 'library' && candidate.kind === 'library') return sel.id === candidate.id
  if (sel.kind === 'tag' && candidate.kind === 'tag') return sel.tag === candidate.tag
  return false
}

type NavItem =
  | { kind: 'library'; id: ReaderLibraryId; label: string; icon: ReactNode }
  | { kind: 'view'; view: 'all' | 'starred'; label: string; icon: ReactNode }

/**
 * 阅读导航 — 全部 / 未读 / 收藏 / 历史 + 标签 / 订阅源。
 */
export function FeedsPanel() {
  const { refresh, workspaceId } = useRssWorkspaceData({ bootstrap: true })
  const loading = useAtomValue(rssLoadingAtom)
  const error = useAtomValue(rssErrorAtom)
  const feeds = useAtomValue(rssFeedsAtom)
  const catalog = useAtomValue(rssCatalogAtom)
  const starredCount = useAtomValue(rssStarredCountAtom)
  const localState = useAtomValue(rssLocalStateAtom)
  const [selected, setSelected] = useAtom(rssSidebarSelectionAtom)
  const [query, setQuery] = useAtom(rssSearchQueryAtom)
  const setAddOpen = useSetAtom(rssAddFeedOpenAtom)
  const setManageOpen = useSetAtom(rssManageFeedsOpenAtom)
  const setCmdOpen = useSetAtom(rssCommandOpenAtom)

  const libraryCounts = useMemo(() => {
    const counts: Record<ReaderLibraryId, number> = {
      unread: 0,
      history: 0,
    }
    for (const article of catalog) {
      const meta = getArticleMeta(localState.metaById, article.id)
      if (matchesLibrary(article, meta, 'unread')) counts.unread += 1
      if (matchesLibrary(article, meta, 'history')) counts.history += 1
    }
    return counts
  }, [catalog, localState.metaById])

  const tagCount = (tag: string) =>
    catalog.filter((a) => (getArticleMeta(localState.metaById, a.id).tags ?? []).includes(tag))
      .length

  const refreshAll = async () => {
    if (!workspaceId) return
    try {
      await window.electronAPI.rssRefresh(workspaceId)
      await refresh()
    } catch {
      // error surface via next load
    }
  }

  const navItems: NavItem[] = [
    { kind: 'view', view: 'all', label: '全部', icon: <Library className="h-3.5 w-3.5" /> },
    { kind: 'library', id: 'unread', label: '未读', icon: <Mail className="h-3.5 w-3.5" /> },
    { kind: 'view', view: 'starred', label: '收藏', icon: <Star className="h-3.5 w-3.5" /> },
    { kind: 'library', id: 'history', label: '历史', icon: <History className="h-3.5 w-3.5" /> },
  ]

  return (
    <ActivityShell
      title="阅读"
      toolbar={
        <div className="px-2.5 py-1.5 space-y-1.5">
          <div className="relative">
            <button
              type="button"
              className="absolute right-1.5 top-1/2 z-10 -translate-y-1/2 border border-border/80 px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-foreground-5"
              title="命令菜单"
              onClick={() => setCmdOpen(true)}
            >
              ⌘K
            </button>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索标题、标签…"
              className="h-7 pr-10 text-xs bg-muted/40 border-0 shadow-none focus-visible:ring-1"
              aria-label="搜索资料库"
            />
          </div>
          <div className="flex items-center gap-1.5 px-0.5">
            <span className="border border-border/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">
              本地
            </span>
            <span className="text-[10px] text-muted-foreground truncate">
              {feeds.length} 个订阅 · SQLite
            </span>
          </div>
        </div>
      }
      actions={
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="管理订阅"
            disabled={!workspaceId}
            onClick={() => setManageOpen(true)}
          >
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="刷新订阅"
            onClick={() => void refreshAll()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="添加"
            disabled={!workspaceId}
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </>
      }
    >
      {loading && feeds.length === 0 ? (
        <RssSkeletonRows rows={8} />
      ) : error && feeds.length === 0 ? (
        <div className="p-4 text-sm text-muted-foreground space-y-2">
          <p className="text-destructive/90">{error}</p>
          {/sidecar|unavailable|ECONNREFUSED|fetch failed|not ready/i.test(error) ? (
            <p className="text-xs">
              请先构建/启动 Go sidecar（`bun run build:grose-modules`），或设置 `GROSE_MODULES_URL`。
            </p>
          ) : null}
        </div>
      ) : (
        <div className="py-1">
          <SectionLabel>资料库</SectionLabel>
          {navItems.map((item) => {
            if (item.kind === 'library') {
              return (
                <FeedRow
                  key={`lib-${item.id}`}
                  label={item.label}
                  count={libraryCounts[item.id]}
                  icon={item.icon}
                  active={isActive(selected, { kind: 'library', id: item.id })}
                  onSelect={() => setSelected({ kind: 'library', id: item.id })}
                />
              )
            }
            return (
              <FeedRow
                key={`view-${item.view}`}
                label={item.label}
                count={item.view === 'starred' ? starredCount : undefined}
                icon={item.icon}
                active={isActive(selected, { kind: 'view', view: item.view })}
                onSelect={() => setSelected({ kind: 'view', view: item.view })}
              />
            )
          })}

          <SectionLabel>标签</SectionLabel>
          <p className="px-3 pb-1 text-[10px] text-muted-foreground leading-snug">
            打开文章时会按标题/摘要自动建议并打上标签。
          </p>
          {localState.tags.map((tag) => (
            <FeedRow
              key={tag}
              label={tag}
              count={tagCount(tag)}
              icon={
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: TAG_COLORS[tag] ?? 'currentColor' }}
                />
              }
              active={isActive(selected, { kind: 'tag', tag })}
              onSelect={() => setSelected({ kind: 'tag', tag })}
            />
          ))}

          <SectionLabel>订阅源</SectionLabel>
          {feeds.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">暂无订阅，点击 + 添加。</p>
          ) : (
            feeds.map((feed) => (
              <FeedRow
                key={feed.id}
                label={feed.name}
                active={isActive(selected, { kind: 'feed', feedId: feed.id })}
                onSelect={() => setSelected({ kind: 'feed', feedId: feed.id })}
                icon={<FeedFavicon feedUrl={feed.url} size={14} />}
              />
            ))
          )}
        </div>
      )}
      {workspaceId ? (
        <>
          <AddFeedDialog workspaceId={workspaceId} onAdded={() => void refresh()} />
          <ManageFeedsDialog workspaceId={workspaceId} />
        </>
      ) : null}
    </ActivityShell>
  )
}
