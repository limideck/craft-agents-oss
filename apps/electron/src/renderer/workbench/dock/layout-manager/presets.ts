import type { LayoutPresetId, LayoutState } from '../../registry/types'
import {
  AGENTS_DEFAULT_RATIOS,
  CENTER_GROUP,
  RIGHT_BOTTOM_GROUP,
  RIGHT_TOP_GROUP,
  RSS_READING_RATIOS,
  SIDEBAR_GROUP,
  panel,
} from './constants'

/** Agents three-column layout: session-list | chat | files+changes / terminal. */
export function agentsDefaultLayout(): LayoutState {
  return {
    columns: [
      {
        id: 'sidebar',
        width: AGENTS_DEFAULT_RATIOS.sidebar,
        groups: [{ id: SIDEBAR_GROUP, panels: [panel('session-list')] }],
      },
      {
        id: 'center',
        width: AGENTS_DEFAULT_RATIOS.center,
        groups: [{ id: CENTER_GROUP, panels: [panel('chat')] }],
      },
      {
        id: 'right',
        width: AGENTS_DEFAULT_RATIOS.right,
        groups: [
          { id: RIGHT_TOP_GROUP, panels: [panel('files'), panel('changes')] },
          { id: RIGHT_BOTTOM_GROUP, panels: [panel('terminal')] },
        ],
      },
    ],
  }
}

/** Focus mode: chat only (no sidebar / right tools). */
export function agentsFocusLayout(): LayoutState {
  return {
    columns: [
      {
        id: 'center',
        width: 1,
        groups: [{ id: CENTER_GROUP, panels: [panel('chat')] }],
      },
    ],
  }
}

/** RSS reading: feeds | article list | reader. */
export function rssReadingLayout(): LayoutState {
  return {
    columns: [
      {
        id: 'rss-feeds',
        width: RSS_READING_RATIOS.feeds,
        groups: [{ id: 'group-rss-feeds', panels: [panel('rss-feeds')] }],
      },
      {
        id: 'rss-list',
        width: RSS_READING_RATIOS.list,
        groups: [{ id: 'group-rss-list', panels: [panel('rss-article-list')] }],
      },
      {
        id: 'rss-reader',
        width: RSS_READING_RATIOS.reader,
        groups: [{ id: 'group-rss-reader', panels: [panel('rss-reader')] }],
      },
    ],
  }
}

/** Minimal workflow canvas placeholder layout. */
export function workflowEditLayout(): LayoutState {
  return {
    columns: [
      {
        id: 'center',
        width: 1,
        groups: [{ id: CENTER_GROUP, panels: [panel('wf-canvas')] }],
      },
    ],
  }
}

export type { LayoutPresetId }

export function getLayoutPreset(id: LayoutPresetId): LayoutState {
  switch (id) {
    case 'agents-focus':
      return agentsFocusLayout()
    case 'rss-reading':
      return rssReadingLayout()
    case 'workflow-edit':
      return workflowEditLayout()
    case 'agents-default':
    default:
      return agentsDefaultLayout()
  }
}
