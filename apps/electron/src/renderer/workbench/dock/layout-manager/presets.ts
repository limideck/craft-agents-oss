import type { LayoutPresetId, LayoutState } from '../../registry/types'
import {
  CENTER_GROUP,
  RIGHT_BOTTOM_GROUP,
  RIGHT_TOP_GROUP,
  RSS_READING_RATIOS,
  WORKFLOW_EDIT_RATIOS,
  panel,
} from './constants'

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

/** RSS reading: article list | reader. Feeds live in ActivityBar `activityView`. */
export function rssReadingLayout(): LayoutState {
  return {
    columns: [
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

/**
 * Workflow edit: canvas (top) + logs (bottom) | right tools panel.
 * Workflow list lives in ActivityBar `activityView`, not the dock.
 */
export function workflowEditLayout(): LayoutState {
  return {
    columns: [
      {
        id: 'center',
        width: WORKFLOW_EDIT_RATIOS.center,
        groups: [
          { id: 'group-wf-canvas', panels: [panel('wf-canvas')] },
          { id: 'group-wf-logs', panels: [panel('wf-logs')] },
        ],
      },
      {
        id: 'right',
        width: WORKFLOW_EDIT_RATIOS.right,
        groups: [{ id: 'group-wf-right', panels: [panel('wf-right')] }],
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
    default:
      return agentsFocusLayout()
  }
}
