import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import type {
  GroseModulesRssArticle,
  GroseModulesRssFeed,
  GroseModulesRssListMode,
  GroseModulesRssView,
} from '@grose-agent/shared/grose-modules'
import { DEFAULT_READER_TAGS } from './local-meta'

/** Local read status — overlay on server articles (star remains server-backed). */
export type ReaderStatus = 'unread' | 'read'

/** Local library nav: unread filter + browse history. */
export type ReaderLibraryId = 'unread' | 'history'

export type ReaderArticleMeta = {
  status?: ReaderStatus
  /** Set when the user opens the article in Reader — powers 历史. */
  lastViewedAt?: number
  tags?: string[]
  summaryCache?: string
  /** Optional local markdown body override (edit). */
  bodyOverride?: string
  /** Set after first auto-tag pass so we don't keep re-applying. */
  autoTagged?: boolean
}

export type ReaderLocalState = {
  metaById: Record<string, ReaderArticleMeta>
  tags: string[]
}

const DEFAULT_LOCAL: ReaderLocalState = {
  metaById: {},
  tags: [...DEFAULT_READER_TAGS],
}

/** Persisted local reader overlay (tags / status / history). */
export const rssLocalStateAtom = atomWithStorage<ReaderLocalState>(
  'grose-rss-local-reader-v3',
  DEFAULT_LOCAL,
)

export type RssSidebarSelection =
  | { kind: 'view'; view: Exclude<GroseModulesRssView, 'feed' | 'search'> }
  | { kind: 'library'; id: ReaderLibraryId }
  | { kind: 'tag'; tag: string }
  | { kind: 'feed'; feedId: string }

export const rssSidebarSelectionAtom = atom<RssSidebarSelection>({
  kind: 'view',
  view: 'all',
})

export const rssSelectedArticleIdAtom = atom<string | null>(null)

export const rssSearchQueryAtom = atom('')

export const rssListModeAtom = atom<GroseModulesRssListMode>('latest')

/** Client type filter on the current article list. */
export type RssTypeFilter = 'all' | 'web' | 'podcast'
export const rssTypeFilterAtom = atom<RssTypeFilter>('all')

export const rssFeedsAtom = atom<GroseModulesRssFeed[]>([])

export const rssArticlesAtom = atom<GroseModulesRssArticle[]>([])

/** Unfiltered server list for the current query (before local library/tag/type filters).
 *  Used for sidebar counts. */
export const rssCatalogAtom = atom<GroseModulesRssArticle[]>([])

export const rssStarredCountAtom = atom(0)

export const rssLoadingAtom = atom(true)

export const rssErrorAtom = atom<string | null>(null)

export const rssAddFeedOpenAtom = atom(false)

export const rssManageFeedsOpenAtom = atom(false)

export const rssCommandOpenAtom = atom(false)

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

/**
 * Map sidebar selection → server list query.
 * Local library / tag selections fetch `all` then filter client-side.
 */
export function selectionToQuery(sel: RssSidebarSelection): {
  view: GroseModulesRssView
  feedId?: string
} {
  if (sel.kind === 'feed') return { view: 'feed', feedId: sel.feedId }
  if (sel.kind === 'view') return { view: sel.view }
  // Unread / History / tags — pull full list, filter locally.
  return { view: 'all' }
}

export function patchArticleMeta(
  state: ReaderLocalState,
  articleId: string,
  patch: Partial<ReaderArticleMeta>,
): ReaderLocalState {
  const prev = state.metaById[articleId] ?? {}
  return {
    ...state,
    metaById: {
      ...state.metaById,
      [articleId]: { ...prev, ...patch },
    },
  }
}
