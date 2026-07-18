import { Globe } from 'lucide-react'
import type { WorkbenchModule } from '../../registry/types'
import { SitesListView } from './activity/sites-list'
import { SitesChatPanel } from './panels/chat-panel'
import { SitesFilesPanel } from './panels/files-panel'
import { SitesPreviewPanel } from './panels/preview-panel'

/** Sites (建站) workbench module — Chat | Files | Preview via grose-modules. */
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
        width: 0.32,
        groups: [
          {
            id: 'group-sites-chat',
            panels: [{ id: 'sites-chat', component: 'sites-chat', title: 'Chat' }],
          },
        ],
      },
      {
        id: 'sites-files-col',
        width: 0.28,
        groups: [
          {
            id: 'group-sites-files',
            panels: [{ id: 'sites-files', component: 'sites-files', title: 'Files' }],
          },
        ],
      },
      {
        id: 'sites-preview-col',
        width: 0.4,
        groups: [
          {
            id: 'group-sites-preview',
            panels: [{ id: 'sites-preview', component: 'sites-preview', title: 'Preview' }],
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
      render: () => <SitesChatPanel />,
    },
    {
      component: 'sites-files',
      title: 'Files',
      singleton: true,
      render: () => <SitesFilesPanel />,
    },
    {
      component: 'sites-preview',
      title: 'Preview',
      singleton: true,
      render: () => <SitesPreviewPanel />,
    },
  ],
  activityView: SitesListView,
}
