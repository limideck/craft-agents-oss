import type { LayoutPanel } from '../../registry/types'

export const SIDEBAR_GROUP = 'group-sidebar'
export const CENTER_GROUP = 'group-center'
export const RIGHT_TOP_GROUP = 'group-right-top'
export const RIGHT_BOTTOM_GROUP = 'group-right-bottom'

/** Default column width fractions (~frontend 18 / 38 / 44). */
export const AGENTS_DEFAULT_RATIOS = {
  sidebar: 0.18,
  center: 0.38,
  right: 0.44,
} as const

/** RSS reading layout: feeds | list | reader. */
export const RSS_READING_RATIOS = {
  feeds: 0.2,
  list: 0.3,
  reader: 0.5,
} as const

export const PANEL_DEFS: Record<string, Omit<LayoutPanel, 'id'>> = {
  'session-list': { component: 'session-list', title: 'Sessions' },
  chat: { component: 'chat', title: 'Agent' },
  files: { component: 'files', title: 'Files' },
  changes: { component: 'changes', title: 'Changes' },
  terminal: { component: 'terminal', title: 'Terminal' },
  'rss-feeds': { component: 'rss-feeds', title: 'Feeds' },
  'rss-article-list': { component: 'rss-article-list', title: 'Articles' },
  'rss-reader': { component: 'rss-reader', title: 'Reader' },
}

export function panel(id: keyof typeof PANEL_DEFS | string): LayoutPanel {
  const config = PANEL_DEFS[id]
  if (!config) {
    return { id, component: id, title: id }
  }
  return { id, ...config }
}
