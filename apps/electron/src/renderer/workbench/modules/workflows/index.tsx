import { Workflow } from 'lucide-react'
import type { WorkbenchModule } from '../../registry/types'
import { PlaceholderPanel } from '../agents/panels/placeholder-panel'

/** Placeholder Workflows module — no business logic yet. */
export const workflowsModule: WorkbenchModule = {
  id: 'workflows',
  title: 'Workflows',
  icon: <Workflow className="h-4 w-4" />,
  order: 40,
  panels: [
    {
      component: 'wf-list',
      title: 'Workflows',
      singleton: true,
      render: () => (
        <PlaceholderPanel
          title="Workflows"
          description="Workflows module placeholder — Phase 3+."
        />
      ),
    },
    {
      component: 'wf-canvas',
      title: 'Canvas',
      render: () => (
        <PlaceholderPanel title="Workflow Canvas" description="Canvas placeholder." />
      ),
    },
    {
      component: 'wf-run',
      title: 'Run',
      render: () => (
        <PlaceholderPanel title="Workflow Run" description="Run view placeholder." />
      ),
    },
  ],
  activityView: function WorkflowsActivity() {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        Workflows will appear here.
      </div>
    )
  },
}
