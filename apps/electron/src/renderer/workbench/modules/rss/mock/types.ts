/** RSS reader mock types — UI framework only; no network / XML parsing. */

export type RssFolder = {
  id: string
  name: string
  /** Feed ids belonging to this folder. */
  feedIds: string[]
}

export type RssFeed = {
  id: string
  title: string
  /** Subscription URL (display only). */
  url: string
  siteUrl?: string
  folderId?: string | null
  /** Optional short description. */
  description?: string
}

export type RssArticle = {
  id: string
  feedId: string
  title: string
  author?: string
  /** ISO-8601 timestamp. */
  publishedAt: string
  summary: string
  /** Sanitized static HTML body (mock; never from network). */
  contentHtml: string
  url: string
  unread: boolean
}

/** Special feed filter ids used by the sidebar. */
export type RssFeedFilterId = 'all' | 'unread' | string
