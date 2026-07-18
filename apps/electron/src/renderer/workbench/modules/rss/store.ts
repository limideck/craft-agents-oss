import { atom } from 'jotai'
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

export function selectionToQuery(sel: RssSidebarSelection): {
  view: GroseModulesRssView
  feedId?: string
} {
  if (sel.kind === 'feed') return { view: 'feed', feedId: sel.feedId }
  return { view: sel.view }
}
