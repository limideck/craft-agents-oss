import { useAtom, useAtomValue } from 'jotai'
import { Folder, Inbox, Plus, Rss } from 'lucide-react'
import type { ReactNode } from 'react'
import { PanelRoot, PanelBody, PanelHeaderBar } from '../../../dock/panel-primitives'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MOCK_ARTICLES, MOCK_FEEDS, MOCK_FOLDERS } from '../mock/data'
import {
  isArticleUnread,
  rssMockReadyAtom,
  rssReadOverridesAtom,
  rssSelectedFeedIdAtom,
} from '../store'
import { RssSkeletonRows, useRssMockReady } from '../components/rss-skeleton'
import type { RssFeedFilterId } from '../mock/types'

function unreadForFeed(feedId: string, overrides: Record<string, boolean>): number {
  return MOCK_ARTICLES.filter(
    (a) => a.feedId === feedId && isArticleUnread(a.id, a.unread, overrides),
  ).length
}

function totalUnread(overrides: Record<string, boolean>): number {
  return MOCK_ARTICLES.filter((a) => isArticleUnread(a.id, a.unread, overrides)).length
}

function FeedRow({
  id,
  label,
  count,
  active,
  onSelect,
  icon,
}: {
  id: RssFeedFilterId
  label: string
  count: number
  active: boolean
  onSelect: (id: RssFeedFilterId) => void
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
      onClick={() => onSelect(id)}
    >
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count > 0 ? (
        <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground">{count}</span>
      ) : null}
    </button>
  )
}

/**
 * Feeds sidebar — subscriptions, folders, unread counts, add-feed (UI only).
 */
export function FeedsPanel() {
  useRssMockReady()
  const ready = useAtomValue(rssMockReadyAtom)
  const [selected, setSelected] = useAtom(rssSelectedFeedIdAtom)
  const overrides = useAtomValue(rssReadOverridesAtom)

  const filedIds = new Set(MOCK_FOLDERS.flatMap((f) => f.feedIds))
  const unfiled = MOCK_FEEDS.filter((f) => !f.folderId || !filedIds.has(f.id))

  return (
    <PanelRoot>
      <PanelHeaderBar className="justify-between">
        <span className="font-medium truncate">Feeds</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          title="Add feed (UI only)"
          onClick={() => {
            /* mock affordance — no network */
          }}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </PanelHeaderBar>
      <PanelBody padding={false} className="p-0">
        {!ready ? (
          <RssSkeletonRows rows={8} />
        ) : (
          <div className="py-1">
            <FeedRow
              id="all"
              label="All articles"
              count={totalUnread(overrides)}
              active={selected === 'all'}
              onSelect={setSelected}
              icon={<Inbox className="h-3.5 w-3.5" />}
            />
            <FeedRow
              id="unread"
              label="Unread"
              count={totalUnread(overrides)}
              active={selected === 'unread'}
              onSelect={setSelected}
              icon={<Rss className="h-3.5 w-3.5" />}
            />

            <div className="px-3 pt-3 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Folders
            </div>
            {MOCK_FOLDERS.map((folder) => (
              <div key={folder.id} className="mb-1">
                <div className="flex items-center gap-1.5 px-3 py-1 text-xs text-muted-foreground">
                  <Folder className="h-3 w-3 shrink-0" />
                  <span className="truncate">{folder.name}</span>
                </div>
                {folder.feedIds.map((feedId) => {
                  const feed = MOCK_FEEDS.find((f) => f.id === feedId)
                  if (!feed) return null
                  return (
                    <FeedRow
                      key={feed.id}
                      id={feed.id}
                      label={feed.title}
                      count={unreadForFeed(feed.id, overrides)}
                      active={selected === feed.id}
                      onSelect={setSelected}
                      icon={<Rss className="h-3.5 w-3.5" />}
                    />
                  )
                })}
              </div>
            ))}

            {unfiled.length > 0 ? (
              <>
                <div className="px-3 pt-3 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Other
                </div>
                {unfiled.map((feed) => (
                  <FeedRow
                    key={feed.id}
                    id={feed.id}
                    label={feed.title}
                    count={unreadForFeed(feed.id, overrides)}
                    active={selected === feed.id}
                    onSelect={setSelected}
                    icon={<Rss className="h-3.5 w-3.5" />}
                  />
                ))}
              </>
            ) : null}
          </div>
        )}
      </PanelBody>
    </PanelRoot>
  )
}
