import { Workflow } from 'lucide-react'
import type { WorkbenchModule } from '../../registry/types'
import { WorkflowListView } from './activity/workflow-list-view'
import { CanvasPanel } from './panels/canvas-panel'
import { LogsPanel } from './panels/logs-panel'
import { RightPanel } from './panels/right-panel'

/** Workflows canvas module definition — ActivityBar registration moved to automationsModule (Flows). */
export const workflowsModule: WorkbenchModule = {
  id: 'workflows',
  title: 'Workflows',
  icon: <Workflow className="h-4 w-4" />,
  order: 70,
  defaultLayout: 'workflow-edit',
  panels: [
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
  activityView: WorkflowListView,
}
