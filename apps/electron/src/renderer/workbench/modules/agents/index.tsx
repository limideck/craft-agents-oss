import { Bot } from 'lucide-react'
import type { WorkbenchModule } from '../../registry/types'
import { SessionListPanel } from './panels/session-list-panel'
import { ChatPanel } from './panels/chat-panel'
import { FilesPanel } from './panels/files-panel'
import { PlaceholderPanel } from './panels/placeholder-panel'

export const agentsModule: WorkbenchModule = {
  id: 'agents',
  title: 'Agents',
  icon: <Bot className="h-4 w-4" />,
  order: 10,
  defaultLayout: 'agents-default',
  panels: [
    {
      component: 'session-list',
      title: 'Sessions',
      singleton: true,
      render: () => <SessionListPanel />,
    },
    {
      component: 'chat',
      title: 'Agent',
      render: (params) => <ChatPanel params={params} />,
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
