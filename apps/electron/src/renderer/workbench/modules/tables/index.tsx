import { Table2 } from 'lucide-react'
import type { WorkbenchModule } from '../../registry/types'
import { SourceListView } from './activity/source-list-view'
import { TablesGridPanel } from './panels/grid-panel'

/**
 * Tables workbench module — spreadsheet preview over the plydb-based sidecar.
 * Data via Admin HTTP (`tablesFetch` IPC); agents use the Tables MCP source.
 */
export const tablesModule: WorkbenchModule = {
  id: 'tables',
  title: 'Tables',
  icon: <Table2 className="h-4 w-4" />,
  order: 55,
  defaultLayout: {
    columns: [
      {
        id: 'center',
        width: 1,
        groups: [
          {
            id: 'group-tables',
            panels: [{ id: 'tables-grid', component: 'tables-grid', title: 'Tables' }],
          },
        ],
      },
    ],
  },
  panels: [
    {
      component: 'tables-grid',
      title: 'Tables',
      singleton: true,
      render: () => <TablesGridPanel />,
    },
  ],
  activityView: SourceListView,
}
