import { Bot } from 'lucide-react'
import type { WorkbenchModule } from '../../registry/types'
import { SessionListPanel } from './panels/session-list-panel'
import { FilesPanel } from './panels/files-panel'
import { PlaceholderPanel } from './panels/placeholder-panel'

/** Session nav in ActivityBar side rail (classic Sessions upper half). */
function AgentsActivityView() {
  return <SessionListPanel />
}

export const agentsModule: WorkbenchModule = {
  id: 'agents',
  title: 'Agents',
  icon: <Bot className="h-4 w-4" />,
  order: 10,
  // Session list lives in activityView; dock is chat + tools.
  // `chat` panel is registered globally via registerSharedWorkbenchPanels.
  defaultLayout: {
    columns: [
      {
        id: 'center',
        width: 0.55,
        groups: [{ id: 'group-chat', panels: [{ id: 'chat', component: 'chat', title: 'Agent' }] }],
      },
      {
        id: 'right',
        width: 0.45,
        groups: [
          {
            id: 'group-right-top',
            panels: [
              { id: 'files', component: 'files', title: 'Files' },
              { id: 'changes', component: 'changes', title: 'Changes' },
            ],
          },
          {
            id: 'group-right-bottom',
            panels: [{ id: 'terminal', component: 'terminal', title: 'Terminal' }],
          },
        ],
      },
    ],
  },
  activityView: AgentsActivityView,
  panels: [
    {
      component: 'session-list',
      title: 'Sessions',
      singleton: true,
      render: () => <SessionListPanel />,
    },
    {
      component: 'files',
      title: 'Files',
      singleton: true,
      render: () => <FilesPanel />,
    },
    {
      component: 'changes',
      title: 'Changes',
      singleton: true,
      render: () => (
        <PlaceholderPanel title="Changes" description="Git changes panel — Phase 3+." />
      ),
    },
    {
      component: 'terminal',
      title: 'Terminal',
      render: () => (
        <PlaceholderPanel title="Terminal" description="Terminal panel — Phase 3+." />
      ),
    },
  ],
}
