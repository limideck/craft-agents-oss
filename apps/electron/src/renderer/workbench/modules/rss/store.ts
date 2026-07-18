import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import type {
  GroseModulesRssArticle,
  GroseModulesRssFeed,
  GroseModulesRssListMode,
  GroseModulesRssView,
} from '@grose-agent/shared/grose-modules'

/** Sidebar selection — smart views or a concrete feed id. */
export type RssSidebarSelection =
  | { kind: 'view'; view: Exclude<GroseModulesRssView, 'feed' | 'search'> }
  | { kind: 'feed'; feedId: string }

export const rssSidebarSelectionAtom = atom<RssSidebarSelection>({ kind: 'view', view: 'today' })

export const rssSelectedArticleIdAtom = atom<string | null>(null)

export const rssSearchQueryAtom = atom('')

export const rssListModeAtom = atom<GroseModulesRssListMode>('latest')

export const rssFeedsAtom = atom<GroseModulesRssFeed[]>([])

export const rssArticlesAtom = atom<GroseModulesRssArticle[]>([])

export const rssStarredCountAtom = atom(0)

export const rssLoadingAtom = atom(true)

export const rssErrorAtom = atom<string | null>(null)

export const rssAddFeedOpenAtom = atom(false)

export const rssManageFeedsOpenAtom = atom(false)

/** Currently playing podcast episode — kept at app level so playback keeps
 *  running even when the reader panel unmounts (navigation/panel switch). */
export type RssPlayingEpisode = {
  id: string
  title: string
  feedName?: string
  audioUrl: string
  /** Resume position in seconds, persisted across panel remounts. */
  position?: number
} | null

export const rssPlayingEpisodeAtom = atom<RssPlayingEpisode>(null)

/** How the podcast player is displayed: a bottom bar or a floating ball. */
export type RssPodcastPlayerMode = 'bottom' | 'floating'

export const rssPodcastPlayerModeAtom = atomWithStorage<RssPodcastPlayerMode>(
  'grose-rss-podcast-player-mode',
  'bottom',
)

export function selectionToQuery(sel: RssSidebarSelection): {
  view: GroseModulesRssView
  feedId?: string
} {
  if (sel.kind === 'feed') return { view: 'feed', feedId: sel.feedId }
  return { view: sel.view }
}
