import { Globe } from 'lucide-react'
import { useAtomValue } from 'jotai'
import type { WorkbenchModule } from '../../registry/types'
import { PanelErrorBoundary } from '../../dock/PanelErrorBoundary'
import { PlaceholderPanel } from '../agents/panels/placeholder-panel'
import { ChangesPanel } from '../agents/panels/changes-panel'
import { TerminalPanel } from '../agents/panels/terminal-panel'
import { SitesListView } from './activity/sites-list'
import { SitesChatPanel } from './panels/chat-panel'
import { SitesFilesPanel } from './panels/files-panel'
import { SitesBrowserPanel } from './panels/browser-panel'
import { SitesDataPanel } from './panels/data-panel'
import { SitesPlanPanel } from './panels/plan-panel'
import { selectedSiteAtom } from './store'

/** Changes panel scoped to the selected site's project directory. */
function SitesChangesPanel() {
  const site = useAtomValue(selectedSiteAtom)
  return <ChangesPanel cwd={site?.path ?? null} />
}

/** Terminal panel scoped to the selected site's project directory. */
function SitesTerminalPanel() {
  const site = useAtomValue(selectedSiteAtom)
  return <TerminalPanel cwd={site?.path ?? null} />
}

/** Open the selected site's project in VS Code (no-op when none selected). */
function SitesVSCodePanel() {
  const site = useAtomValue(selectedSiteAtom)
  if (!site?.path) {
    return (
      <PlaceholderPanel
        title="VS Code"
        description="Select a site to open its workspace in VS Code."
      />
    )
  }
  return <TerminalPanel cwd={site.path} initialCommand="code ." />
}

/**
 * Sites (建站) — matches kandev Design advanced dock:
 * Activity site list | Chat | right (Files/Changes/Browser/Data/Plan + Terminal/VS Code).
 */
export const sitesModule: WorkbenchModule = {
  id: 'sites',
  title: 'Sites',
  icon: <Globe className="h-4 w-4" />,
  order: 65,
  defaultLayout: {
    columns: [
      {
        // Keep column ids module-scoped — do not reuse Agents panel id `chat`.
        id: 'sites-chat-col',
        width: 0.55,
        groups: [
          {
            id: 'group-sites-chat',
            panels: [{ id: 'sites-chat', component: 'sites-chat', title: 'Chat' }],
          },
        ],
      },
      {
        id: 'sites-right',
        width: 0.45,
        groups: [
          {
            id: 'group-sites-right-top',
            panels: [
              { id: 'sites-files', component: 'sites-files', title: 'Files' },
              { id: 'sites-changes', component: 'sites-changes', title: 'Changes' },
              { id: 'sites-browser', component: 'sites-browser', title: 'Browser' },
              { id: 'sites-data', component: 'sites-data', title: 'Data' },
              { id: 'sites-plan', component: 'sites-plan', title: 'Plan' },
            ],
          },
          {
            id: 'group-sites-right-bottom',
            panels: [
              { id: 'sites-terminal', component: 'sites-terminal', title: 'Terminal' },
              { id: 'sites-vscode', component: 'sites-vscode', title: 'VS Code' },
            ],
          },
        ],
      },
    ],
  },
  panels: [
    {
      component: 'sites-chat',
      title: 'Chat',
      singleton: true,
      render: () => (
        <PanelErrorBoundary panelName="Sites Chat">
          <SitesChatPanel />
        </PanelErrorBoundary>
      ),
    },
    {
      component: 'sites-files',
      title: 'Files',
      singleton: true,
      render: () => (
        <PanelErrorBoundary panelName="Sites Files">
          <SitesFilesPanel />
        </PanelErrorBoundary>
      ),
    },
    {
      component: 'sites-changes',
      title: 'Changes',
      singleton: true,
      render: () => (
        <PanelErrorBoundary panelName="Sites Changes">
          <SitesChangesPanel />
        </PanelErrorBoundary>
      ),
    },
    {
      component: 'sites-browser',
      title: 'Browser',
      singleton: true,
      render: () => (
        <PanelErrorBoundary panelName="Sites Browser">
          <SitesBrowserPanel />
        </PanelErrorBoundary>
      ),
    },
    {
      component: 'sites-data',
      title: 'Data',
      singleton: true,
      render: () => (
        <PanelErrorBoundary panelName="Sites Data">
          <SitesDataPanel />
        </PanelErrorBoundary>
      ),
    },
    {
      component: 'sites-plan',
      title: 'Plan',
      singleton: true,
      render: () => (
        <PanelErrorBoundary panelName="Sites Plan">
          <SitesPlanPanel />
        </PanelErrorBoundary>
      ),
    },
    {
      component: 'sites-terminal',
      title: 'Terminal',
      singleton: true,
      render: () => (
        <PanelErrorBoundary panelName="Sites Terminal">
          <SitesTerminalPanel />
        </PanelErrorBoundary>
      ),
    },
    {
      component: 'sites-vscode',
      title: 'VS Code',
      singleton: true,
      render: () => (
        <PanelErrorBoundary panelName="Sites VS Code">
          <SitesVSCodePanel />
        </PanelErrorBoundary>
      ),
    },
  ],
  activityView: SitesListView,
}
