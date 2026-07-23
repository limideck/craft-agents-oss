/**
 * Browser-safe grose-modules constants (no Node / credentials / fs).
 * Keep slug + display metadata here so registry / module-actions never
 * transitively import mcp-source (credentials → crypto).
 */

export const GROSE_MODULES_SOURCE_SLUG = 'grose-modules'
export const GROSE_MODULES_SOURCE_NAME = 'Grose Modules'
export const GROSE_MODULES_PROVIDER = 'grose-modules'
/** Shown in <sources> when the source is first introduced this session */
export const GROSE_MODULES_TAGLINE =
  'Preferred builtin for RSS, Knowledge, and Workflows (rss_*/kb_*/wf_* tools)'

/**
 * Feed / article / homepage URL prefixes that already ship cleaned full text
 * in RSS (`rss_get_article` content is authoritative). Add more entries here.
 * Matching is case-insensitive; http/https interchangeable; path-prefix.
 */
export const PRECLEANED_FULL_CONTENT_FEED_URL_PREFIXES = [
  'https://vipuser.yzcw.dpdns.org/bryanmoyo/',
] as const
