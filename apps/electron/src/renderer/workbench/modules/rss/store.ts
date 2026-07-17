import { atom } from 'jotai'
import type {
  CraftModulesRssArticle,
  CraftModulesRssFeed,
  CraftModulesRssListMode,
  CraftModulesRssView,
} from '@craft-agent/shared/craft-modules'

/** Sidebar selection — smart views or a concrete feed id. */
export type RssSidebarSelection =
  | { kind: 'view'; view: Exclude<CraftModulesRssView, 'feed' | 'search'> }
  | { kind: 'feed'; feedId: string }

export const rssSidebarSelectionAtom = atom<RssSidebarSelection>({ kind: 'view', view: 'today' })

export const rssSelectedArticleIdAtom = atom<string | null>(null)

export const rssSearchQueryAtom = atom('')

export const rssListModeAtom = atom<CraftModulesRssListMode>('latest')

export const rssFeedsAtom = atom<CraftModulesRssFeed[]>([])

export const rssArticlesAtom = atom<CraftModulesRssArticle[]>([])

export const rssStarredCountAtom = atom(0)

export const rssLoadingAtom = atom(true)

export const rssErrorAtom = atom<string | null>(null)

export const rssAddFeedOpenAtom = atom(false)

export function selectionToQuery(sel: RssSidebarSelection): {
  view: CraftModulesRssView
  feedId?: string
} {
  if (sel.kind === 'feed') return { view: 'feed', feedId: sel.feedId }
  return { view: sel.view }
}
