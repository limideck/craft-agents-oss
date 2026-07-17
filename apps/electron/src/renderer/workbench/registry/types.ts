import type { ComponentType, ReactNode } from 'react'

/** Well-known layout preset ids. */
export type LayoutPresetId =
  | 'agents-default'
  | 'agents-focus'
  | 'rss-reading'
  | 'workflow-edit'

/** A panel within a group (tab). */
export type LayoutPanel = {
  id: string
  component: string
  title: string
  tabComponent?: string
  params?: Record<string, unknown>
}

/** A group within a column (vertical slice). Contains tabs. */
export type LayoutGroup = {
  id?: string
  panels: LayoutPanel[]
  activePanel?: string
}

/** A column in the layout (horizontal slice). */
export type LayoutColumn = {
  id: string
  pinned?: boolean
  /** Fraction of total width (0–1), or absolute px when > 1. */
  width?: number
  groups: LayoutGroup[]
}

/** Complete declarative layout state (office-preset level). */
export type LayoutState = {
  columns: LayoutColumn[]
}

/** Contribution registered by a WorkbenchModule for a dockview component key. */
export type PanelContribution = {
  /** Dockview component key (must match LayoutPanel.component / registry). */
  component: string
  title: string
  tabComponent?: string
  /** At most one instance in the layout (e.g. RSS reader main). */
  singleton?: boolean
  /** Destroy portal when workspace/scope changes. */
  envScoped?: boolean
  render: (params: Record<string, unknown>) => ReactNode
}

export type CommandContribution = {
  id: string
  title: string
  shortcut?: string
  run: () => void | Promise<void>
}

/**
 * Workbench Module contract — freeze at Phase 2.
 * Shell only knows panelId / component / params; modules register themselves.
 */
export type WorkbenchModule = {
  id: string
  title: string
  icon: ReactNode
  order: number
  defaultLayout?: LayoutPresetId | LayoutState
  panels: PanelContribution[]
  /** Optional ActivityBar side content (list/tree), not a dock panel. */
  activityView?: ComponentType
  commands?: CommandContribution[]
}
