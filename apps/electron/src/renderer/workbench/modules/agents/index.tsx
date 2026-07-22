import { Bot } from 'lucide-react'
import { useAppShellContext } from '@/context/AppShellContext'
import type { WorkbenchModule } from '../../registry/types'
import { SessionListPanel } from './panels/session-list-panel'
import { FilesPanel } from './panels/files-panel'
import { FileEditorPanel } from './panels/file-editor-panel'
import { ChangesPanel } from './panels/changes-panel'
import { TerminalPanel } from './panels/terminal-panel'

/** Session nav in ActivityBar side rail (classic Sessions upper half). */
function AgentsActivityView() {
  return <SessionListPanel />
}

/** Changes panel scoped to the active Agents workspace. */
function AgentsChangesPanel() {
  const { workspaces, activeWorkspaceId } = useAppShellContext()
  const rootPath = workspaces.find((w) => w.id === activeWorkspaceId)?.rootPath ?? null
  return <ChangesPanel cwd={rootPath} />
}

/** Terminal panel scoped to the active Agents workspace. */
function AgentsTerminalPanel() {
  const { workspaces, activeWorkspaceId } = useAppShellContext()
  const rootPath = workspaces.find((w) => w.id === activeWorkspaceId)?.rootPath ?? null
  return <TerminalPanel cwd={rootPath} />
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
      component: 'file-editor',
      title: '预览',
      // Not a singleton — preview slot + optional pinned tabs share this component.
      render: (params) => <FileEditorPanel params={params} />,
    },
    {
      component: 'changes',
      title: 'Changes',
      singleton: true,
      render: () => <AgentsChangesPanel />,
    },
    {
      component: 'terminal',
      title: 'Terminal',
      singleton: true,
      render: () => <AgentsTerminalPanel />,
    },
  ],
}
