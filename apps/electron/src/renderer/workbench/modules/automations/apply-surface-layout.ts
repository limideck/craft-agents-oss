import type { DockviewApi } from 'dockview-react'
import { applyLayout, resolveModuleLayout } from '../../dock/layout-manager'
import type { LayoutState } from '../../registry/types'
import type { AutomationsSurface } from './store'

/** Skills-style single-column detail for Rules. */
export const RULES_LAYOUT: LayoutState = {
  columns: [
    {
      id: 'center',
      width: 1,
      groups: [
        {
          id: 'group-automation-detail',
          panels: [
            {
              id: 'automation-detail',
              component: 'automation-detail',
              title: 'Automation',
            },
          ],
        },
      ],
    },
  ],
}

/**
 * Apply Rules or Flows dock layout via the same applyLayout path as module switches.
 * Call from activityView / surface handlers — do not branch in WorkbenchShell.
 */
export function applyAutomationsSurfaceLayout(
  api: DockviewApi | null,
  surface: AutomationsSurface,
): void {
  if (!api) return
  const layout =
    surface === 'flows'
      ? resolveModuleLayout('workflow-edit')
      : RULES_LAYOUT
  if (!layout) return
  try {
    applyLayout(api, layout, api.width || 1200, api.height || 800)
  } catch (err) {
    console.warn('[automations] failed to apply surface layout', err)
  }
}
