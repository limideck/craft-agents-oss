import { atom } from 'jotai'
import { MOCK_ARTICLES } from './mock/data'
import type { RssFeedFilterId } from './mock/types'

/** Selected sidebar filter: all / unread / feed id. */
export const rssSelectedFeedIdAtom = atom<RssFeedFilterId>('all')

/** Selected article id in the list / reader. */
export const rssSelectedArticleIdAtom = atom<string | null>(MOCK_ARTICLES[0]?.id ?? null)

/** List search query (client filter only). */
export const rssSearchQueryAtom = atom('')

/**
 * Local read-state overrides keyed by article id.
 * `true` = force read, `false` = force unread, missing = use mock default.
 */
export const rssReadOverridesAtom = atom<Record<string, boolean>>({})

/** Simulated initial load flag — panels can show a short skeleton. */
export const rssMockReadyAtom = atom(false)

export function isArticleUnread(
  articleId: string,
  defaultUnread: boolean,
  overrides: Record<string, boolean>,
): boolean {
  if (articleId in overrides) return !overrides[articleId]
  return defaultUnread
}
