import { Zap } from 'lucide-react'
import type { WorkbenchModule } from '../../registry/types'
import { CanvasPanel } from '../workflows/panels/canvas-panel'
import { LogsPanel } from '../workflows/panels/logs-panel'
import { RightPanel } from '../workflows/panels/right-panel'
import { AutomationsActivityView } from './activity/automations-activity-view'
import { RULES_LAYOUT } from './apply-surface-layout'
import { AutomationDetailPanel } from './panels/automation-detail-panel'

/**
 * Automations workbench module — unified Rules (automations.json) + Flows (workflow canvas).
 * Re-exports wf-* panels from modules/workflows; ActivityBar no longer registers workflowsModule.
 */
export const automationsModule: WorkbenchModule = {
  id: 'automations',
  title: 'Automations',
  icon: <Zap className="h-4 w-4" />,
  order: 35,
  /** Default to Rules detail; Flows switches via applyAutomationsSurfaceLayout. */
  defaultLayout: RULES_LAYOUT,
  panels: [
    {
      component: 'automation-detail',
      title: 'Automation',
      singleton: true,
      render: () => <AutomationDetailPanel />,
    },
    {
      component: 'wf-canvas',
      title: 'Canvas',
      singleton: true,
      render: () => <CanvasPanel />,
    },
    {
      component: 'wf-logs',
      title: 'Logs',
      singleton: true,
      render: () => <LogsPanel />,
    },
    {
      component: 'wf-right',
      title: 'Workflow',
      singleton: true,
      render: () => <RightPanel />,
    },
  ],
  activityView: AutomationsActivityView,
}

export { automationsSurfaceAtom, selectedAutomationIdAtom, automationFilterKindAtom } from './store'
export type { AutomationsSurface } from './store'
export { useAutomationsDeepLink } from './use-automations-deep-link'
export { applyAutomationsSurfaceLayout, RULES_LAYOUT } from './apply-surface-layout'
