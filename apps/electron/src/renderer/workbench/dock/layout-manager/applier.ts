import type { DockviewApi, SerializedDockview } from 'dockview-react'
import type { LayoutColumn, LayoutPanel, LayoutState } from '../../registry/types'
import {
  CENTER_GROUP,
  RIGHT_BOTTOM_GROUP,
  RIGHT_TOP_GROUP,
  SIDEBAR_GROUP,
} from './constants'

/**
 * Slim layout applier — office-preset level.
 * Builds a SerializedDockview from LayoutState and applies via fromJSON.
 * Not a full kandev dockview-store / serializer port.
 */

type SerializedLeafNode = {
  type: 'leaf'
  data: {
    id: string
    views: string[]
    activeView: string
  }
  size: number
}

type SerializedBranchNode = {
  type: 'branch'
  data: Array<SerializedLeafNode | SerializedBranchNode>
  size: number
}

type SerializedGridNode = SerializedLeafNode | SerializedBranchNode

function serializeGroup(
  groupId: string,
  panels: LayoutPanel[],
  activePanel: string | undefined,
  size: number,
): SerializedLeafNode {
  const views = panels.map((p) => p.id)
  return {
    type: 'leaf',
    data: {
      id: groupId,
      views,
      activeView: activePanel ?? views[0] ?? '',
    },
    size,
  }
}

function serializeColumn(column: LayoutColumn, width: number, totalHeight: number): SerializedGridNode {
  const groups = column.groups
  if (groups.length === 0) {
    return serializeGroup(`${column.id}-empty`, [], undefined, totalHeight)
  }
  if (groups.length === 1) {
    const g = groups[0]
    const leaf = serializeGroup(g.id ?? `${column.id}-0`, g.panels, g.activePanel, totalHeight)
    return { ...leaf, size: width }
  }

  const heightEach = Math.floor(totalHeight / groups.length)
  const children: SerializedLeafNode[] = groups.map((g, i) =>
    serializeGroup(g.id ?? `${column.id}-${i}`, g.panels, g.activePanel, heightEach),
  )
  // Last group absorbs remainder
  const used = heightEach * groups.length
  if (children.length > 0 && used < totalHeight) {
    children[children.length - 1].size += totalHeight - used
  }

  return {
    type: 'branch',
    data: children,
    size: width,
  }
}

function collectPanels(state: LayoutState): Record<string, {
  id: string
  contentComponent: string
  title: string
  params?: Record<string, unknown>
}> {
  const out: Record<string, {
    id: string
    contentComponent: string
    title: string
    params?: Record<string, unknown>
  }> = {}
  for (const col of state.columns) {
    for (const group of col.groups) {
      for (const p of group.panels) {
        out[p.id] = {
          id: p.id,
          contentComponent: p.component,
          title: p.title,
          params: p.params,
        }
      }
    }
  }
  return out
}

export function toSerializedDockview(
  state: LayoutState,
  totalWidth: number,
  totalHeight: number,
): SerializedDockview {
  const w = Math.max(totalWidth, 100)
  const h = Math.max(totalHeight, 100)

  const totalFrac = state.columns.reduce((s, c) => s + (c.width && c.width <= 1 ? c.width : 0), 0)
  const widths = state.columns.map((c) => {
    if (c.width === undefined) return Math.floor(w / state.columns.length)
    if (c.width > 1) return Math.round(c.width)
    const frac = totalFrac > 0 ? c.width / totalFrac : 1 / state.columns.length
    return Math.round(frac * w)
  })
  // Fix rounding
  const widthSum = widths.reduce((a, b) => a + b, 0)
  if (widths.length > 0 && widthSum !== w) {
    widths[widths.length - 1] += w - widthSum
  }

  const columnNodes = state.columns.map((col, i) => serializeColumn(col, widths[i], h))

  // Dockview fromJSON requires root.type === 'branch' (even for a single column).
  // Emitting a leaf root clears the layout then throws — blank dock for Settings/Sources/etc.
  const gridRoot: SerializedBranchNode = {
    type: 'branch',
    data: columnNodes,
    size: h,
  }

  const panels = collectPanels(state)

  return {
    grid: {
      root: gridRoot,
      width: w,
      height: h,
      orientation: 'HORIZONTAL',
    },
    panels,
    activeGroup: state.columns[0]?.groups[0]?.id,
  } as unknown as SerializedDockview
}

export type LayoutGroupIds = {
  sidebarGroupId: string
  centerGroupId: string
  rightTopGroupId: string
  rightBottomGroupId: string
}

export function applyLayout(
  api: DockviewApi,
  state: LayoutState,
  totalWidth?: number,
  totalHeight?: number,
): LayoutGroupIds {
  const w = totalWidth ?? api.width ?? 1200
  const h = totalHeight ?? api.height ?? 800
  const serialized = toSerializedDockview(state, w, h)
  api.fromJSON(serialized)

  return {
    sidebarGroupId: SIDEBAR_GROUP,
    centerGroupId: CENTER_GROUP,
    rightTopGroupId: RIGHT_TOP_GROUP,
    rightBottomGroupId: RIGHT_BOTTOM_GROUP,
  }
}

export type PanelPlacement = 'right' | 'left' | 'active-group'

export function focusOrAddPanel(
  api: DockviewApi,
  options: {
    id: string
    component: string
    title: string
    params?: Record<string, unknown>
    /** Prefer opening beside this group; defaults to center. */
    referenceGroupId?: string
    /**
     * `active-group` — tab within the reference/active group (default).
     * `right` / `left` — new split beside the active panel (or reference group).
     */
    placement?: PanelPlacement
  },
): void {
  const existing = api.getPanel(options.id)
  if (existing) {
    if (options.params) {
      existing.api.updateParameters(options.params)
    }
    if (options.title) {
      existing.api.setTitle(options.title)
    }
    existing.api.setActive()
    return
  }

  const placement = options.placement ?? 'active-group'
  const base = {
    id: options.id,
    component: options.component,
    title: options.title,
    params: options.params,
  }

  if (placement === 'right' || placement === 'left') {
    const activePanel = api.activePanel
    if (activePanel) {
      api.addPanel({
        ...base,
        position: { referencePanel: activePanel.id, direction: placement },
      })
      return
    }
    const refGroupId = options.referenceGroupId ?? CENTER_GROUP
    const refGroup = api.getGroup(refGroupId) ?? api.groups[api.groups.length - 1] ?? api.groups[0]
    if (refGroup) {
      api.addPanel({
        ...base,
        position: { referenceGroup: refGroup.id, direction: placement },
      })
      return
    }
    api.addPanel(base)
    return
  }

  const refGroupId = options.referenceGroupId ?? CENTER_GROUP
  const refGroup =
    api.getGroup(refGroupId) ??
    api.activePanel?.group ??
    api.groups[0]
  if (!refGroup) {
    api.addPanel(base)
    return
  }

  api.addPanel({
    ...base,
    position: { referenceGroup: refGroup.id, direction: 'within' },
  })
}
