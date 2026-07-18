/**
 * Connectors workbench module — Open Connector management console.
 * Sections: Overview / Providers / Actions / Runs / Access
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { atom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { Cable } from 'lucide-react'
import type { WorkbenchModule } from '../../registry/types'
import { OpenConnectorNavigator } from './OpenConnectorNavigator'
import { OpenConnectorPage } from './OpenConnectorPage'
import { useOpenConnectorRuntime } from './useOpenConnectorRuntime'
import { ActivityShell } from '../../shell/ActivityShell'
import type { OpenConnectorSection } from './types'

export type { OpenConnectorSection } from './types'

export const connectorSectionAtom = atom<OpenConnectorSection>('overview')
export const connectorSelectedServiceAtom = atom<string | null>(null)
export const connectorSelectedActionIdAtom = atom<string | null>(null)

function ConnectorsActivityView() {
  const { t } = useTranslation()
  const [section, setSection] = useAtom(connectorSectionAtom)
  const runtime = useOpenConnectorRuntime(true)
  const ready = runtime.status?.ready === true
  const starting = runtime.status?.starting === true

  return (
    <ActivityShell title={t('sidebar.openConnector')} scroll={false} bodyClassName="overflow-hidden">
      <OpenConnectorNavigator
        selectedSection={section}
        runtimeReady={ready}
        runtimeStarting={starting}
        onSelectSection={setSection}
      />
    </ActivityShell>
  )
}

function ConnectorsDetailPanel() {
  const section = useAtomValue(connectorSectionAtom)
  const setSection = useSetAtom(connectorSectionAtom)
  const [selectedService, setSelectedService] = useAtom(connectorSelectedServiceAtom)
  const [selectedActionId, setSelectedActionId] = useAtom(connectorSelectedActionIdAtom)

  return (
    <OpenConnectorPage
      section={section}
      selectedService={selectedService}
      selectedActionId={selectedActionId}
      onNavigateSection={setSection}
      onSelectService={setSelectedService}
      onSelectAction={setSelectedActionId}
    />
  )
}

export const connectorsModule: WorkbenchModule = {
  id: 'connectors',
  title: 'Connectors',
  icon: <Cable className="h-4 w-4" />,
  order: 92,
  placement: 'footer',
  defaultLayout: {
    columns: [
      {
        id: 'center',
        width: 1,
        groups: [
          {
            id: 'group-connectors',
            panels: [
              {
                id: 'connectors-console',
                component: 'connectors-console',
                title: 'Connectors',
              },
            ],
          },
        ],
      },
    ],
  },
  panels: [
    {
      component: 'connectors-console',
      title: 'Connectors',
      singleton: true,
      render: () => <ConnectorsDetailPanel />,
    },
  ],
  activityView: ConnectorsActivityView,
}
