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

/** RSS reading layout: article list | reader (feeds live in activityView). */
export const RSS_READING_RATIOS = {
  list: 0.38,
  reader: 0.62,
} as const

/** Workflow edit: canvas+logs | right tools (~62 / 38). */
export const WORKFLOW_EDIT_RATIOS = {
  center: 0.62,
  right: 0.38,
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
  'wf-canvas': { component: 'wf-canvas', title: 'Canvas' },
  'wf-logs': { component: 'wf-logs', title: 'Logs' },
  'wf-right': { component: 'wf-right', title: 'Workflow' },
}

export function panel(id: keyof typeof PANEL_DEFS | string): LayoutPanel {
  const config = PANEL_DEFS[id]
  if (!config) {
    return { id, component: id, title: id }
  }
  return { id, ...config }
}
