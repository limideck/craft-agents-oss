import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { CalendarDays, Headphones, Inbox, Plus, RefreshCw, Rss, Settings2, Star } from 'lucide-react'
import type { ReactNode } from 'react'
import { PanelRoot, PanelBody, PanelHeaderBar } from '../../../dock/panel-primitives'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  rssAddFeedOpenAtom,
  rssErrorAtom,
  rssFeedsAtom,
  rssLoadingAtom,
  rssManageFeedsOpenAtom,
  rssSidebarSelectionAtom,
  rssStarredCountAtom,
  type RssSidebarSelection,
} from '../store'
import { useRssWorkspaceData } from '../use-rss-data'
import { AddFeedDialog } from '../components/add-feed-dialog'
import { ManageFeedsDialog } from '../components/manage-feeds-dialog'
import { RssSkeletonRows } from '../components/rss-skeleton'

function FeedRow({
  active,
  onSelect,
  label,
  count,
  icon,
}: {
  active: boolean
  onSelect: () => void
  label: string
  count?: number
  icon?: ReactNode
}) {
  return (
    <button
      type="button"
      aria-current={active ? 'true' : undefined}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-sm text-left rounded-none',
        'hover:bg-foreground-5 focus-visible:outline-none focus-visible:bg-foreground-5',
        active && 'bg-foreground-10 text-foreground',
        !active && 'text-foreground/90',
      )}
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

function isActive(sel: RssSidebarSelection, candidate: RssSidebarSelection): boolean {
  if (sel.kind !== candidate.kind) return false
  if (sel.kind === 'view' && candidate.kind === 'view') return sel.view === candidate.view
  if (sel.kind === 'feed' && candidate.kind === 'feed') return sel.feedId === candidate.feedId
  return false
}

/**
 * Feeds sidebar — feedoverflow-style smart views + flat feed list.
 */
export function FeedsPanel() {
  const { refresh, workspaceId } = useRssWorkspaceData({ bootstrap: true })
  const loading = useAtomValue(rssLoadingAtom)
  const error = useAtomValue(rssErrorAtom)
  const feeds = useAtomValue(rssFeedsAtom)
  const starredCount = useAtomValue(rssStarredCountAtom)
  const [selected, setSelected] = useAtom(rssSidebarSelectionAtom)
  const setAddOpen = useSetAtom(rssAddFeedOpenAtom)
  const setManageOpen = useSetAtom(rssManageFeedsOpenAtom)

  const refreshAll = async () => {
    if (!workspaceId) return
    try {
      await window.electronAPI.rssRefresh(workspaceId)
      await refresh()
    } catch {
      // error surface via next load
    }
  }

  return (
    <PanelRoot>
      <PanelHeaderBar className="justify-between">
        <span className="font-medium truncate">Feeds</span>
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Manage feeds"
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
            title="Refresh feeds"
            onClick={() => void refreshAll()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Add feed"
            disabled={!workspaceId}
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </PanelHeaderBar>
      <PanelBody padding={false} className="p-0">
        {loading && feeds.length === 0 ? (
          <RssSkeletonRows rows={8} />
        ) : error && feeds.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground space-y-2">
            <p className="text-destructive/90">{error}</p>
            {/sidecar|unavailable|ECONNREFUSED|fetch failed|not ready/i.test(error) ? (
              <p className="text-xs">
                Build/start the Go sidecar (`bun run build:craft-modules`) or set `CRAFT_MODULES_URL`.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="py-1">
            <FeedRow
              label="Today"
              active={isActive(selected, { kind: 'view', view: 'today' })}
              onSelect={() => setSelected({ kind: 'view', view: 'today' })}
              icon={<CalendarDays className="h-3.5 w-3.5" />}
            />
            <FeedRow
              label="All"
              active={isActive(selected, { kind: 'view', view: 'all' })}
              onSelect={() => setSelected({ kind: 'view', view: 'all' })}
              icon={<Inbox className="h-3.5 w-3.5" />}
            />
            <FeedRow
              label="Starred"
              count={starredCount}
              active={isActive(selected, { kind: 'view', view: 'starred' })}
              onSelect={() => setSelected({ kind: 'view', view: 'starred' })}
              icon={<Star className="h-3.5 w-3.5" />}
            />
            <FeedRow
              label="Podcasts"
              active={isActive(selected, { kind: 'view', view: 'podcast' })}
              onSelect={() => setSelected({ kind: 'view', view: 'podcast' })}
              icon={<Headphones className="h-3.5 w-3.5" />}
            />

            <div className="px-3 pt-3 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Subscriptions
            </div>
            {feeds.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">No feeds yet. Add one to start.</p>
            ) : (
              feeds.map((feed) => (
                <FeedRow
                  key={feed.id}
                  label={feed.name}
                  active={isActive(selected, { kind: 'feed', feedId: feed.id })}
                  onSelect={() => setSelected({ kind: 'feed', feedId: feed.id })}
                  icon={<Rss className="h-3.5 w-3.5" />}
                />
              ))
            )}
          </div>
        )}
      </PanelBody>
      {workspaceId ? (
        <>
          <AddFeedDialog workspaceId={workspaceId} onAdded={() => void refresh()} />
          <ManageFeedsDialog workspaceId={workspaceId} />
        </>
      ) : null}
    </PanelRoot>
  )
}
